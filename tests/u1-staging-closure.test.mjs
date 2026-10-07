/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [evidenceBytes, migration] = await Promise.all([
  readFile('delivery/CZA_U1_Staging_Closure.json'),
  readFile('db/migrations/20260916_u1_student_panel_core_v1.sql', 'utf8'),
]);
const evidence = JSON.parse(evidenceBytes.toString('utf8'));

test('U1 staging closure is bound to the approved staging target', () => {
  assert.equal(evidence.schemaVersion, 'CZA-U1-STAGING-CLOSURE-V1');
  assert.equal(
    evidence.sourceCandidate.commit,
    '578711c46fbea33981ef9fa68d772f8ce4f03177',
  );
  assert.equal(evidence.target.environment, 'staging');
  assert.equal(evidence.target.organizationId, 'org-silent-boat-09386886');
  assert.equal(evidence.target.projectId, 'orange-resonance-01270480');
  assert.equal(evidence.security.stagingOnly, true);
  assert.equal(evidence.security.productionAccessed, false);
  assert.equal(evidence.security.productionMutation, false);
});

test('live U1 migration evidence is additive and idempotent', () => {
  assert.equal(
    createHash('sha256').update(migration).digest('hex'),
    evidence.migration.sha256,
  );
  assert.doesNotMatch(
    migration,
    /\b(?:drop|truncate)\b|\bdelete\s+from\b|\balter\s+table\b[^;]*\bdrop\b/i,
  );
  assert.equal(evidence.migration.additiveOnly, true);
  assert.equal(evidence.migration.destructiveSqlMatches, 0);
  assert.equal(
    evidence.migration.firstSchemaSha256,
    evidence.migration.secondSchemaSha256,
  );
  assert.equal(evidence.migration.idempotent, true);
});

test('live staging demo chain reaches history and learning profile', () => {
  const flow = evidence.demoFlow;
  assert.equal(flow.dataClass, 'synthetic_demo');
  assert.equal(flow.allStudentsMarkedDemo, true);
  assert.equal(flow.writtenOutsideStaging, false);
  for (const stage of [
    flow.identity,
    flow.assignment,
    flow.attemptResult,
    flow.errorEvidence,
    flow.history,
    flow.learningProfile,
  ]) {
    assert.equal(stage.result, 'PASS');
  }
  assert.equal(flow.history.entryCount, 2);
  assert.equal(flow.history.allEntriesStudentScoped, true);
  assert.deepEqual(
    flow.learningProfile.progression.map((item) => item.scorePercent),
    [50, 100],
  );
});

test('cross-student and failed-write probes left no partial records', () => {
  const negative = evidence.negativeTests;
  assert.equal(negative.crossStudent.result, 'PASS');
  assert.equal(negative.crossStudent.foreignAssignmentRows, 0);
  assert.equal(negative.crossStudent.foreignRecordRows, 0);
  assert.equal(negative.crossStudent.foreignAttemptRows, 0);
  assert.equal(negative.failedWriteRollback.result, 'PASS');
  assert.equal(negative.failedWriteRollback.sentinelRecipeRows, 0);
  assert.equal(negative.failedWriteRollback.partialAttemptRows, 0);
  assert.equal(negative.idempotency.secondReplayed, true);
});

test('closure does not overclaim preview deployment or persist secrets', () => {
  assert.equal(evidence.applicationVerification.productionBuild, 'PASS');
  assert.equal(evidence.applicationVerification.dashboardRouteBuilt, true);
  assert.equal(evidence.applicationVerification.deployedPreviewClaimed, false);
  assert.equal(evidence.applicationVerification.newHostingCreated, false);
  assert.equal(evidence.security.credentialValuesPersisted, false);
  assert.equal(evidence.security.temporaryEnvironmentFileRemoved, true);

  const serialized = evidenceBytes.toString('utf8');
  assert.doesNotMatch(
    serialized,
    /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/,
  );
  assert.doesNotMatch(serialized, /\bgh[pousr]_[A-Za-z0-9]{20,}\b/);
  assert.doesNotMatch(
    serialized,
    /\b(?:postgres|postgresql):\/\/[^\s:@/]+:[^\s@/]+@/i,
  );
});
