import assert from 'node:assert/strict';

const HEX_64 = /^[0-9a-f]{64}$/;
const REQUIRED_CLOUDFLARE = [
  'cloudflare_ruleset', 'cloudflare_dns_record', 'cloudflare_workers_script', 'cloudflare_workers_route',
  'cloudflare_zero_trust_access_application', 'cloudflare_zero_trust_access_policy',
  'cloudflare_zero_trust_tunnel_cloudflared', 'cloudflare_zero_trust_tunnel_cloudflared_config',
];
const REQUIRED_PROVIDERS = [
  { source: 'registry.opentofu.org/cloudflare/cloudflare', version: '5.25.0', platform: 'linux_amd64', sha256: '70871d2145742cd1b70ed0ac0482f63e2329bd9468fdb73b20c92bd2f13fce76' },
  { source: 'registry.opentofu.org/terraform-community-providers/neon', version: '0.1.15', platform: 'linux_amd64', sha256: 'e7cc45a5250e11a1542082ac248f3cd5ec52af13e88195e92ceb43947f1fcab3' },
];

export function verifyNativeProviderProof(proof, { contract, sourceCommit, providerLockSha256, tofuSha256 }) {
  assert.equal(contract.status, 'PASS_REQUIRED_DURING_STATIC_REAUDIT');
  assert.equal(proof.schemaVersion, contract.schemaVersion);
  assert.equal(proof.result, 'PASS');
  assert.equal(proof.sourceCommit, sourceCommit);
  assert.deepEqual(proof.platform, contract.platform);
  assert.equal(proof.execution, contract.execution);
  assert.ok(contract.allowedInstallationModes.includes(proof.installationMode));
  assert.equal(proof.packageIntegrity, 'READONLY_LOCKFILE_INIT_SUCCEEDED');
  assert.equal(proof.adapterUsed, false);
  assert.equal(proof.developmentOverrideUsed, false);
  assert.equal(proof.reattachProviderUsed, false);
  assert.equal(contract.adapterAllowed, false);
  assert.equal(contract.developmentOverrideAllowed, false);
  assert.equal(contract.reattachProviderAllowed, false);
  assert.equal(proof.tofu?.version, '1.12.0');
  assert.equal(proof.tofu?.sha256, tofuSha256);
  assert.equal(proof.providerLockSha256, providerLockSha256);
  assert.match(proof.providerSchemaSha256 || '', HEX_64);
  assert.match(proof.providerSchemaInventorySha256 || '', HEX_64);
  assert.ok(proof.inventory?.cloudflareResourceCount >= 100);
  assert.ok(proof.inventory?.cloudflareDataSourceCount >= 20);
  assert.deepEqual(proof.inventory?.requiredCloudflare, REQUIRED_CLOUDFLARE);
  assert.equal(proof.inventory?.neonProjectPresent, true);
  assert.deepEqual(contract.providers, REQUIRED_PROVIDERS);
  assert.equal(proof.binaries?.length, REQUIRED_PROVIDERS.length);
  const binaries = [...proof.binaries].sort((a, b) => a.source.localeCompare(b.source));
  const expected = [...REQUIRED_PROVIDERS].sort((a, b) => a.source.localeCompare(b.source));
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(binaries[index].source, expected[index].source);
    assert.equal(binaries[index].version, expected[index].version);
    assert.equal(binaries[index].platform, expected[index].platform);
    assert.equal(binaries[index].sha256, expected[index].sha256);
    assert.ok(Number.isSafeInteger(binaries[index].size) && binaries[index].size > 0);
  }
  return { result: 'PASS', schema: proof.schemaVersion, providers: binaries.length, nativeAfUnix: true };
}
