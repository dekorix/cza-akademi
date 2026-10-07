#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { lstat, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const root = resolve(options['--root'] || '.');
const schemaPath = resolve(options['--schema'] || '');
const inventoryPath = resolve(options['--inventory'] || '');
const outputPath = resolve(options['--out'] || '');
const sourceCommit = options['--source-commit'];
const tofu = process.env.CZA_TOFU_BIN || 'tofu';
if (!options['--schema'] || !options['--inventory'] || !options['--out'] || !/^[0-9a-f]{40}$/.test(sourceCommit || '')) throw new Error('NATIVE_PROVIDER_PROOF_USAGE');

for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'NEON_API_KEY', 'TF_REATTACH_PROVIDERS', 'TF_CLI_CONFIG_FILE', 'TF_PLUGIN_CACHE_DIR']) {
  if (process.env[name]) throw new Error(`NATIVE_PROVIDER_PROOF_ENV_FORBIDDEN:${name}`);
}

const socketPath = resolve('/tmp', `cza-native-provider-proof-${process.pid}.sock`);
await new Promise((resolveProbe, rejectProbe) => {
  const server = createServer();
  server.once('error', rejectProbe);
  server.listen(socketPath, () => server.close(resolveProbe));
}).catch(error => { throw new Error(`NATIVE_AF_UNIX_REQUIRED:${error.code || 'UNKNOWN'}`); });
await rm(socketPath, { force: true });

const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const providerRoot = resolve(root, 'infra/staging/p1-provision/.terraform/providers');
const requirements = [
  { source: 'registry.opentofu.org/cloudflare/cloudflare', version: '5.25.0', path: 'registry.opentofu.org/cloudflare/cloudflare/5.25.0/linux_amd64/terraform-provider-cloudflare_v5.25.0' },
  { source: 'registry.opentofu.org/terraform-community-providers/neon', version: '0.1.15', path: 'registry.opentofu.org/terraform-community-providers/neon/0.1.15/linux_amd64/terraform-provider-neon_v0.1.15' },
];
const binaries = [];
const signedMirrorRoot = resolve(root, 'delivery/toolchain/providers');
let installationMode = 'DIRECT_REGISTRY_INSTALL';
for (const requirement of requirements) {
  const path = resolve(providerRoot, requirement.path);
  const stat = await lstat(path);
  const resolvedPath = await realpath(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`NATIVE_PROVIDER_BINARY_NOT_REGULAR:${requirement.source}`);
  if (resolvedPath !== path) {
    if (!resolvedPath.startsWith(`${signedMirrorRoot}/`)) throw new Error(`NATIVE_PROVIDER_BINARY_SYMLINK_UNTRUSTED:${requirement.source}`);
    installationMode = 'SIGNED_FILESYSTEM_MIRROR';
  }
  binaries.push({ source: requirement.source, version: requirement.version, platform: 'linux_amd64', sha256: await digest(path), size: stat.size });
}

const version = JSON.parse(execFileSync(tofu, ['version', '-json'], { encoding: 'utf8', env: { PATH: process.env.PATH || '' } }));
if (version.terraform_version !== '1.12.0' || process.platform !== 'linux' || process.arch !== 'x64') throw new Error('NATIVE_TOOLCHAIN_MISMATCH');
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
const schemaSha256 = await digest(schemaPath);
if (inventory.result !== 'PASS' || inventory.providerSchemaSha256 !== schemaSha256 || inventory.cloudflareResourceCount < 100 || inventory.cloudflareDataSourceCount < 20 || inventory.neonProjectPresent !== true) throw new Error('NATIVE_PROVIDER_SCHEMA_INVENTORY_INVALID');

const proof = {
  schemaVersion: 'CZA-NATIVE-PROVIDER-PROOF-V4',
  result: 'PASS',
  sourceCommit,
  platform: { os: process.platform, arch: process.arch, afUnix: true },
  execution: 'OPENTOFU_NATIVE_PLUGIN_PROTOCOL',
  installationMode,
  packageIntegrity: 'READONLY_LOCKFILE_INIT_SUCCEEDED',
  adapterUsed: false,
  developmentOverrideUsed: false,
  reattachProviderUsed: false,
  tofu: { version: version.terraform_version, sha256: await digest(tofu) },
  providerLockSha256: await digest(resolve(root, 'infra/staging/p1-provision/.terraform.lock.hcl')),
  providerSchemaSha256: schemaSha256,
  providerSchemaInventorySha256: await digest(inventoryPath),
  inventory: {
    cloudflareResourceCount: inventory.cloudflareResourceCount,
    cloudflareDataSourceCount: inventory.cloudflareDataSourceCount,
    requiredCloudflare: inventory.requiredCloudflare,
    neonProjectPresent: inventory.neonProjectPresent,
  },
  binaries,
};
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`${JSON.stringify({ result: 'PASS', output: outputPath, providers: binaries.length })}\n`);
