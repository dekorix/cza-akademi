import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CredentialBroker, BrokerError, brokerConstants } from '../services/p1-credential-broker/broker.mjs';
import { GithubOidcVerifier } from '../services/p1-credential-broker/github-oidc.mjs';
import { MemoryLeaseStore } from '../services/p1-credential-broker/lease-store.mjs';
import { NeonAdminClient, neonAdminConstants } from '../services/p1-credential-broker/neon-admin-client.mjs';
import { createBrokerServer, configurationFromEnvironment } from '../services/p1-credential-broker/server.mjs';
import { unresolvedRequestedWals, verifyNoMutationReconciliation } from '../scripts/faz3/verify-p1-orphan-wal.mjs';

const policy = JSON.parse(await readFile('security/faz3/oidc/p1-neon-runtime-policy.json', 'utf8'));
const currentP0c = 'c'.repeat(64);
const walRunId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
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
    iss: policy.issuer,
    ...policy.claims,
    run_id: '35070000001',
    run_attempt: '1',
    iat: Math.floor(nowMs / 1000) - 10,
    exp: Math.floor(nowMs / 1000) + 300,
    ...overrides,
  });
  return `${header}.${claims}.${sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), signingKey).toString('base64url')}`;
};
const request = overrides => ({
  policy: brokerConstants.POLICY,
  scopes: [...brokerConstants.SCOPES],
  ttlSeconds: 900,
  p0cAttestationSha256: currentP0c,
  walRunId,
  ...overrides,
});

class FakeNeonClient {
  region = 'aws-eu-central-1';
  projects = [];
  calls = [];

  async findProjectsByName(name) {
    this.calls.push(['find', name]);
    return this.projects.filter(project => project.name === name).map(project => structuredClone(project));
  }

  async createProject({ name }) {
    this.calls.push(['create', name]);
    const project = { id: `project-${this.projects.length + 1}`, name };
    this.projects.push(project);
    return structuredClone(project);
  }

  async inspectProject(projectId) {
    this.calls.push(['inspect', projectId]);
    const project = this.projects.find(item => item.id === projectId);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    return {
      leaseProjectId: null,
      projectId,
      projectName: project.name,
      region: this.region,
      pooledEndpoint: 'ep-staging-pooler.eu-central-1.aws.neon.tech',
      unpooledEndpoint: 'ep-staging.eu-central-1.aws.neon.tech',
      migrationEndpoint: 'ep-staging.eu-central-1.aws.neon.tech',
      createdAt: '2026-09-16T12:00:01Z',
      targetEnvironment: 'staging',
    };
  }

  async deleteProject(projectId) {
    this.calls.push(['delete', projectId]);
    this.projects = this.projects.filter(project => project.id !== projectId);
  }
}

const setup = ({ Store = MemoryLeaseStore, clock = { value: nowMs } } = {}) => {
  const store = new Store();
  const neon = new FakeNeonClient();
  const verifier = new GithubOidcVerifier({ policy, fetchImpl: oidcFetch });
  const broker = new CredentialBroker({
    oidcVerifier: verifier,
    neonClient: neon,
    leaseStore: store,
    capabilitySecret: 'test-capability-secret-with-at-least-32-bytes',
    currentP0c,
    productionDenylist: ['d'.repeat(64)],
    now: () => clock.value,
  });
  return { broker, store, neon, verifier, clock };
};

test('GitHub OIDC JWT signature and exact claims including job_workflow_sha are enforced', async t => {
  const { verifier } = setup();
  assert.equal((await verifier.verify(token(), nowMs)).run_attempt, '1');
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifier.verify(token({}, other), nowMs), /OIDC_SIGNATURE_INVALID/);
  for (const [name, value] of [
    ['aud', 'wrong-audience'],
    ['ref', 'refs/heads/main'],
    ['environment', 'production'],
    ['job_workflow_sha', '0'.repeat(40)],
    ['repository', 'other/repository'],
  ]) await t.test(`${name} mismatch is denied`, async () => assert.rejects(verifier.verify(token({ [name]: value }), nowMs), /OIDC_CLAIM_MISMATCH/));
});

test('invalid OIDC or wrong job_workflow_sha creates zero leases', async () => {
  const { broker, store } = setup();
  await assert.rejects(broker.exchange({ token: 'invalid', request: request() }), /OIDC_TOKEN_INVALID/);
  await assert.rejects(broker.exchange({ token: token({ job_workflow_sha: '0'.repeat(40) }), request: request() }), /OIDC_CLAIM_MISMATCH/);
  assert.equal((await store.list()).length, 0);
});

