#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyManifestObject } from '../../security/faz3/attestation/verify-manifest-attestation.mjs';

const HEX_40 = /^[0-9a-f]{40}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const EXPECTED_MANIFEST_KEY_FINGERPRINT = 'a750f810dba3c1bf6708c34e66037f7c0f26c3effe95975f67cacc8831cc4639';
const EXPECTED_REPOSITORY = 'dekorix/cza-akademi';
const EXPECTED_WORKFLOW = '.github/workflows/faz3-p0-native-provider-schema.yml';
const CLAIM_NAMESPACE = 'faz3-p1-native-proof-consumed';

const digest = value => createHash('sha256').update(value).digest('hex');

export function proofConsumptionClaimName(binding) {
  return `${binding.singleUse.claimNamespace}-${binding.runId}-${binding.artifact.digestSha256}`;
}

export function verifyP1NativeProofManifest(
  manifest,
  { expectedKeyFingerprint = EXPECTED_MANIFEST_KEY_FINGERPRINT } = {},
) {
  const attestation = verifyManifestObject(manifest);
  assert.equal(attestation.public_key_fingerprint, expectedKeyFingerprint, 'B1_MANIFEST_TRUST_ROOT_MISMATCH');
  assert.equal(manifest.schemaVersion, 'CZA-FAZ3-DELIVERY-MANIFEST-V4');
  assert.equal(manifest.providerProof?.status, 'PASS', 'B1_MANIFEST_PROVIDER_PROOF_NOT_PASS');
  assert.equal(manifest.providerProof?.schemaVersion, 'CZA-NATIVE-PROVIDER-PROOF-V4');
  assert.equal(manifest.providerProof?.adapterAllowed, false);
  assert.equal(manifest.providerProof?.developmentOverrideAllowed, false);
  assert.equal(manifest.providerProof?.reattachProviderAllowed, false);

  const application = manifest.application;
  assert.match(application?.commit || '', HEX_40, 'B1_MANIFEST_APPLICATION_COMMIT_INVALID');
  assert.match(application?.tree || '', HEX_40, 'B1_MANIFEST_APPLICATION_TREE_INVALID');

  const binding = manifest.providerProof.nativeRun;
  assert.equal(binding?.schemaVersion, 'CZA-B1-NATIVE-PROVIDER-RUN-BINDING-V1');
  assert.equal(binding?.repository, EXPECTED_REPOSITORY, 'B1_MANIFEST_REPOSITORY_MISMATCH');
  assert.equal(binding?.workflowPath, EXPECTED_WORKFLOW, 'B1_MANIFEST_WORKFLOW_MISMATCH');
  assert.ok(Number.isSafeInteger(binding?.runId) && binding.runId > 0, 'B1_MANIFEST_RUN_ID_INVALID');
  assert.deepEqual(binding?.application, { commit: application.commit, tree: application.tree }, 'B1_MANIFEST_APPLICATION_BINDING_MISMATCH');

  assert.ok(Number.isSafeInteger(binding?.artifact?.id) && binding.artifact.id > 0, 'B1_MANIFEST_ARTIFACT_ID_INVALID');
  assert.equal(binding?.artifact?.name, `faz3-native-provider-proof-${application.commit}`, 'B1_MANIFEST_ARTIFACT_NAME_MISMATCH');
  assert.match(binding?.artifact?.digestSha256 || '', HEX_64, 'B1_MANIFEST_ARTIFACT_DIGEST_INVALID');
  assert.equal(binding?.evidence?.proofSchemaVersion, 'CZA-B1-NATIVE-PROVIDER-PROOF-V1');
  for (const field of [
    'proofDocumentSha256',
    'providerSchemaSha256',
    'providerSchemaInventorySha256',
    'providerLockSha256',
  ]) assert.match(binding?.evidence?.[field] || '', HEX_64, `B1_MANIFEST_EVIDENCE_HASH_INVALID:${field}`);
  assert.equal(binding.evidence.providerLockSha256, manifest.hashes?.providerLockHcl, 'B1_MANIFEST_LOCK_HASH_MISMATCH');

  assert.deepEqual(binding?.singleUse, {
    required: true,
    guard: 'GITHUB_ACTIONS_ARTIFACT_CLAIM',
    claimNamespace: CLAIM_NAMESPACE,
    retentionDays: 30,
  }, 'B1_MANIFEST_SINGLE_USE_POLICY_INVALID');

  return {
    result: 'PASS',
    attestation,
    application,
    binding,
    claimName: proofConsumptionClaimName(binding),
  };
}

