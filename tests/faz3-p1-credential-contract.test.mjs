import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildP1Environment } from '../scripts/faz3/provider-mutation-wrapper.mjs';

const p0c = 'a'.repeat(64);
const runId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
const nowMs = Date.parse('2026-09-15T12:00:00.000Z');
const credential = {
  p0cAttestationSha256: p0c,
  ttlSeconds: 900,
  scopes: ['staging:create', 'staging:inspect', 'staging:delete'],
  expiresAt: '2026-09-15T15:59:59.000Z',
  cloudflareApiToken: 'cloudflare-scoped-token',
  neonApiKey: 'neon-scoped-key',
  cloudflareAccountId: '1'.repeat(32),
  cloudflareZoneId: '2'.repeat(32),
  publicAuthority: 'phase2-staging.example.test',
  transportAuthority: 'transport-staging.example.test',
  originServiceAuthority: 'origin-staging.internal.test',
  accessAudience: 'audience-id',
  accessIdentityProviderId: 'identity-provider-id',
  educatorEmailDomain: 'example.test',
  stagingCidrAllowlist: ['192.0.2.10/32'],
  originServiceUrl: 'https://origin-staging.internal.test/',
  hmacKeyId: 'cza-faz3-hmac-v1',
  hmacSecret: 'h'.repeat(32),
  ipHashKey: 'i'.repeat(32),
  providerEndpoints: ['https://api.cloudflare.com', 'https://console.neon.tech'],
  productionEndpointSha256Denylist: [createHash('sha256').update('production.example.test').digest('hex')],
};

test('P1 credential contract supplies every declared Terraform variable without ambient secrets', () => {
  const env = buildP1Environment({ credential, p0c, runId, nowMs, path: '/usr/bin' });
  for (const name of [
    'cloudflare_api_token', 'neon_api_key', 'p0c_attestation_sha256', 'run_id', 'expires_at',
    'cloudflare_account_id', 'cloudflare_zone_id', 'public_authority', 'transport_authority',
    'origin_service_authority', 'access_audience', 'access_identity_provider_id', 'educator_email_domain',
    'staging_cidr_allowlist', 'origin_service_url', 'hmac_key_id', 'hmac_secret', 'ip_hash_key',
    'production_endpoint_sha256_denylist',
  ]) assert.ok(Object.hasOwn(env, `TF_VAR_${name}`), name);
  assert.deepEqual(Object.keys(env).filter(name => !name.startsWith('TF_VAR_')).sort(), ['PATH', 'TF_IN_AUTOMATION']);
});

test('P1 credential contract fails closed on attestation, authority, expiry, scope and egress changes', () => {
  const rejects = [
    { p0cAttestationSha256: 'b'.repeat(64) },
    { transportAuthority: credential.publicAuthority },
    { expiresAt: '2026-09-15T16:00:01.000Z' },
    { scopes: ['staging:create'] },
    { providerEndpoints: ['https://api.cloudflare.com'] },
    { productionEndpointSha256Denylist: [createHash('sha256').update('api.cloudflare.com').digest('hex')] },
  ];
  for (const change of rejects) assert.throws(() => buildP1Environment({ credential: { ...credential, ...change }, p0c, runId, nowMs }));
});