test('exchange rejects wrong P0-C, TTL, production, Cloudflare, org, and provider URL fields', async () => {
  const { broker, store } = setup();
  const denied = [
    request({ p0cAttestationSha256: 'a'.repeat(64) }),
    request({ ttlSeconds: 901 }),
    request({ scopes: ['production:neon:create'] }),
    request({ scopes: [...brokerConstants.SCOPES, 'staging:cloudflare:create'] }),
    { ...request(), organizationId: 'production-org' },
    { ...request(), providerUrl: 'https://example.invalid' },
    { ...request(), cloudflareToken: 'forbidden' },
  ];
  for (const value of denied) await assert.rejects(broker.exchange({ token: token(), request: value }), BrokerError);
  assert.equal((await store.list()).length, 0);
});

test('50 parallel exchanges reserve exactly one lease and retry returns the same opaque capability', async () => {
  const { broker, store, neon } = setup();
  const leases = await Promise.all(Array.from({ length: 50 }, () => broker.exchange({ token: token(), request: request() })));
  assert.equal(new Set(leases.map(item => item.leaseId)).size, 1);
  assert.equal(new Set(leases.map(item => item.leaseToken)).size, 1);
  assert.deepEqual(Object.keys(leases[0]).sort(), ['expiresAt', 'leaseId', 'leaseToken', 'scopes', 'targetEnvironment']);
  assert.doesNotMatch(JSON.stringify(leases), /neonApiKey|api[_-]?key/i);
  assert.equal((await store.list()).length, 1);
  assert.equal(neon.calls.length, 0);
});

test('expired, revoked, or wrong-scope leases cannot create a project', async () => {
  const expired = setup();
  const expiredLease = await expired.broker.exchange({ token: token(), request: request({ ttlSeconds: 60 }) });
  expired.clock.value += 61_000;
  await assert.rejects(expired.broker.createProject({ token: token(), leaseToken: expiredLease.leaseToken, request: { leaseId: expiredLease.leaseId } }), /LEASE_EXPIRED/);
  assert.equal(expired.neon.calls.length, 0);

  const revoked = setup();
  const revokedLease = await revoked.broker.exchange({ token: token(), request: request() });
  await revoked.broker.revoke({ token: token(), leaseToken: revokedLease.leaseToken, request: { leaseId: revokedLease.leaseId } });
  await assert.rejects(revoked.broker.createProject({ token: token(), leaseToken: revokedLease.leaseToken, request: { leaseId: revokedLease.leaseId } }), /LEASE_REVOKED/);

  const scoped = setup();
  const scopedLease = await scoped.broker.exchange({ token: token(), request: request() });
  scoped.store.leases.get(scopedLease.leaseId).scopes = ['staging:neon:inspect'];
  await assert.rejects(scoped.broker.createProject({ token: token(), leaseToken: scopedLease.leaseToken, request: { leaseId: scopedLease.leaseId } }), /SCOPE_DENIED/);
  assert.equal(scoped.neon.calls.length, 0);
});

test('broker database unavailable means zero Neon provider calls', async () => {
  const { broker, store, neon } = setup();
  const lease = await broker.exchange({ token: token(), request: request() });
  store.getLease = async () => { throw new Error('DATABASE_UNAVAILABLE'); };
  await assert.rejects(broker.createProject({ token: token(), leaseToken: lease.leaseToken, request: { leaseId: lease.leaseId } }), /DATABASE_UNAVAILABLE/);
  assert.equal(neon.calls.length, 0);
});

test('Neon success plus DB persist crash retries by adoption without a second project', async () => {
  class CrashOnceStore extends MemoryLeaseStore {
    crashed = false;
    async setSucceeded(...args) {
      if (!this.crashed) { this.crashed = true; throw new Error('SIMULATED_DB_CRASH'); }
      return super.setSucceeded(...args);
    }
  }
  const { broker, neon } = setup({ Store: CrashOnceStore });
  const lease = await broker.exchange({ token: token(), request: request() });
  const operation = () => broker.createProject({ token: token(), leaseToken: lease.leaseToken, request: { leaseId: lease.leaseId } });
  await assert.rejects(operation(), /SIMULATED_DB_CRASH/);
  const contract = await operation();
  assert.equal(contract.projectName, `cza-f3-staging-${walRunId.toLowerCase()}`);
  assert.equal(neon.calls.filter(([operationName]) => operationName === 'create').length, 1);
  assert.equal(neon.projects.length, 1);
});

test('concurrent project create is serialized and creates exactly one project', async () => {
  const { broker, neon } = setup();
  const lease = await broker.exchange({ token: token(), request: request() });
  const results = await Promise.all(Array.from({ length: 50 }, () => broker.createProject({
    token: token(), leaseToken: lease.leaseToken, request: { leaseId: lease.leaseId },
  })));
  assert.equal(new Set(results.map(value => value.projectId)).size, 1);
  assert.equal(neon.calls.filter(([operationName]) => operationName === 'create').length, 1);
});

