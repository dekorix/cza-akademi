/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verifyP2Evidence } from '../scripts/faz3/verify-p2-evidence.mjs';
import { verifyP3Acceptance } from '../scripts/faz3/verify-p3-acceptance.mjs';

const [evidenceBytes, p2Bytes, manifestBytes, policyBytes, callerWorkflow, reusableWorkflow, prereq, ledger] = await Promise.all([
  readFile('delivery/p3/CZA_Faz3_P3_Staging_Acceptance.json'),
  readFile('delivery/p2/CZA_Faz3_P2_Real_Staging_Evidence.json'),
  readFile('delivery/CZA_Faz3_Delivery_Manifest_v4.json'),
  readFile('security/faz3/oidc/p1-neon-runtime-policy.json'),
  readFile('.github/workflows/faz3-p1-provision.yml', 'utf8'),
  readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8'),
  readFile('db/migrations/20260912_staging_core_prerequisites_v1.sql'),
  readFile('db/migrations/20260913_canonical_learning_ledger_v1.sql'),
]);
const evidence = JSON.parse(evidenceBytes.toString('utf8'));
const p2 = JSON.parse(p2Bytes.toString('utf8'));
const policy = JSON.parse(policyBytes.toString('utf8'));
const p2Verification = verifyP2Evidence(p2, {
  manifestBytes,
  policy,
  reusableWorkflow: `${callerWorkflow}\n${reusableWorkflow}`,
});
const context = {
  p2Bytes,
  p2Verification,
  migrationFiles: new Map([
    ['db/migrations/20260912_staging_core_prerequisites_v1.sql', prereq],
    ['db/migrations/20260913_canonical_learning_ledger_v1.sql', ledger],
  ]),
};
const verify = candidate => verifyP3Acceptance(candidate, context);

test('exact P3 staging acceptance evidence passes', () => {
  assert.deepEqual(verify(evidence), {
    result: 'PASS',
    projectId: 'orange-resonance-01270480',
    migrationIdempotent: true,
    readWriteSmoke: 'PASS',
    transactionRollback: 'PASS',
    productionAccessed: false,
    productionMutation: false,
    p2Regression: 'PASS',
    secretScan: 'PASS',
  });
});

test('migration drift and wrong file digest fail closed', () => {
  const drift = structuredClone(evidence);
  drift.migration.secondSchemaSha256 = '0'.repeat(64);
  assert.throws(() => verify(drift), /P3_SCHEMA_DRIFT_ON_SECOND_APPLY/);

  const digest = structuredClone(evidence);
  digest.migration.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => verify(digest), /P3_MIGRATION_FILE_DIGEST_MISMATCH/);
});

test('failed read/write, rollback, authz or immutability fails closed', () => {
  const mutations = [
    candidate => { candidate.acceptance.readWriteSmoke = 'FAIL'; },
    candidate => { candidate.acceptance.transactionRollback.residualRows = 1; },
    candidate => { candidate.acceptance.authz.runtimeDirectLedgerSelect = true; },
    candidate => { candidate.acceptance.immutableLedger.result = 'FAIL'; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(evidence);
    mutate(candidate);
    assert.throws(() => verify(candidate));
  }
});

test('non-synthetic or outside-staging data fails closed', () => {
  const realData = structuredClone(evidence);
  realData.demoFlow.dataClass = 'student_data';
  assert.throws(() => verify(realData), /P3_NON_SYNTHETIC_DATA/);

  const outside = structuredClone(evidence);
  outside.demoFlow.writtenOutsideStaging = true;
  assert.throws(() => verify(outside), /P3_WRITE_OUTSIDE_STAGING/);
});

test('production access or mutation fails closed', () => {
  for (const field of ['productionAccessed', 'productionMutation']) {
    const candidate = structuredClone(evidence);
    candidate.security[field] = true;
    assert.throws(() => verify(candidate), /P3_PRODUCTION_/);
  }
});

test('unsupported profile or deployment claims fail closed', () => {
  const profile = structuredClone(evidence);
  profile.demoFlow.profileHistory.materializedProfileTableClaimed = true;
  assert.throws(() => verify(profile), /P3_UNSUPPORTED_PROFILE_CLAIM/);

  const deploy = structuredClone(evidence);
  deploy.applicationReadiness.deployedHttpEndpointClaimed = true;
  assert.throws(() => verify(deploy), /P3_UNPROVEN_DEPLOYMENT_CLAIM/);
});

test('secret-shaped material is rejected', () => {
  const candidate = structuredClone(evidence);
  candidate.security.databaseUrl = 'redacted-fixture';
  assert.throws(() => verify(candidate), /P3_SECRET_FIELD_PRESENT/);
});

test('P2 evidence digest remains bound to the approved baseline', () => {
  assert.equal(
    createHash('sha256').update(p2Bytes).digest('hex'),
    evidence.p2Baseline.evidenceSha256,
  );
  assert.equal(p2Verification.result, 'PASS');
});
