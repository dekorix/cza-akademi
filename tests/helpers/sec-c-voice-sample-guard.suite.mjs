import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { register } from 'node:module';

const AUTH_REQUIRED = '{"error":"Oturum erişim belirteci gerekli"}';
const AUTH_INVALID = '{"error":"Oturum erişim belirteci geçersiz"}';

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createDb() {
  const tables = new Map();
  let n = 0;
  const gets = [];
  const bucket = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  return {
    bucket,
    gets,
    reset() {
      tables.clear();
      gets.length = 0;
      n = 0;
    },
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
      gets.push(name);
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

const writes = [];
const db = createDb();

function createSdk() {
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
    storage: {
      async write(rows) {
        writes.push(rows);
        return [true];
      },
    },
  };
}

globalThis.__CZA_ASSESSMENT_SDK = createSdk();
register(new URL('./sec-c-appdeploy-sdk-loader.mjs', import.meta.url));

const { handler } = await import('../../apps/assessment-appdeploy/backend/index.ts');
const {
  VOICE_QUOTA_COLLECTION,
  VOICE_SAMPLE_MAX_BYTES,
  EARLY_SAMPLE_MAX_BYTES,
  VOICE_SAMPLE_MAX_PER_SESSION,
  VOICE_SESSION_MAX_BYTES,
} = await import('../../apps/assessment-appdeploy/backend/voiceSampleGuard.ts');

function token() {
  return randomBytes(32).toString('base64url');
}

async function addSession(extra = {}) {
  const [id] = await db.add('assessment_sessions', [{
    studentLabel: 'Sentetik',
    status: 'active',
    startStation: 'FULL',
    currentTaskId: 'W1',
    attempts: [],
    observations: [],
    createdAt: '2026-10-15T00:00:00.000Z',
    profileCode: 'P2',
    ...extra,
  }]);
  return id;
}

async function educatorCookie() {
  const secret = randomBytes(32).toString('hex');
  const [id] = await db.add('cza_educator_sessions', [{
    tokenHash: sha256Hex(secret),
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-10-15T00:00:00.000Z',
  }]);
  return 'cza_session=' + id + '.' + secret;
}

async function call(request) {
  return handler(request);
}

function unreadBody() {
  let reads = 0;
  return {
    reads: () => reads,
    get body() {
      reads += 1;
      return { content: 'YQ==', contentType: 'audio/webm', durationMs: 10 };
    },
  };
}

test.beforeEach(() => {
  db.reset();
  writes.length = 0;
});

test('health check still reaches the inner router', async () => {
  const response = await call({ method: 'GET', path: '/api/_healthcheck', headers: {} });
  assert.equal(response.statusCode, 200);
  assert.equal(writes.length, 0);
});

test('other session routes stay outside the voice gate', async () => {
  const id = await addSession();
  const before = db.gets.length;
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/answer',
    headers: {},
    body: { answer: 'merhaba' },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(writes.length, 0);
  assert.ok(db.gets.slice(before).includes('assessment_sessions'));
});

for (const route of ['voice-sample', 'early-voice-sample']) {
  test('missing credential returns 401 for an existing and a missing ' + route + ' and writes nothing', async () => {
    const existing = await addSession(route === 'early-voice-sample'
      ? { profileCode: 'E2', earlyDevelopment: { version: 'E2-v2', responses: [] } }
      : {});
    const probe = unreadBody();
    const present = await call({ method: 'POST', path: '/api/session/' + existing + '/' + route, headers: {}, get body() { return probe.body; } });
    const absentProbe = unreadBody();
    const absent = await call({ method: 'POST', path: '/api/session/missing-session/' + route, headers: {}, get body() { return absentProbe.body; } });
    assert.equal(present.statusCode, 401);
    assert.equal(absent.statusCode, 401);
    assert.equal(present.body, absent.body);
    assert.equal(present.body, AUTH_REQUIRED);
    assert.equal(present.body.includes(existing), false);
    assert.equal(probe.reads(), 0);
    assert.equal(absentProbe.reads(), 0);
    assert.equal(writes.length, 0);
    assert.equal(db.gets.includes('assessment_sessions'), false);
  });
}

test('early voice without a credential does not reveal E2 version or existence', async () => {
  const legacy = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v2', responses: [] } });
  const current = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v7', responses: [] } });
  const legacyResponse = await call({ method: 'POST', path: '/api/session/' + legacy + '/early-voice-sample', headers: {}, body: {} });
  const currentResponse = await call({ method: 'POST', path: '/api/session/' + current + '/early-voice-sample', headers: {}, body: {} });
  const missingResponse = await call({ method: 'POST', path: '/api/session/missing-session/early-voice-sample', headers: {}, body: {} });
  assert.equal(legacyResponse.statusCode, 401);
  assert.equal(currentResponse.statusCode, 401);
  assert.equal(missingResponse.statusCode, 401);
  assert.equal(legacyResponse.body, currentResponse.body);
  assert.equal(currentResponse.body, missingResponse.body);
  assert.equal(writes.length, 0);
});

test('a bearer from another session returns 403 and writes nothing', async () => {
  const owned = token();
  const foreign = token();
  const id = await addSession({
    childAccessTokenHash: sha256Hex(owned),
    childAccessExpiresAt: '2099-01-01T00:00:00.000Z',
  });
  await addSession({
    childAccessTokenHash: sha256Hex(foreign),
    childAccessExpiresAt: '2099-01-01T00:00:00.000Z',
  });
  const probe = unreadBody();
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: { authorization: 'Bearer ' + foreign },
    get body() { return probe.body; },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body, AUTH_INVALID);
  assert.equal(response.body.includes(foreign), false);
  assert.equal(probe.reads(), 0);
  assert.equal(writes.length, 0);
});

