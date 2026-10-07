import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { stagingDatabaseConfig } from '../services/cza-learning-core-staging/lib/config.js';
import { createStudentHandler } from '../services/cza-learning-core-staging/lib/handler.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'test-session-token';

function request(body, init = {}) {
  return new Request('https://core-staging.invalid/api/student', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...init.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

async function invoke(database, body, init) {
  const calls = [];
  const wrapped = Object.fromEntries(
    Object.entries(database).map(([name, implementation]) => [
      name,
      async (...args) => {
        calls.push({ name, args });
        return implementation(...args);
      },
    ]),
  );
  const response = await createStudentHandler({ databaseFactory: () => wrapped })(request(body, init));
  return { response, body: await response.json(), calls };
}

const validDatabase = {
  login: async () => ({ ok: true, sessionToken: TOKEN, student: { id: UUID_A } }),
  me: async () => ({ student: { id: UUID_A }, assignments: [], mastery: [] }),
  start: async () => UUID_B,
  attempt: async () => UUID_B,
  interaction: async () => UUID_B,
  finish: async () => ({ sessionId: UUID_B, status: 'completed' }),
};

test('POST-only, JSON-only, invalid action and malformed schema fail closed', async () => {
  const getResponse = await createStudentHandler({ databaseFactory: () => validDatabase })(
    new Request('https://core-staging.invalid/api/student'),
  );
  assert.equal(getResponse.status, 405);

  const wrongType = await invoke(validDatabase, '{"action":"me"}', {
    headers: { 'content-type': 'text/plain' },
  });
  assert.equal(wrongType.response.status, 415);

  const malformed = await invoke(validDatabase, '{');
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.body.error, 'invalid_request');

  const unknown = await invoke(validDatabase, { action: 'admin' });
  assert.equal(unknown.response.status, 400);
  assert.equal(unknown.body.error, 'invalid_action');
  assert.equal(unknown.calls.length, 0);

  const extra = await invoke(validDatabase, { action: 'me', sessionToken: TOKEN, extra: true });
  assert.equal(extra.body.error, 'invalid_request_schema');
  assert.equal(extra.calls.length, 0);
});

test('bounded body rejects an oversized request before database access', async () => {
  const result = await invoke(validDatabase, {
    action: 'login',
    username: 'x'.repeat(70_000),
    pin: '1234',
  });
  assert.equal(result.response.status, 413);
  assert.equal(result.body.error, 'request_too_large');
  assert.equal(result.calls.length, 0);
});

test('invalid credentials are negative and a proven login result is preserved', async () => {
  const invalid = await invoke(
    { ...validDatabase, login: async () => ({ ok: false, error: 'invalid_credentials' }) },
    { action: 'login', username: 'demo', pin: 'bad' },
  );
  assert.equal(invalid.response.status, 401);
  assert.deepEqual(invalid.body, { ok: false, error: 'invalid_credentials' });

  const positive = await invoke(validDatabase, { action: 'login', username: 'demo', pin: '1234' });
  assert.equal(positive.response.status, 200);
  assert.equal(positive.body.sessionToken, TOKEN);
  assert.equal(positive.calls[0].name, 'login');
});

test('me delegates the session token and preserves the dashboard RPC contract', async () => {
  const result = await invoke(validDatabase, { action: 'me', sessionToken: TOKEN });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body.assignments, []);
  assert.equal(result.calls[0].args[0].sessionToken, TOKEN);

  const expired = await invoke({ ...validDatabase, me: async () => null }, {
    action: 'me', sessionToken: 'expired-token',
  });
  assert.equal(expired.response.status, 401);
  assert.equal(expired.body.error, 'invalid_session');
});

test('start validates canonical input and returns a UUID sessionId', async () => {
  const result = await invoke(validDatabase, {
    action: 'start', moduleCode: 'flash_anzan', source: 'free_practice',
    clientSessionId: UUID_A, recipeId: null, settings: { questionCount: 2 }, sessionToken: TOKEN,
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true, sessionId: UUID_B });
});

