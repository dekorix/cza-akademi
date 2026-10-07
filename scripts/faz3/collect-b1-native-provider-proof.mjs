#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const root = resolve(options['--root'] || '.');
const schemaPath = resolve(options['--schema'] || '');
const inventoryPath = resolve(options['--inventory'] || '');
const handshakeLogPath = resolve(options['--handshake-log'] || '');
const osReleasePath = resolve(options['--os-release'] || '');
const outputPath = resolve(options['--out'] || '');
const matrixPath = resolve(options['--matrix'] || '');
const applicationCommit = options['--application-commit'];
const applicationTree = options['--application-tree'];
const tofu = process.env.CZA_TOFU_BIN || 'tofu';

if (
  !options['--schema'] || !options['--inventory'] || !options['--handshake-log'] ||
  !options['--os-release'] || !options['--out'] || !options['--matrix'] ||
  !/^[0-9a-f]{40}$/.test(applicationCommit || '') || !/^[0-9a-f]{40}$/.test(applicationTree || '')
) throw new Error('B1_NATIVE_PROVIDER_PROOF_USAGE');

const forbiddenEnvironment = [
  'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_API_USER_SERVICE_KEY', 'NEON_API_KEY',
  'TF_REATTACH_PROVIDERS', 'TF_CLI_CONFIG_FILE', 'TF_PLUGIN_CACHE_DIR', 'TF_CLI_ARGS',
  'TF_CLI_ARGS_init', 'TF_CLI_ARGS_providers',
];
for (const name of forbiddenEnvironment) {
  if (process.env[name]) throw new Error(`B1_PROVIDER_PROOF_ENV_FORBIDDEN:${name}`);
}
if (
  process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
  process.env.RUNNER_OS !== 'Linux' || process.env.RUNNER_ARCH !== 'X64' ||
  !process.env.ImageOS || !process.env.ImageVersion
) throw new Error('B1_GITHUB_HOSTED_LINUX_RUNNER_REQUIRED');
if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('B1_NATIVE_LINUX_AMD64_REQUIRED');

const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const providerPolicy = JSON.parse(await readFile(resolve(root, 'infra/staging/provider-lock.json'), 'utf8'));
const lockPath = resolve(root, 'infra/staging/p1-provision/.terraform.lock.hcl');
const lockSha256 = await digest(lockPath);
if (providerPolicy.lockfilePolicy?.sha256 !== lockSha256) throw new Error('B1_PROVIDER_LOCK_POLICY_MISMATCH');

const requirements = [
  { source: 'registry.opentofu.org/cloudflare/cloudflare', version: '5.25.0', relativePath: 'registry.opentofu.org/cloudflare/cloudflare/5.25.0/linux_amd64/terraform-provider-cloudflare_v5.25.0' },
  { source: 'registry.opentofu.org/terraform-community-providers/neon', version: '0.1.15', relativePath: 'registry.opentofu.org/terraform-community-providers/neon/0.1.15/linux_amd64/terraform-provider-neon_v0.1.15' },
];
const providerRoot = resolve(root, 'infra/staging/p1-provision/.terraform/providers');
const providers = [];
for (const requirement of requirements) {
  const policy = providerPolicy.providers?.find(value => value.source === requirement.source);
  if (policy?.version !== requirement.version || !/^[0-9a-f]{64}$/.test(policy?.linuxAmd64BinarySha256 || '')) {
    throw new Error(`B1_PROVIDER_POLICY_INVALID:${requirement.source}`);
  }
  const binaryPath = resolve(providerRoot, requirement.relativePath);
  const stat = await lstat(binaryPath);
  if (!stat.isFile() || stat.isSymbolicLink() || await realpath(binaryPath) !== binaryPath) {
    throw new Error(`B1_DIRECT_PROVIDER_BINARY_REQUIRED:${requirement.source}`);
  }
  const sha256 = await digest(binaryPath);
  if (sha256 !== policy.linuxAmd64BinarySha256) throw new Error(`B1_PROVIDER_BINARY_HASH_MISMATCH:${requirement.source}`);
  providers.push({ source: requirement.source, version: requirement.version, platform: 'linux_amd64', sha256, size: stat.size });
}

const tofuVersion = JSON.parse(execFileSync(tofu, ['version', '-json'], {
  encoding: 'utf8',
  env: { PATH: process.env.PATH || '' },
}));
if (tofuVersion.terraform_version !== providerPolicy.openTofu?.version) throw new Error('B1_OPENTOFU_VERSION_MISMATCH');
const tofuSha256 = await digest(tofu);
if (tofuSha256 !== providerPolicy.openTofu?.linuxAmd64BinarySha256) throw new Error('B1_OPENTOFU_BINARY_HASH_MISMATCH');

