#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HEX_64 = /^[0-9a-f]{64}$/;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const REQUIRED_SCOPES = ['staging:neon:create', 'staging:neon:delete', 'staging:neon:inspect'];
const REQUIRED_PROVIDER_ENDPOINT = 'https://console.neon.tech/api/v2/';
const MAX_CREDENTIAL_TTL_SECONDS = 900;
const MAX_RESOURCE_LIFETIME_MS = 4 * 60 * 60 * 1000;
const ALLOWED_CREDENTIAL_KEYS = new Set([
  'expiresAt', 'neonApiKey', 'p0cAttestationSha256', 'productionEndpointSha256Denylist',
  'providerEndpoints', 'scopes', 'targetEnvironment', 'targetProjectNamePrefix', 'ttlSeconds',
]);

function exactArray(actual, expected) {
  return Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

export function assertP1NeonMutationReady(history) {
  if (!Array.isArray(history) || history.length < 3) throw new Error('MUTATION_BEFORE_DURABLE_WAL');
  const states = history.map(entry => entry?.state);
  if (states[0] !== 'PREPARED' || !states.includes('WAL_DURABLE') || states.at(-1) !== 'REQUESTED') {
    throw new Error('MUTATION_BEFORE_DURABLE_WAL');
  }
  const runId = history[0]?.runId;
  if (!ULID.test(runId || '') || history.some(entry => entry?.runId !== runId)) throw new Error('WAL_IDENTITY_INVALID');
  return runId;
}

export function buildP1NeonEnvironment({ credential, p0c, runId, nowMs = Date.now(), path = process.env.PATH || '' }) {
  if (!credential || typeof credential !== 'object' || Array.isArray(credential)) throw new Error('NEON_SCOPED_CREDENTIAL_INVALID');
  const keys = Object.keys(credential);
  if (keys.some(key => /cloudflare/i.test(key))) throw new Error('CLOUDFLARE_CREDENTIAL_FORBIDDEN');
  if (keys.some(key => !ALLOWED_CREDENTIAL_KEYS.has(key))) throw new Error('NEON_SCOPED_CREDENTIAL_INVALID');
  if (!HEX_64.test(p0c || '') || credential.p0cAttestationSha256 !== p0c || !ULID.test(runId || '')) throw new Error('P1_NEON_PREREQUISITE_MISSING');
  if (!Number.isInteger(credential.ttlSeconds) || credential.ttlSeconds < 1 || credential.ttlSeconds > MAX_CREDENTIAL_TTL_SECONDS) throw new Error('NEON_SCOPED_CREDENTIAL_INVALID');
  if (!exactArray(credential.scopes, REQUIRED_SCOPES)) throw new Error('NEON_SCOPED_CREDENTIAL_INVALID');
  if (credential.targetEnvironment !== 'staging' || credential.targetProjectNamePrefix !== 'cza-f3-staging-') throw new Error('NEON_STAGING_ONLY');

  const expiresAtMs = Date.parse(credential.expiresAt || '');
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs || expiresAtMs > nowMs + MAX_RESOURCE_LIFETIME_MS) throw new Error('STAGING_EXPIRY_INVALID');
  if (!exactArray(credential.providerEndpoints, [REQUIRED_PROVIDER_ENDPOINT])) throw new Error('NEON_PROVIDER_ENDPOINT_INVALID');
  const providerHost = new URL(REQUIRED_PROVIDER_ENDPOINT).hostname;
  const denylist = credential.productionEndpointSha256Denylist;
  if (!Array.isArray(denylist) || denylist.length === 0 || denylist.some(value => !HEX_64.test(value))) throw new Error('PRODUCTION_ENDPOINT_DENYLIST_REQUIRED');
  if (denylist.includes(createHash('sha256').update(providerHost).digest('hex'))) throw new Error('PRODUCTION_ENDPOINT_REJECTED');
  if (typeof credential.neonApiKey !== 'string' || credential.neonApiKey.length < 20 || /[\u0000-\u001f\u007f]/.test(credential.neonApiKey)) throw new Error('NEON_SCOPED_CREDENTIAL_INVALID');

  return {
    PATH: path,
    TF_IN_AUTOMATION: '1',
    TF_VAR_environment: 'staging',
    TF_VAR_expires_at: new Date(expiresAtMs).toISOString(),
    TF_VAR_neon_api_key: credential.neonApiKey,
    TF_VAR_p0c_attestation_sha256: p0c,
    TF_VAR_production_endpoint_sha256_denylist: JSON.stringify(denylist),
    TF_VAR_run_id: runId,
  };
}

export function buildP1NeonApplyArgs(runId, cwd = process.cwd()) {
  if (!ULID.test(runId || '')) throw new Error('WAL_IDENTITY_INVALID');
  return ['-chdir=infra/staging/p1-neon', 'apply', '-input=false', '-auto-approve', `-state=${cwd}/recovery/${runId}.tfstate`];
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
  const journal = options['--journal'];
  const credentialFile = options['--credential-file'];
  const p0c = options['--p0c-sha256'];
  if (!journal || !credentialFile) throw new Error('P1_NEON_PREREQUISITE_MISSING');
  const history = (await readFile(journal, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const runId = assertP1NeonMutationReady(history);
  const credential = JSON.parse(await readFile(credentialFile, 'utf8'));
  const env = buildP1NeonEnvironment({ credential, p0c, runId });
  const result = spawnSync(process.env.CZA_TOFU_BIN || 'tofu', buildP1NeonApplyArgs(runId), { stdio: 'inherit', env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
