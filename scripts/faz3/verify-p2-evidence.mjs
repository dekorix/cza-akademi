#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateStagingContract } from './p1-neon-mutation-wrapper.mjs';
import { verifyP1NeonRuntimeClaims } from '../../security/faz3/oidc/p1-neon-runtime-trust.mjs';
import { verifyManifestObject } from '../../security/faz3/attestation/verify-manifest-attestation.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const REQUIRED_WAL_STATES = ['PREPARED', 'WAL_DURABLE', 'REQUESTED', 'OBSERVED', 'RECONCILED'];
const REQUIRED_OIDC_CLAIMS = [
  'repository_id', 'repository_owner_id', 'environment', 'ref', 'event_name', 'job_workflow_sha',
];
const REQUIRED_ARTIFACTS = ['claim', 'walPrepared', 'walDurable', 'walRequested', 'result'];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exact(actual, expected, code) {
  if (actual !== expected) fail(code);
}

function assertSha(value, pattern, code) {
  if (!pattern.test(value || '')) fail(code);
}

function assertArtifact(artifact, runId) {
  if (!artifact || !Number.isSafeInteger(artifact.id) || artifact.id <= 0) fail('P2_ARTIFACT_METADATA_INVALID');
  if (typeof artifact.name !== 'string' || artifact.name.length === 0) fail('P2_ARTIFACT_METADATA_INVALID');
  assertSha(artifact.digestSha256, SHA256, 'P2_ARTIFACT_DIGEST_INVALID');
  exact(artifact.runId, runId, 'P2_ARTIFACT_RUN_MISMATCH');
  exact(artifact.expired, false, 'P2_ARTIFACT_EXPIRED');
}

function scanObjectForSecrets(value, path = '') {
  const forbiddenKeys = new Set([
    'apiKey', 'authorization', 'connectionString', 'databasePassword', 'githubToken',
    'leaseToken', 'neonApiKey', 'password', 'privateKey',
  ]);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) scanObjectForSecrets(value[index], `${path}[${index}]`);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) fail(`P2_SECRET_FIELD_PRESENT:${path ? `${path}.` : ''}${key}`);
      scanObjectForSecrets(child, path ? `${path}.${key}` : key);
    }
    return;
  }
  if (typeof value !== 'string') return;
  const secretPatterns = [
    /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bcza_p1_[A-Za-z0-9_-]{30,}\b/,
    /\b(?:postgres|postgresql):\/\/[^\s:@/]+:[^\s@/]+@/i,
    /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/i,
  ];
  if (secretPatterns.some(pattern => pattern.test(value))) fail(`P2_SECRET_VALUE_PRESENT:${path}`);
}

