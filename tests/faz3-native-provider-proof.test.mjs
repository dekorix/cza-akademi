import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyNativeProviderProof } from '../scripts/faz3/verify-native-provider-proof.mjs';
import { verifyB1NativeProviderProof, verifyGitHubArtifactMetadata, verifyGitHubRunMetadata } from '../scripts/faz3/verify-b1-native-provider-proof.mjs';
import {
  createConsumptionClaim,
  verifyManifestProofEvidence,
  verifyP1NativeProofManifest,
  verifyProofUnused,
} from '../scripts/faz3/verify-p1-native-proof-manifest.mjs';

const sourceCommit = 'a'.repeat(40);
const providerLockSha256 = 'b'.repeat(64);
const tofuSha256 = 'c'.repeat(64);
const providers = [
  { source: 'registry.opentofu.org/cloudflare/cloudflare', version: '5.25.0', platform: 'linux_amd64', sha256: '70871d2145742cd1b70ed0ac0482f63e2329bd9468fdb73b20c92bd2f13fce76' },
  { source: 'registry.opentofu.org/terraform-community-providers/neon', version: '0.1.15', platform: 'linux_amd64', sha256: 'e7cc45a5250e11a1542082ac248f3cd5ec52af13e88195e92ceb43947f1fcab3' },
];
const contract = {
  status: 'PASS_REQUIRED_DURING_STATIC_REAUDIT', schemaVersion: 'CZA-NATIVE-PROVIDER-PROOF-V4',
  execution: 'OPENTOFU_NATIVE_PLUGIN_PROTOCOL', platform: { os: 'linux', arch: 'x64', afUnix: true },
  adapterAllowed: false, developmentOverrideAllowed: false, reattachProviderAllowed: false,
  allowedInstallationModes: ['DIRECT_REGISTRY_INSTALL', 'SIGNED_FILESYSTEM_MIRROR'], providers,
};
const proof = {
  schemaVersion: contract.schemaVersion, result: 'PASS', sourceCommit, platform: contract.platform,
  execution: contract.execution, installationMode: 'SIGNED_FILESYSTEM_MIRROR', packageIntegrity: 'READONLY_LOCKFILE_INIT_SUCCEEDED',
  adapterUsed: false, developmentOverrideUsed: false, reattachProviderUsed: false,
  tofu: { version: '1.12.0', sha256: tofuSha256 }, providerLockSha256,
  providerSchemaSha256: 'd'.repeat(64), providerSchemaInventorySha256: 'e'.repeat(64),
  inventory: {
    cloudflareResourceCount: 140, cloudflareDataSourceCount: 30, neonProjectPresent: true,
    requiredCloudflare: [
      'cloudflare_ruleset', 'cloudflare_dns_record', 'cloudflare_workers_script', 'cloudflare_workers_route',
      'cloudflare_zero_trust_access_application', 'cloudflare_zero_trust_access_policy',
      'cloudflare_zero_trust_tunnel_cloudflared', 'cloudflare_zero_trust_tunnel_cloudflared_config',
    ],
  },
  binaries: providers.map((provider, index) => ({ ...provider, size: 1024 + index })),
};
const context = { contract, sourceCommit, providerLockSha256, tofuSha256 };

test('native provider proof accepts only the full unmodified AF_UNIX contract', () => {
  assert.equal(verifyNativeProviderProof(proof, context).result, 'PASS');
});

for (const [name, mutate] of [
  ['adapter', value => { value.adapterUsed = true; }],
  ['development override', value => { value.developmentOverrideUsed = true; }],
  ['source commit', value => { value.sourceCommit = 'f'.repeat(40); }],
  ['lock file', value => { value.providerLockSha256 = 'f'.repeat(64); }],
  ['schema surface', value => { value.inventory.cloudflareResourceCount = 5; }],
  ['provider version', value => { value.binaries[0].version = '5.24.0'; }],
]) {
  test(`native provider proof rejects ${String(name)} drift`, () => {
    const changed = structuredClone(proof);
    mutate(changed);
    assert.throws(() => verifyNativeProviderProof(changed, context));
  });
}

