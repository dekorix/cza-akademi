#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX_40 = /^[0-9a-f]{40}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const EXPECTED_PROVIDERS = [
  { source: 'registry.opentofu.org/cloudflare/cloudflare', version: '5.25.0', platform: 'linux_amd64', sha256: '70871d2145742cd1b70ed0ac0482f63e2329bd9468fdb73b20c92bd2f13fce76' },
  { source: 'registry.opentofu.org/terraform-community-providers/neon', version: '0.1.15', platform: 'linux_amd64', sha256: 'e7cc45a5250e11a1542082ac248f3cd5ec52af13e88195e92ceb43947f1fcab3' },
];
const EVIDENCE_FILES = [
  'B1-Kapanis-Matrisi.md', 'native-provider-proof.json', 'provider-handshake.log',
  'provider-lock.hcl', 'provider-schema-inventory.json', 'provider-schema.json',
  'runner-os-release.txt', 'tofu-fmt.txt', 'tofu-init.txt', 'tofu-validate.txt', 'tofu-version.json',
];
const digest = value => createHash('sha256').update(value).digest('hex');

export function verifyGitHubArtifactMetadata(response, { expectedName, expectedDigest }) {
  assert.match(expectedDigest || '', HEX_64, 'B1_ARTIFACT_DIGEST_INVALID');
  const matches = (response?.artifacts || []).filter(artifact => artifact.name === expectedName && artifact.expired === false);
  assert.equal(matches.length, 1, 'B1_ARTIFACT_EXACTLY_ONE_REQUIRED');
  const artifact = matches[0];
  assert.equal(artifact.digest, `sha256:${expectedDigest}`, 'B1_ARTIFACT_DIGEST_MISMATCH');
  assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0, 'B1_ARTIFACT_ID_INVALID');
  assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'B1_ARTIFACT_EMPTY');
  return { result: 'PASS', artifactId: artifact.id, digest: artifact.digest };
}

export function verifyGitHubRunMetadata(response, { expectedCommit, expectedRepository, expectedWorkflowPath }) {
  assert.match(expectedCommit || '', HEX_40, 'B1_RUN_COMMIT_INVALID');
  assert.equal(response?.status, 'completed', 'B1_RUN_NOT_COMPLETED');
  assert.equal(response?.conclusion, 'success', 'B1_RUN_NOT_SUCCESSFUL');
  assert.equal(response?.head_sha, expectedCommit, 'B1_RUN_COMMIT_MISMATCH');
  assert.equal(response?.repository?.full_name, expectedRepository, 'B1_RUN_REPOSITORY_MISMATCH');
  assert.equal(response?.path, expectedWorkflowPath, 'B1_RUN_WORKFLOW_MISMATCH');
  assert.ok(['push', 'workflow_dispatch'].includes(response?.event), 'B1_RUN_EVENT_FORBIDDEN');
  return { result: 'PASS', runId: response.id, commit: response.head_sha, workflow: response.path };
}

