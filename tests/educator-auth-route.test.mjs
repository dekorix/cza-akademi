import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../app/api/educator-auth/route.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function route(fetch) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', js)(id => {
    if (id.includes('request-guard')) return { allowRequest: () => ({ allowed: true }) };
    return { authUrl: p => `https://auth.test${p}`, educatorCookie: () => 'session=test' };
  }, module, module.exports, fetch);
  return module.exports.POST;
}
const request = body => new Request('https://cza.test/api/educator-auth', { method: 'POST', headers: { origin: 'https://cza.test' }, body: JSON.stringify(body) });
test('reset forwards trusted origin and returns success', async () => {
  const post = route(async (url, options) => {
    assert.equal(url, 'https://auth.test/reset-password');
    assert.equal(options.headers.origin, 'https://cza.test');
    assert.equal(JSON.parse(options.body).token, 'test-token');
    return Response.json({ status: true });
  });
  assert.deepEqual(await (await post(request({ action: 'reset', token: 'test-token', newPassword: 'test-password' }))).json(), { ok: true });
});
test('provider failure is not falsely described as an expired link', async () => {
  for (const [code, status, error] of [['MISSING_ORIGIN', 502, 'reset_unavailable'], ['INVALID_TOKEN', 400, 'invalid_reset']]) {
    const post = route(async () => Response.json({ code }, { status: 400 }));
    const response = await post(request({ action: 'reset', token: 'test-token', newPassword: 'test-password' }));
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, error);
  }
});
test('foreign origins never reach the authentication provider', async () => {
  const post = route(() => { throw new Error('must not call'); });
  const req = new Request('https://cza.test/api/educator-auth', { method: 'POST', headers: { origin: 'https://foreign.test' }, body: '{}' });
  assert.equal((await post(req)).status, 403);
});