export function verifyManifestProofEvidence(binding, { proofDocument, schema, inventory, lockfile }) {
  assert.equal(digest(proofDocument), binding.evidence.proofDocumentSha256, 'B1_PROOF_DOCUMENT_HASH_MISMATCH');
  assert.equal(digest(schema), binding.evidence.providerSchemaSha256, 'B1_PROVIDER_SCHEMA_HASH_MISMATCH');
  assert.equal(digest(inventory), binding.evidence.providerSchemaInventorySha256, 'B1_PROVIDER_SCHEMA_INVENTORY_HASH_MISMATCH');
  assert.equal(digest(lockfile), binding.evidence.providerLockSha256, 'B1_PROVIDER_LOCK_HASH_MISMATCH');
  const proof = JSON.parse(proofDocument);
  assert.equal(proof.schemaVersion, binding.evidence.proofSchemaVersion, 'B1_PROOF_SCHEMA_VERSION_MISMATCH');
  assert.equal(proof.result, 'PASS', 'B1_PROOF_RESULT_NOT_PASS');
  assert.deepEqual(proof.application, binding.application, 'B1_PROOF_APPLICATION_MISMATCH');
  assert.equal(proof.providerSchema?.sha256, binding.evidence.providerSchemaSha256, 'B1_PROOF_SCHEMA_BINDING_MISMATCH');
  assert.equal(proof.providerSchema?.inventorySha256, binding.evidence.providerSchemaInventorySha256, 'B1_PROOF_INVENTORY_BINDING_MISMATCH');
  assert.equal(proof.lockfile?.sha256, binding.evidence.providerLockSha256, 'B1_PROOF_LOCK_BINDING_MISMATCH');
  return { result: 'PASS', application: binding.application };
}

export function verifyProofUnused(response, { claimName }) {
  assert.ok(Array.isArray(response?.artifacts), 'B1_REPLAY_METADATA_INVALID');
  assert.ok(Number.isSafeInteger(response?.total_count) && response.total_count >= 0, 'B1_REPLAY_TOTAL_INVALID');
  assert.equal(response.total_count, 0, 'B1_PROOF_REPLAY_DETECTED');
  assert.equal(response.artifacts.some(artifact => artifact?.name === claimName), false, 'B1_PROOF_REPLAY_DETECTED');
  return { result: 'PASS', claimName };
}

export function createConsumptionClaim(verified, { workflowRunId, consumedAt }) {
  assert.match(String(workflowRunId || ''), /^[1-9][0-9]*$/, 'B1_CONSUMER_RUN_ID_INVALID');
  assert.ok(!Number.isNaN(Date.parse(consumedAt)), 'B1_CONSUMED_AT_INVALID');
  return {
    schemaVersion: 'CZA-B1-NATIVE-PROVIDER-CONSUMPTION-V1',
    claimName: verified.claimName,
    proof: {
      repository: verified.binding.repository,
      runId: verified.binding.runId,
      artifactId: verified.binding.artifact.id,
      artifactDigestSha256: verified.binding.artifact.digestSha256,
      application: verified.application,
      manifestPayloadSha256: verified.attestation.payload_sha256,
    },
    consumption: { workflowRunId: String(workflowRunId), consumedAt },
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
    if (!options['--manifest']) throw new Error('B1_SIGNED_MANIFEST_REQUIRED');
    const manifest = JSON.parse(await readFile(resolve(options['--manifest']), 'utf8'));
    const verified = verifyP1NativeProofManifest(manifest);

    if (options['--github-output']) {
      await appendFile(resolve(options['--github-output']), [
        `application_commit=${verified.application.commit}`,
        `application_tree=${verified.application.tree}`,
        `proof_run_id=${verified.binding.runId}`,
        `proof_artifact_id=${verified.binding.artifact.id}`,
        `proof_artifact_name=${verified.binding.artifact.name}`,
        `proof_artifact_digest=${verified.binding.artifact.digestSha256}`,
        `claim_name=${verified.claimName}`,
      ].join('\n') + '\n');
    }
    if (options['--evidence']) {
      const evidence = resolve(options['--evidence']);
      verifyManifestProofEvidence(verified.binding, {
        proofDocument: await readFile(resolve(evidence, 'native-provider-proof.json')),
        schema: await readFile(resolve(evidence, 'provider-schema.json')),
        inventory: await readFile(resolve(evidence, 'provider-schema-inventory.json')),
        lockfile: await readFile(resolve(evidence, 'provider-lock.hcl')),
      });
    }
    if (options['--replay-metadata']) {
      verifyProofUnused(JSON.parse(await readFile(resolve(options['--replay-metadata']), 'utf8')), { claimName: verified.claimName });
    }
    if (options['--write-claim']) {
      const claim = createConsumptionClaim(verified, {
        workflowRunId: options['--consumer-run-id'],
        consumedAt: options['--consumed-at'],
      });
      await writeFile(resolve(options['--write-claim']), `${JSON.stringify(claim, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
    process.stdout.write(`${JSON.stringify({ result: 'PASS', application: verified.application, proofRunId: verified.binding.runId, claimName: verified.claimName })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ result: 'FAIL', error: error.code || error.message })}\n`);
    process.exitCode = 1;
  }
}
