#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifyP2Evidence } from './verify-p2-evidence.mjs';

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exact(actual, expected, code) {
  if (actual !== expected) fail(code);
}

function secretScan(value, path = '') {
  const forbiddenKeys = new Set([
    'apiKey', 'authorization', 'connectionString', 'databasePassword',
    'databaseUrl', 'githubToken', 'leaseToken', 'password', 'privateKey',
  ]);
  if (Array.isArray(value)) {
    value.forEach((item, index) => secretScan(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) fail(`P3_SECRET_FIELD_PRESENT:${path}.${key}`);
      secretScan(child, path ? `${path}.${key}` : key);
    }
    return;
  }
  if (typeof value !== 'string') return;
  const patterns = [
    /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bcza_p1_[A-Za-z0-9_-]{30,}\b/,
    /\b(?:postgres|postgresql):\/\/[^\s:@/]+:[^\s@/]+@/i,
    /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/i,
  ];
  if (patterns.some(pattern => pattern.test(value))) fail(`P3_SECRET_VALUE_PRESENT:${path}`);
}

export function verifyP3Acceptance(evidence, context) {
  exact(evidence?.schemaVersion, 'CZA-FAZ3-P3-STAGING-ACCEPTANCE-V1', 'P3_SCHEMA_INVALID');
  secretScan(evidence);

  const source = evidence.sourceCheckpoint;
  exact(source.branch, 'feature/faz3-gate1b-v4', 'P3_BRANCH_INVALID');
  exact(source.commit, '5971b294a6ec521b37f559e8b79adbf85edf4585', 'P3_SOURCE_COMMIT_INVALID');
  exact(source.tree, '48758d0c2396441dc94637a5790efad45c09efc1', 'P3_SOURCE_TREE_INVALID');
  exact(source.remoteCommit, source.commit, 'P3_SOURCE_REMOTE_MISMATCH');
  if (!SHA1.test(source.commit) || !SHA1.test(source.tree)) fail('P3_SOURCE_IDENTITY_INVALID');

  exact(evidence.p2Baseline.status, 'APPROVED', 'P3_P2_NOT_APPROVED');
  exact(evidence.p2Baseline.regression, 'PASS', 'P3_P2_REGRESSION_FAILED');
  exact(createHash('sha256').update(context.p2Bytes).digest('hex'), evidence.p2Baseline.evidenceSha256, 'P3_P2_EVIDENCE_DIGEST_MISMATCH');
  exact(context.p2Verification.result, 'PASS', 'P3_P2_REGRESSION_FAILED');

  const target = evidence.target;
  exact(target.environment, 'staging', 'P3_TARGET_NOT_STAGING');
  exact(target.organizationId, 'org-silent-boat-09386886', 'P3_STAGING_ORG_MISMATCH');
  exact(target.projectId, 'orange-resonance-01270480', 'P3_PROJECT_MISMATCH');
  exact(target.brokerControlProjectId, 'young-bar-92679633', 'P3_CONTROL_PROJECT_MISMATCH');
  if (!target.directHost.endsWith('.eu-central-1.aws.neon.tech') || target.directHost.includes('-pooler.')) fail('P3_DIRECT_HOST_INVALID');
  if (!target.pooledHost.includes('-pooler.')) fail('P3_POOLED_HOST_INVALID');

  exact(evidence.databaseHealth.connected, true, 'P3_DATABASE_NOT_CONNECTED');
  exact(evidence.databaseHealth.ready, true, 'P3_DATABASE_NOT_READY');
  exact(evidence.databaseHealth.primary, true, 'P3_DATABASE_NOT_PRIMARY');

  const migration = evidence.migration;
  exact(migration.status, 'APPLIED', 'P3_MIGRATION_NOT_APPLIED');
  exact(migration.idempotent, true, 'P3_MIGRATION_NOT_IDEMPOTENT');
  exact(migration.firstSchemaSha256, migration.secondSchemaSha256, 'P3_SCHEMA_DRIFT_ON_SECOND_APPLY');
  if (!SHA256.test(migration.firstSchemaSha256)) fail('P3_SCHEMA_DIGEST_INVALID');
  exact(migration.tableCount, 10, 'P3_TABLE_COUNT_INVALID');
  for (const file of migration.files) {
    const bytes = context.migrationFiles.get(file.path);
    if (!bytes) fail('P3_MIGRATION_FILE_MISSING');
    exact(createHash('sha256').update(bytes).digest('hex'), file.sha256, 'P3_MIGRATION_FILE_DIGEST_MISMATCH');
  }

  exact(evidence.applicationReadiness.status, 'READY', 'P3_APPLICATION_NOT_READY');
  exact(evidence.applicationReadiness.databaseFunctionsPresent, true, 'P3_DATABASE_FUNCTIONS_MISSING');
  exact(evidence.applicationReadiness.apiHandlerTargetedTests, 'PASS', 'P3_API_HANDLER_TESTS_FAILED');
  exact(evidence.applicationReadiness.deployedHttpEndpointClaimed, false, 'P3_UNPROVEN_DEPLOYMENT_CLAIM');

  exact(evidence.acceptance.readWriteSmoke, 'PASS', 'P3_READ_WRITE_FAILED');
  exact(evidence.acceptance.transactionRollback.result, 'PASS', 'P3_ROLLBACK_FAILED');
  exact(evidence.acceptance.transactionRollback.residualRows, 0, 'P3_ROLLBACK_RESIDUE');
  exact(evidence.acceptance.idempotency.result, 'PASS', 'P3_IDEMPOTENCY_FAILED');
  exact(evidence.acceptance.idempotency.firstReplayed, false, 'P3_FIRST_WRITE_REPLAYED');
  exact(evidence.acceptance.idempotency.secondReplayed, true, 'P3_REPLAY_NOT_IDEMPOTENT');
  exact(evidence.acceptance.idempotency.changedPayloadRejected, true, 'P3_CHANGED_PAYLOAD_NOT_REJECTED');
  exact(evidence.acceptance.authz.result, 'PASS', 'P3_AUTHORIZATION_FAILED');
  exact(evidence.acceptance.authz.unauthenticatedApiStatus, 401, 'P3_UNAUTHORIZED_STATUS_INVALID');
  exact(evidence.acceptance.authz.runtimeDirectLedgerSelect, false, 'P3_RUNTIME_DIRECT_LEDGER_ACCESS');
  exact(evidence.acceptance.authz.runtimeVerifiedEvidenceAppend, false, 'P3_RUNTIME_EVIDENCE_ESCALATION');
  exact(evidence.acceptance.immutableLedger.result, 'PASS', 'P3_LEDGER_MUTABLE');

  const flow = evidence.demoFlow;
  exact(flow.dataClass, 'synthetic_demo', 'P3_NON_SYNTHETIC_DATA');
  exact(flow.records.length, 2, 'P3_DEMO_HISTORY_INCOMPLETE');
  exact(flow.profileHistory.entryCount, 2, 'P3_PROFILE_HISTORY_INCOMPLETE');
  exact(flow.profileHistory.allEntriesSynthetic, true, 'P3_PROFILE_HISTORY_NOT_SYNTHETIC');
  exact(flow.profileHistory.materializedProfileTableClaimed, false, 'P3_UNSUPPORTED_PROFILE_CLAIM');
  exact(flow.writtenOutsideStaging, false, 'P3_WRITE_OUTSIDE_STAGING');

  const security = evidence.security;
  exact(security.productionAccessed, false, 'P3_PRODUCTION_ACCESS_FORBIDDEN');
  exact(security.productionMutation, false, 'P3_PRODUCTION_MUTATION_FORBIDDEN');
  exact(security.cloudflareMutation, false, 'P3_CLOUDFLARE_MUTATION_FORBIDDEN');
  exact(security.realStudentDataUsed, false, 'P3_REAL_STUDENT_DATA_FORBIDDEN');
  exact(security.stagingOnly, true, 'P3_NOT_STAGING_ONLY');
  exact(security.endpointDenylistViolation, false, 'P3_ENDPOINT_DENYLIST_VIOLATION');
  exact(security.credentialHygiene.credentialValuesPersisted, false, 'P3_CREDENTIAL_PERSISTED');
  exact(security.credentialHygiene.finalRotationCompleted, true, 'P3_STAGING_CREDENTIAL_NOT_ROTATED');
  exact(security.secretScan.result, 'PASS', 'P3_SECRET_SCAN_FAILED');
  exact(security.secretScan.findings, 0, 'P3_SECRET_SCAN_FAILED');

  return {
    result: 'PASS',
    projectId: target.projectId,
    migrationIdempotent: true,
    readWriteSmoke: 'PASS',
    transactionRollback: 'PASS',
    productionAccessed: false,
    productionMutation: false,
    p2Regression: 'PASS',
    secretScan: 'PASS',
  };
}

