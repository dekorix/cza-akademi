import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const origin = 'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const target = { role: 'cza_v01_app_runtime_min', database: 'cza_t5_synthetic',
  project: 'patient-firefly-51111834', branch: 'br-withered-queen-b15ltb40' };

function harness(result, { enabled = true, wrongTarget = false, sqlThrows = false } = {}) {
  const calls = [], logs = [], upstream = [];
  const sql = async (strings, ...values) => {
    const text = strings.join('?');
    calls.push(text);
    if (text.includes('current_user')) return [wrongTarget ? { ...target, branch: 'foreign' } : target];
    if (sqlThrows) throw new Error('private database details');
    return result === undefined ? [] : [{ result }];
  };
  const env = { NODE_ENV: 'production', DATABASE_URL: 'synthetic-test-only',
    CZA_EDUCATOR_AUTH_MODE: enabled ? 'neon-qa' : '',
    CZA_CORE_API_URL: 'https://approved-core.test/api/core',
    CZA_CORE_API_ALLOWED_HOSTS: 'approved-core.test' };
  const stubs = {
    'node:crypto': crypto,
    '@neondatabase/serverless': { neon: () => sql },
    '@/lib/qa-student-read-contract': { qaStudentReads: {} },
    '@/lib/isolated-qa-auth': { isolatedQaEnabled: () => enabled, QA_EDUCATOR_ORIGIN: origin },
    '@/lib/qa-assigned-work': { isolatedQaAssignedAction: async () => null },
    '@/lib/request-guard': { allowRequest: async () => ({ allowed: true }) },
    '@/lib/k3e-staging-diagnostics': { stagingDiagnosticsEnabled: () => false },
    '@/lib/student-session': {
      readRequestCookie: () => '', STUDENT_COOKIE: 'cza_student_session',
      StudentSessionError: class extends Error {},
    },
    '@/lib/learning-contract-server': {},
    '@/lib/persistence/canonical-repository': {},
    '@/lib/persistence/work-center-repository': { WorkCenterPersistenceError: class extends Error {} },
    '@/lib/work-center': {}, '@/lib/package-catalog': { isPackageAccessCode: () => false },
    '@/lib/exercise-registry': {}, '@/lib/engine-registry': {},
  };
  const sandbox = vm.createContext({
    console: { error: (...args) => logs.push(args.join(' ')) },
    URL, Request, Response, Headers, AbortController, setTimeout, clearTimeout,
    Buffer, Date, TextDecoder, TextEncoder, process: { env },
    fetch: async (...args) => {
      upstream.push(args[0]);
      return Response.json({ ok: false, error: 'upstream_reached' }, { status: 401 });
    },
  });
  const cache = new Map();
  function require(id) {
    if (id in stubs) return stubs[id];
    const file = id.startsWith('@/') ? id.slice(2) + '.ts' : id;
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInContext('(function(exports,require){' + code + '\n})', sandbox, { filename: file })(exports, require);
    return exports;
  }
  return { helper: require('@/lib/qa-student-read'), route: require('app/api/core/route.ts'),
    calls, logs, upstream };
}

function request() {
  return new Request(origin + '/api/core', { method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: 'synthetic', pin: 'unit-only' }) });
}

test('QA malformed SQL results fail closed even when an external core is configured', async () => {
  for (const result of [undefined, null, false, 0, '', [], {}, { ok: 'true' }, { ok: false }]) {
    const h = harness(result);
    const response = await h.route.POST(request());
    assert.equal(response.status, 503, 'malformed result must not become upstream or credential response');
    assert.equal((await response.json()).error, 'qa_login_unavailable');
    assert.equal(h.upstream.length, 0, 'QA credentials must never fall through to external core');
    assert.equal(response.headers.get('set-cookie')?.includes('Max-Age=28800') ?? false, false);
    assert.deepEqual(h.logs, ['qa_login_unavailable stage=sql']);
  }
});

test('canonical credential rejection stays 401; successful login keeps cookies and removes body token', async () => {
  const denied = harness({ ok: false, error: 'invalid_credentials' });
  const response = await denied.route.POST(request());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'invalid_credentials');
  assert.equal(denied.upstream.length, 0);
  const accepted = harness({ ok: true, sessionToken: 'unit-session-token', student: { id: 'synthetic' } });
  const ok = await accepted.route.POST(request());
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).sessionToken, undefined);
  assert.ok(ok.headers.get('set-cookie').includes('cza_student_session=unit-session-token'));
  assert.ok(ok.headers.get('set-cookie').includes('HttpOnly'));
  assert.ok(ok.headers.get('set-cookie').includes('Secure'));
  assert.equal(accepted.upstream.length, 0);
});

test('target rejection and SQL failure remain fail closed without leaking exception content', async () => {
  for (const options of [{ wrongTarget: true }, { sqlThrows: true }]) {
    const h = harness(null, options);
    const response = await h.route.POST(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'qa_login_unavailable');
    assert.equal(h.upstream.length, 0);
    assert.equal(h.logs.some(line => line.includes('private database details')), false);
    assert.equal(h.calls.length, options.wrongTarget ? 1 : 2);
  }
});

test('QA-disabled canonical upstream login remains unchanged', async () => {
  const h = harness(null, { enabled: false });
  const response = await h.route.POST(request());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'upstream_reached');
  assert.equal(h.upstream.length, 1);
  assert.equal(h.calls.length, 0);
});