const hash = value => createHash('sha256').update(value).digest('hex');
const b1Commit = '1'.repeat(40);
const b1Tree = '2'.repeat(40);
const osRelease = Buffer.from('ID=ubuntu\nVERSION_ID="24.04"\n');
const handshakeLog = Buffer.from([
  'provider: plugin started: path=.terraform/providers/registry.opentofu.org/cloudflare/cloudflare/5.25.0/linux_amd64/terraform-provider-cloudflare_v5.25.0 pid=101',
  'provider: plugin address: address=/tmp/plugin-a network=unix',
  'provider: using plugin: version=6',
  'provider: plugin started: path=.terraform/providers/registry.opentofu.org/terraform-community-providers/neon/0.1.15/linux_amd64/terraform-provider-neon_v0.1.15 pid=102',
  'provider: plugin address: address=/tmp/plugin-b network=unix',
  'provider: using plugin: version=5',
].join('\n'));
const b1Schema = Buffer.from(JSON.stringify({ provider_schemas: Object.fromEntries(providers.map(provider => [provider.source, {}])) }));
const b1Inventory = Buffer.from(JSON.stringify({
  result: 'PASS', providerSchemaSha256: hash(b1Schema), cloudflareResourceCount: 140,
  cloudflareDataSourceCount: 30, neonProjectPresent: true,
}));
const b1Lockfile = Buffer.from(providers.map(provider => `provider "${provider.source}" {\n  version = "${provider.version}"\n}`).join('\n'));
const b1Policy = {
  openTofu: { version: '1.12.0', linuxAmd64BinarySha256: tofuSha256 },
  lockfilePolicy: { sha256: hash(b1Lockfile) },
  providers: providers.map(provider => ({ source: provider.source, version: provider.version, linuxAmd64BinarySha256: provider.sha256 })),
};
const b1Proof = {
  schemaVersion: 'CZA-B1-NATIVE-PROVIDER-PROOF-V1', result: 'PASS',
  application: { commit: b1Commit, tree: b1Tree },
  runner: { environment: 'github-hosted', os: 'Linux', arch: 'X64', imageOS: 'ubuntu24', imageVersion: '20260907.1', kernelRelease: '6.11.0', osReleaseSha256: hash(osRelease) },
  platform: { os: 'linux', arch: 'x64', afUnix: true },
  installationMode: 'DIRECT_REGISTRY_INSTALL', packageIntegrity: 'READONLY_LOCKFILE_INIT_SUCCEEDED',
  adapterUsed: false, developmentOverrideUsed: false, reattachProviderUsed: false,
  providerBinaryModified: false, providerCredentialsUsed: false, providerMutationAttempted: false,
  providerSchemaExecuted: true,
  tofu: { version: '1.12.0', binarySha256: tofuSha256 },
  lockfile: { path: 'infra/staging/p1-provision/.terraform.lock.hcl', sha256: hash(b1Lockfile) },
  providers: providers.map((provider, index) => ({ ...provider, size: 2048 + index })),
  providerSchema: { sha256: hash(b1Schema), inventorySha256: hash(b1Inventory) },
  nativeHandshake: {
    result: 'PASS', transport: 'AF_UNIX', execution: 'OPENTOFU_NATIVE_PLUGIN_PROTOCOL',
    logSha256: hash(handshakeLog), unixSocketHandshakes: 2, protocolVersions: [5, 6],
    providers: providers.map(provider => ({ source: provider.source, processStarted: true })),
  },
};
const b1Context = {
  expectedCommit: b1Commit, expectedTree: b1Tree, providerPolicy: b1Policy,
  lockfile: b1Lockfile, schema: b1Schema, inventory: b1Inventory, handshakeLog, osRelease,
};

test('B1 proof accepts an exact GitHub-hosted direct-registry AF_UNIX schema run', () => {
  assert.equal(verifyB1NativeProviderProof(b1Proof, b1Context).result, 'PASS');
});

for (const [name, mutateProof, mutateContext] of [
  ['missing proof', value => { value.result = 'MISSING'; }],
  ['application commit', value => { value.application.commit = '3'.repeat(40); }],
  ['application tree', value => { value.application.tree = '4'.repeat(40); }],
  ['lockfile hash', value => { value.lockfile.sha256 = '5'.repeat(64); }],
  ['provider version', value => { value.providers[0].version = '5.24.0'; }],
  ['provider binary hash', value => { value.providers[1].sha256 = '6'.repeat(64); }],
  ['schema execution flag', value => { value.providerSchemaExecuted = false; }],
  ['schema artifact hash', value => { value.providerSchema.sha256 = '7'.repeat(64); }],
  ['native handshake', value => { value.nativeHandshake.result = 'FAIL'; }],
  ['non-direct installation', value => { value.installationMode = 'SIGNED_FILESYSTEM_MIRROR'; }],
  ['changed schema bytes', () => {}, value => { value.schema = Buffer.from('{}'); }],
]) {
  test(`B1 P1 gate hard-fails on ${String(name)}`, () => {
    const changedProof = structuredClone(b1Proof);
    const changedContext = { ...b1Context };
    mutateProof(changedProof);
    mutateContext?.(changedContext);
    assert.throws(() => verifyB1NativeProviderProof(changedProof, changedContext));
  });
}

