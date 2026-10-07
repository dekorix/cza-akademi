import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const SIGNATURE_VERSION = 'cza-educator-proxy-v2';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing-environment:${name}`);
  return value;
}

const tunnelUrl = new URL(requiredEnvironment('CZA_PROXY_E2E_TUNNEL_URL'));
const originUrl = new URL(requiredEnvironment('CZA_PROXY_E2E_ORIGIN_URL'));
const secret = requiredEnvironment('CZA_PROXY_E2E_HMAC_SECRET');
const accessToken = requiredEnvironment('CZA_PROXY_E2E_ACCESS_TOKEN');
const ownerEmail = requiredEnvironment('CZA_PROXY_E2E_OWNER_EMAIL');
const proxyLog = requiredEnvironment('CZA_PROXY_E2E_PROXY_LOG');
const attackerEmail = 'attacker@example.invalid';

assert.equal(tunnelUrl.protocol, 'https:');
assert.match(tunnelUrl.hostname, /^[a-z0-9-]+\.trycloudflare\.com$/);
assert.equal(originUrl.hostname, '127.0.0.1');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function boundedFetch(input, init = {}) {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
}

function signedHeaders(method, path, body, nonce = randomBytes(32).toString('hex')) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodySha256 = sha256(body);
  const payload = [
    SIGNATURE_VERSION,
    timestamp,
    nonce,
    method,
    path,
    bodySha256,
    ownerEmail,
  ].join('\n');
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return {
    'content-type': 'application/json',
    origin: originUrl.origin,
    'oai-authenticated-user-email': ownerEmail,
    'x-cza-proxy-timestamp': timestamp,
    'x-cza-proxy-nonce': nonce,
    'x-cza-proxy-signature': signature,
  };
}

test('external Cloudflare path rejects unauthenticated preview traffic', async () => {
  const response = await boundedFetch(new URL('/api/educator-auth', tunnelUrl), {
    headers: { 'oai-authenticated-user-email': attackerEmail },
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'preview_access_required');
});

test('external Cloudflare path overwrites spoofed trusted headers', async () => {
  const response = await boundedFetch(new URL('/api/educator-auth', tunnelUrl), {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'oai-authenticated-user-email': attackerEmail,
      'x-cza-proxy-timestamp': '1000000000',
      'x-cza-proxy-nonce': 'a'.repeat(64),
      'x-cza-proxy-signature': '0'.repeat(64),
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-cza-proxy-e2e'), 'signed-boundary');
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'cza-educator-auth');
});

test('external POST identity is rewritten and body-bound HMAC is accepted', async () => {
  const body = JSON.stringify({ action: 'me' });
  const response = await boundedFetch(new URL('/api/educator-auth', tunnelUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      origin: 'https://attacker.example.invalid',
      'oai-authenticated-user-email': attackerEmail,
      'x-cza-proxy-timestamp': '1000000000',
      'x-cza-proxy-nonce': 'b'.repeat(64),
      'x-cza-proxy-signature': '0'.repeat(64),
    },
    body,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.user?.name, 'Habip Çelik');
});

test('proxy streaming limit rejects oversized external body', async () => {
  const response = await boundedFetch(new URL('/api/educator-auth', tunnelUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action: 'me', padding: 'x'.repeat(65 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'request_too_large',
  });
});

test('direct origin rejects a forged identity header', async () => {
  const response = await boundedFetch(new URL('/api/educator-auth', originUrl), {
    headers: { 'oai-authenticated-user-email': ownerEmail },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'trusted_proxy_required');
});

test('origin rejects body tamper and consumes a valid nonce exactly once', async () => {
  const path = '/api/educator-auth';
  const validBody = JSON.stringify({ action: 'me' });
  const tamperedBody = JSON.stringify({ action: 'logout' });
  const headers = signedHeaders('POST', path, validBody);

  const tampered = await boundedFetch(new URL(path, originUrl), {
    method: 'POST',
    headers,
    body: tamperedBody,
  });
  assert.equal(tampered.status, 403);

  const valid = await boundedFetch(new URL(path, originUrl), {
    method: 'POST',
    headers,
    body: validBody,
  });
  assert.equal(valid.status, 200);

  const replay = await boundedFetch(new URL(path, originUrl), {
    method: 'POST',
    headers,
    body: validBody,
  });
  assert.equal(replay.status, 403);
});

test('sanitized proxy log proves overwrite, body hash and unique nonces', async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const events = fs
    .readFileSync(proxyLog, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const forwarded = events.filter((event) => event.event === 'request_forwarded');
  assert.ok(forwarded.length >= 2);
  assert.ok(
    forwarded.every(
      (event) =>
        event.signatureVersion === SIGNATURE_VERSION &&
        event.protectedHeadersOverwritten === true,
    ),
  );
  assert.ok(
    forwarded.every(
      (event) =>
        event.incomingIdentitySha256 === sha256(attackerEmail) &&
        event.forwardedIdentitySha256 === sha256(ownerEmail),
    ),
  );
  assert.equal(
    new Set(forwarded.map((event) => event.nonceSha256)).size,
    forwarded.length,
  );
  assert.ok(
    forwarded.some(
      (event) =>
        event.bodySha256 === sha256(JSON.stringify({ action: 'me' })),
    ),
  );
});