export function verifyB1NativeProviderProof(proof, context) {
  assert.match(context.expectedCommit || '', HEX_40, 'B1_EXPECTED_COMMIT_INVALID');
  assert.match(context.expectedTree || '', HEX_40, 'B1_EXPECTED_TREE_INVALID');
  assert.equal(proof.schemaVersion, 'CZA-B1-NATIVE-PROVIDER-PROOF-V1');
  assert.equal(proof.result, 'PASS');
  assert.deepEqual(proof.application, { commit: context.expectedCommit, tree: context.expectedTree });
  assert.equal(proof.runner?.environment, 'github-hosted');
  assert.equal(proof.runner?.os, 'Linux');
  assert.equal(proof.runner?.arch, 'X64');
  assert.match(proof.runner?.imageOS || '', /^ubuntu24$/);
  assert.match(proof.runner?.imageVersion || '', /^\S+$/);
  assert.match(proof.runner?.kernelRelease || '', /^\S+$/);
  assert.equal(proof.runner?.osReleaseSha256, digest(context.osRelease));
  assert.deepEqual(proof.platform, { os: 'linux', arch: 'x64', afUnix: true });
  assert.equal(proof.installationMode, 'DIRECT_REGISTRY_INSTALL');
  assert.equal(proof.packageIntegrity, 'READONLY_LOCKFILE_INIT_SUCCEEDED');
  for (const field of [
    'adapterUsed', 'developmentOverrideUsed', 'reattachProviderUsed', 'providerBinaryModified',
    'providerCredentialsUsed', 'providerMutationAttempted',
  ]) assert.equal(proof[field], false, `B1_FORBIDDEN_FLAG:${field}`);
  assert.equal(proof.providerSchemaExecuted, true);

  assert.equal(context.providerPolicy?.openTofu?.version, '1.12.0');
  assert.equal(proof.tofu?.version, context.providerPolicy.openTofu.version);
  assert.equal(proof.tofu?.binarySha256, context.providerPolicy.openTofu.linuxAmd64BinarySha256);
  assert.equal(proof.lockfile?.path, 'infra/staging/p1-provision/.terraform.lock.hcl');
  const lockSha256 = digest(context.lockfile);
  assert.equal(lockSha256, context.providerPolicy?.lockfilePolicy?.sha256, 'B1_LOCK_POLICY_HASH_MISMATCH');
  assert.equal(proof.lockfile?.sha256, lockSha256, 'B1_LOCK_PROOF_HASH_MISMATCH');
  for (const expected of EXPECTED_PROVIDERS) {
    const block = new RegExp(`provider "${expected.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" \\{([\\s\\S]*?)\\n\\}`).exec(context.lockfile.toString());
    assert.ok(block, `B1_LOCK_PROVIDER_MISSING:${expected.source}`);
    assert.match(block[1], new RegExp(`version\\s*=\\s*"${expected.version.replaceAll('.', '\\.')}"`), `B1_LOCK_PROVIDER_VERSION_MISMATCH:${expected.source}`);
  }

  const schemaSha256 = digest(context.schema);
  const inventorySha256 = digest(context.inventory);
  assert.deepEqual(proof.providerSchema, { sha256: schemaSha256, inventorySha256 });
  const schema = JSON.parse(context.schema);
  const inventory = JSON.parse(context.inventory);
  for (const expected of EXPECTED_PROVIDERS) assert.ok(schema.provider_schemas?.[expected.source], `B1_SCHEMA_PROVIDER_MISSING:${expected.source}`);
  assert.equal(inventory.result, 'PASS');
  assert.equal(inventory.providerSchemaSha256, schemaSha256);
  assert.ok(inventory.cloudflareResourceCount >= 100);
  assert.ok(inventory.cloudflareDataSourceCount >= 20);
  assert.equal(inventory.neonProjectPresent, true);

  assert.equal(proof.nativeHandshake?.result, 'PASS');
  assert.equal(proof.nativeHandshake?.transport, 'AF_UNIX');
  assert.equal(proof.nativeHandshake?.execution, 'OPENTOFU_NATIVE_PLUGIN_PROTOCOL');
  assert.equal(proof.nativeHandshake?.logSha256, digest(context.handshakeLog));
  const handshakeText = context.handshakeLog.toString();
  for (const expected of EXPECTED_PROVIDERS) {
    const binary = `terraform-provider-${expected.source.split('/').at(-1)}_v${expected.version}`;
    assert.ok(handshakeText.split('\n').some(line => line.includes('plugin started:') && line.includes(binary)), `B1_HANDSHAKE_PROVIDER_START_MISSING:${expected.source}`);
  }
  const addressLines = handshakeText.split('\n').filter(line => line.includes('plugin address:'));
  assert.equal(addressLines.some(line => /\bnetwork=(?!unix\b)\S+/.test(line)), false, 'B1_HANDSHAKE_NON_UNIX_TRANSPORT');
  const unixSocketHandshakes = addressLines.filter(line => /\bnetwork=unix\b/.test(line)).length;
  assert.ok(unixSocketHandshakes >= EXPECTED_PROVIDERS.length, 'B1_HANDSHAKE_UNIX_COUNT_INVALID');
  assert.equal(proof.nativeHandshake?.unixSocketHandshakes, unixSocketHandshakes);
  const protocolVersions = [...new Set([...handshakeText.matchAll(/using plugin: version=(\d+)/g)].map(match => Number(match[1])))].sort((left, right) => left - right);
  assert.ok(protocolVersions.length > 0 && protocolVersions.every(version => Number.isSafeInteger(version) && version >= 5));
  assert.deepEqual(proof.nativeHandshake?.protocolVersions, protocolVersions);
  assert.deepEqual(
    proof.nativeHandshake?.providers?.map(provider => ({ source: provider.source, processStarted: provider.processStarted })),
    EXPECTED_PROVIDERS.map(provider => ({ source: provider.source, processStarted: true })),
  );

  assert.equal(proof.providers?.length, EXPECTED_PROVIDERS.length);
  for (const expected of EXPECTED_PROVIDERS) {
    const actual = proof.providers.find(provider => provider.source === expected.source);
    assert.ok(actual, `B1_PROOF_PROVIDER_MISSING:${expected.source}`);
    assert.deepEqual({ source: actual.source, version: actual.version, platform: actual.platform, sha256: actual.sha256 }, expected);
    assert.ok(Number.isSafeInteger(actual.size) && actual.size > 0);
    const policy = context.providerPolicy.providers?.find(provider => provider.source === expected.source);
    assert.equal(policy?.version, expected.version);
    assert.equal(policy?.linuxAmd64BinarySha256, expected.sha256);
  }
  return { result: 'PASS', commit: context.expectedCommit, tree: context.expectedTree, providers: EXPECTED_PROVIDERS.length };
}

