import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import {
  CHILD_ACCESS_DAYS,
  SESSION_ATTEMPT_MAX,
  SESSION_RECORD_MAX_BYTES,
  SESSION_RESTART_MAX,
  childAccessStatus,
  issueChildAccess,
  presentedBearer,
  sessionRecordBytes,
  sha256Hex,
} from '../../apps/assessment-appdeploy/backend/childAccess.ts';
import {
  captureChildAccessFromHash,
  childAssessmentHash,
  readChildAccess,
  rememberChildAccess,
} from '../../apps/assessment-appdeploy/src/childAccessMemory.ts';
import { installChildAccessHeader } from '../../apps/assessment-appdeploy/src/childAccessMemory.ts';

function createDb() {
  const tables = new Map();
  let n = 0;
  const bucket = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  return {
    bucket,
    reset() { tables.clear(); n = 0; },
    async add(name, records) {
      const ids = [];
      for (const record of records) {
        const id = 'rec' + (++n);
        bucket(name).set(id, { ...record, id });
        ids.push(id);
      }
      return ids;
    },
    async get(name, ids) {
      return ids.map((id) => bucket(name).get(id));
    },
    async update(name, rows) {
      return rows.map(({ id, record }) => {
        if (!bucket(name).has(id)) return null;
        const next = { ...record, id };
        bucket(name).set(id, next);
        return id;
      });
    },
    async list(name, options) {
      const limit = options?.limit ?? 100;
      return { items: [...bucket(name).values()].slice(0, limit) };
    },
  };
}

function createSdk(db) {
  function router(map) {
    return async function handle(request) {
      const method = request.method || 'GET';
      const path = request.path;
      for (const [key, handlers] of Object.entries(map)) {
        const space = key.indexOf(' ');
        if (key.slice(0, space) !== method) continue;
        const names = [];
        const regex = new RegExp('^' + key.slice(space + 1).replace(/:([^/]+)/g, (_, name) => {
          names.push(name);
          return '([^/]+)';
        }) + '$');
        const found = path.match(regex);
        if (!found) continue;
        const params = Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1])]));
        const ctx = { params, body: request.body, event: { headers: request.headers || {} }, user: undefined };
        for (const fn of handlers) {
          const result = await fn(ctx);
          if (result) return result;
        }
        return { statusCode: 500, headers: {}, body: JSON.stringify({ error: 'empty' }) };
      }
      return { statusCode: 404, headers: {}, body: JSON.stringify({ error: 'no route' }) };
    };
  }
  return {
    db,
    router,
    json: (data, status = 200) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }),
    error: (message, status = 400) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: message }) }),
    storage: { async write() { return [true]; } },
  };
}

const db = createDb();
globalThis.__CZA_ASSESSMENT_SDK = createSdk(db);
register(new URL('./appdeploy-sdk-loader.mjs', import.meta.url), { parentURL: import.meta.url });

let handler;