export function verifyP2Evidence(evidence, { manifestBytes, policy, reusableWorkflow }) {
  exact(evidence?.schemaVersion, 'CZA-FAZ3-P2-REAL-STAGING-EVIDENCE-V1', 'P2_SCHEMA_INVALID');
  scanObjectForSecrets(evidence);

  const source = evidence.sourceCheckpoint;
  exact(source.branch, 'feature/faz3-gate1b-v4', 'P2_BRANCH_INVALID');
  exact(source.commit, '02b6ae60cbe1b8c0dee2c51110b10960104d2cd8', 'P2_SOURCE_COMMIT_INVALID');
  exact(source.tree, '3e27ce885da38cf93db0b2bcfbdb752f5adf9491', 'P2_SOURCE_TREE_INVALID');
  assertSha(source.commit, SHA1, 'P2_SOURCE_COMMIT_INVALID');
  assertSha(source.tree, SHA1, 'P2_SOURCE_TREE_INVALID');
  exact(source.remoteCommit, source.commit, 'P2_SOURCE_REMOTE_MISMATCH');

  const run = evidence.p1Run;
  exact(run.id, 35134327735, 'P2_RUN_ID_INVALID');
  exact(run.conclusion, 'success', 'P2_RUN_NOT_SUCCESSFUL');
  exact(run.event, 'workflow_dispatch', 'P2_RUN_EVENT_INVALID');
  exact(run.headBranch, source.branch, 'P2_RUN_BRANCH_MISMATCH');
  exact(run.headSha, source.commit, 'P2_RUN_HEAD_MISMATCH');
  const jobs = new Map(run.jobs?.map(job => [job.name, job]));
  for (const name of ['p1 / native-provider-proof-gate', 'p1 / provision-neon-staging-project']) {
    const job = jobs.get(name);
    if (!job || job.status !== 'completed' || job.conclusion !== 'success') fail('P2_REQUIRED_JOB_NOT_SUCCESSFUL');
    if (!job.requiredSteps || Object.values(job.requiredSteps).some(result => result !== 'success')) fail('P2_REQUIRED_STEP_NOT_SUCCESSFUL');
  }

  for (const key of REQUIRED_ARTIFACTS) assertArtifact(evidence.githubArtifacts?.[key], run.id);
  const expectedArtifactNames = {
    claim: `faz3-p1-native-proof-consumed-${evidence.nativeProof.runId}-${evidence.nativeProof.expectedDigestSha256}`,
    walPrepared: `faz3-p1-neon-wal-prepared-${evidence.wal.runId}`,
    walDurable: `faz3-p1-neon-wal-durable-${evidence.wal.runId}`,
    walRequested: `faz3-p1-neon-wal-requested-${evidence.wal.runId}`,
    result: `faz3-p1-neon-result-${evidence.wal.runId}`,
  };
  for (const [key, name] of Object.entries(expectedArtifactNames)) exact(evidence.githubArtifacts[key].name, name, 'P2_ARTIFACT_NAME_MISMATCH');
  assertArtifact(evidence.nativeProof.artifact, evidence.nativeProof.runId);
  exact(evidence.nativeProof.runId, 35121038976, 'P2_NATIVE_PROOF_RUN_INVALID');
  exact(evidence.nativeProof.result, 'PASS', 'P2_NATIVE_PROOF_INVALID');
  exact(evidence.nativeProof.expectedDigestSha256, '1d65f81b064d8a2c68704055d67ea4721666c606a4dea63b26a60d28372ed0ee', 'P2_NATIVE_PROOF_DIGEST_MISMATCH');
  exact(evidence.nativeProof.artifact.digestSha256, evidence.nativeProof.expectedDigestSha256, 'P2_NATIVE_PROOF_DIGEST_MISMATCH');

  const manifestHash = createHash('sha256').update(manifestBytes).digest('hex');
  exact(evidence.trust.p0cManifestSha256, '7df975961415220879051f0b1e21178d2659db6bd0eb53c56a1069d7ef57ba9b', 'P2_P0C_MANIFEST_DIGEST_MISMATCH');
  exact(manifestHash, evidence.trust.p0cManifestSha256, 'P2_P0C_MANIFEST_DIGEST_MISMATCH');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  exact(verifyManifestObject(manifest).result, 'PASS', 'P2_P0C_SIGNATURE_INVALID');

  const observedClaims = { iss: policy.issuer, ...evidence.trust.oidc.observedClaims };
  if (!verifyP1NeonRuntimeClaims(observedClaims, policy)) fail('P2_OIDC_EXACT_POLICY_MISMATCH');
  for (const claim of REQUIRED_OIDC_CLAIMS) exact(observedClaims[claim], policy.claims[claim], 'P2_OIDC_EXACT_POLICY_MISMATCH');
  exact(evidence.trust.oidc.brokerExchangeAccepted, true, 'P2_OIDC_EXCHANGE_NOT_PROVEN');
  if (!reusableWorkflow.includes(`uses: dekorix/cza-akademi/.github/workflows/faz3-p1-neon-step1-reusable.yml@${policy.claims.job_workflow_sha}`)
      && !reusableWorkflow.includes(`job_workflow_sha`)) {
    fail('P2_REUSABLE_WORKFLOW_BINDING_MISSING');
  }

  const wal = evidence.wal;
  exact(wal.runId, '01K2ANG8T31E2F3713704CD2B4', 'P2_WAL_RUN_ID_INVALID');
  if (JSON.stringify(wal.states) !== JSON.stringify(REQUIRED_WAL_STATES)) fail('P2_WAL_CHAIN_INVALID');
  exact(wal.resourceId, evidence.neon.p1Project.id, 'P2_WAL_RESOURCE_MISMATCH');

  const lease = evidence.broker.lease;
  exact(lease.status, 'REVOKED', 'P2_LEASE_NOT_REVOKED');
  exact(lease.workflowRunId, String(run.id), 'P2_LEASE_RUN_MISMATCH');
  exact(lease.walRunId, wal.runId, 'P2_LEASE_WAL_MISMATCH');
  exact(lease.projectId, evidence.neon.p1Project.id, 'P2_LEASE_PROJECT_MISMATCH');
  exact(lease.jobWorkflowSha, policy.claims.job_workflow_sha, 'P2_LEASE_WORKFLOW_MISMATCH');
  exact(evidence.broker.runnerReceivesNeonKey, false, 'P2_RUNNER_NEON_KEY_FORBIDDEN');
  exact(evidence.broker.runtimeNeonApiKeyIssued, false, 'P2_RUNTIME_NEON_KEY_FORBIDDEN');
  exact(evidence.broker.opaqueLeaseOnly, true, 'P2_OPAQUE_LEASE_REQUIRED');
  exact(evidence.broker.publicTunnel.active, false, 'P2_TEMP_TUNNEL_STILL_ACTIVE');
  exact(evidence.broker.publicTunnel.healthHttpStatus, 502, 'P2_TEMP_TUNNEL_STATUS_INVALID');
  exact(evidence.broker.publicTunnel.originHostStatus, 'ERROR', 'P2_TEMP_TUNNEL_STATUS_INVALID');
  exact(evidence.broker.githubVariables.environmentCount, 0, 'P2_BROKER_VARIABLE_NOT_REMOVED');
  exact(evidence.broker.githubVariables.repositoryCount, 0, 'P2_BROKER_VARIABLE_NOT_REMOVED');
  exact(evidence.broker.githubVariables.removed, true, 'P2_BROKER_VARIABLE_NOT_REMOVED');

  const staging = evidence.neon.stagingOrganization;
  exact(staging.id, 'org-silent-boat-09386886', 'P2_STAGING_ORG_MISMATCH');
  if (!Array.isArray(staging.projects) || staging.projects.length !== 2) fail('P2_STAGING_PROJECT_INVENTORY_INVALID');
  const stagingProjects = new Map(staging.projects.map(project => [project.id, project]));
  for (const id of ['young-bar-92679633', 'orange-resonance-01270480']) {
    const project = stagingProjects.get(id);
    if (!project || project.orgId !== staging.id) fail('P2_STAGING_PROJECT_INVENTORY_INVALID');
  }
  exact(stagingProjects.get('young-bar-92679633').name, 'CZA P1 Broker Control STAGING', 'P2_BROKER_CONTROL_PROJECT_MISMATCH');
  exact(stagingProjects.get('orange-resonance-01270480').name, 'cza-f3-staging-01k2ang8t31e2f3713704cd2b4', 'P2_P1_PROJECT_MISMATCH');

  const p1Project = evidence.neon.p1Project;
  exact(p1Project.id, 'orange-resonance-01270480', 'P2_P1_PROJECT_MISMATCH');
  exact(p1Project.orgId, staging.id, 'P2_P1_PROJECT_ORG_MISMATCH');
  if (Date.parse(stagingProjects.get(p1Project.id).createdAt) < Date.parse(run.createdAt)
      || Date.parse(stagingProjects.get(p1Project.id).createdAt) > Date.parse(run.updatedAt)) {
    fail('P2_P1_PROJECT_CREATION_WINDOW_INVALID');
  }
  validateStagingContract(evidence.neon.endpointContract, { leaseId: lease.id, runId: wal.runId });
  exact(evidence.neon.endpointContract.projectId, p1Project.id, 'P2_ENDPOINT_PROJECT_MISMATCH');

  const production = evidence.neon.productionOrganization;
  if (!Array.isArray(production.projects) || production.projects.length !== 1) fail('P2_PRODUCTION_INVENTORY_INVALID');
  const learningCore = production.projects[0];
  exact(learningCore.id, 'hidden-glade-66748043', 'P2_LEARNING_CORE_ID_MISMATCH');
  exact(learningCore.name, 'CZA Learning Core', 'P2_LEARNING_CORE_NAME_MISMATCH');
  exact(learningCore.orgId, production.id, 'P2_LEARNING_CORE_ORG_MISMATCH');
  if (Date.parse(learningCore.updatedAt) >= Date.parse(run.createdAt)) fail('P2_LEARNING_CORE_P1_MUTATION_NOT_EXCLUDED');
  exact(production.oldWrongStagingProjectPresent, false, 'P2_OLD_WRONG_STAGING_PROJECT_PRESENT');

  exact(evidence.security.productionAccessed, false, 'P2_PRODUCTION_ACCESS_FORBIDDEN');
  exact(evidence.security.productionMutation, false, 'P2_PRODUCTION_MUTATION_FORBIDDEN');
  exact(evidence.security.cloudflareResourcesCreated, 0, 'P2_CLOUDFLARE_MUTATION_FORBIDDEN');
  exact(evidence.security.secretScan.result, 'PASS', 'P2_SECRET_SCAN_FAILED');
  exact(evidence.security.secretScan.findings, 0, 'P2_SECRET_SCAN_FAILED');
  exact(evidence.replayGuard.active, true, 'P2_REPLAY_GUARD_INACTIVE');
  exact(evidence.replayGuard.claimPresent, true, 'P2_REPLAY_CLAIM_MISSING');
  exact(evidence.replayGuard.consumerRunId, run.id, 'P2_REPLAY_CONSUMER_MISMATCH');
  exact(evidence.replayGuard.claimName, evidence.githubArtifacts.claim.name, 'P2_REPLAY_CLAIM_MISMATCH');
  exact(evidence.replayGuard.proofDigestSha256, evidence.nativeProof.expectedDigestSha256, 'P2_REPLAY_CLAIM_MISMATCH');
  if (!reusableWorkflow.includes('Reject replay and create single-use claim')
      || !reusableWorkflow.includes('Persist single-use proof claim before provisioning')) {
    fail('P2_REPLAY_GUARD_CODE_MISSING');
  }

  return {
    result: 'PASS',
    p1RunId: run.id,
    walRunId: wal.runId,
    leaseRevoked: true,
    productionAccessed: false,
    productionMutation: false,
    secretScan: 'PASS',
  };
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
  const evidencePath = options['--evidence'] || 'delivery/p2/CZA_Faz3_P2_Real_Staging_Evidence.json';
  const [evidenceBytes, manifestBytes, policyBytes, callerWorkflow, reusableWorkflow] = await Promise.all([
    readFile(evidencePath),
    readFile('delivery/CZA_Faz3_Delivery_Manifest_v4.json'),
    readFile('security/faz3/oidc/p1-neon-runtime-policy.json'),
    readFile('.github/workflows/faz3-p1-provision.yml', 'utf8'),
    readFile('.github/workflows/faz3-p1-neon-step1-reusable.yml', 'utf8'),
  ]);
  const evidence = JSON.parse(evidenceBytes.toString('utf8'));
  const policy = JSON.parse(policyBytes.toString('utf8'));
  const workflowSource = `${callerWorkflow}\n${reusableWorkflow}`;
  process.stdout.write(`${JSON.stringify(verifyP2Evidence(evidence, { manifestBytes, policy, reusableWorkflow: workflowSource }))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ result: 'FAIL', error: error.code || error.message })}\n`);
    process.exitCode = 1;
  }
}
