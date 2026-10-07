import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import vercelHandler, {
  createVercelNodeHandler,
} from '../services/cza-learning-core-staging/api/student.js';
import { createStudentHandler } from '../services/cza-learning-core-staging/lib/handler.js';

const TIMEOUT_MS = 1_000;

function nodeRequest(method, body, headers = {}) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  request.method = method;
  request.url = '/api/student';
  request.headers = { host: 'cza-learning-core-staging.invalid', ...headers };
  return request;
}

function parsedNodeRequest(method, body, headers = {}) {
  const request = nodeRequest(method, undefined, headers);
  request.body = body;
  return request;
}

async function invokeRequest(handler, request) {
  const responseHeaders = new Map();
  let completed = false;
  let responseBody = Buffer.alloc(0);
  const response = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders.set(name.toLowerCase(), value);
    },
    end(value) {
      completed = true;
      responseBody = value ? Buffer.from(value) : Buffer.alloc(0);
    },
  };
  const invocation = handler(request, response);
  await Promise.race([
    invocation,
    new Promise((_, reject) => setTimeout(() => reject(new Error('FUNCTION_INVOCATION_TIMEOUT')), TIMEOUT_MS)),
  ]);
  assert.equal(completed, true);
  return {
    status: response.statusCode,
    headers: responseHeaders,
    body: JSON.parse(responseBody.toString('utf8')),
  };
}

async function invoke(handler, method, body, headers = {}) {
  return invokeRequest(handler, nodeRequest(method, body, headers));
}

async function invokeParsed(handler, body, headers = {}) {
  return invokeRequest(handler, parsedNodeRequest('POST', body, headers));
}

test('Vercel Node default export completes GET with 405 instead of timing out', async () => {
  const response = await invoke(vercelHandler, 'GET');
  assert.equal(response.status, 405);
  assert.deepEqual(response.body, { ok: false, error: 'method_not_allowed' });
});

test('Vercel Node bridge completes invalid action POST fail-closed', async () => {
  const response = await invoke(vercelHandler, 'POST', JSON.stringify({ action: 'unknown' }), {
    'content-type': 'application/json',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { ok: false, error: 'invalid_action' });
});

test('Vercel Node bridge completes invalid session POST fail-closed', async () => {
  const webHandler = createStudentHandler({
    databaseFactory: () => ({ me: async () => null }),
  });
  const response = await invoke(
    createVercelNodeHandler(webHandler),
    'POST',
    JSON.stringify({ action: 'me', sessionToken: 'expired-token' }),
    { 'content-type': 'application/json' },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { ok: false, error: 'invalid_session' });
});

test('Vercel Node bridge writes a valid canonical POST Response to res.end', async () => {
  const webHandler = createStudentHandler({
    databaseFactory: () => ({
      me: async () => ({ student: { id: '11111111-1111-4111-8111-111111111111' }, assignments: [], mastery: [] }),
    }),
  });
  const response = await invoke(
    createVercelNodeHandler(webHandler),
    'POST',
    JSON.stringify({ action: 'me', sessionToken: 'valid-token' }),
    { 'content-type': 'application/json' },
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.student.id, '11111111-1111-4111-8111-111111111111');
  assert.match(response.headers.get('content-type'), /^application\/json/);
});

test('Vercel Node bridge forwards a pre-parsed invalid action to canonical validation', async () => {
  const response = await invokeParsed(vercelHandler, { action: 'unknown' }, {
    'content-type': 'application/json',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { ok: false, error: 'invalid_action' });
});

test('Vercel Node bridge forwards a pre-parsed request to canonical session validation', async () => {
  const webHandler = createStudentHandler({
    databaseFactory: () => ({ me: async () => null }),
  });
  const response = await invokeParsed(
    createVercelNodeHandler(webHandler),
    { action: 'me', sessionToken: 'expired-token' },
    { 'content-type': 'application/json' },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { ok: false, error: 'invalid_session' });
});

test('Vercel Node bridge completes a valid pre-parsed canonical POST', async () => {
  const webHandler = createStudentHandler({
    databaseFactory: () => ({
      me: async () => ({ student: { id: '11111111-1111-4111-8111-111111111111' }, assignments: [], mastery: [] }),
    }),
  });
  const response = await invokeParsed(
    createVercelNodeHandler(webHandler),
    { action: 'me', sessionToken: 'valid-token' },
    { 'content-type': 'application/json' },
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.student.id, '11111111-1111-4111-8111-111111111111');
});

test('Vercel Node bridge accepts parsed string and byte body representations', async () => {
  for (const body of [
    JSON.stringify({ action: 'unknown' }),
    Buffer.from(JSON.stringify({ action: 'unknown' })),
    new Uint8Array(Buffer.from(JSON.stringify({ action: 'unknown' }))),
  ]) {
    const response = await invokeParsed(vercelHandler, body, {
      'content-type': 'application/json',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { ok: false, error: 'invalid_action' });
  }
});

test('Vercel Node bridge preserves the body limit for reconstructed parsed JSON', async () => {
  const response = await invokeParsed(
    vercelHandler,
    { action: 'login', username: 'x'.repeat(70_000), pin: '1234' },
    { 'content-type': 'application/json' },
  );
  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { ok: false, error: 'request_too_large' });
});

test('Vercel Node bridge keeps content type and malformed body checks fail-closed', async () => {
  const unsupported = await invokeParsed(vercelHandler, { action: 'unknown' }, {
    'content-type': 'text/plain',
  });
  assert.equal(unsupported.status, 415);
  assert.deepEqual(unsupported.body, { ok: false, error: 'unsupported_media_type' });

  const malformed = await invokeParsed(vercelHandler, 7, {
    'content-type': 'application/json',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { ok: false, error: 'invalid_request' });
});
