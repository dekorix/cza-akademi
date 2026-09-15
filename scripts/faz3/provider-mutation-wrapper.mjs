#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HEX_64 = /^[0-9a-f]{64}$/;
const HOST = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const MAX_RESOURCE_LIFETIME_MS = 4 * 60 * 60 * 1000;
const REQUIRED_SCOPES = ['staging:create', 'staging:delete', 'staging:inspect'];
const REQUIRED_PROVIDER_HOSTS = ['api.cloudflare.com', 'console.neon.tech'];

function requireString(value, code, minimum = 1) {
  if (typeof value !== 'string' || value.length < minimum || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(code);
  return value;
}

function requireHost(value, code) {
  const host = requireString(value, code).toLowerCase();
  if (!HOST.test(host) || !host.includes('staging') || /(^|[.-])(prod|production|main)([.-]|$)/.test(host)) throw new Error(code);
  return host;
}

function requireHex32(value, code) {
  const id = requireString(value, code);
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error(code);
  return id;
}

export function buildP1Environment({ credential, p0c, runId, nowMs = Date.now(), path = process.env.PATH || '' }) {
  if (!HEX_64.test(p0c || '') || credential?.p0cAttestationSha256 !== p0c || !ULID.test(runId || '')) throw new Error('P1_MUTATION_PREREQUISITE_MISSING');
  if (!Number.isInteger(credential.ttlSeconds) || credential.ttlSeconds < 1 || credential.ttlSeconds > 900) throw new Error('SCOPED_CREDENTIAL_INVALID');
  if (JSON.stringify([...(credential.scopes || [])].sort()) !== JSON.stringify(REQUIRED_SCOPES)) throw new Error('SCOPED_CREDENTIAL_INVALID');

  const expiresAtMs = Date.parse(credential.expiresAt || '');
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs || expiresAtMs > nowMs + MAX_RESOURCE_LIFETIME_MS) throw new Error('STAGING_EXPIRY_INVALID');
  const publicAuthority = requireHost(credential.publicAuthority, 'STAGING_AUTHORITY_INVALID');
  const transportAuthority = requireHost(credential.transportAuthority, 'STAGING_AUTHORITY_INVALID');
  const originServiceAuthority = requireHost(credential.originServiceAuthority, 'STAGING_AUTHORITY_INVALID');
  if (new Set([publicAuthority, transportAuthority, originServiceAuthority]).size !== 3) throw new Error('AUTHORITY_COLLISION');

  const originServiceUrl = new URL(requireString(credential.originServiceUrl, 'ORIGIN_SERVICE_URL_INVALID'));
  if (!['http:', 'https:'].includes(originServiceUrl.protocol) || /(^|[.-])(prod|production|main)([.-]|$)/.test(originServiceUrl.hostname)) throw new Error('ORIGIN_SERVICE_URL_INVALID');
  if (!Array.isArray(credential.stagingCidrAllowlist) || credential.stagingCidrAllowlist.length === 0 || credential.stagingCidrAllowlist.some(value => typeof value !== 'string' || !value.includes('/'))) throw new Error('STAGING_CIDR_INVALID');
  if (!Array.isArray(credential.providerEndpoints) || !Array.isArray(credential.productionEndpointSha256Denylist) || credential.productionEndpointSha256Denylist.length === 0) throw new Error('EGRESS_POLICY_MISSING');
  if (credential.productionEndpointSha256Denylist.some(value => !HEX_64.test(value))) throw new Error('EGRESS_POLICY_INVALID');
  const denied = new Set(credential.productionEndpointSha256Denylist);
  const providerHosts = credential.providerEndpoints.map(endpoint => new URL(endpoint).hostname.toLowerCase()).sort();
  if (JSON.stringify(providerHosts) !== JSON.stringify(REQUIRED_PROVIDER_HOSTS)) throw new Error('PROVIDER_ENDPOINT_SET_INVALID');
  for (const host of providerHosts) if (denied.has(createHash('sha256').update(host).digest('hex'))) throw new Error('PRODUCTION_ENDPOINT_REJECTED');

  const scalarVariables = {
    cloudflare_api_token: requireString(credential.cloudflareApiToken, 'SCOPED_CREDENTIAL_INVALID'),
    neon_api_key: requireString(credential.neonApiKey, 'SCOPED_CREDENTIAL_INVALID'),
    p0c_attestation_sha256: p0c,
    run_id: runId,
    expires_at: new Date(expiresAtMs).toISOString(),
    cloudflare_account_id: requireHex32(credential.cloudflareAccountId, 'SCOPED_CREDENTIAL_INVALID'),
    cloudflare_zone_id: requireHex32(credential.cloudflareZoneId, 'SCOPED_CREDENTIAL_INVALID'),
    public_authority: publicAuthority,
    transport_authority: transportAuthority,
    origin_service_authority: originServiceAuthority,
    access_audience: requireString(credential.accessAudience, 'SCOPED_CREDENTIAL_INVALID'),
    access_identity_provider_id: requireString(credential.accessIdentityProviderId, 'SCOPED_CREDENTIAL_INVALID'),
    educator_email_domain: requireString(credential.educatorEmailDomain, 'SCOPED_CREDENTIAL_INVALID'),
    origin_service_url: originServiceUrl.toString(),
    hmac_key_id: requireString(credential.hmacKeyId, 'SCOPED_CREDENTIAL_INVALID'),
    hmac_secret: requireString(credential.hmacSecret, 'SCOPED_CREDENTIAL_INVALID', 32),
    ip_hash_key: requireString(credential.ipHashKey, 'SCOPED_CREDENTIAL_INVALID', 32),
  };
  const env = { PATH: path, TF_IN_AUTOMATION: '1' };
  for (const [name, value] of Object.entries(scalarVariables)) env[`TF_VAR_${name}`] = value;
  env.TF_VAR_staging_cidr_allowlist = JSON.stringify(credential.stagingCidrAllowlist);
  env.TF_VAR_production_endpoint_sha256_denylist = JSON.stringify(credential.productionEndpointSha256Denylist);
  return env;
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
  const journal = options['--journal'];
  const credentialFile = options['--credential-file'];
  const p0c = options['--p0c-sha256'];
  if (!journal || !credentialFile) throw new Error('P1_MUTATION_PREREQUISITE_MISSING');
  const history = (await readFile(journal, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (history.at(-1)?.state !== 'REQUESTED' || !history.some(item => item.state === 'WAL_DURABLE')) throw new Error('MUTATION_BEFORE_DURABLE_WAL');
  const credential = JSON.parse(await readFile(credentialFile, 'utf8'));
  const env = buildP1Environment({ credential, p0c, runId: history[0].runId });
  const args = ['-chdir=infra/staging/p1-provision', 'apply', '-input=false', '-auto-approve', `-state=${process.cwd()}/recovery/${history[0].runId}.tfstate`];
  const result = spawnSync(process.env.CZA_TOFU_BIN || 'tofu', args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