test('B1 artifact metadata requires one exact non-expired digest-bound artifact', () => {
  const digest = '8'.repeat(64);
  const metadata = { artifacts: [{ id: 123, name: `faz3-native-provider-proof-${b1Commit}`, expired: false, size_in_bytes: 4096, digest: `sha256:${digest}` }] };
  assert.equal(verifyGitHubArtifactMetadata(metadata, { expectedName: metadata.artifacts[0].name, expectedDigest: digest }).result, 'PASS');
  assert.throws(() => verifyGitHubArtifactMetadata(metadata, { expectedName: metadata.artifacts[0].name, expectedDigest: '9'.repeat(64) }));
  assert.throws(() => verifyGitHubArtifactMetadata({ artifacts: [] }, { expectedName: metadata.artifacts[0].name, expectedDigest: digest }));
});

test('B1 run metadata requires the exact successful proof workflow and commit', () => {
  const run = {
    id: 456, status: 'completed', conclusion: 'success', head_sha: b1Commit, event: 'push',
    path: '.github/workflows/faz3-p0-native-provider-schema.yml', repository: { full_name: 'dekorix/cza-akademi' },
  };
  const expected = { expectedCommit: b1Commit, expectedRepository: 'dekorix/cza-akademi', expectedWorkflowPath: run.path };
  assert.equal(verifyGitHubRunMetadata(run, expected).result, 'PASS');
  assert.throws(() => verifyGitHubRunMetadata({ ...run, head_sha: 'a'.repeat(40) }, expected));
  assert.throws(() => verifyGitHubRunMetadata({ ...run, path: '.github/workflows/other.yml' }, expected));
  assert.throws(() => verifyGitHubRunMetadata({ ...run, conclusion: 'failure' }, expected));
});

const signedManifest = JSON.parse(await readFile('delivery/CZA_Faz3_Delivery_Manifest_v4.json', 'utf8'));
const verifiedManifest = verifyP1NativeProofManifest(signedManifest);

test('signed Manifest v4 accepts the exact native proof run and digest', () => {
  assert.equal(verifiedManifest.result, 'PASS');
  assert.equal(verifiedManifest.binding.runId, 35014797059);
  assert.equal(verifiedManifest.binding.artifact.digestSha256, '3067bafbfd36a661f48d0498f4cefc210ec1befb1a7d38acb4dd0c9fd92c05d4');
  assert.deepEqual(verifiedManifest.binding.application, {
    commit: signedManifest.application.commit,
    tree: signedManifest.application.tree,
  });
  assert.equal(verifyGitHubRunMetadata({
    id: verifiedManifest.binding.runId,
    status: 'completed',
    conclusion: 'success',
    head_sha: verifiedManifest.application.commit,
    event: 'push',
    path: verifiedManifest.binding.workflowPath,
    repository: { full_name: verifiedManifest.binding.repository },
  }, {
    expectedCommit: verifiedManifest.application.commit,
    expectedRepository: verifiedManifest.binding.repository,
    expectedWorkflowPath: verifiedManifest.binding.workflowPath,
    expectedRunId: verifiedManifest.binding.runId,
  }).result, 'PASS');
  assert.equal(verifyGitHubArtifactMetadata({ artifacts: [{
    id: verifiedManifest.binding.artifact.id,
    name: verifiedManifest.binding.artifact.name,
    expired: false,
    size_in_bytes: 4096,
    digest: `sha256:${verifiedManifest.binding.artifact.digestSha256}`,
  }] }, {
    expectedName: verifiedManifest.binding.artifact.name,
    expectedDigest: verifiedManifest.binding.artifact.digestSha256,
    expectedArtifactId: verifiedManifest.binding.artifact.id,
  }).result, 'PASS');
});

test('P1 gate rejects a damaged Manifest v4 signature', () => {
  const changed = structuredClone(signedManifest);
  changed.attestation.signature = `${changed.attestation.signature[0] === 'A' ? 'B' : 'A'}${changed.attestation.signature.slice(1)}`;
  assert.throws(() => verifyP1NativeProofManifest(changed), /ED25519_SIGNATURE_INVALID/);
});

test('P1 gate rejects run ID metadata that disagrees with signed Manifest v4', () => {
  const run = {
    id: verifiedManifest.binding.runId + 1,
    status: 'completed',
    conclusion: 'success',
    head_sha: verifiedManifest.application.commit,
    event: 'push',
    path: verifiedManifest.binding.workflowPath,
    repository: { full_name: verifiedManifest.binding.repository },
  };
  assert.throws(() => verifyGitHubRunMetadata(run, {
    expectedCommit: verifiedManifest.application.commit,
    expectedRepository: verifiedManifest.binding.repository,
    expectedWorkflowPath: verifiedManifest.binding.workflowPath,
    expectedRunId: verifiedManifest.binding.runId,
  }), /B1_RUN_ID_MISMATCH/);
});

