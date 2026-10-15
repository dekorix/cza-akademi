import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

function load(file, dependencies, environment, extras = {}) {
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (id) => {
      if (!(id in dependencies)) throw new Error(`Missing mocked dependency: ${id}`);
      return dependencies[id];
    },
    process: { env: environment },
    console,
    URL,
    Request,
    Response,
    Headers,
    AbortController,
    setTimeout,
    clearTimeout,
    Buffer,
    Date,
    JSON,
    Error,
    TypeError,
    ...extras,
  }, { filename: file });
  return exports;
}

const client = load('lib/core-client.ts', {}, {}, { fetch: (...args) => globalThis.fetch(...args) });

function routeFor(login, allow = async () => ({ allowed: true })) {
  const stubs = {
    '@neondatabase/serverless': { neon: () => { throw new Error('neon_not_used'); } },
    '@/lib/qa-student-read': { isolatedQaStudentLogin: login },
    '@/lib/qa-assigned-work': { isolatedQaAssignedAction: async () => null },
    '@/lib/request-guard': {
      allowRequest: allow,
      rateLimited: (gate) => Response.json(
        { ok: false, error: gate.unavailable ? 'rate_limit_unavailable' : 'rate_limited' },
        { status: gate.unavailable ? 503 : 429, headers: { 'cache-control': 'no-store' } },
      ),
    },
    '@/lib/k3e-staging-diagnostics': { stagingDiagnosticsEnabled: () => false },
    '@/lib/student-session': {
      readRequestCookie: () => '',
      StudentSessionError: class StudentSessionError extends Error {},
    },
    '@/lib/learning-contract-server': {},
    '@/lib/persistence/canonical-repository': {},
    '@/lib/persistence/work-center-repository': {
      WorkCenterPersistenceError: class WorkCenterPersistenceError extends Error {},
    },
    '@/lib/work-center': {},
    '@/lib/package-catalog': { isPackageAccessCode: () => false },
    '@/lib/exercise-registry': {},
    '@/lib/engine-registry': {},
  };
  const sandbox = vm.createContext({
    console, URL, Request, Response, Headers, AbortController, setTimeout, clearTimeout,
    Buffer, Date, TextDecoder, TextEncoder, process: { env: { NODE_ENV: 'test' } },
  });
  const cache = new Map();
  function require(id) {
    if (id in stubs) return stubs[id];
    const file = id.startsWith('@/') ? `${id.slice(2)}.ts` : id;
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const runner = vm.runInContext(
      `(function(exports, require){\n${ts.transpileModule(read(file), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText}\n})`,
      sandbox,
      { filename: file },
    );
    runner(exports, require);
    return exports;
  }
  return require('app/api/core/route.ts');
}