function parsed(response) {
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

async function call(method, path, { token, headers, body } = {}) {
  const requestHeaders = { ...(headers || {}) };
  if (token) requestHeaders.authorization = 'Bearer ' + token;
  const response = await handler({ method, path, headers: requestHeaders, body });
  return parsed(response);
}

async function openParent(profile = {}) {
  const result = await call('POST', '/api/parent/sessions', {
    body: { studentLabel: 'Sentetik', profileCode: 'P2', assessmentPurpose: 'GENERAL', startStation: 'FULL', ...profile },
  });
  assert.equal(result.status, 200);
  return result.body;
}

test.before(async () => {
  ({ handler } = await import('../../apps/assessment-appdeploy/backend/index.ts'));
});

test.beforeEach(() => db.reset());

test('child capability is 256 bits, stored only as a digest, and expires with the session window', () => {
  const issued = issueChildAccess(Date.parse('2026-10-15T00:00:00.000Z'));
  assert.equal(issued.secret === issued.childAccessTokenHash, false);
  assert.equal(/^[A-Za-z0-9_-]{43}$/.test(issued.secret), true);
  assert.equal(issued.childAccessTokenHash, sha256Hex(issued.secret));
  assert.equal(Date.parse(issued.childAccessExpiresAt) - Date.parse('2026-10-15T00:00:00.000Z'), CHILD_ACCESS_DAYS * 24 * 60 * 60 * 1000);
  const now = Date.parse('2026-10-15T00:00:00.000Z');
  assert.equal(childAccessStatus({ presentedToken: issued.secret, storedHash: issued.childAccessTokenHash, expiresAt: issued.childAccessExpiresAt, now }), 200);
  assert.equal(childAccessStatus({ presentedToken: issued.secret + 'x', storedHash: issued.childAccessTokenHash, expiresAt: issued.childAccessExpiresAt, now: now + 1000 }), 403);
  assert.equal(childAccessStatus({ presentedToken: issued.secret, storedHash: undefined, expiresAt: issued.childAccessExpiresAt, now }), 403);
  assert.equal(childAccessStatus({ presentedToken: issued.secret, storedHash: issued.childAccessTokenHash, expiresAt: issued.childAccessExpiresAt, now: now + CHILD_ACCESS_DAYS * 24 * 60 * 60 * 1000 }), 401);
  assert.equal(presentedBearer({}).state, 'absent');
  assert.equal(presentedBearer({ authorization: 'Bearer short' }).state, 'malformed');
  assert.equal(presentedBearer({ authorization: 'Bearer ' + issued.secret }).state, 'ok');
});

test('the fragment capability is kept in session storage and removed from the address bar', () => {
  const issued = issueChildAccess();
  const hash = childAssessmentHash('rec1', issued.secret);
  assert.equal(hash.startsWith('#/assessment?session=rec1&access='), true);
  assert.equal(hash.includes('?access='), false);
  const store = { getItem: (key) => store.map.get(key) ?? null, setItem: (key, value) => store.map.set(key, value), map: new Map() };
  let next = '';
  const captured = captureChildAccessFromHash(hash, store, (value) => { next = value; });
  assert.equal(captured, true);
  assert.equal(next.includes('access='), false);
  assert.equal(next.includes(issued.secret), false);
  assert.equal(readChildAccess('rec1', store) === issued.secret, true);
});

test('child session requests send the bearer header for that session id', () => {
  const issued = issueChildAccess();
  const bag = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => bag.get(key) ?? null,
    setItem: (key, value) => bag.set(key, value),
    removeItem: (key) => bag.delete(key),
    clear: () => bag.clear(),
    key: () => null,
    get length() { return bag.size; },
  };
  rememberChildAccess('rec9', issued.secret);
  let seen = '';
  const client = {
    interceptors: { request: { use(fn) { this.fn = fn; } } },
  };
  installChildAccessHeader(client);
  const config = client.interceptors.request.fn({ url: '/api/session/rec9/answer', headers: {} });
  seen = config.headers.Authorization || '';
  assert.equal(seen.startsWith('Bearer '), true);
  assert.equal(seen.slice('Bearer '.length) === issued.secret, true);
  const other = client.interceptors.request.fn({ url: '/api/sessions/recent', headers: {} });
  assert.equal(other.headers.Authorization, undefined);
});

test('reading or writing a session without its capability returns 401', async () => {
  const created = await openParent();
  const read = await call('GET', '/api/session/' + created.id);
  const write = await call('POST', '/api/session/' + created.id + '/answer', { body: { answer: 'merhaba' } });
  const restart = await call('POST', '/api/session/' + created.id + '/restart-warmup', { body: {} });
  assert.equal(read.status, 401);
  assert.equal(write.status, 401);
  assert.equal(restart.status, 401);
  const stored = db.bucket('assessment_sessions').get(created.id);
  assert.equal(stored.attempts.length, 0);
  assert.equal(stored.currentTaskId, 'W1');
});

test('a capability from another session cannot read or write this session', async () => {
  const first = await openParent();
  const second = await openParent();
  assert.equal(first.accessToken === second.accessToken, false);
  const read = await call('GET', '/api/session/' + first.id, { token: second.accessToken });
  const write = await call('POST', '/api/session/' + first.id + '/answer', { token: second.accessToken, body: { answer: 'merhaba' } });
  const restart = await call('POST', '/api/session/' + first.id + '/restart-warmup', { token: second.accessToken, body: {} });
  assert.equal(read.status, 403);
  assert.equal(write.status, 403);
  assert.equal(restart.status, 403);
  const stored = db.bucket('assessment_sessions').get(first.id);
  assert.equal(stored.attempts.length, 0);
  assert.equal(JSON.stringify(stored).includes(first.accessToken), false);
  assert.equal(JSON.stringify(stored).includes(second.accessToken), false);
  assert.equal(stored.childAccessTokenHash, sha256Hex(first.accessToken));
});