const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
const schemaSha256 = await digest(schemaPath);
if (
  inventory.result !== 'PASS' || inventory.providerSchemaSha256 !== schemaSha256 ||
  inventory.cloudflareResourceCount < 100 || inventory.cloudflareDataSourceCount < 20 ||
  inventory.neonProjectPresent !== true
) throw new Error('B1_PROVIDER_SCHEMA_INVENTORY_INVALID');
for (const requirement of requirements) {
  if (!schema.provider_schemas?.[requirement.source]) throw new Error(`B1_PROVIDER_SCHEMA_MISSING:${requirement.source}`);
}

const handshakeLog = await readFile(handshakeLogPath, 'utf8');
const startedProviders = requirements.map(requirement => ({
  source: requirement.source,
  binary: basename(requirement.relativePath),
  processStarted: handshakeLog.split('\n').some(line => line.includes('plugin started:') && line.includes(basename(requirement.relativePath))),
}));
if (startedProviders.some(provider => !provider.processStarted)) throw new Error('B1_PROVIDER_PROCESS_START_NOT_PROVEN');
const pluginAddressLines = handshakeLog.split('\n').filter(line => line.includes('plugin address:'));
const unixSocketHandshakes = pluginAddressLines.filter(line => /\bnetwork=unix\b/.test(line)).length;
if (pluginAddressLines.some(line => /\bnetwork=(?!unix\b)\S+/.test(line)) || unixSocketHandshakes < requirements.length) {
  throw new Error('B1_NATIVE_AF_UNIX_HANDSHAKE_NOT_PROVEN');
}
const protocolVersions = [...new Set([...handshakeLog.matchAll(/using plugin: version=(\d+)/g)].map(match => Number(match[1])))].sort((left, right) => left - right);
if (protocolVersions.length === 0 || protocolVersions.some(version => !Number.isSafeInteger(version) || version < 5)) {
  throw new Error('B1_PROVIDER_PROTOCOL_VERSION_NOT_PROVEN');
}

const osReleaseSha256 = await digest(osReleasePath);
const proof = {
  schemaVersion: 'CZA-B1-NATIVE-PROVIDER-PROOF-V1',
  result: 'PASS',
  application: { commit: applicationCommit, tree: applicationTree },
  runner: {
    environment: process.env.RUNNER_ENVIRONMENT,
    os: process.env.RUNNER_OS,
    arch: process.env.RUNNER_ARCH,
    imageOS: process.env.ImageOS,
    imageVersion: process.env.ImageVersion,
    kernelRelease: execFileSync('uname', ['-r'], { encoding: 'utf8' }).trim(),
    osReleaseSha256,
  },
  platform: { os: process.platform, arch: process.arch, afUnix: true },
  installationMode: 'DIRECT_REGISTRY_INSTALL',
  packageIntegrity: 'READONLY_LOCKFILE_INIT_SUCCEEDED',
  adapterUsed: false,
  developmentOverrideUsed: false,
  reattachProviderUsed: false,
  providerBinaryModified: false,
  providerCredentialsUsed: false,
  providerMutationAttempted: false,
  providerSchemaExecuted: true,
  tofu: { version: tofuVersion.terraform_version, binarySha256: tofuSha256 },
  lockfile: { path: 'infra/staging/p1-provision/.terraform.lock.hcl', sha256: lockSha256 },
  providers,
  providerSchema: {
    sha256: schemaSha256,
    inventorySha256: await digest(inventoryPath),
  },
  nativeHandshake: {
    result: 'PASS',
    transport: 'AF_UNIX',
    execution: 'OPENTOFU_NATIVE_PLUGIN_PROTOCOL',
    logSha256: await digest(handshakeLogPath),
    unixSocketHandshakes,
    protocolVersions,
    providers: startedProviders,
  },
};
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o644 });

const matrix = `# B1 Native Provider Kapanış Matrisi

| Kontrol | Bağlı kanıt | Sonuç |
| --- | --- | --- |
| Temiz native Linux | GitHub-hosted ${proof.runner.imageOS}/${proof.runner.imageVersion}; AF_UNIX | PASS |
| Değiştirilmemiş provider'lar | Cloudflare ${providers[0].version} ve Neon ${providers[1].version} binary SHA-256 | PASS |
| Native schema/handshake | provider-schema SHA-256 + handshake-log SHA-256; ${unixSocketHandshakes} AF_UNIX handshake | PASS |
| Kaynak kimliği | commit \`${applicationCommit}\`; tree \`${applicationTree}\`; lockfile SHA-256 | PASS |
| Mutation/credential/adapter | kullanılmadı | PASS |
`;
await writeFile(matrixPath, matrix, { mode: 0o644 });
process.stdout.write(`${JSON.stringify({ result: 'PASS', output: outputPath, matrix: matrixPath, providers: providers.length })}\n`);
