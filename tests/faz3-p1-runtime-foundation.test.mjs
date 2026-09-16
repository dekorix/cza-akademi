import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CredentialBroker, BrokerError, brokerConstants } from '../services/p1-credential-broker/broker.mjs';
import { GithubOidcVerifier } from '../services/p1-credential-broker/github-oidc.mjs';
import { MemoryLeaseStore } from '../services/p1-credential-broker/lease-store.mjs';
import { createBrokerServer } from '../services/p1-credential-broker/server.mjs';
import { unresolvedRequestedWals, verifyNoMutationReconciliation } from '../scripts/faz3/verify-p1-orphan-wal.mjs';

const policy = JSON.parse(await readFile('security/faz3/oidc/p1-neon-runtime-policy.json', 'utf8'));
const currentP0c = 'c'.repeat(64);
const nowMs = Date.parse('2026-09-16T12:00:00Z');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
const discovery = { issuer: policy.issuer, jwks_uri: `${policy.issuer}/.well-known/jwks` };
const oidcFetch = async url => {
  const value = String(url);
  if (value.endsWith('/.well-known/openid-configuration')) return new Response(JSON.stringify(discovery), { status: 200 });
  if (value === discovery.jwks_uri) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  return new Response('', { status: 404 });
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = (overrides = {}, signingKey = privateKey) => {
  const header = encode({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' });
  const claims = encode({
    iss: policy.issuer, ...policy.claims, run_id: '35070000001',
    iat: Math.floor(nowMs / 1000) - 10, exp: Math.floor(nowMs / 1000) + 300, ...overrides,
  });
  return `${header}.${claims}.${sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), signingKey).toString('base64url')}`;
};
const request = overrides => ({
  policy: brokerConstants.POLICY,
  scopes: [...brokerConstants.SCOPES],
  ttlSeconds: 900,
  p0cAttestationSha256: currentP0c,
  ...overrides,
});

class FakeNeonClient {
  created = [];
  revoked = [];
  async createRunKey({ runId }) {
    this.created.push(runId);
    return { keyId: 73, apiKey: 'neon_run_scoped_key_1234567890' };
  }
  async revokeRunKey(keyId) { this.revoked.push(keyId); }
}

const setup = () => {
  const store = new MemoryLeaseStore();
  const neon = new FakeNeonClient();
  const verifier = new GithubOidcVerifier({ policy, fetchImpl: oidcFetch });
  const broker = new CredentialBroker({
    oidcVerifier: verifier, neonClient: neon, leaseStore: store, currentP0c,
    productionDenylist: ['d'.repeat(64)], now: () => nowMs,
  });
  return { broker, store, neon, verifier };
};

test('GitHub OIDC JWT signature and every exact runtime claim are enforced', async t => {
  const { verifier } = setup();
  assert.equal((await verifier.verify(token(), nowMs)).run_id, '35070000001');
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifier.verify(token({}, other), nowMs), /OIDC_SIGNATURE_INVALID/);
  for (const [name, value] of [
    ['aud', 'wrong-audience'],
    ['ref', 'refs/heads/main'],
    ['environment', 'production'],
    ['job_workflow_sha', '0'.repeat(40)],
    ['repository', 'other/repository'],
  ]) {
    await t.test(`${name} mismatch is denied`, async () => assert.rejects(verifier.verify(token({ [name]: value }), nowMs), /OIDC_CLAIM_MISMATCH/));
  }
});

test('exchange accepts only current P0-C, exact staging scopes, and TTL at most 900', async () => {
  const { broker, neon } = setup();
  await assert.rejects(broker.exchange({ token: token(), request: request({ p0cAttestationSha256: 'a'.repeat(64) }) }), error => error instanceof BrokerError && error.code === 'P0C_MISMATCH');
  await assert.rejects(broker.exchange({ token: token(), request: request({ ttlSeconds: 901 }) }), error => error.code === 'TTL_DENIED');
  await assert.rejects(broker.exchange({ token: token(), request: request({ scopes: ['production:neon:create'] }) }), error => error.code === 'SCOPE_DENIED');
  await assert.rejects(broker.exchange({ token: token(), request: request({ scopes: [...brokerConstants.SCOPES, 'staging:cloudflare:create'] }) }), error => error.code === 'SCOPE_DENIED');
  assert.equal(neon.created.length, 0);
});

test('exchange creates a run-bound lease without returning admin material and cleanup revokes it', async () => {
  const { broker, store, neon } = setup();
  const result = await broker.exchange({ token: token(), request: request() });
  assert.equal(result.credential.neonApiKey, 'neon_run_scoped_key_1234567890');
  assert.equal(Object.keys(result).some(key => /admin|bootstrap|keyId/i.test(key)), false);
  const [lease] = await store.list();
  assert.equal(lease.runId, '35070000001');
  assert.equal(lease.keyId, 73);
  assert.equal(lease.status, 'ACTIVE');
  assert.deepEqual(await broker.revoke({ token: token(), request: { leaseId: result.leaseId } }), { leaseId: result.leaseId, status: 'REVOKED' });
  assert.deepEqual(neon.revoked, [73]);
});

test('expiry sweeper revokes a lease when workflow cleanup is missed', async () => {
  let clock = nowMs;
  const store = new MemoryLeaseStore();
  const neon = new FakeNeonClient();
  const broker = new CredentialBroker({
    oidcVerifier: new GithubOidcVerifier({ policy, fetchImpl: oidcFetch }), neonClient: neon, leaseStore: store,
    currentP0c, productionDenylist: ['d'.repeat(64)], now: () => clock,
  });
  await broker.exchange({ token: token(), request: request({ ttlSeconds: 60 }) });
  clock += 61_000;
  assert.deepEqual(await broker.sweepExpired(), { revoked: 1 });
  assert.equal((await store.list())[0].status, 'EXPIRED_REVOKED');
});

test('broker exposes healthz without performing an exchange', async () => {
  const { broker, neon } = setup();
  const server = createBrokerServer(broker);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(neon.created.length, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('old run machine evidence proves skipped provider mutation and resolves its requested WAL', async () => {
  const record = JSON.parse(await readFile('security/faz3/recovery/reconciliations/35067500579-01K2KH2DCA2448770B9A359BE9.json', 'utf8'));
  const artifact = expected => ({ ...expected, workflow_run: { id: record.workflowRunId, head_sha: record.headSha } });
  const job = {
    id: record.jobId, name: record.jobName, conclusion: 'failure',
    steps: [record.exchangeStep, record.providerMutationStep],
  };
  const result = verifyNoMutationReconciliation({
    record,
    run: { id: record.workflowRunId, head_sha: record.headSha, repository: { id: record.repositoryId } },
    jobs: [job],
    artifacts: [artifact(record.requestedWalArtifact), artifact(record.finalWalArtifact)],
  });
  assert.deepEqual(result, { walRunId: record.walRunId, terminalState: 'RECONCILED_NO_MUTATION' });
  assert.deepEqual(unresolvedRequestedWals({ artifacts: [artifact(record.requestedWalArtifact)], records: [record] }), []);
  assert.equal(unresolvedRequestedWals({ artifacts: [artifact({ ...record.requestedWalArtifact, id: 999 })], records: [record] }).length, 1);
  assert.throws(() => verifyNoMutationReconciliation({
    record, run: { id: record.workflowRunId, head_sha: record.headSha, repository: { id: record.repositoryId } },
    jobs: [{ ...job, steps: [record.exchangeStep, { ...record.providerMutationStep, conclusion: 'success' }] }],
    artifacts: [artifact(record.requestedWalArtifact), artifact(record.finalWalArtifact)],
  }), /PROVIDER_MUTATION_ABSENCE_UNPROVEN/);
});

test('workflow blocks orphan WAL before proof claim and reaches REQUESTED only after broker plus tofu init', async () => {
  const workflow = await readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8');
  const positions = {
    orphan: workflow.indexOf('Reject unresolved P1 WAL before proof consumption'),
    claim: workflow.indexOf('Reject replay and create single-use claim'),
    durable: workflow.indexOf('Persist WAL_DURABLE externally before credential exchange'),
    exchange: workflow.indexOf('Exchange exact-claim OIDC token for Neon-only credential'),
    install: workflow.indexOf('Install checksum-pinned OpenTofu'),
    init: workflow.indexOf('Initialize checksum-locked Neon provider'),
    requested: workflow.indexOf('Mark REQUESTED immediately before provider mutation'),
    requestedUpload: workflow.indexOf('Persist REQUESTED WAL externally', workflow.indexOf('Mark REQUESTED immediately before provider mutation')),
    mutation: workflow.indexOf('Create only the isolated Neon staging project'),
  };
  assert.equal(Object.values(positions).every(value => value >= 0), true, JSON.stringify(positions));
  assert.equal(positions.orphan < positions.claim, true);
  assert.equal(positions.durable < positions.exchange, true);
  assert.equal(positions.exchange < positions.install && positions.install < positions.init, true);
  assert.equal(positions.init < positions.requested && positions.requested < positions.requestedUpload && positions.requestedUpload < positions.mutation, true);
  assert.doesNotMatch(workflow.slice(positions.durable, positions.requested), /--state=REQUESTED/);
  assert.doesNotMatch(workflow.slice(positions.exchange, positions.mutation), /continue-on-error:\s*true/);
  assert.match(workflow, /\/v1\/exchange/);
  assert.match(workflow, /Revoke run-bound Neon lease[\s\S]*\/v1\/revoke/);
});
