import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const staging =
  'https://cza-akademi-staging.cza-staging-habip.workers.dev/api/core';
const core = 'https://cza-learning-core-staging.vercel.app/api/student';
const secret = 'FAKE_SECRET_DO_NOT_LOG_59417';

function load(file, dependencies, environment, logs, fetcher) {
  const source = readFileSync(new URL(file, root), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    require: (id) => {
      if (!(id in dependencies))
        throw new Error(`Missing mocked dependency: ${id}`);
      return dependencies[id];
    },
    process: { env: environment },
    console: Object.fromEntries(
      ['debug', 'info', 'log', 'warn', 'error'].map((level) => [
        level,
        (...args) => logs.push(args),
      ]),
    ),
    URL,
    Request,
    Response,
    Headers,
    AbortController,
    setTimeout,
    clearTimeout,
    Buffer,
    Date,
    Map,
    Number,
    JSON,
    String,
    fetch: fetcher,
  };
  vm.runInNewContext(code, context, { filename: file });
  return exports;
}

function setup(
  environment = {},
  fetcher = async () => new Response(JSON.stringify({ ok: true })),
) {
  const env = {
    NODE_ENV: 'production',
    CZA_TRUSTED_EDGE: 'cloudflare',
    DATABASE_URL: 'fake-db',
    ...environment,
  };
  const logs = [];
  const helper = load('lib/k3e-staging-diagnostics.ts', {}, env, logs);
  const address = load(
    'lib/trusted-client-address.ts',
    { 'node:net': { isIP } },
    env,
    logs,
  );
  let sqlResult = [{ allowed: true, retry_after_seconds: 0 }];
  const neon = () => async () => {
    if (sqlResult instanceof Error) throw sqlResult;
    return sqlResult;
  };
  const guard = load(
    'lib/request-guard.ts',
    {
      'node:crypto': { createHash },
      '@neondatabase/serverless': { neon },
      '@/lib/trusted-client-address': address,
    },
    env,
    logs,
  );
  const route = load(
    'app/api/core/route.ts',
    {
      '@neondatabase/serverless': { neon },
      '@/lib/request-guard': guard,
      '@/lib/k3e-staging-diagnostics': helper,
      '@/lib/student-session': {
        readRequestCookie: (request, name) =>
          request.headers
            .get('cookie')
            ?.match(new RegExp(`${name}=([^;]+)`))?.[1] || '',
      },
      '@/lib/core-request-security': {
        parseCoreRequest: (input) => input,
        readBoundedJson: async (response) => response.json(),
        configuredCoreUrl: () => core,
        CoreRequestError: class CoreRequestError extends Error {},
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
    },
    env,
    logs,
    fetcher,
  );
  const request = (url = staging, action = 'me', headers = {}) => {
    const r = new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'cza_student_session=fake-session',
        ...headers,
      },
      body: JSON.stringify({ action }),
    });
    r.cf = { colo: 'test' };
    return r;
  };
  return {
    env,
    logs,
    guard,
    route,
    request,
    setSqlResult: (value) => {
      sqlResult = value;
    },
  };
}

async function assertNoSecretOutput(response, logs) {
  const output = JSON.stringify({
    body: await response.clone().text(),
    headers: [...response.headers],
    logs,
  });
  assert.equal(output.includes(secret), false);
}

test('guard stages distinguish parameters, edge, address, database, SQL and quota without changing 503/429', async () => {
  const s = setup();
  const stages = [];
  const run = (request = s.request(), limit = 6) =>
    s.guard.allowRequest(
      request,
      'student-login',
      limit,
      60_000,
      undefined,
      (stage) => stages.push(stage),
    );
  assert.equal((await run(undefined, 0)).unavailable, true);
  s.env.CZA_TRUSTED_EDGE = '';
  await run();
  s.env.CZA_TRUSTED_EDGE = 'cloudflare';
  const noCf = s.request();
  delete noCf.cf;
  await run(noCf);
  await run(
    s.request(staging, 'me', { 'cf-connecting-ip': 'invalid-address' }),
  );
  delete s.env.DATABASE_URL;
  await run(s.request(staging, 'me', { 'cf-connecting-ip': '192.0.2.1' }));
  s.env.DATABASE_URL = 'fake-db';
  s.setSqlResult(new Error(secret));
  await run(s.request(staging, 'me', { 'cf-connecting-ip': '192.0.2.1' }));
  s.setSqlResult([]);
  await run(s.request(staging, 'me', { 'cf-connecting-ip': '192.0.2.1' }));
  s.setSqlResult([{ allowed: false, retry_after_seconds: 7 }]);
  const quota = await run(
    s.request(staging, 'me', { 'cf-connecting-ip': '192.0.2.1' }),
  );
  assert.deepEqual(stages, [
    'invalid_parameters',
    'trusted_edge_unconfigured',
    'cloudflare_context_missing',
    'client_address_unavailable',
    'database_unconfigured',
    'sql_call_failed',
    'sql_result_invalid',
    'quota_exceeded',
  ]);
  assert.equal((await s.guard.rateLimited(quota).json()).error, 'rate_limited');
  assert.equal(s.guard.rateLimited(quota).status, 429);
  assert.equal(
    s.guard.rateLimited({
      allowed: false,
      unavailable: true,
      retryAfterSeconds: 30,
    }).status,
    503,
  );
  assert.equal(JSON.stringify(stages).includes(secret), false);
});