test('the matching capability can read and write, and the child payload omits birthDate', async () => {
  const created = await call('POST', '/api/parent/sessions', {
    body: { studentLabel: 'Sentetik', profileCode: 'E2', assessmentPurpose: 'GENERAL', birthDate: '2024-06-01' },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.accessToken === created.body.id, false);
  assert.equal(Object.hasOwn(created.body, 'birthDate'), false);
  const read = await call('GET', '/api/session/' + created.body.id, { token: created.body.accessToken });
  assert.equal(read.status, 200);
  assert.equal(Object.hasOwn(read.body, 'birthDate'), false);
  assert.equal(JSON.stringify(read.body).includes('2024-06-01'), false);
  assert.equal(typeof read.body.ageMonths, 'number');
  assert.equal(read.body.ageMonths >= 24 && read.body.ageMonths <= 35, true);
  assert.equal(Object.hasOwn(read.body, 'childAccessTokenHash'), false);
  assert.equal(JSON.stringify(read.body).includes(created.body.accessToken), false);
  const write = await call('POST', '/api/session/' + created.body.id + '/answer', { token: created.body.accessToken, body: { answer: 'merhaba' } });
  assert.equal(write.status, 200);
  assert.equal(Object.hasOwn(write.body, 'birthDate'), false);
  assert.equal(write.body.attempts.length, 1);
  const restart = await call('POST', '/api/session/' + created.body.id + '/restart-warmup', { token: created.body.accessToken, body: {} });
  assert.equal(restart.status, 200);
  assert.equal(restart.body.currentTask.id, 'W1');
  assert.equal(Object.hasOwn(restart.body, 'birthDate'), false);
});

test('an expired capability is rejected and an educator cookie remains a separate authenticator', async () => {
  const created = await openParent();
  const stored = db.bucket('assessment_sessions').get(created.id);
  stored.childAccessExpiresAt = '2020-01-01T00:00:00.000Z';
  const expired = await call('GET', '/api/session/' + created.id, { token: created.accessToken });
  assert.equal(expired.status, 401);
  const secret = 'educator-fixture-secret-not-a-child-token';
  await db.add('cza_educator_sessions', [{ tokenHash: sha256Hex(secret), expiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-10-15T00:00:00.000Z' }]);
  const educatorId = [...db.bucket('cza_educator_sessions').keys()].at(-1);
  const viaEducator = await call('GET', '/api/session/' + created.id, { headers: { cookie: 'cza_session=' + educatorId + '.' + secret } });
  assert.equal(viaEducator.status, 200);
  assert.equal(Object.hasOwn(viaEducator.body, 'birthDate'), false);
});

const RESTART_ROUTES = [
  ['restart-warmup', 'W1'],
  ['restart-math-scan', 'M1A'],
  ['restart-math-attitude', 'MA1'],
  ['restart-emotional-awareness', 'EA1'],
  ['restart-self-leadership', 'SL1'],
  ['restart-character-compass', 'CG1'],
  ['restart-spiritual-values', 'MV1'],
  ['restart-language-scan', 'L1A'],
  ['restart-potential-lab', 'ZX1'],
  ['restart-working-memory', 'WM1'],
  ['restart-executive-lab', 'EX1'],
  ['restart-expression-lab', 'DX1'],
  ['restart-visual-strategy', 'GV1'],
  ['restart-reading-fluency', 'RF1'],
  ['restart-speed-balance', 'HB1'],
  ['restart-voice-stroop', 'SV1'],
  ['restart-metacognition', 'MC1'],
  ['restart-organize-lab', 'DU1'],
  ['restart-decision-lab', 'DK1'],
  ['restart-adaptive-transfer', 'AV1'],
];

test('every restart route rejects a missing or foreign capability and accepts its own', async () => {
  assert.equal(RESTART_ROUTES.length, 20);
  const created = await openParent();
  const other = await openParent();
  for (const [route, taskId] of RESTART_ROUTES) {
    const path = '/api/session/' + created.id + '/' + route;
    const missing = await call('POST', path, { body: {} });
    const foreign = await call('POST', path, { token: other.accessToken, body: {} });
    assert.equal(missing.status, 401);
    assert.equal(foreign.status, 403);
    const owned = await call('POST', path, { token: created.accessToken, body: {} });
    assert.equal(owned.status, 200);
    assert.equal(owned.body.currentTask.id, taskId);
  }
  const stored = db.bucket('assessment_sessions').get(created.id);
  assert.equal(stored.attempts.length, 0);
  assert.equal(stored.restartCount, 20);
  assert.equal(JSON.stringify(stored).includes(created.accessToken), false);
  assert.equal(JSON.stringify(stored).includes(other.accessToken), false);
});

test('voice sample routes stay outside the session capability', async () => {
  const created = await openParent();
  const voice = await call('POST', '/api/session/' + created.id + '/voice-sample', { body: {} });
  const early = await call('POST', '/api/session/' + created.id + '/early-voice-sample', { body: {} });
  assert.equal(voice.status, 400);
  assert.equal(early.status, 409);
});

test('POST /api/session/:id/answer returns 413 and leaves the stored session unchanged', async () => {
  const created = await openParent();
  const stored = db.bucket('assessment_sessions').get(created.id);
  stored.attempts = [{ taskId: 'W1', title: 'Dolgu', answer: 'x'.repeat(SESSION_RECORD_MAX_BYTES), correctness: 'review', responseLatencyMs: null, totalResponseMs: null, supportLevel: 0 }];
  const before = structuredClone(stored);
  assert.equal(sessionRecordBytes(before) > SESSION_RECORD_MAX_BYTES, true);
  const write = await call('POST', '/api/session/' + created.id + '/answer', { token: created.accessToken, body: { answer: 'merhaba' } });
  assert.equal(write.status, 413);
  const after = db.bucket('assessment_sessions').get(created.id);
  assert.deepEqual(after, before);
  const read = await call('GET', '/api/session/' + created.id, { token: created.accessToken });
  assert.equal(read.status, 200);
  assert.equal(read.body.attempts.length, 1);
  assert.equal(read.body.attempts[0].answer === 'merhaba', false);
});

test('a restart or answer past the session ceiling returns 429 and leaves the stored session unchanged', async () => {
  assert.equal(SESSION_RESTART_MAX, 40);
  assert.equal(SESSION_ATTEMPT_MAX, 96);
  assert.equal(SESSION_RECORD_MAX_BYTES, 512 * 1024);
  const created = await openParent();
  const answer = 'x'.repeat(2000);
  for (let round = 1; round <= SESSION_RESTART_MAX; round += 1) {
    const restart = await call('POST', '/api/session/' + created.id + '/restart-warmup', { token: created.accessToken, body: {} });
    const write = await call('POST', '/api/session/' + created.id + '/answer', { token: created.accessToken, body: { answer, shownAt: 1, completedAt: 2 } });
    assert.equal(restart.status, 200);
    assert.equal(write.status, 200);
  }
  const grown = db.bucket('assessment_sessions').get(created.id);
  const grownBytes = sessionRecordBytes(grown);
  assert.equal(grown.restartCount, SESSION_RESTART_MAX);
  assert.equal(grown.attempts.length, SESSION_RESTART_MAX);
  assert.equal(grownBytes < SESSION_RECORD_MAX_BYTES, true);
  assert.equal(grownBytes > 80_000, true);
  const beforeRestart = structuredClone(grown);
  const blockedRestart = await call('POST', '/api/session/' + created.id + '/restart-warmup', { token: created.accessToken, body: {} });
  assert.equal(blockedRestart.status, 429);
  assert.deepEqual(db.bucket('assessment_sessions').get(created.id), beforeRestart);

  const attemptSession = await openParent();
  const target = db.bucket('assessment_sessions').get(attemptSession.id);
  target.attempts = Array.from({ length: SESSION_ATTEMPT_MAX }, (_, index) => ({
    taskId: 'W1', title: 'Dolgu', answer: String(index), correctness: 'review', responseLatencyMs: null, totalResponseMs: null, supportLevel: 0,
  }));
  const beforeAnswer = structuredClone(target);
  const blockedAnswer = await call('POST', '/api/session/' + attemptSession.id + '/answer', { token: attemptSession.accessToken, body: { answer: 'merhaba' } });
  assert.equal(blockedAnswer.status, 429);
  assert.deepEqual(db.bucket('assessment_sessions').get(attemptSession.id), beforeAnswer);
});

test('a normal answer still fits under the session byte cap', async () => {
  const created = await openParent();
  const write = await call('POST', '/api/session/' + created.id + '/answer', { token: created.accessToken, body: { answer: 'merhaba' } });
  assert.equal(write.status, 200);
  const stored = db.bucket('assessment_sessions').get(created.id);
  assert.equal(sessionRecordBytes(stored) < SESSION_RECORD_MAX_BYTES, true);
  assert.equal(stored.attempts.length, 1);
});