function loginRequest(body, headers = {}) {
  return new Request('https://app.test/api/core', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://app.test',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const loginBody = { action: 'login', username: 'student', pin: 'test-pin' };
const fallback = 'Merkezi kayıt sistemine şu anda ulaşılamıyor. Bağlantını kontrol edip tekrar dene.';
const credentialMessage = 'Kullanıcı adı veya PIN hatalı.';

async function captured(run) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => lines.push(args.map((item) => String(item)).join(' '));
  try {
    return { response: await run(), lines };
  } finally {
    console.error = original;
  }
}

test('login route separates schema, origin, rate limit, QA, core config and wrong PIN', async () => {
  const schema = routeFor(async () => { throw new Error('must_not_login'); });
  const malformed = await schema.POST(loginRequest('{'));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'invalid_request');

  const missingPin = await schema.POST(loginRequest({ action: 'login', username: 'student' }));
  assert.equal(missingPin.status, 400);
  assert.equal((await missingPin.json()).error, 'invalid_request_schema');

  const foreign = await schema.POST(loginRequest(loginBody, { origin: 'https://other.test' }));
  assert.equal(foreign.status, 403);
  assert.equal((await foreign.json()).error, 'request_origin_rejected');

  const limited = routeFor(async () => { throw new Error('must_not_login'); }, async () => ({
    allowed: false, unavailable: true, retryAfterSeconds: 30,
  }));
  const rate = await limited.POST(loginRequest(loginBody));
  assert.equal(rate.status, 503);
  assert.equal((await rate.json()).error, 'rate_limit_unavailable');

  const target = routeFor(async () => { throw new Error('v03_qa_target_rejected'); });
  const targetResult = await captured(() => target.POST(loginRequest(loginBody)));
  assert.equal(targetResult.response.status, 503);
  assert.equal((await targetResult.response.json()).error, 'qa_login_unavailable');
  assert.deepEqual(targetResult.lines, ['qa_login_unavailable stage=target']);

  const sql = routeFor(async () => { throw new Error('db_down test-pin'); });
  const sqlResult = await captured(() => sql.POST(loginRequest(loginBody)));
  assert.equal(sqlResult.response.status, 503);
  assert.equal((await sqlResult.response.json()).error, 'qa_login_unavailable');
  assert.deepEqual(sqlResult.lines, ['qa_login_unavailable stage=sql']);
  assert.equal(sqlResult.lines.some((line) => line.includes('test-pin') || line.includes('db_down')), false);

  const unconfigured = routeFor(async () => null);
  const config = await captured(() => unconfigured.POST(loginRequest(loginBody)));
  assert.equal(config.response.status, 503);
  assert.equal((await config.response.json()).error, 'core_configuration_unavailable');
  assert.deepEqual(config.lines, []);

  const wrongPin = routeFor(async () => ({ ok: false, error: 'invalid_credentials' }));
  const denied = await captured(() => wrongPin.POST(loginRequest(loginBody)));
  assert.equal(denied.response.status, 401);
  assert.equal((await denied.response.json()).error, 'invalid_credentials');
  assert.deepEqual(denied.lines, []);
});

test('core client separates network failure and non-JSON responses from credential errors', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(client.core('login', loginBody), (error) => {
      assert.equal(error.message, 'network_unavailable');
      assert.equal(error.status, 0);
      assert.equal(error.message.includes('Failed to fetch'), false);
      return true;
    });

    globalThis.fetch = async () => new Response('<html>unavailable</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    });
    await assert.rejects(client.core('login', loginBody), (error) => {
      assert.equal(error.message, 'invalid_response');
      assert.equal(error.status, 502);
      assert.equal(error.message.includes('html'), false);
      return true;
    });

    globalThis.fetch = async () => Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    await assert.rejects(client.core('login', loginBody), (error) =>
      error.message === 'invalid_credentials' && error.status === 401);

    globalThis.fetch = async () => Response.json({ ok: false, error: 'qa_login_unavailable' }, { status: 503 });
    await assert.rejects(client.core('login', loginBody), (error) =>
      error.message === 'qa_login_unavailable' && error.status === 503);
  } finally {
    globalThis.fetch = previous;
  }
});

test('friendly login messages stay distinct and infrastructure is not a credential error', () => {
  const cases = [
    ['invalid_request', 'Giriş isteği okunamadı. Sayfayı yenileyip yeniden dene.'],
    ['invalid_request_schema', 'Giriş bilgileri eksik veya biçimi uygun değil. Yeniden dene.'],
    ['request_origin_rejected', 'Güvenlik doğrulaması tamamlanamadı.'],
    ['rate_limit_unavailable', 'Güvenlik sayacı şu anda doğrulanamıyor. Lütfen biraz sonra yeniden dene.'],
    ['qa_login_unavailable', 'Öğrenci girişi şu anda tamamlanamıyor. Biraz sonra yeniden dene.'],
    ['core_configuration_unavailable', 'Öğrenci kayıt servisi bu ortamda hazır değil. Biraz sonra yeniden dene.'],
    ['invalid_credentials', credentialMessage],
    ['network_unavailable', 'Bağlantı kurulamadı. Ağını kontrol edip yeniden dene.'],
    ['invalid_response', 'Sunucu geçerli bir yanıt vermedi. Biraz sonra yeniden dene.'],
  ];
  for (const [code, message] of cases) {
    const shown = client.friendlyCoreError(new client.CoreClientError(code, 503));
    assert.equal(shown, message);
    if (code !== 'invalid_credentials') assert.notEqual(shown, credentialMessage);
  }
  assert.equal(client.friendlyCoreError(new Error('core_unavailable')), fallback);
  assert.equal(client.friendlyCoreError(new client.CoreClientError('qa_login_unavailable', 503)).includes('503'), false);
});