test('declared P2 oversize returns 413 before the body is read and writes nothing', async () => {
  const secret = token();
  const id = await addSession({
    childAccessTokenHash: sha256Hex(secret),
    childAccessExpiresAt: '2099-01-01T00:00:00.000Z',
  });
  let reads = 0;
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: {
      authorization: 'Bearer ' + secret,
      'content-length': String(VOICE_SAMPLE_MAX_BYTES + 1),
    },
    get body() {
      reads += 1;
      return { content: 'YQ==', contentType: 'audio/webm' };
    },
  });
  assert.equal(response.statusCode, 413);
  assert.equal(JSON.parse(response.body).error, 'Ses kaydı boyut sınırını aşıyor');
  assert.equal(reads, 0);
  assert.equal(writes.length, 0);
});

test('declared E2 oversize returns 413 before the body is read and writes nothing', async () => {
  const cookie = await educatorCookie();
  const id = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v7', responses: [] } });
  let reads = 0;
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/early-voice-sample',
    headers: { cookie, 'content-length': String(EARLY_SAMPLE_MAX_BYTES + 1) },
    get body() {
      reads += 1;
      return { content: 'YQ==', contentType: 'audio/webm', itemId: 'E7_AUD_03' };
    },
  });
  assert.equal(response.statusCode, 413);
  assert.equal(JSON.parse(response.body).error, 'Ses kaydı boyut sınırını aşıyor');
  assert.equal(reads, 0);
  assert.equal(writes.length, 0);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).size, 0);
});

test('P2 content over 4 MiB returns 413 and writes nothing', async () => {
  const cookie = await educatorCookie();
  const id = await addSession();
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: { cookie },
    body: { content: 'A'.repeat(VOICE_SAMPLE_MAX_BYTES + 1), contentType: 'audio/webm' },
  });
  assert.equal(response.statusCode, 413);
  assert.equal(writes.length, 0);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).size, 0);
});

test('E2 content over 1 MiB returns 413 and writes nothing', async () => {
  const cookie = await educatorCookie();
  const id = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v7', responses: [] } });
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/early-voice-sample',
    headers: { cookie },
    body: {
      content: 'A'.repeat(EARLY_SAMPLE_MAX_BYTES + 1),
      contentType: 'audio/webm',
      itemId: 'E7_AUD_03',
    },
  });
  assert.equal(response.statusCode, 413);
  assert.equal(writes.length, 0);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).size, 0);
});

test('the per-session sample ceiling returns 429 and writes nothing', async () => {
  const cookie = await educatorCookie();
  const id = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v7', responses: [] } });
  const [quotaId] = await db.add(VOICE_QUOTA_COLLECTION, [{ sessionId: id, count: VOICE_SAMPLE_MAX_PER_SESSION }]);
  const stored = db.bucket('assessment_sessions').get(id);
  stored.voiceSampleQuotaId = quotaId;
  const probe = unreadBody();
  const early = await call({
    method: 'POST',
    path: '/api/session/' + id + '/early-voice-sample',
    headers: { cookie },
    get body() { return probe.body; },
  });
  const stroop = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: { cookie },
    get body() { return probe.body; },
  });
  assert.equal(early.statusCode, 429);
  assert.equal(stroop.statusCode, 429);
  assert.equal(early.body, stroop.body);
  assert.equal(JSON.parse(early.body).error, 'Bu oturum için ses örneği sınırına ulaşıldı');
  assert.equal(probe.reads(), 0);
  assert.equal(writes.length, 0);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).get(quotaId).count, VOICE_SAMPLE_MAX_PER_SESSION);
});

test('the per-session byte ceiling returns 429 and writes nothing', async () => {
  const cookie = await educatorCookie();
  const id = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v7', responses: [] } });
  const [quotaId] = await db.add(VOICE_QUOTA_COLLECTION, [{
    sessionId: id,
    count: 1,
    bytes: VOICE_SESSION_MAX_BYTES,
  }]);
  const stored = db.bucket('assessment_sessions').get(id);
  stored.voiceSampleQuotaId = quotaId;
  const probe = unreadBody();
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: { cookie },
    get body() { return probe.body; },
  });
  assert.equal(response.statusCode, 429);
  assert.equal(JSON.parse(response.body).error, 'Bu oturum için toplam ses boyutu sınırına ulaşıldı');
  assert.equal(probe.reads(), 0);
  assert.equal(writes.length, 0);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).get(quotaId).bytes, VOICE_SESSION_MAX_BYTES);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).get(quotaId).count, 1);
});