test('P1 gate rejects artifact digest metadata that disagrees with signed Manifest v4', () => {
  const artifact = verifiedManifest.binding.artifact;
  const metadata = { artifacts: [{ id: artifact.id, name: artifact.name, expired: false, size_in_bytes: 4096, digest: `sha256:${'f'.repeat(64)}` }] };
  assert.throws(() => verifyGitHubArtifactMetadata(metadata, {
    expectedName: artifact.name,
    expectedDigest: artifact.digestSha256,
    expectedArtifactId: artifact.id,
  }), /B1_ARTIFACT_DIGEST_MISMATCH/);
});

test('P1 ignores fake manual-dispatch proof locators and derives them only from the signed manifest', async () => {
  const caller = await readFile('.github/workflows/faz3-p1-provision.yml', 'utf8');
  const reusable = await readFile('.github/workflows/faz3-p1-provision-reusable.yml', 'utf8');
  const proofWorkflow = await readFile('.github/workflows/faz3-p0-native-provider-schema.yml', 'utf8');
  assert.doesNotMatch(caller, /native_provider_(?:proof_run_id|artifact_digest)/);
  assert.doesNotMatch(reusable, /inputs\.native_provider_(?:proof_run_id|artifact_digest)/);
  assert.match(reusable, /native-provider-proof-gate:/);
  assert.match(reusable, /verify-p1-native-proof-manifest\.mjs/);
  assert.match(reusable, /--metadata=.*b1-artifacts\.json/);
  assert.match(reusable, /--run-metadata=.*b1-run\.json/);
  assert.match(reusable, /run-id:\s*\$\{\{ steps\.manifest\.outputs\.proof_run_id \}\}/);
  assert.match(reusable, /needs:\s*native-provider-proof-gate/);
  assert.match(reusable, /needs\.native-provider-proof-gate\.result == 'success'/);
  for (const path of [
    'scripts/faz3/verify-p1-native-proof-manifest.mjs',
    'scripts/faz3/verify-b1-native-provider-proof.mjs',
    'security/faz3/attestation/verify-manifest-attestation.mjs',
    'security/faz3/attestation/jcs.mjs',
  ]) assert.match(reusable, new RegExp(`${hash(await readFile(path))}  ${path.replaceAll('.', '\\.')}`));
  assert.match(proofWorkflow, /init -backend=false -input=false -lockfile=readonly/);
  assert.match(proofWorkflow, /providers schema -json/);
  assert.match(proofWorkflow, /TF_LOG=TRACE/);
  assert.doesNotMatch(proofWorkflow, /\btofu\b[^\n]*\b(?:apply|destroy|import)\b/);
});

test('P1 replay guard permits the first claim and rejects the same run/digest a second time', () => {
  assert.equal(verifyProofUnused({ total_count: 0, artifacts: [] }, { claimName: verifiedManifest.claimName }).result, 'PASS');
  assert.throws(() => verifyProofUnused({ total_count: 1, artifacts: [{ name: verifiedManifest.claimName, expired: false }] }, { claimName: verifiedManifest.claimName }), /B1_PROOF_REPLAY_DETECTED/);
  const claim = createConsumptionClaim(verifiedManifest, { workflowRunId: '9001', consumedAt: '2026-09-15T20:00:00Z' });
  assert.equal(claim.claimName, verifiedManifest.claimName);
  assert.equal(claim.proof.runId, verifiedManifest.binding.runId);
  assert.equal(claim.proof.artifactDigestSha256, verifiedManifest.binding.artifact.digestSha256);
});

test('P1 gate rejects proof evidence for a different commit/tree', () => {
  const schema = Buffer.from('{}');
  const inventory = Buffer.from('{}');
  const lockfile = Buffer.from('lock');
  const proof = {
    schemaVersion: 'CZA-B1-NATIVE-PROVIDER-PROOF-V1',
    result: 'PASS',
    application: { commit: '3'.repeat(40), tree: '4'.repeat(40) },
    providerSchema: { sha256: hash(schema), inventorySha256: hash(inventory) },
    lockfile: { sha256: hash(lockfile) },
  };
  const proofDocument = Buffer.from(JSON.stringify(proof));
  const binding = {
    ...verifiedManifest.binding,
    evidence: {
      ...verifiedManifest.binding.evidence,
      proofDocumentSha256: hash(proofDocument),
      providerSchemaSha256: hash(schema),
      providerSchemaInventorySha256: hash(inventory),
      providerLockSha256: hash(lockfile),
    },
  };
  assert.throws(() => verifyManifestProofEvidence(binding, { proofDocument, schema, inventory, lockfile }), /B1_PROOF_APPLICATION_MISMATCH/);
});
