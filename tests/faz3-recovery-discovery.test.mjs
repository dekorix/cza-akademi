import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { reconcileRun } from '../scripts/faz3/reconcile-staging-v4.mjs';

test('lost provider response is reconciled by run label without a resource ID', async () => {
  const runId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
  const prefix = `cza-f3-${runId.toLowerCase()}`;
  const history = [{ state: 'REQUESTED', runId, label: `${prefix}-staging-stack`, resourceId: null }];
  const calls = [];
  let cleanupStarted = false;
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method });
    if (options.method === 'DELETE') { cleanupStarted = true; return new Response(null, { status: 204 }); }
    if (cleanupStarted) return url.includes('console.neon.tech') ? Response.json({ projects: [] }) : Response.json({ result: [] });
    if (url.includes('console.neon.tech')) return Response.json({ projects: [{ id: 'project-1', name: `${prefix}-staging-stack` }] });
    if (url.includes('/cfd_tunnel')) return Response.json({ result: [{ id: 'tunnel-1', name: `${prefix}-staging-stack` }] });
    if (url.includes('/access/apps')) return Response.json({ result: [{ id: 'app-1', name: `${prefix}-staging-stack` }] });
    if (url.includes('/access/policies')) return Response.json({ result: [{ id: 'policy-1', name: `${prefix}-educator-mfa` }] });
    if (url.includes('/rulesets')) return Response.json({ result: [{ id: 'ruleset-1', name: `${prefix}-request-firewall` }] });
    if (url.includes('/workers/scripts')) return Response.json({ result: [{ id: `${prefix}-staging-stack` }] });
    if (url.includes('/workers/routes')) return Response.json({ result: [{ id: 'route-1', script: `${prefix}-staging-stack` }] });
    if (url.includes('/dns_records')) return Response.json({ result: [{ id: 'dns-1', name: 'transport.staging.invalid' }] });
    throw new Error(`UNEXPECTED_URL:${url}`);
  };
  const result = await reconcileRun({
    history, execute: true, fetchImpl,
    credential: {
      cloudflareApiToken: 'cf', neonApiKey: 'neon', cloudflareAccountId: 'a'.repeat(32), cloudflareZoneId: 'b'.repeat(32),
      transportAuthority: 'transport.staging.invalid', providerEndpoints: ['https://api.cloudflare.com', 'https://console.neon.tech'],
      productionEndpointSha256Denylist: [createHash('sha256').update('production.invalid').digest('hex')],
    },
  });
  assert.equal(result.result, 'RECONCILED');
  assert.equal(result.discovered, 8);
  assert.equal(result.deleted.length, 8);
  assert.equal(result.remaining, 0);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 8);
});

test('reconciler fails if provider discovery still finds a run resource after delete', async () => {
  const runId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
  const prefix = `cza-f3-${runId.toLowerCase()}`;
  const fetchImpl = async (url, options) => {
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (url.includes('console.neon.tech')) return Response.json({ projects: [{ id: 'project-1', name: `${prefix}-staging-stack` }] });
    return Response.json({ result: [] });
  };
  await assert.rejects(reconcileRun({
    history: [{ state: 'REQUESTED', runId, label: `${prefix}-staging-stack`, resourceId: null }], execute: true, fetchImpl,
    credential: {
      cloudflareApiToken: 'cf', neonApiKey: 'neon', cloudflareAccountId: 'a'.repeat(32), cloudflareZoneId: 'b'.repeat(32),
      providerEndpoints: ['https://api.cloudflare.com', 'https://console.neon.tech'],
      productionEndpointSha256Denylist: [createHash('sha256').update('production.invalid').digest('hex')],
    },
  }), /RECOVERY_RESOURCES_REMAIN/);
});

test('reconciler rejects non-staging or malformed recovery identity before provider access', async () => {
  let called = false;
  await assert.rejects(reconcileRun({
    history: [{ runId: 'invalid', label: 'production-main' }], execute: true, credential: {},
    fetchImpl: async () => { called = true; return new Response(); },
  }), /RECOVERY_IDENTITY_MISSING/);
  assert.equal(called, false);
});
