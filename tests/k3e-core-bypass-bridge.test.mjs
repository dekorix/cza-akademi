import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(
  new URL('../app/api/core/route.ts', import.meta.url),
  'utf8',
);

const SECRET_ENV = 'CZA_CORE_VERCEL_BYPASS_SECRET';
const BYPASS_HEADER = 'x-vercel-protection-bypass';

function modeledUpstreamHeaders(secret) {
  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
  });
  const normalized = secret?.trim();
  if (normalized) headers.set(BYPASS_HEADER, normalized);
  return headers;
}

test('configured allowed core receives the server-side Vercel bypass header', () => {
  const secret = 'staging-bypass-secret';
  const headers = modeledUpstreamHeaders(secret);
  assert.equal(headers.get(BYPASS_HEADER), secret);
  assert.match(
    route,
    /process\.env\.CZA_CORE_VERCEL_BYPASS_SECRET\?\.trim\(\)/,
  );
  assert.match(
    route,
    /upstreamHeaders\.set\(\s*'x-vercel-protection-bypass',\s*vercelBypassSecret,?\s*\)/,
  );
  assert.match(route, /fetch\(coreUrl, \{[\s\S]*headers: upstreamHeaders/);
});

test('missing or blank secret preserves the existing upstream headers', () => {
  for (const secret of [undefined, '', '   ']) {
    const headers = modeledUpstreamHeaders(secret);
    assert.equal(headers.has(BYPASS_HEADER), false);
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('accept'), 'application/json');
  }
});

test('allowlist validation fails closed before the secret is read or fetch starts', () => {
  const validation = route.indexOf('coreUrl = configuredCoreUrl();');
  const secretRead = route.indexOf(`process.env.${SECRET_ENV}`);
  const upstreamFetch = route.indexOf('fetch(coreUrl');
  assert.ok(validation >= 0);
  assert.ok(secretRead > validation);
  assert.ok(upstreamFetch > secretRead);
  assert.match(route, /core_configuration_unavailable/);
});

test('bypass secret is absent from URL, logs, payload and responses', () => {
  assert.doesNotMatch(
    route,
    /console\.(?:log|info|warn|error)[\s\S]{0,120}vercelBypassSecret/,
  );
  assert.doesNotMatch(route, /JSON\.stringify\([^)]*vercelBypassSecret/);
  assert.doesNotMatch(route, /respond\([^)]*vercelBypassSecret/);
  assert.doesNotMatch(route, /coreUrl\s*[+]?=[^;]*vercelBypassSecret/);
  assert.doesNotMatch(route, /searchParams[\s\S]{0,120}vercelBypassSecret/);
});

test('canonical proxy payload and lifecycle actions remain unchanged', () => {
  assert.match(
    route,
    /const payload: Record<string, unknown> = \{ \.\.\.input \}/,
  );
  assert.match(route, /delete payload\.sessionToken/);
  assert.match(
    route,
    /if \(action !== 'login'\) payload\.sessionToken = sessionToken/,
  );
  for (const action of ['login', 'start', 'attempt', 'interaction', 'finish']) {
    assert.match(
      route,
      new RegExp(`action === '${action}'|action !== '${action}'`),
    );
  }
  assert.match(route, /body: JSON\.stringify\(payload\)/);
});