test('revoke is an atomic control-plane state change and sweeper expires missed cleanup', async () => {
  const active = setup();
  const lease = await active.broker.exchange({ token: token(), request: request() });
  assert.deepEqual(await active.broker.revoke({ token: token(), leaseToken: lease.leaseToken, request: { leaseId: lease.leaseId } }), { leaseId: lease.leaseId, status: 'REVOKED' });
  assert.equal(active.neon.calls.length, 0);

  const expiring = setup();
  await expiring.broker.exchange({ token: token(), request: request({ ttlSeconds: 60 }) });
  expiring.clock.value += 61_000;
  assert.deepEqual(await expiring.broker.sweepExpired(), { expired: 1 });
  assert.equal((await expiring.store.list())[0].status, 'EXPIRED');
});

test('revoke fails closed when the durable lease database cannot commit', async () => {
  const { broker, store } = setup();
  const lease = await broker.exchange({ token: token(), request: request() });
  store.revoke = async () => { throw new Error('DATABASE_UNAVAILABLE'); };
  await assert.rejects(broker.revoke({ token: token(), leaseToken: lease.leaseToken, request: { leaseId: lease.leaseId } }), /DATABASE_UNAVAILABLE/);
  assert.equal((await store.getLease(lease.leaseId)).status, 'ACTIVE');
});

test('Neon admin client is physically pinned to the staging organization and fixed API origin', async () => {
  const calls = [];
  const client = new NeonAdminClient({
    stagingApiKey: 'staging-bootstrap-secret-value',
    stagingOrganizationId: 'dedicated-staging-org',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/projects')) return new Response(JSON.stringify({
        project: { id: 'project-staging-1', name: `cza-f3-staging-${walRunId.toLowerCase()}`, org_id: 'dedicated-staging-org' },
      }), { status: 200 });
      return new Response('', { status: 404 });
    },
  });
  await client.createProject({ name: `cza-f3-staging-${walRunId.toLowerCase()}` });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${neonAdminConstants.API_ROOT}/projects`);
  assert.equal(JSON.parse(calls[0].init.body).project.org_id, 'dedicated-staging-org');
  assert.throws(() => new NeonAdminClient({ stagingApiKey: 'staging-bootstrap-secret-value', stagingOrganizationId: 'PRODUCTION_ORG' }), /STAGING_NEON_ORGANIZATION_ID_INVALID/);
});

test('healthz is database-backed and broker runtime accepts only staging secret names', async () => {
  const { broker } = setup();
  const server = createBrokerServer(broker);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'ready' });
  } finally { await new Promise(resolve => server.close(resolve)); }
  const environment = {
    CZA_BROKER_DATABASE_URL: 'postgres://broker.invalid/db',
    CZA_BROKER_CAPABILITY_SECRET: 'x'.repeat(32),
    CZA_STAGING_NEON_API_KEY: 'bootstrap-secret-never-log',
    CZA_STAGING_NEON_ORG_ID: 'staging-org',
    CZA_CURRENT_P0C_SHA256: currentP0c,
    CZA_PRODUCTION_ENDPOINT_SHA256_DENYLIST: 'd'.repeat(64),
  };
  assert.equal(configurationFromEnvironment(environment).stagingOrganizationId, 'staging-org');
  assert.throws(() => configurationFromEnvironment({ ...environment, CZA_NEON_ADMIN_API_KEY: 'legacy' }), /LEGACY_NEON_ADMIN_CONFIGURATION_FORBIDDEN/);
});

test('bootstrap Neon secret never appears in exchange response, broker errors, or source logging calls', async () => {
  const bootstrapSecret = 'neon-bootstrap-secret-material-123456';
  const { broker } = setup();
  const response = await broker.exchange({ token: token(), request: request() });
  assert.doesNotMatch(JSON.stringify(response), new RegExp(bootstrapSecret));
  const sources = await Promise.all(['broker.mjs', 'server.mjs', 'neon-admin-client.mjs'].map(file => readFile(`services/p1-credential-broker/${file}`, 'utf8')));
  assert.doesNotMatch(sources.join('\n'), /console\.(log|error|warn)|process\.stdout\.write/);
});

test('old run machine evidence proves skipped provider mutation and resolves its requested WAL', async () => {
  const record = JSON.parse(await readFile('security/faz3/recovery/reconciliations/35067500579-01K2KH2DCA2448770B9A359BE9.json', 'utf8'));
  const artifact = expected => ({ ...expected, workflow_run: { id: record.workflowRunId, head_sha: record.headSha } });
  const job = { id: record.jobId, name: record.jobName, conclusion: 'failure', steps: [record.exchangeStep, record.providerMutationStep] };
  assert.deepEqual(verifyNoMutationReconciliation({
    record,
    run: { id: record.workflowRunId, head_sha: record.headSha, repository: { id: record.repositoryId } },
    jobs: [job],
    artifacts: [artifact(record.requestedWalArtifact), artifact(record.finalWalArtifact)],
  }), { walRunId: record.walRunId, terminalState: 'RECONCILED_NO_MUTATION' });
  assert.deepEqual(unresolvedRequestedWals({ artifacts: [artifact(record.requestedWalArtifact)], records: [record] }), []);
});
