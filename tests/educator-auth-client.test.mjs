import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/educator-auth-client.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { educatorAuthRequest, educatorAuthError } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('auth only accepts an explicit successful server response', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(JSON.parse(options.body).action, 'request-reset');
    return Response.json({ ok: true });
  });
  assert.deepEqual(await educatorAuthRequest({ action: 'request-reset' }), { ok: true });
});

test('failed reset requests cannot be reported as sent', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: false, error: 'reset_unavailable' }, { status: 503 }));
  await assert.rejects(educatorAuthRequest({ action: 'request-reset' }), /reset_unavailable/);
});

test('malformed success and network failure remain failures', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(educatorAuthRequest({ action: 'login' }), /auth_unavailable/);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(educatorAuthRequest({ action: 'reset' }), /Failed to fetch/);
  assert.match(educatorAuthError(new TypeError('Failed to fetch')), /yeniden dene/);
});
