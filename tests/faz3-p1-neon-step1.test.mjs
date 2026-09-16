import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertP1NeonMutationReady, validateOpaqueLease, validateStagingContract } from '../scripts/faz3/p1-neon-mutation-wrapper.mjs';
import { verifyP1NeonStaticGraph } from '../scripts/faz3/verify-p1-neon-static.mjs';
import { verifyP1NeonRuntimeClaims } from '../security/faz3/oidc/p1-neon-runtime-trust.mjs';

const reusableSha = '874c406bd1710da7af798a920c87e4982676d6ea';
const trustGateSha = 'd968805ec0901ad73fdc510ef3a501aaf6151536';
const executionSha = 'fcf41e909dfa66f6dd70cf9c947dc708142ab442';
const runId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
const leaseId = '018f47a2-4d31-7c2a-9f11-123456789abc';
const nowMs = Date.parse('2026-09-16T12:00:00Z');
const policy = JSON.parse(await readFile('security/faz3/oidc/p1-neon-runtime-policy.json', 'utf8'));
const claims = { iss: policy.issuer, ...policy.claims, workflow_sha: 'f'.repeat(40) };
const lease = {
  leaseId,
  leaseToken: `cza_p1_${'a'.repeat(43)}`,
  expiresAt: '2026-09-16T12:15:00Z',
  scopes: ['staging:neon:create', 'staging:neon:inspect', 'staging:neon:delete'],
  targetEnvironment: 'staging',
};
const contract = {
  leaseProjectId: leaseId,
  projectId: 'project-staging-1',
  projectName: `cza-f3-staging-${runId.toLowerCase()}`,
  region: 'aws-eu-central-1',
  pooledEndpoint: 'ep-staging-pooler.eu-central-1.aws.neon.tech',
  unpooledEndpoint: 'ep-staging.eu-central-1.aws.neon.tech',
  migrationEndpoint: 'ep-staging.eu-central-1.aws.neon.tech',
  createdAt: '2026-09-16T12:00:01Z',
  targetEnvironment: 'staging',
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

test('Neon-only evidence graph rejects any Cloudflare surface', () => {
  assert.throws(() => verifyP1NeonStaticGraph({ ...graph, main: `${graph.main}\nresource "cloudflare_worker" "x" {}` }), /CLOUDFLARE_SURFACE_FORBIDDEN/);
  assert.deepEqual(verifyP1NeonStaticGraph(graph), { result: 'PASS', resources: ['neon_project.staging'] });
});

test('runner accepts only an opaque broker lease and never a Neon credential', () => {
  assert.deepEqual(validateOpaqueLease(lease, { nowMs }), lease);
  assert.throws(() => validateOpaqueLease({ ...lease, neonApiKey: 'forbidden' }, { nowMs }), /OPAQUE_LEASE_INVALID/);
  assert.throws(() => validateOpaqueLease({ ...lease, cloudflareToken: 'forbidden' }, { nowMs }), /OPAQUE_LEASE_INVALID/);
});

test('mutation without durable WAL fails closed', () => {
  assert.throws(() => assertP1NeonMutationReady(history.slice(0, 1)), /MUTATION_BEFORE_DURABLE_WAL/);
  assert.throws(() => assertP1NeonMutationReady([history[0], history[2]]), /MUTATION_BEFORE_DURABLE_WAL/);
});

test('production host in returned staging contract fails closed', () => {
  assert.throws(() => validateStagingContract({ ...contract, pooledEndpoint: 'prod.db.example' }, { leaseId, runId }), /PRODUCTION_ENDPOINT_REJECTED/);
});

test('correct staging broker-proxy preflight passes', () => {
  assert.equal(verifyP1NeonRuntimeClaims(claims, policy), true);
  assert.equal(assertP1NeonMutationReady(history), runId);
  assert.deepEqual(validateOpaqueLease(lease, { nowMs }), lease);
  assert.deepEqual(validateStagingContract(contract, { leaseId, runId }), contract);
});

test('runtime workflow orders WAL and opaque lease before broker mutation and contains no provider mutation', async () => {
  const workflow = await readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8');
  const positions = {
    orphan: workflow.indexOf('Reject unresolved P1 WAL before proof consumption'),
    claim: workflow.indexOf('Reject replay and create single-use claim'),
    durable: workflow.indexOf('Persist WAL_DURABLE externally before credential exchange'),
    exchange: workflow.indexOf('Exchange exact-claim OIDC token for opaque broker lease'),
    requested: workflow.indexOf('Mark REQUESTED immediately before broker mutation'),
    requestedUpload: workflow.indexOf('Persist REQUESTED WAL externally'),
    mutation: workflow.indexOf('Create only the isolated Neon staging project through broker'),
    revoke: workflow.indexOf('Revoke run-bound broker lease and remove opaque capability'),
  };
  assert.equal(Object.values(positions).every(value => value >= 0), true, JSON.stringify(positions));
  assert.equal(positions.orphan < positions.claim, true);
  assert.equal(positions.durable < positions.exchange && positions.exchange < positions.requested, true);
  assert.equal(positions.requested < positions.requestedUpload && positions.requestedUpload < positions.mutation && positions.mutation < positions.revoke, true);
  const runtime = workflow.slice(workflow.indexOf('  provision-neon-staging-project:'));
  assert.doesNotMatch(runtime, /TF_VAR_neon_api_key|neonApiKey|tofu\s+-chdir|Install checksum-pinned OpenTofu|Initialize checksum-locked Neon provider/);
  assert.match(runtime, /\/v1\/exchange/);
  assert.match(runtime, /\/v1\/neon\/projects/);
  assert.match(runtime, /x-cza-lease-token/);
  assert.match(runtime, /\/v1\/revoke/);
});

test('caller and reusable workflow are pinned to immutable trust layers', async () => {
  const caller = await readFile('.github/workflows/faz3-p1-provision.yml', 'utf8');
  const reusable = await readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8');
  const broker = JSON.parse(await readFile('security/faz3/oidc/credential-broker-policy.json', 'utf8'));
  assert.match(caller, new RegExp(`faz3-p1-neon-step1-reusable\\.yml@${reusableSha}`));
  assert.match(reusable, new RegExp(`ref: ${trustGateSha}`));
  assert.match(reusable, new RegExp(`ref: ${executionSha}`));
  assert.doesNotMatch(reusable, /infra\/staging\/p1-provision|provider-mutation-wrapper\.mjs|TF_VAR_cloudflare/i);
  assert.equal(policy.claims.job_workflow_sha, reusableSha);
  assert.equal(broker.requiredExactClaimsFile, 'security/faz3/oidc/p1-neon-runtime-policy.json');
  assert.equal(broker.manifestOidcAuthorization, false);
  assert.deepEqual(broker.forbiddenAuthorizationClaims, ['workflow_sha']);
});