async function main() {
  const evidencePath = process.argv[2] || 'delivery/p3/CZA_Faz3_P3_Staging_Acceptance.json';
  const [evidenceBytes, p2Bytes, manifestBytes, policyBytes, callerWorkflow, reusableWorkflow, prereq, ledger] = await Promise.all([
    readFile(evidencePath),
    readFile('delivery/p2/CZA_Faz3_P2_Real_Staging_Evidence.json'),
    readFile('delivery/CZA_Faz3_Delivery_Manifest_v4.json'),
    readFile('security/faz3/oidc/p1-neon-runtime-policy.json'),
    readFile('.github/workflows/faz3-p1-provision.yml', 'utf8'),
    readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8'),
    readFile('db/migrations/20260912_staging_core_prerequisites_v1.sql'),
    readFile('db/migrations/20260913_canonical_learning_ledger_v1.sql'),
  ]);
  const p2 = JSON.parse(p2Bytes.toString('utf8'));
  const policy = JSON.parse(policyBytes.toString('utf8'));
  const p2Verification = verifyP2Evidence(p2, {
    manifestBytes,
    policy,
    reusableWorkflow: `${callerWorkflow}\n${reusableWorkflow}`,
  });
  const result = verifyP3Acceptance(JSON.parse(evidenceBytes.toString('utf8')), {
    p2Bytes,
    p2Verification,
    migrationFiles: new Map([
      ['db/migrations/20260912_staging_core_prerequisites_v1.sql', prereq],
      ['db/migrations/20260913_canonical_learning_ledger_v1.sql', ledger],
    ]),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ result: 'FAIL', error: error.code || error.message })}\n`);
    process.exitCode = 1;
  }
}
