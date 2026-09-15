import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { originHmacMessage } from '../security/faz3/hmac/canonical-origin.mjs';

const secret = 'v4-test-secret-that-is-longer-than-thirty-two-bytes';
const accessJwt = 'synthetic.access.jwt';
const body = '{}';
const now = 1_789_440_000;
const config = {
  publicAuthority: 'phase2-staging.example.invalid', originAuthority: 'phase2-origin.internal',
  accessAudience: 'cza-staging-audience', accessTeamDomain: 'cza-staging.cloudflareaccess.com',
  hmacKeyId: 'staging-2026-09', hmacSecret: secret,
};

async function loadVerifier() {
  const directory = await mkdtemp(resolve(tmpdir(), 'cza-faz3-origin-'));
  const output = resolve(directory, 'verifier.mjs');
  const built = spawnSync(resolve('node_modules/.bin/esbuild'), [
    'lib/faz3-origin-verifier.ts', '--bundle', '--platform=node', '--format=esm', '--target=node22', `--outfile=${output}`,
  ], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  return { module: await import(`${new URL(`file://${output}`).href}?t=${Date.now()}`), directory };
}

function signedRequest(overrides = {}, requestBody = body) {
  const fields = {
    v: '2', kid: config.hmacKeyId, ts: String(now), nonce: 'a'.repeat(32), method: 'POST',
    'public-authority': config.publicAuthority, 'raw-target': '/phase2?b=2&a=1', target: '/phase2?a=1&b=2',
    'route-id': 'phase2-staging-v1', 'origin-service-authority': config.originAuthority,
    'content-type': 'application/json', 'body-sha256': createHash('sha256').update(requestBody).digest('hex'),
    'access-jwt-sha256': createHash('sha256').update(accessJwt).digest('hex'), audience: config.accessAudience,
    'subject-hash': 'edge-authn-only', 'role-metadata': 'edge-authn-only', 'client-ip-hash': 'b'.repeat(64),
    'request-id': '00000000-0000-4000-8000-000000000000', ...overrides,
  };
  const headers = new Headers({ 'content-type': 'application/json', 'cf-access-jwt-assertion': accessJwt });
  for (const [name, value] of Object.entries(fields)) headers.set(`x-cza-${name}`, value);
  headers.set('x-cza-signature', createHmac('sha256', secret).update(originHmacMessage(fields)).digest('hex'));
  return new Request('https://phase2-origin.internal/api/faz3-origin', { method: 'POST', headers, body: requestBody });
}

test('origin verifier binds target, body, Access identity, tenant principal and one-shot nonce', async () => {
  const { module, directory } = await loadVerifier();
  let consumed = false;
  const dependencies = {
    config,
    verifyJwt: async () => ({ subject: 'subject', subjectHash: 'c'.repeat(64), jwtIdHash: 'd'.repeat(64), expiresAt: now + 60 }),
    resolvePrincipal: async subjectHash => subjectHash === 'c'.repeat(64) ? ({ academyId: 'academy', educatorId: 'educator', role: 'reviewer' }) : null,
    consumeNonce: async () => { if (consumed) return false; consumed = true; return true; },
  };
  try {
    const verified = await module.verifyFaz3OriginRequest(signedRequest(), now, dependencies);
    assert.equal(verified.canonicalTarget, '/phase2?a=1&b=2');
    assert.equal(verified.principal.role, 'reviewer');
    await assert.rejects(module.verifyFaz3OriginRequest(signedRequest(), now, dependencies), error => error.code === 'REPLAY_REJECTED');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('origin verifier rejects a changed body even when all identity fixtures are valid', async () => {
  const { module, directory } = await loadVerifier();
  const request = signedRequest({}, body);
  const tampered = new Request(request.url, { method: 'POST', headers: request.headers, body: '{"tampered":true}' });
  try {
    await assert.rejects(module.verifyFaz3OriginRequest(tampered, now, {
      config,
      verifyJwt: async () => ({ subject: 'subject', subjectHash: 'c'.repeat(64), jwtIdHash: null, expiresAt: now + 60 }),
      resolvePrincipal: async () => ({ academyId: 'academy', educatorId: 'educator', role: 'educator' }),
      consumeNonce: async () => true,
    }), error => error.code === 'BODY_TAMPERED');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
