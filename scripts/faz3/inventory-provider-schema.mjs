#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('SCHEMA_INVENTORY_USAGE');
const bytes = await readFile(input);
const schema = JSON.parse(bytes);
const providers = schema.provider_schemas || {};
const cloudflare = providers['registry.opentofu.org/cloudflare/cloudflare'];
const neon = providers['registry.opentofu.org/terraform-community-providers/neon'];
const requiredCloudflare = [
  'cloudflare_ruleset', 'cloudflare_dns_record', 'cloudflare_workers_script', 'cloudflare_workers_route',
  'cloudflare_zero_trust_access_application', 'cloudflare_zero_trust_access_policy',
  'cloudflare_zero_trust_tunnel_cloudflared', 'cloudflare_zero_trust_tunnel_cloudflared_config',
];
const missing = requiredCloudflare.filter(name => !cloudflare?.resource_schemas?.[name]);
if (missing.length || !neon?.resource_schemas?.neon_project) throw new Error(`PROVIDER_SCHEMA_SURFACE_MISSING:${missing.join(',')}`);
const cloudflareResourceCount = Object.keys(cloudflare.resource_schemas).length;
const cloudflareDataSourceCount = Object.keys(cloudflare.data_source_schemas || {}).length;
if (cloudflareResourceCount < 100 || cloudflareDataSourceCount < 20) throw new Error('PROVIDER_SCHEMA_SUSPICIOUSLY_REDUCED');
const evidence = {
  schemaVersion: 'CZA-PROVIDER-SCHEMA-INVENTORY-V4', result: 'PASS',
  providerSchemaSha256: createHash('sha256').update(bytes).digest('hex'),
  cloudflareResourceCount, cloudflareDataSourceCount, requiredCloudflare,
  neonProjectPresent: true,
};
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence)}\n`);
