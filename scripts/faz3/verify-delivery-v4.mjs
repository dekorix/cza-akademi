#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyManifestObject } from '../../security/faz3/attestation/verify-manifest-attestation.mjs';
import { verifyExactClaims } from '../../security/faz3/oidc/exact-claims.mjs';
import { verifyGitIdentity } from './git-object-verifier.mjs';
import { verifyNativeProviderProof } from './verify-native-provider-proof.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const nativeProviderProofPath = options['--native-provider-proof'];
const staticOnly = process.argv.includes('--static-only');
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(root, 'delivery/CZA_Faz3_Delivery_Manifest_v4.json'), 'utf8'));
const publicKey = await readFile(resolve(root, 'delivery/offline-static-reaudit-public.pem'));
const attestation = verifyManifestObject(manifest, publicKey);
assert.equal(attestation.result, 'PASS');

const boundPaths = {
  gitTreeIndex: 'delivery/git-tree-index.json', gitCommitObject: 'delivery/git-commit-object.txt',
  specification: 'docs/faz3/CZA_Faz3_Gate1B_v4_Uygulama_Sartnamesi.md', closureMatrix: 'docs/faz3/CZA_Faz3_Gate1B_v4_Kapanis_Matrisi.md',
  resourceGraph: 'infra/staging/generated/offline-resource-graph.json', providerLockHcl: 'infra/staging/p1-provision/.terraform.lock.hcl',
  providerLockPolicy: 'infra/staging/provider-lock.json', worker: 'infra/staging/worker/src/worker.mjs',
  workerCanonical: 'infra/staging/worker/src/canonical-edge.mjs', originVerifier: 'lib/faz3-origin-verifier.ts',
  oidcTrustPolicy: 'delivery/security/faz3/oidc/resolved-trust-policy.json', rbacPolicy: 'security/faz3/rbac/state-machine.json',
  replayPolicy: 'security/faz3/policies/security-state.json', recoveryPolicy: 'security/faz3/recovery/recovery-policy.json',
  actionPins: 'security/faz3/supply-chain/action-pins.json', credentialBrokerPolicy: 'security/faz3/oidc/credential-broker-policy.json',
  oidcExactClaims: 'security/faz3/oidc/exact-claims.mjs', oidcPolicyGenerator: 'security/faz3/oidc/generate-resolved-policy.mjs',
  providerProofCollector: 'scripts/faz3/collect-native-provider-proof.mjs', providerProofVerifier: 'scripts/faz3/verify-native-provider-proof.mjs',
  providerSchemaInventory: 'scripts/faz3/inventory-provider-schema.mjs', offlineGate: 'scripts/faz3/run-offline-gate-v4.sh',
  p1MutationWrapper: 'scripts/faz3/provider-mutation-wrapper.mjs', recoveryReconciler: 'scripts/faz3/reconcile-staging-v4.mjs',
  toolchainInventoryCode: 'scripts/faz3/toolchain-inventory.mjs', toolchainVerifier: 'scripts/faz3/verify-vendored-toolchain.mjs',
  vendoredToolchainInventory: 'delivery/toolchain/inventory.json',
  localStaticEvidence: 'delivery/evidence/local-static-results.json',
  npmLock: 'package-lock.json',
  providerProofStatus: 'delivery/evidence/provider-proof-status.json',
};
for (const [name, path] of Object.entries(boundPaths)) {
  const digest = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
  assert.equal(digest, manifest.hashes[name], `MANIFEST_HASH_MISMATCH:${name}`);
}

const workflowDirectory = resolve(root, '.github/workflows');
const workflowNames = (await readdir(workflowDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => `.github/workflows/${entry.name}`)
  .sort();
assert.deepEqual(Object.keys(manifest.hashes.workflows || {}).sort(), workflowNames, 'MANIFEST_WORKFLOW_SET_MISMATCH');
for (const path of workflowNames) {
  const digest = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
  assert.equal(digest, manifest.hashes.workflows[path], `MANIFEST_WORKFLOW_HASH_MISMATCH:${path}`);
}

const index = JSON.parse(await readFile(resolve(root, 'delivery/git-tree-index.json'), 'utf8'));
const commitObject = await readFile(resolve(root, 'delivery/git-commit-object.txt'), 'utf8');
const identity = await verifyGitIdentity(root, index, commitObject);
assert.equal(identity.commit, manifest.application.commit);
assert.equal(identity.tree, manifest.application.tree);

const oidc = JSON.parse(await readFile(resolve(root, 'delivery/security/faz3/oidc/resolved-trust-policy.json'), 'utf8'));
assert.equal(oidc.claims.workflow_sha, manifest.application.commit);
assert.equal(manifest.oidcIdentity.workflowSha, manifest.application.commit);
assert.equal(oidc.claims.job_workflow_sha, manifest.oidcIdentity.jobWorkflowSha);
assert.equal(oidc.claims.job_workflow_ref, `dekorix/cza-akademi/${manifest.oidcIdentity.reusableWorkflowPath}@${manifest.oidcIdentity.jobWorkflowSha}`);
const callerWorkflow = await readFile(resolve(root, manifest.oidcIdentity.callerWorkflowPath), 'utf8');
assert.match(callerWorkflow, new RegExp(`uses:\\s*dekorix/cza-akademi/\\.github/workflows/faz3-p1-provision-reusable\\.yml@${manifest.oidcIdentity.jobWorkflowSha}`));
assert.equal(verifyExactClaims({ iss: oidc.issuer, ...oidc.claims }, oidc), true);

const changed = structuredClone(manifest);
changed.acceptanceGateVersion += '-tampered';
assert.throws(() => verifyManifestObject(changed, publicKey), /PAYLOAD_SHA256_MISMATCH/);
const wrongKey = generateKeyPairSync('ed25519').publicKey;
assert.throws(() => verifyManifestObject(manifest, wrongKey), /PUBLIC_KEY_FINGERPRINT_MISMATCH/);
const badSignature = structuredClone(manifest);
const signature = Buffer.from(badSignature.attestation.signature, 'base64');
signature[0] ^= 1;
badSignature.attestation.signature = signature.toString('base64');
assert.throws(() => verifyManifestObject(badSignature, publicKey), /ED25519_SIGNATURE_INVALID/);

const providerLock = JSON.parse(await readFile(resolve(root, 'infra/staging/provider-lock.json'), 'utf8'));
assert.equal(providerLock.lockfilePolicy.sha256, manifest.hashes.providerLockHcl);
if (staticOnly) {
  process.stdout.write(`${JSON.stringify({ result: 'STATIC_PREFLIGHT_PASS', attestation, identity, oidc: 'PASS', workflows: workflowNames.length, negativeAttestationTests: 3 })}\n`);
  process.exit(0);
}
if (!nativeProviderProofPath) throw new Error('NATIVE_PROVIDER_PROOF_PATH_REQUIRED');
const nativeProviderProof = JSON.parse(await readFile(resolve(nativeProviderProofPath), 'utf8'));
const provider = verifyNativeProviderProof(nativeProviderProof, {
  contract: manifest.providerProof,
  sourceCommit: manifest.application.commit,
  providerLockSha256: manifest.hashes.providerLockHcl,
  tofuSha256: providerLock.openTofu.linuxAmd64BinarySha256,
});
process.stdout.write(`${JSON.stringify({ result: 'PASS', attestation, identity, oidc: 'PASS', provider, workflows: workflowNames.length, negativeAttestationTests: 3 })}\n`);
