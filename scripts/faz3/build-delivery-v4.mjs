#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, copyFile, cp, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeToolchainInventory } from './toolchain-inventory.mjs';

const root = resolve(process.argv[2] || '.');
const delivery = resolve(root, process.argv[3] || 'delivery');
const hashFile = async path => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
await mkdir(resolve(delivery, 'security/faz3/oidc'), { recursive: true });

const providerLock = JSON.parse(await readFile(resolve(root, 'infra/staging/provider-lock.json'), 'utf8'));
const tofuTarget = resolve(delivery, 'toolchain/tofu');
const providerTargetRoot = resolve(delivery, 'toolchain/providers');
const providerPackagePaths = [
  'registry.opentofu.org/cloudflare/cloudflare/5.25.0/linux_amd64',
  'registry.opentofu.org/terraform-community-providers/neon/0.1.15/linux_amd64',
];
const providerBinaryPaths = [
  'registry.opentofu.org/cloudflare/cloudflare/5.25.0/linux_amd64/terraform-provider-cloudflare_v5.25.0',
  'registry.opentofu.org/terraform-community-providers/neon/0.1.15/linux_amd64/terraform-provider-neon_v0.1.15',
];
if (process.env.CZA_TOFU_BIN && process.env.CZA_PROVIDER_MIRROR_ROOT) {
  await mkdir(resolve(delivery, 'toolchain'), { recursive: true });
  await copyFile(resolve(process.env.CZA_TOFU_BIN), tofuTarget);
  await chmod(tofuTarget, 0o755);
  for (const path of providerPackagePaths) {
    const source = resolve(process.env.CZA_PROVIDER_MIRROR_ROOT, path);
    if (!(await lstat(source)).isDirectory()) throw new Error(`PROVIDER_PACKAGE_NOT_DIRECTORY:${path}`);
    const target = resolve(providerTargetRoot, path);
    await cp(source, target, { recursive: true, force: true });
  }
  for (const path of providerBinaryPaths) await chmod(resolve(providerTargetRoot, path), 0o755);
}
if (await hashFile('delivery/toolchain/tofu') !== providerLock.openTofu.linuxAmd64BinarySha256) throw new Error('VENDORED_TOFU_HASH_MISMATCH');
for (let index = 0; index < providerBinaryPaths.length; index += 1) {
  const actual = await hashFile(`delivery/toolchain/providers/${providerBinaryPaths[index]}`);
  if (actual !== providerLock.providers[index].linuxAmd64BinarySha256) throw new Error(`VENDORED_PROVIDER_HASH_MISMATCH:${providerLock.providers[index].source}`);
}
for (const required of ['node_modules/.bin/esbuild', 'node_modules/.bin/tsc', 'node_modules/.bin/wrangler']) await lstat(resolve(root, required));
await writeToolchainInventory(root, resolve(delivery, 'toolchain/inventory.json'));

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim();
const base = execFileSync('git', ['merge-base', '6a0142d1e0dabe9e0d1154a6c630c202317dc61e', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (base !== '6a0142d1e0dabe9e0d1154a6c630c202317dc61e') throw new Error('BASE_COMMIT_MISMATCH');
if (execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('TRACKED_WORKTREE_MUST_BE_CLEAN');

const listing = execFileSync('git', ['ls-tree', '-r', '--full-tree', 'HEAD'], { cwd: root, encoding: 'utf8' });
const entries = listing.trim().split('\n').filter(Boolean).map(line => {
  const match = /^(\d+) blob ([0-9a-f]{40})\t(.+)$/.exec(line);
  if (!match) throw new Error(`GIT_TREE_ENTRY_INVALID:${line}`);
  return { mode: match[1], blob: match[2], path: match[3] };
});
const gitIndex = { schemaVersion: 'CZA-GIT-IDENTITY-V4', commit, tree, entries };
await writeFile(resolve(delivery, 'git-tree-index.json'), `${JSON.stringify(gitIndex, null, 2)}\n`);
await writeFile(resolve(delivery, 'git-commit-object.txt'), execFileSync('git', ['cat-file', 'commit', 'HEAD'], { cwd: root }));

const reusableWorkflowPath = '.github/workflows/faz3-p1-provision-reusable.yml';
const callerWorkflowPath = '.github/workflows/faz3-p1-provision.yml';
const callerWorkflow = await readFile(resolve(root, callerWorkflowPath), 'utf8');
const jobWorkflowSha = /uses:\s*dekorix\/cza-akademi\/\.github\/workflows\/faz3-p1-provision-reusable\.yml@([0-9a-f]{40})/.exec(callerWorkflow)?.[1];
if (!jobWorkflowSha) throw new Error('PINNED_REUSABLE_WORKFLOW_IDENTITY_REQUIRED');
const pinnedReusable = execFileSync('git', ['show', `${jobWorkflowSha}:${reusableWorkflowPath}`], { cwd: root });
const currentReusable = await readFile(resolve(root, reusableWorkflowPath));
if (!pinnedReusable.equals(currentReusable)) throw new Error('PINNED_REUSABLE_WORKFLOW_CONTENT_MISMATCH');

const resolvedOidc = resolve(delivery, 'security/faz3/oidc/resolved-trust-policy.json');
execFileSync(process.execPath, [resolve(root, 'security/faz3/oidc/generate-resolved-policy.mjs'), `--workflow-sha=${commit}`, `--job-workflow-sha=${jobWorkflowSha}`, `--out=${resolvedOidc}`], { cwd: root, stdio: 'inherit' });

const workflowPaths = execFileSync('git', ['ls-files', '.github/workflows'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
if (workflowPaths.length === 0) throw new Error('WORKFLOW_SET_EMPTY');
const workflowHashes = Object.fromEntries(await Promise.all(workflowPaths.map(async path => [path, await hashFile(path)])));

const manifest = {
  schemaVersion: 'CZA-FAZ3-DELIVERY-MANIFEST-V4', acceptanceGateVersion: 'CZA-F3-GATE-1B-V4',
  application: { baseCommit: base, commit, tree },
  oidcIdentity: { callerWorkflowPath, workflowSha: commit, reusableWorkflowPath, jobWorkflowSha },
  mutationClaims: { providerMutationAttempted: false, workflowTriggered: false, productionAccessed: false, mergePushDeployAttempted: false },
  providerProof: {
    status: 'PASS_REQUIRED_DURING_STATIC_REAUDIT', schemaVersion: 'CZA-NATIVE-PROVIDER-PROOF-V4',
    execution: 'OPENTOFU_NATIVE_PLUGIN_PROTOCOL', platform: { os: 'linux', arch: 'x64', afUnix: true },
    adapterAllowed: false, developmentOverrideAllowed: false, reattachProviderAllowed: false,
    allowedInstallationModes: ['DIRECT_REGISTRY_INSTALL', 'SIGNED_FILESYSTEM_MIRROR'],
    providers: providerLock.providers.map(provider => ({ source: provider.source, version: provider.version, platform: 'linux_amd64', sha256: provider.linuxAmd64BinarySha256 })),
  },
  hashes: {
    gitTreeIndex: await hashFile('delivery/git-tree-index.json'),
    gitCommitObject: await hashFile('delivery/git-commit-object.txt'),
    specification: await hashFile('docs/faz3/CZA_Faz3_Gate1B_v4_Uygulama_Sartnamesi.md'),
    closureMatrix: await hashFile('docs/faz3/CZA_Faz3_Gate1B_v4_Kapanis_Matrisi.md'),
    resourceGraph: await hashFile('infra/staging/generated/offline-resource-graph.json'),
    providerLockHcl: await hashFile('infra/staging/p1-provision/.terraform.lock.hcl'),
    providerLockPolicy: await hashFile('infra/staging/provider-lock.json'),
    worker: await hashFile('infra/staging/worker/src/worker.mjs'),
    workerCanonical: await hashFile('infra/staging/worker/src/canonical-edge.mjs'),
    originVerifier: await hashFile('lib/faz3-origin-verifier.ts'),
    oidcTrustPolicy: await hashFile('delivery/security/faz3/oidc/resolved-trust-policy.json'),
    rbacPolicy: await hashFile('security/faz3/rbac/state-machine.json'),
    replayPolicy: await hashFile('security/faz3/policies/security-state.json'),
    recoveryPolicy: await hashFile('security/faz3/recovery/recovery-policy.json'),
    actionPins: await hashFile('security/faz3/supply-chain/action-pins.json'),
    credentialBrokerPolicy: await hashFile('security/faz3/oidc/credential-broker-policy.json'),
    oidcExactClaims: await hashFile('security/faz3/oidc/exact-claims.mjs'),
    oidcPolicyGenerator: await hashFile('security/faz3/oidc/generate-resolved-policy.mjs'),
    providerProofCollector: await hashFile('scripts/faz3/collect-native-provider-proof.mjs'),
    providerProofVerifier: await hashFile('scripts/faz3/verify-native-provider-proof.mjs'),
    providerSchemaInventory: await hashFile('scripts/faz3/inventory-provider-schema.mjs'),
    offlineGate: await hashFile('scripts/faz3/run-offline-gate-v4.sh'),
    p1MutationWrapper: await hashFile('scripts/faz3/provider-mutation-wrapper.mjs'),
    recoveryReconciler: await hashFile('scripts/faz3/reconcile-staging-v4.mjs'),
    toolchainInventoryCode: await hashFile('scripts/faz3/toolchain-inventory.mjs'),
    toolchainVerifier: await hashFile('scripts/faz3/verify-vendored-toolchain.mjs'),
    vendoredToolchainInventory: await hashFile('delivery/toolchain/inventory.json'),
    npmLock: await hashFile('package-lock.json'),
    localStaticEvidence: await hashFile('delivery/evidence/local-static-results.json'),
    providerProofStatus: await hashFile('delivery/evidence/provider-proof-status.json'),
    workflows: workflowHashes,
  },
  attestation: null,
};
const manifestPath = resolve(delivery, 'CZA_Faz3_Delivery_Manifest_v4.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ result: 'PASS', commit, tree, manifestPath })}\n`);
