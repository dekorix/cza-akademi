import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { verifyP2Evidence } from '../scripts/faz3/verify-p2-evidence.mjs';

const evidence = JSON.parse(await readFile('delivery/p2/CZA_Faz3_P2_Real_Staging_Evidence.json', 'utf8'));
const manifestBytes = await readFile('delivery/CZA_Faz3_Delivery_Manifest_v4.json');
const policy = JSON.parse(await readFile('security/faz3/oidc/p1-neon-runtime-policy.json', 'utf8'));
const reusableWorkflow = `${await readFile('.github/workflows/faz3-p1-provision.yml', 'utf8')}\n${await readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8')}`;

const verify = candidate => verifyP2Evidence(candidate, { manifestBytes, policy, reusableWorkflow });

test('exact P1 real-staging evidence pack passes', () => {
  assert.deepEqual(verify(evidence), {
    result: 'PASS',
    p1RunId: 35134327735,
    walRunId: '01K2ANG8T31E2F3713704CD2B4',
    leaseRevoked: true,
    productionAccessed: false,
    productionMutation: false,
    secretScan: 'PASS',
  });
});

test('failed trust or provision job is rejected', () => {
  for (const index of [0, 1]) {
    const candidate = structuredClone(evidence);
    candidate.p1Run.jobs[index].conclusion = 'failure';
    assert.throws(() => verify(candidate), /P2_REQUIRED_JOB_NOT_SUCCESSFUL/);
  }
});

test('incomplete or reordered WAL chain is rejected', () => {
  const candidate = structuredClone(evidence);
  candidate.wal.states.splice(1, 1);
  assert.throws(() => verify(candidate), /P2_WAL_CHAIN_INVALID/);
});

test('active lease, tunnel, or GitHub broker variable is rejected', () => {
  const mutations = [
    candidate => { candidate.broker.lease.status = 'ACTIVE'; },
    candidate => { candidate.broker.publicTunnel.active = true; },
    candidate => { candidate.broker.githubVariables.environmentCount = 1; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(evidence);
    mutate(candidate);
    assert.throws(() => verify(candidate));
  }
});

test('OIDC runtime claim drift is rejected', () => {
  for (const [key, value] of [
    ['repository_id', '999'],
    ['repository_owner_id', '999'],
    ['environment', 'production'],
    ['ref', 'refs/heads/main'],
    ['event_name', 'push'],
    ['job_workflow_sha', '0'.repeat(40)],
  ]) {
    const candidate = structuredClone(evidence);
    candidate.trust.oidc.observedClaims[key] = value;
    assert.throws(() => verify(candidate), /P2_OIDC_EXACT_POLICY_MISMATCH/);
  }
});

test('staging inventory drift and production mutation signals are rejected', () => {
  const wrongOrg = structuredClone(evidence);
  wrongOrg.neon.p1Project.orgId = 'org-green-fire-42822633';
  assert.throws(() => verify(wrongOrg), /P2_P1_PROJECT_ORG_MISMATCH/);

  const productionMutation = structuredClone(evidence);
  productionMutation.security.productionMutation = true;
  assert.throws(() => verify(productionMutation), /P2_PRODUCTION_MUTATION_FORBIDDEN/);
});

test('missing replay claim is rejected', () => {
  const candidate = structuredClone(evidence);
  candidate.replayGuard.claimPresent = false;
  assert.throws(() => verify(candidate), /P2_REPLAY_CLAIM_MISSING/);
});

test('secret-shaped evidence is rejected', () => {
  const candidate = structuredClone(evidence);
  candidate.broker.lease.leaseToken = `cza_p1_${'a'.repeat(43)}`;
  assert.throws(() => verify(candidate), /P2_SECRET_FIELD_PRESENT/);
});
