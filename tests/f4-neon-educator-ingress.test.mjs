/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const origin = 'https://cza-akademi-staging.cza-staging-habip.workers.dev';
const authBase =
  'https://ep-falling-resonance-b2qnvtwf.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth';
const token = 'test-only-opaque-session.signature';
const secret = 'isolated-test-only-hmac-secret-32-bytes-minimum';
const cookieName = '__Host-cza_neon_educator';
// Independent fixture: observed live Neon Auth Set-Cookie, not imported from product.
const observedProviderCookie = '__Secure-neon-auth.session_token';
const aid = '10000000-0000-4000-8000-000000000001';
const otherAid = '10000000-0000-4000-8000-000000000002';
const uid = '20000000-0000-4000-8000-000000000001';
const sid = '30000000-0000-4000-8000-000000000001';

function load(path, modules, env, fetcher) {
  const source = fs.readFileSync(
    new URL('../' + path, import.meta.url),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const m = { exports: {} };
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated real module execution, provider transport only is simulated
  new Function('require', 'module', 'exports', 'process', 'fetch', js)(
    (id) => {
      if (id in modules) return modules[id];
      throw new Error('Unexpected import ' + id);
    },
    m,
    m.exports,
    { env },
    fetcher,
  );
  return m.exports;
}
function req(action, headers = {}, path = '/api/educator-auth') {
  return new Request(origin + path, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(typeof action === 'string' ? { action } : action),
  });
}
function signedIn(path = '/api/educator-students') {
  return new Request(origin + path, {
    headers: { cookie: `${cookieName}=${token}` },
  });
}
async function harness(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TYPE app_role AS ENUM ('student','educator');
    CREATE TABLE users(id uuid PRIMARY KEY,academy_id uuid,auth_user_id text,email text,display_name text,role app_role,is_active boolean,username text);
    CREATE TABLE students(id uuid PRIMARY KEY,academy_id uuid,user_id uuid,first_name text,last_name text,status text);
    CREATE TABLE teacher_student_links(teacher_id uuid,student_id uuid,can_view boolean);
    CREATE TABLE student_external_identifiers(student_id uuid,identifier_type text,identifier_value text);
    CREATE TABLE test_nonces(hash text PRIMARY KEY);
    CREATE FUNCTION cza_consume_trusted_proxy_nonce(n text,expiry timestamptz) RETURNS boolean LANGUAGE sql AS $$
      WITH added AS (INSERT INTO test_nonces VALUES(n) ON CONFLICT DO NOTHING RETURNING hash)
      SELECT EXISTS(SELECT 1 FROM added) $$;
    INSERT INTO users VALUES ('${uid}','${aid}','provider-educator','canonical@example.invalid','Canonical educator','educator',true,'educator');
    INSERT INTO students VALUES ('${sid}','${aid}',NULL,'Linked','Student','active'),
      ('30000000-0000-4000-8000-000000000002','${aid}',NULL,'Unlinked','Student','active'),
      ('30000000-0000-4000-8000-000000000003','${otherAid}',NULL,'Cross','Academy','active');
    INSERT INTO teacher_student_links VALUES ('${uid}','${sid}',true),
      ('${uid}','30000000-0000-4000-8000-000000000003',true);
  `);
  const env = {
    CZA_EDUCATOR_AUTH_MODE: 'neon',
    CZA_NEON_AUTH_BASE_URL: authBase,
    CZA_TRUSTED_PROXY_HMAC_SECRET: secret,
    DATABASE_URL: 'postgresql://isolated.invalid/test',
  };
  const state = {
    id: 'provider-educator',
    revoked: false,
    expired: false,
    fail: '',
    forgedEmail: 'owner@example.invalid',
    nonceDenied: false,
    rateDenied: false,
  };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.ok(url.startsWith(authBase + '/'));
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.origin, origin);
    assert.ok(!JSON.stringify(options).includes(secret));
    if (state.fail === 'network') throw new Error('sensitive-upstream-error');
    if (state.fail === 'redirect') return new Response(null, { status: 307 });
    if (url.endsWith('/sign-in/email')) {
      if (state.fail === 'credentials')
        return Response.json({ error: 'bad password' }, { status: 401 });
      if (state.fail === 'missing-cookie') return Response.json({ ok: true });
      state.revoked = false;
      assert.equal(options.headers.cookie, undefined);
      return Response.json(
        { token: 'must-not-return-provider-body' },
        {
          headers: {
            'set-cookie': `${state.fail === 'wrong-cookie-name' ? '__Secure-neonauth.session_token' : observedProviderCookie}=${token}; HttpOnly; Secure; Path=/`,
          },
        },
      );
    }
    assert.equal(options.headers.cookie, `${observedProviderCookie}=${token}`);
    if (url.endsWith('/sign-out')) {
      if (state.fail === 'logout') return new Response(null, { status: 503 });
      state.revoked = true;
      return Response.json({ success: true });
    }
    assert.ok(
      url.endsWith('/get-session?disableCookieCache=true&disableRefresh=true'),
    );
    if (state.revoked) return Response.json(null);
    return Response.json({
      user: { id: state.id, email: state.forgedEmail, role: 'admin' },
      session: {
        userId: state.mismatch ? 'wrong-id' : state.id,
        expiresAt: new Date(
          Date.now() + (state.expired ? -60000 : 60000),
        ).toISOString(),
      },
    });
  };
  const modules = {
    'node:crypto': crypto,
    '@neondatabase/serverless': {
      neon:
        () =>
        async (strings, ...values) => {
          const sql = strings.reduce(
            (q, part, i) => q + (i ? `$${i}` : '') + part,
            '',
          );
          if (
            state.nonceDenied &&
            sql.includes('cza_consume_trusted_proxy_nonce')
          )
            return [{ consumed: false }];
          return (await db.query(sql, values)).rows;
        },
    },
    '@/lib/request-guard': {
      allowRequest: async () => ({ allowed: !state.rateDenied }),
      allowAccountRequest: async () => ({ allowed: !state.rateDenied }),
      rateLimited: () =>
        Response.json({ error: 'rate_limited' }, { status: 429 }),
    },
  };
  modules['@/lib/educator-request-security'] = load(
    'lib/educator-request-security.ts',
    modules,
    env,
    fetcher,
  );
  const ingress = load('lib/educator-neon-ingress.ts', modules, env, fetcher);
  modules['@/lib/educator-neon-ingress'] = ingress;
  const auth = load('lib/educator-auth.ts', modules, env, fetcher);
  modules['@/lib/educator-auth'] = auth;
  const route = load('app/api/educator-auth/route.ts', modules, env, fetcher);
  const students = load(
    'app/api/educator-students/route.ts',
    modules,
    env,
    fetcher,
  );
  return {
    db,
    state,
    env,
    auth,
    route,
    students,
    ingress,
    calls,
    modules,
    fetcher,
  };
}

test('normal login without proxy signature, verified-ID canonical mapping and linked student API', async (t) => {
  const h = await harness(t);
  const response = await h.route.POST(
    req({
      action: 'login',
      email: 'typed@example.invalid',
      password: 'test-password',
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    user: {
      id: 'provider-educator',
      email: 'canonical@example.invalid',
      name: 'Canonical educator',
    },
  });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /^__Host-cza_neon_educator=/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])
    assert.ok(setCookie.includes(attr));
  assert.ok(!setCookie.includes('Domain='));
  const me = await h.route.POST(
    req('me', { cookie: `${cookieName}=${token}` }),
  );
  assert.equal(me.status, 200);
  const list = await h.students.GET(signedIn('/api/educator-students?page=0'));
  assert.equal(list.status, 200);
  assert.deepEqual(
    (await list.json()).students.map((s) => s.id),
    [sid],
  );
  const nonces = await h.db.query('SELECT count(*)::int AS n FROM test_nonces');
  assert.equal(nonces.rows[0].n, 3);
  assert.equal(
    h.calls.filter((c) => c.url.includes('/get-session?')).length,
    3,
  );
});

for (const scenario of [
  'student',
  'inactive',
  'unmapped',
  'ambiguous',
  'no-academy',
]) {
  test(`${scenario} canonical mapping DENY, regardless of provider email/role`, async (t) => {
    const h = await harness(t);
    if (scenario === 'student')
      await h.db.exec("UPDATE users SET role='student'");
    if (scenario === 'inactive')
      await h.db.exec('UPDATE users SET is_active=false');
    if (scenario === 'unmapped') h.state.id = 'unknown-id';
    if (scenario === 'no-academy')
      await h.db.exec('UPDATE users SET academy_id=NULL');
    if (scenario === 'ambiguous')
      await h.db.exec(
        `INSERT INTO users SELECT '20000000-0000-4000-8000-000000000002','${otherAid}',auth_user_id,email,display_name,role,is_active,username FROM users`,
      );
    assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
    const response = await h.route.POST(
      req({
        action: 'login',
        email: 'canonical@example.invalid',
        password: 'test-password',
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(h.state.revoked, true);
  });
}

test('expired, revoked, inconsistent and absent provider sessions fail closed without owner fallback', async (t) => {
  const h = await harness(t);
  for (const key of ['expired', 'revoked', 'mismatch']) {
    h.state[key] = true;
    assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
    h.state[key] = false;
  }
  const callsBefore = h.calls.length;
  const localOnly = new Request(origin + '/api/educator-students', {
    headers: { cookie: 'cza_educator_session=local.test' },
  });
  assert.equal(await h.auth.authenticatedEducator(localOnly), null);
  assert.equal(h.calls.length, callsBefore);
});

test('forged identity/signature headers and duplicate session cookies cannot authorize', async (t) => {
  const h = await harness(t);
  for (const header of [
    'oai-authenticated-user-email',
    'x-cza-proxy-signature',
    'x-cza-proxy-nonce',
    'x-cza-proxy-timestamp',
    'x-cza-role',
    'x-educator-id',
    'x-academy-id',
  ]) {
    const r = signedIn();
    r.headers.set(header, 'forged');
    assert.equal(await h.auth.authenticatedEducator(r), null);
  }
  const duplicate = signedIn();
  duplicate.headers.append('cookie', `; ${cookieName}=${token}`);
  assert.equal(await h.auth.authenticatedEducator(duplicate), null);
  assert.equal(h.calls.length, 0);
});

test('wrong origin, cross-site, unconfigured target, HMAC/nonce failure and rate gate DENY', async (t) => {
  const h = await harness(t);
  const cross = req('me', {
    origin: 'https://attacker.invalid',
    cookie: `${cookieName}=${token}`,
  });
  assert.equal((await h.route.POST(cross)).status, 403);
  const missingOrigin = req('logout');
  missingOrigin.headers.delete('origin');
  assert.equal((await h.route.POST(missingOrigin)).status, 403);
  const crossSite = signedIn();
  crossSite.headers.set('sec-fetch-site', 'cross-site');
  assert.equal(await h.auth.authenticatedEducator(crossSite), null);
  assert.equal(
    await h.auth.authenticatedEducator(
      new Request('https://production.invalid/api/educator-students', {
        headers: { cookie: `${cookieName}=${token}` },
      }),
    ),
    null,
  );
  h.env.CZA_NEON_AUTH_BASE_URL = 'https://wrong.invalid/auth';
  assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
  h.env.CZA_NEON_AUTH_BASE_URL = authBase;
  h.env.CZA_TRUSTED_PROXY_HMAC_SECRET = '';
  assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
  h.env.CZA_TRUSTED_PROXY_HMAC_SECRET = secret;
  h.state.nonceDenied = true;
  assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
  h.state.rateDenied = true;
  assert.equal((await h.route.POST(req('me'))).status, 429);
});

test('logout revokes provider session; old cookie is unusable; failed revocation is not success', async (t) => {
  const h = await harness(t);
  const response = await h.route.POST(
    req('logout', { cookie: `${cookieName}=${token}` }),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
  h.state.revoked = false;
  h.state.fail = 'logout';
  const failed = await h.route.POST(
    req('logout', { cookie: `${cookieName}=${token}` }),
  );
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('set-cookie'), null);
});

test('provider redirect/network failure exposes no raw secret/token/error and no local fallback', async (t) => {
  const h = await harness(t);
  for (const fail of ['redirect', 'network']) {
    h.state.fail = fail;
    const response = await h.route.POST(
      req({
        action: 'login',
        email: 'test@example.invalid',
        password: 'test-password',
      }),
    );
    assert.equal(response.status, 503);
    const body = await response.text();
    for (const sensitive of [
      secret,
      token,
      'test-password',
      'sensitive-upstream-error',
    ])
      assert.ok(!body.includes(sensitive));
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
  }
});

test('provider credential rejection and missing session cookie never create a browser session', async (t) => {
  const h = await harness(t);
  for (const [fail, status] of [
    ['credentials', 401],
    ['missing-cookie', 502],
  ]) {
    h.state.fail = fail;
    const response = await h.route.POST(
      req({
        action: 'login',
        email: 'test@example.invalid',
        password: 'test-password',
      }),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(h.calls.filter((c) => c.url.includes('/get-session')).length, 0);
});

test('canonical can_view revocation is respected on the next actual student-list read', async (t) => {
  const h = await harness(t);
  await h.db.exec('UPDATE teacher_student_links SET can_view=false');
  const response = await h.students.GET(signedIn());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).students, []);
});

test('body lifecycle: actual assignment POST remains readable after authenticated handoff', async (t) => {
  const h = await harness(t);
  await h.db.exec(`
    ALTER TABLE teacher_student_links ADD COLUMN academy_id uuid DEFAULT '${aid}';
    CREATE TYPE session_status AS ENUM ('active','in_progress','completed');
    CREATE TABLE training_recipes(id uuid,student_id uuid,academy_id uuid,assigned_by uuid,module_code text,name text,instructions text,settings jsonb,starts_at timestamptz,expires_at timestamptz,is_active boolean,cancelled_at timestamptz,created_at timestamptz,source text);
    CREATE TABLE training_sessions(id uuid,recipe_id uuid,status session_status,last_activity_at timestamptz,completed_at timestamptz);
  `);
  // These imports are not reached by the real list branch; auth and SQL remain real.
  for (const name of [
    'assessment-routing',
    'assessment-learning-response',
    'assessment-report',
    'cza-work-recommendations',
  ])
    h.modules['@/lib/' + name] = {};
  h.modules['@/lib/training-recipes'] = { assignableModules: [] };
  const assignments = load(
    'app/api/educator-assignments/route.ts',
    h.modules,
    h.env,
    h.fetcher,
  );
  const input = { action: 'list', studentId: sid };
  const r = req(
    input,
    { cookie: `${cookieName}=${token}` },
    '/api/educator-assignments',
  );
  const response = await assignments.POST(r);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, assignments: [] });
  const raw = req(
    input,
    { cookie: `${cookieName}=${token}` },
    '/api/educator-assignments?source=panel',
  );
  assert.ok(await h.auth.authenticatedEducator(raw));
  assert.equal(raw.bodyUsed, false);
  assert.deepEqual(await raw.json(), input);
});

test('body lifecycle: undeclared and chunked oversized auth bodies return 413 without sibling cancellation', async (t) => {
  const h = await harness(t);
  for (const chunked of [false, true]) {
    const body = chunked
      ? new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(32768));
            controller.enqueue(new Uint8Array(32769));
            // Deliberately keep the network source open: rejection cannot wait for EOF.
          },
        })
      : 'x'.repeat(65537);
    const r = new Request(origin + '/api/educator-auth', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body,
      ...(chunked ? { duplex: 'half' } : {}),
    });
    const pending = h.route.POST(r);
    let timer;
    const result = await Promise.race([
      pending,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), 500);
      }),
    ]);
    clearTimeout(timer);
    // Cleanup only AFTER observing the deadline, never to make the assertion pass.
    void r.body.cancel().catch(() => {});
    await pending;
    assert.ok(result, '413 must complete before test cleanup cancels sibling');
    assert.equal(result.status, 413);
    assert.equal((await result.json()).error, 'request_too_large');
  }
  assert.equal(h.calls.length, 0);
  assert.equal(
    (await h.db.query('SELECT count(*)::int AS n FROM test_nonces')).rows[0].n,
    0,
  );
});

test('body lifecycle: exact 64 KiB body hash and downstream bytes are preserved', async (t) => {
  const h = await harness(t);
  const body = ' '.repeat(65536 - 15) + '{"action":"me"}';
  assert.equal(Buffer.byteLength(body), 65536);
  const r = new Request(origin + '/api/educator-auth', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      cookie: `${cookieName}=${token}`,
    },
    body,
  });
  const security = h.modules['@/lib/educator-request-security'];
  assert.equal(
    await security.requestBodySha256(r),
    crypto.createHash('sha256').update(body).digest('hex'),
  );
  assert.equal(r.bodyUsed, false);
  const response = await h.route.POST(r);
  assert.equal(response.status, 200);
});

test('provider cookie contract: observed login cookie is extracted and restored for get-session and logout', async (t) => {
  const h = await harness(t);
  const login = await h.route.POST(
    req({
      action: 'login',
      email: 'test@example.invalid',
      password: 'test-password',
    }),
  );
  assert.equal(login.status, 200, 'observed provider cookie must be accepted');
  const browserCookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(browserCookie, `${cookieName}=${token}`);
  const me = await h.route.POST(req('me', { cookie: browserCookie }));
  assert.equal(me.status, 200);
  const logout = await h.route.POST(req('logout', { cookie: browserCookie }));
  assert.equal(logout.status, 200);
  const sessionCalls = h.calls.filter((c) => c.url.includes('/get-session?'));
  assert.equal(sessionCalls.length, 2);
  const logoutCalls = h.calls.filter((c) => c.url.endsWith('/sign-out'));
  assert.equal(logoutCalls.length, 1);
  for (const call of [...sessionCalls, ...logoutCalls]) {
    assert.equal(
      call.options.headers.cookie,
      '__Secure-neon-auth.session_token=' + token,
    );
    assert.ok(!call.options.headers.cookie.includes(cookieName));
  }
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(await h.auth.authenticatedEducator(signedIn()), null);
});

test('provider cookie contract: wrong legacy cookie name alone cannot create a session', async (t) => {
  const h = await harness(t);
  h.state.fail = 'wrong-cookie-name';
  const response = await h.route.POST(
    req({
      action: 'login',
      email: 'test@example.invalid',
      password: 'test-password',
    }),
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'provider_session_cookie_missing',
  });
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(
    h.calls.length,
    1,
    'must reject before session verification or canonical authentication',
  );
});
