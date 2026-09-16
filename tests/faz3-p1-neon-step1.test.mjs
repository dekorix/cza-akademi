import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildP1NeonEnvironment, assertP1NeonMutationReady } from '../scripts/faz3/p1-neon-mutation-wrapper.mjs';
import { verifyP1NeonStaticGraph } from '../scripts/faz3/verify-p1-neon-static.mjs';
import { verifyP1NeonRuntimeClaims } from '../security/faz3/oidc/p1-neon-runtime-trust.mjs';

const reusableSha = '77ffa12e66c906f2ecf87d7b8b71b38f5e15fe0b';
const executionSha = '31bd150537b5ae96899ae5fd2cc63e4591035a29';
const p0c = 'a'.repeat(64);
const runId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
const nowMs = Date.parse('2026-09-16T12:00:00Z');
const policy = JSON.parse(await readFile('security/faz3/oidc/p1-neon-runtime-policy.json', 'utf8'));
const claims = { iss: policy.issuer, ...policy.claims, workflow_sha: 'f'.repeat(40) };
const credential = {
  p0cAttestationSha256: p0c,
  ttlSeconds: 900,
  expiresAt: '2026-09-16T12:30:00Z',
  scopes: ['staging:neon:create', 'staging:neon:inspect', 'staging:neon:delete'],
  targetEnvironment: 'staging',
  targetProjectNamePrefix: 'cza-f3-staging-',
  providerEndpoints: ['https://console.neon.tech/api/v2/'],
  productionEndpointSha256Denylist: ['b'.repeat(64)],
  neonApiKey: 'neon_scoped_test_key_1234567890',
};
const history = [
  { sequence: 1, state: 'PREPARED', runId },
  { sequence: 2, state: 'WAL_DURABLE', runId },
  { sequence: 3, state: 'REQUESTED', runId },
];
const root = 'infra/staging/p1-neon';
const graph = {
  main: await readFile(`${root}/main.tf`, 'utf8'),
  variables: await readFile(`${root}/variables.tf`, 'utf8'),
  versions: await readFile(`${root}/versions.tf`, 'utf8'),
  lockfile: await readFile(`${root}/.terraform.lock.hcl`, 'utf8'),
};

test('stale OIDC runtime policy fails closed', () => {
  const stale = structuredClone(policy);
  stale.claims.job_workflow_sha = '0'.repeat(40);
  assert.equal(verifyP1NeonRuntimeClaims(claims, stale), false);
});

test('wrong reusable job_workflow_sha fails closed while workflow_sha is not authoritative', () => {
  assert.equal(verifyP1NeonRuntimeClaims({ ...claims, job_workflow_sha: '1'.repeat(40) }, policy), false);
  assert.equal(verifyP1NeonRuntimeClaims({ ...claims, workflow_sha: '2'.repeat(40) }, policy), true);
});

test('wrong repository, environment, ref, or caller path/ref fails closed', () => {
  for (const [key, value] of [
    ['repository_id', '999'],
    ['environment', 'production'],
    ['ref', 'refs/heads/main'],
    ['workflow_ref', 'dekorix/cza-akademi/.github/workflows/other.yml@refs/heads/feature/faz3-gate1b-v4'],
  ]) assert.equal(verifyP1NeonRuntimeClaims({ ...claims, [key]: value }, policy), false, key);
});

test('Neon-only resource graph rejects any Cloudflare surface', () => {
  assert.throws(() => verifyP1NeonStaticGraph({ ...graph, main: `${graph.main}\nresource "cloudflare_worker" "x" {}` }), /CLOUDFLARE_SURFACE_FORBIDDEN/);
});

test('Neon-only credential contract rejects Cloudflare credentials', () => {
  assert.throws(() => buildP1NeonEnvironment({ credential: { ...credential, cloudflareApiToken: 'forbidden' }, p0c, runId, nowMs }), /CLOUDFLARE_CREDENTIAL_FORBIDDEN/);
});

test('mutation without durable WAL fails closed', () => {
  assert.throws(() => assertP1NeonMutationReady(history.slice(0, 1)), /MUTATION_BEFORE_DURABLE_WAL/);
  assert.throws(() => assertP1NeonMutationReady([history[0], history[2]]), /MUTATION_BEFORE_DURABLE_WAL/);
});

test('production or non-Neon provider host fails closed', () => {
  assert.throws(() => buildP1NeonEnvironment({ credential: { ...credential, providerEndpoints: ['https://production.neon.example/'] }, p0c, runId, nowMs }), /NEON_PROVIDER_ENDPOINT_INVALID/);
});

test('correct staging Neon-only preflight passes', () => {
  assert.equal(verifyP1NeonRuntimeClaims(claims, policy), true);
  assert.equal(assertP1NeonMutationReady(history), runId);
  assert.deepEqual(verifyP1NeonStaticGraph(graph), { result: 'PASS', resources: ['neon_project.staging'] });
  const env = buildP1NeonEnvironment({ credential, p0c, runId, nowMs, path: '/usr/bin' });
  assert.equal(env.TF_VAR_environment, 'staging');
  assert.equal(env.TF_VAR_neon_api_key, credential.neonApiKey);
  assert.equal(Object.keys(env).some(key => /cloudflare/i.test(key)), false);
});

test('caller and reusable workflow are pinned to the immutable trust layers', async () => {
  const caller = await readFile('.github/workflows/faz3-p1-provision.yml', 'utf8');
  const reusable = await readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8');
  const broker = JSON.parse(await readFile('security/faz3/oidc/credential-broker-policy.json', 'utf8'));
  assert.match(caller, new RegExp(`faz3-p1-neon-step1-reusable\\.yml@${reusableSha}`));
  assert.match(reusable, new RegExp(`ref: ${executionSha}`));
  assert.doesNotMatch(reusable, /infra\/staging\/p1-provision|provider-mutation-wrapper\.mjs|TF_VAR_cloudflare/i);
  assert.equal(policy.claims.job_workflow_sha, reusableSha);
  assert.equal(broker.requiredExactClaimsFile, 'security/faz3/oidc/p1-neon-runtime-policy.json');
  assert.equal(broker.manifestOidcAuthorization, false);
  assert.deepEqual(broker.forbiddenAuthorizationClaims, ['workflow_sha']);
});