test('diagnostics=1 rejects upstream 307 after one request and masks the redirect log', async () => {
  const calls = [];
  const s = setup(
    {
      CZA_STAGING_RUNTIME_DIAGNOSTICS: '1',
      CZA_CORE_VERCEL_BYPASS_SECRET: secret,
    },
    async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: false, error: secret }), {
        status: 307,
        headers: {
          location: `https://name:${secret}@vercel.com/login/${secret}?token=${secret}#${secret}`,
          'set-cookie': `upstream-secret=${secret}`,
        },
      });
    },
  );
  const response = await s.route.POST(
    s.request(staging, 'me', { 'x-k3e-diagnostics': '1' }),
  );
  assert.equal(response.status, 502);
  await assertNoSecretOutput(response, s.logs);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'core_unavailable',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, core);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(
    calls[0].options.headers.get('x-vercel-protection-bypass'),
    secret,
  );
  assert.equal(s.logs.length, 1);
  assert.equal(s.logs[0][0], 'k3e_upstream_redirect');
  assert.equal(s.logs[0][1].status, 307);
  assert.equal(s.logs[0][1].host, 'vercel.com');
  assert.equal(s.logs[0][1].path, '/login/[masked]');
  assert.equal(JSON.stringify(s.logs).includes(secret), false);
});

test('diagnostics=0, unset flag, wrong host, query and client header reject 307 without following or logging', async () => {
  for (const [env, url, headers] of [
    [
      { CZA_STAGING_RUNTIME_DIAGNOSTICS: '0' },
      staging,
      { 'x-k3e-diagnostics': '1' },
    ],
    [{}, staging, { 'x-k3e-diagnostics': '1' }],
    [
      { CZA_STAGING_RUNTIME_DIAGNOSTICS: '1' },
      'https://other.example/api/core',
      {},
    ],
    [{ CZA_STAGING_RUNTIME_DIAGNOSTICS: '1' }, `${staging}?diagnostics=1`, {}],
  ]) {
    const calls = [];
    const s = setup(
      { ...env, CZA_CORE_VERCEL_BYPASS_SECRET: secret },
      async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ ok: false, error: secret }), {
          status: 307,
          headers: {
            location: `https://vercel.com/login/${secret}?token=${secret}`,
            'set-cookie': `upstream-secret=${secret}`,
          },
        });
      },
    );
    const response = await s.route.POST(s.request(url, 'me', headers));
    assert.equal(response.status, 502);
    await assertNoSecretOutput(response, s.logs);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'core_unavailable',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, core);
    assert.equal(calls[0].options.redirect, 'manual');
    assert.equal(
      calls[0].options.headers.get('x-vercel-protection-bypass'),
      secret,
    );
    assert.deepEqual(s.logs, []);
  }
});

test('upstream 200 JSON is preserved with the bypass header in both diagnostic modes', async () => {
  const result = { ok: true, student: { id: 'synthetic-student' } };
  for (const flag of ['0', '1']) {
    const calls = [];
    const s = setup(
      {
        CZA_STAGING_RUNTIME_DIAGNOSTICS: flag,
        CZA_CORE_VERCEL_BYPASS_SECRET: secret,
      },
      async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    );
    const response = await s.route.POST(s.request());
    assert.equal(response.status, 200);
    await assertNoSecretOutput(response, s.logs);
    assert.deepEqual(await response.json(), result);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, core);
    assert.equal(calls[0].options.redirect, 'manual');
    assert.equal(
      calls[0].options.headers.get('x-vercel-protection-bypass'),
      secret,
    );
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      action: 'me',
      sessionToken: 'fake-session',
    });
    assert.deepEqual(s.logs, []);
  }
});

test('upstream network exceptions return 502 without exposing secrets in either diagnostic mode', async () => {
  for (const flag of ['0', '1']) {
    const calls = [];
    const s = setup(
      {
        CZA_STAGING_RUNTIME_DIAGNOSTICS: flag,
        CZA_CORE_VERCEL_BYPASS_SECRET: secret,
      },
      async (url, options) => {
        calls.push({ url, options });
        throw new Error(secret);
      },
    );
    const response = await s.route.POST(s.request());
    assert.equal(response.status, 502);
    await assertNoSecretOutput(response, s.logs);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'core_unavailable',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, core);
    assert.equal(calls[0].options.redirect, 'manual');
    assert.equal(
      calls[0].options.headers.get('x-vercel-protection-bypass'),
      secret,
    );
    assert.deepEqual(s.logs, []);
  }
});

test('login reports fixed SQL stage and keeps rate limit failure, while ordinary upstream success is unchanged', async () => {
  const s = setup({ CZA_STAGING_RUNTIME_DIAGNOSTICS: '1' });
  s.setSqlResult(new Error(secret));
  const login = await s.route.POST(
    s.request(staging, 'login', { 'cf-connecting-ip': '192.0.2.1' }),
  );
  assert.equal(login.status, 503);
  assert.equal((await login.json()).error, 'rate_limit_unavailable');
  assert.equal(s.logs[0][1].stage, 'sql_call_failed');
  assert.equal(JSON.stringify(s.logs).includes(secret), false);
  const success = await s.route.POST(s.request());
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true });
});