test('a sample that would cross the session byte ceiling returns 429 and writes nothing', async () => {
  const cookie = await educatorCookie();
  const id = await addSession({ profileCode: 'E2', earlyDevelopment: { version: 'E2-v7', responses: [] } });
  const [quotaId] = await db.add(VOICE_QUOTA_COLLECTION, [{
    sessionId: id,
    count: 2,
    bytes: VOICE_SESSION_MAX_BYTES - 4,
  }]);
  const stored = db.bucket('assessment_sessions').get(id);
  stored.voiceSampleQuotaId = quotaId;
  const response = await call({
    method: 'POST',
    path: '/api/session/' + id + '/early-voice-sample',
    headers: { cookie },
    body: { content: 'AAAAA', contentType: 'audio/webm', itemId: 'E7_AUD_03' },
  });
  assert.equal(response.statusCode, 429);
  assert.equal(JSON.parse(response.body).error, 'Bu oturum için toplam ses boyutu sınırına ulaşıldı');
  assert.equal(writes.length, 0);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).get(quotaId).bytes, VOICE_SESSION_MAX_BYTES - 4);
  assert.equal(db.bucket(VOICE_QUOTA_COLLECTION).get(quotaId).count, 2);
});

test('educator cookie and matching bearer can store one sample each', async () => {
  const cookie = await educatorCookie();
  const secret = token();
  const educatorSession = await addSession();
  const childSession = await addSession({
    profileCode: 'E2',
    earlyDevelopment: { version: 'E2-v7', responses: [] },
    childAccessTokenHash: sha256Hex(secret),
    childAccessExpiresAt: '2099-01-01T00:00:00.000Z',
  });
  const byEducator = await call({
    method: 'POST',
    path: '/api/session/' + educatorSession + '/voice-sample',
    headers: { cookie },
    body: { content: 'YQ==', contentType: 'audio/webm', durationMs: 30 },
  });
  const byBearer = await call({
    method: 'POST',
    path: '/api/session/' + childSession + '/early-voice-sample',
    headers: { authorization: 'Bearer ' + secret },
    body: { content: 'YQ==', contentType: 'audio/webm', durationMs: 20, itemId: 'E7_AUD_03' },
  });
  assert.equal(byEducator.statusCode, 200);
  assert.equal(byBearer.statusCode, 200);
  assert.equal(writes.length, 2);
  assert.equal(writes[0][0].path.startsWith('voice/' + educatorSession + '/stroop-'), true);
  assert.equal(writes[1][0].path.startsWith('early/' + childSession + '/E7_AUD_03-'), true);
  assert.equal(writes[0][0].content, 'YQ==');
  assert.equal(JSON.parse(byEducator.body).path.includes(secret), false);
  const linked = db.bucket('assessment_sessions').get(childSession);
  assert.equal(typeof linked.voiceSampleQuotaId, 'string');
  const childQuota = db.bucket(VOICE_QUOTA_COLLECTION).get(linked.voiceSampleQuotaId);
  assert.equal(childQuota.count, 1);
  assert.equal(childQuota.bytes, Buffer.byteLength('YQ=='));
});

test('an expired bearer is rejected and an invalid educator cookie does not open the route', async () => {
  const secret = token();
  const id = await addSession({
    childAccessTokenHash: sha256Hex(secret),
    childAccessExpiresAt: '2020-01-01T00:00:00.000Z',
  });
  const expired = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: { authorization: 'Bearer ' + secret },
    body: { content: 'YQ==', contentType: 'audio/webm' },
  });
  const invalidCookie = await call({
    method: 'POST',
    path: '/api/session/' + id + '/voice-sample',
    headers: { cookie: 'cza_session=missing.not-a-real-secret' },
    body: { content: 'YQ==', contentType: 'audio/webm' },
  });
  const missingWithInvalidCookie = await call({
    method: 'POST',
    path: '/api/session/missing-session/voice-sample',
    headers: { cookie: 'cza_session=missing.not-a-real-secret' },
    body: { content: 'YQ==', contentType: 'audio/webm' },
  });
  assert.equal(expired.statusCode, 401);
  assert.equal(JSON.parse(expired.body).error, 'Oturum erişim belirtecinin süresi doldu');
  assert.equal(invalidCookie.statusCode, 401);
  assert.equal(missingWithInvalidCookie.statusCode, 401);
  assert.equal(invalidCookie.body, missingWithInvalidCookie.body);
  assert.equal(invalidCookie.body, AUTH_REQUIRED);
  assert.equal(writes.length, 0);
});