export async function verifyEvidenceDirectory(evidenceDirectory, context) {
  const directory = resolve(evidenceDirectory);
  const manifestText = await readFile(resolve(directory, 'sha256sums.txt'), 'utf8');
  const entries = manifestText.trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64})  ([^/]+)$/.exec(line);
    assert.ok(match, `B1_EVIDENCE_MANIFEST_LINE_INVALID:${line}`);
    return { sha256: match[1], name: match[2] };
  });
  assert.deepEqual(entries.map(entry => entry.name).sort(), [...EVIDENCE_FILES].sort(), 'B1_EVIDENCE_FILE_SET_MISMATCH');
  const actualNames = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name).sort();
  assert.deepEqual(actualNames, [...EVIDENCE_FILES, 'sha256sums.txt'].sort(), 'B1_EVIDENCE_DIRECTORY_SET_MISMATCH');
  const files = Object.fromEntries(await Promise.all(EVIDENCE_FILES.map(async name => [name, await readFile(resolve(directory, name))])));
  for (const entry of entries) assert.equal(digest(files[entry.name]), entry.sha256, `B1_EVIDENCE_HASH_MISMATCH:${entry.name}`);
  assert.ok(files['tofu-init.txt'].includes(Buffer.from('OpenTofu has been successfully initialized')), 'B1_TOFU_INIT_SUCCESS_NOT_PROVEN');
  const proof = JSON.parse(files['native-provider-proof.json']);
  const tofuVersion = JSON.parse(files['tofu-version.json']);
  assert.equal(tofuVersion.terraform_version, proof.tofu?.version, 'B1_TOFU_VERSION_ARTIFACT_MISMATCH');
  const result = verifyB1NativeProviderProof(proof, {
    ...context,
    schema: files['provider-schema.json'],
    inventory: files['provider-schema-inventory.json'],
    handshakeLog: files['provider-handshake.log'],
    osRelease: files['runner-os-release.txt'],
    lockfile: files['provider-lock.hcl'],
  });
  return { ...result, evidenceFiles: EVIDENCE_FILES.length };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
  if (options['--metadata']) {
    const metadata = JSON.parse(await readFile(resolve(options['--metadata']), 'utf8'));
    const runMetadata = JSON.parse(await readFile(resolve(options['--run-metadata']), 'utf8'));
    const run = verifyGitHubRunMetadata(runMetadata, {
      expectedCommit: options['--expected-commit'],
      expectedRepository: options['--expected-repository'],
      expectedWorkflowPath: '.github/workflows/faz3-p0-native-provider-schema.yml',
    });
    const artifact = verifyGitHubArtifactMetadata(metadata, {
      expectedName: options['--expected-name'],
      expectedDigest: options['--expected-digest'],
    });
    process.stdout.write(`${JSON.stringify({ result: 'PASS', run, artifact })}\n`);
  } else {
    const root = resolve(options['--root'] || '.');
    const evidence = options['--evidence'];
    if (!evidence) throw new Error('B1_EVIDENCE_DIRECTORY_REQUIRED');
    const providerPolicy = JSON.parse(await readFile(resolve(root, 'infra/staging/provider-lock.json'), 'utf8'));
    const result = await verifyEvidenceDirectory(evidence, {
      expectedCommit: options['--expected-commit'],
      expectedTree: options['--expected-tree'],
      providerPolicy,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}