test('attempt contract delegates only validated canonical fields', async () => {
  const result = await invoke(validDatabase, {
    action: 'attempt', sessionId: UUID_A,
    payload: { clientAttemptId: UUID_B, questionIndex: 0, isCorrect: true },
    sessionToken: TOKEN,
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(result.calls[0].name, 'attempt');
});

test('interaction contract delegates the exact consumer envelope', async () => {
  const result = await invoke(validDatabase, {
    action: 'interaction', sessionId: UUID_A, clientEventId: UUID_B,
    questionIndex: 0, sequenceNo: 1, eventType: 'stimulus_shown',
    screenArea: 'exercise', elapsedMs: 125, payload: {}, sessionToken: TOKEN,
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(result.calls[0].name, 'interaction');
});

test('finish preserves the existing RPC return contract', async () => {
  const result = await invoke(validDatabase, {
    action: 'finish', sessionId: UUID_B, activeDurationMs: 2000,
    questionCount: 2, correctCount: 2, timeoutCount: 0, aborted: false,
    sessionToken: TOKEN,
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { sessionId: UUID_B, status: 'completed' });
});

test('null RPC outcomes reject invalid sessions for every mutating action', async () => {
  const database = { ...validDatabase, start: async () => null, attempt: async () => null,
    interaction: async () => null, finish: async () => null };
  const bodies = [
    { action: 'start', moduleCode: 'flash_anzan', source: 'free_practice', clientSessionId: UUID_A, recipeId: null, settings: {}, sessionToken: TOKEN },
    { action: 'attempt', sessionId: UUID_A, payload: {}, sessionToken: TOKEN },
    { action: 'interaction', sessionId: UUID_A, clientEventId: UUID_B, questionIndex: 0, sequenceNo: 0, eventType: 'answer', screenArea: 'exercise', elapsedMs: 0, payload: {}, sessionToken: TOKEN },
    { action: 'finish', sessionId: UUID_A, sessionToken: TOKEN },
  ];
  for (const body of bodies) {
    const result = await invoke(database, body);
    assert.ok(result.response.status === 401 || result.response.status === 403);
    assert.equal(result.body.ok, false);
  }
});

test('database identity is pinned to the non-production branch and fails closed', () => {
  const base = {
    DATABASE_URL: 'postgresql://staging:secret@ep-falling-resonance-b2qnvtwf.c-6.eu-central-1.aws.neon.tech/cza_learning?sslmode=require',
    CZA_NEON_PROJECT_ID: 'hidden-glade-66748043',
    CZA_NEON_BRANCH_ID: 'br-ancient-bread-b2puable',
    CZA_NEON_DATABASE: 'cza_learning',
  };
  assert.equal(stagingDatabaseConfig(base).databaseUrl, base.DATABASE_URL);
  assert.throws(() => stagingDatabaseConfig({
    ...base,
    DATABASE_URL: 'postgresql://staging:secret@ep-production-main.c-6.eu-central-1.aws.neon.tech/cza_learning?sslmode=require',
  }));
  assert.throws(() => stagingDatabaseConfig({
    ...base,
    DATABASE_URL: 'postgresql://staging:secret@ep-other-branch.c-6.eu-central-1.aws.neon.tech/cza_learning?sslmode=require',
  }));
  assert.throws(() => stagingDatabaseConfig({
    ...base,
    DATABASE_URL: 'postgresql://staging:secret@ep-foreign-project.c-6.eu-central-1.aws.neon.tech/cza_learning?sslmode=require',
  }));
  assert.throws(() => stagingDatabaseConfig({ ...base, CZA_NEON_BRANCH_ID: 'br-aged-bird-b2ml5crw' }));
  assert.throws(() => stagingDatabaseConfig({ ...base, CZA_NEON_DATABASE: 'production' }));
  assert.throws(() => stagingDatabaseConfig({ ...base, DATABASE_URL: 'postgresql://user:secret@db.example.com/cza_learning' }));
  assert.throws(() => stagingDatabaseConfig({ ...base, CZA_NEON_PROJECT_ID: undefined }));
  assert.throws(() => stagingDatabaseConfig({ ...base, CZA_NEON_BRANCH_ID: undefined }));
  assert.throws(() => stagingDatabaseConfig({ ...base, CZA_NEON_DATABASE: undefined }));
  assert.throws(() => stagingDatabaseConfig({}));
});

test('handler and database adapter contain no credential logging or production fallback', async () => {
  const files = await Promise.all([
    readFile(new URL('../services/cza-learning-core-staging/lib/handler.js', import.meta.url), 'utf8'),
    readFile(new URL('../services/cza-learning-core-staging/lib/database.js', import.meta.url), 'utf8'),
    readFile(new URL('../services/cza-learning-core-staging/lib/config.js', import.meta.url), 'utf8'),
  ]);
  const source = files.join('\n');
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)/);
  assert.doesNotMatch(source, /cza-learning-core-v05|prj_DiZ6pfesNKbH0uolMmoydntQ6H3c|dpl_32z3sFZNThgZZbp1ewTLApN659ND/);
  assert.doesNotMatch(source, /token_hash|pin_hash|DATABASE_URL\s*[:=]\s*['"][^'"]+/);
});

test('unexpected database errors expose only a bounded generic error', async () => {
  const secret = 'postgresql://user:password@host/database';
  const result = await invoke({ ...validDatabase, me: async () => { throw new Error(secret); } }, {
    action: 'me', sessionToken: TOKEN,
  });
  assert.equal(result.response.status, 503);
  assert.deepEqual(result.body, { ok: false, error: 'core_unavailable' });
  assert.doesNotMatch(JSON.stringify(result.body), /password|postgresql/);
});
