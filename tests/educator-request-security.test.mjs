import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL('../lib/educator-request-security.ts', import.meta.url),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const commonJsModule = { exports: {} };
// oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
new Function('require', 'module', 'exports', js)(
  (id) => {
    if (id === 'node:crypto') return crypto;
    throw new Error(`unexpected import: ${id}`);
  },
  commonJsModule,
  commonJsModule.exports,
);
const security = commonJsModule.exports;

function jsonRequest(body, headers = {}) {
  return new Request('https://cza.test/api/educator-auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

test('bounded reader returns strict normalized input and the exact body digest', async () => {
  const raw = JSON.stringify({
    action: 'request-reset',
    email: '  EDUCATOR@TEST.EXAMPLE  ',
  });
  const result = await security.readEducatorAuthRequest(jsonRequest(raw));
  assert.deepEqual(result.input, {
    action: 'request-reset',
    email: 'educator@test.example',
  });
  assert.equal(
    result.bodySha256,
    crypto.createHash('sha256').update(raw).digest('hex'),
  );
});

test('root primitives, arrays, unknown fields and prototype keys are rejected', async () => {
  for (const body of [
    'null',
    '[]',
    JSON.stringify({ action: 'me', extra: true }),
    '{"action":"me","__proto__":{"admin":true}}',
  ]) {
    await assert.rejects(
      security.readEducatorAuthRequest(jsonRequest(body)),
      (error) =>
        ['invalid_request', 'invalid_request_schema'].includes(error.code) &&
        error.status === 400,
    );
  }
});

test('chunked bodies are cancelled as soon as they exceed 64 KiB', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40 * 1024));
      controller.enqueue(new Uint8Array(25 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('https://cza.test/api/educator-auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    duplex: 'half',
  });
  await assert.rejects(
    security.readEducatorAuthRequest(request),
    (error) => error.code === 'request_too_large' && error.status === 413,
  );
  assert.equal(cancelled, true);
});

test('declared size and media type fail before JSON parsing', async () => {
  await assert.rejects(
    security.readEducatorAuthRequest(
      jsonRequest('{"action":"me"}', { 'content-length': '65537' }),
    ),
    (error) => error.code === 'request_too_large' && error.status === 413,
  );
  await assert.rejects(
    security.readEducatorAuthRequest(
      new Request('https://cza.test/api/educator-auth', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{"action":"me"}',
      }),
    ),
    (error) => error.code === 'unsupported_media_type' && error.status === 415,
  );
});
