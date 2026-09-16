#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const RESOURCE = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;

export function verifyP1NeonStaticGraph({ main, variables, versions, lockfile }) {
  const combined = `${main}\n${variables}\n${versions}\n${lockfile}`;
  if (/cloudflare/i.test(combined)) throw new Error('CLOUDFLARE_SURFACE_FORBIDDEN');
  if (!/terraform-community-providers\/neon/.test(versions) || !/version\s*=\s*"= 0\.1\.15"/.test(versions)) throw new Error('NEON_PROVIDER_PIN_REQUIRED');
  if (!/registry\.opentofu\.org\/terraform-community-providers\/neon/.test(lockfile)) throw new Error('NEON_LOCKFILE_REQUIRED');
  const resources = [...main.matchAll(RESOURCE)].map(match => `${match[1]}.${match[2]}`);
  if (resources.length !== 1 || resources[0] !== 'neon_project.staging') throw new Error('NEON_PROJECT_ONLY_GRAPH_REQUIRED');
  if (!/production_endpoint_sha256_denylist/.test(variables) || !/NEON_STAGING_ONLY/.test(main)) throw new Error('NEON_STAGING_GUARD_REQUIRED');
  for (const output of ['project_id', 'pooled_endpoint', 'unpooled_endpoint', 'migration_endpoint']) {
    if (!new RegExp(`\\b${output}\\b`).test(main)) throw new Error('NEON_OUTPUT_CONTRACT_INCOMPLETE');
  }
  return { result: 'PASS', resources };
}

async function main() {
  const root = 'infra/staging/p1-neon';
  const result = verifyP1NeonStaticGraph({
    main: await readFile(`${root}/main.tf`, 'utf8'),
    variables: await readFile(`${root}/variables.tf`, 'utf8'),
    versions: await readFile(`${root}/versions.tf`, 'utf8'),
    lockfile: await readFile(`${root}/.terraform.lock.hcl`, 'utf8'),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
