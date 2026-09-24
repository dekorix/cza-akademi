import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL('../app/api/educator-auth/route.ts', import.meta.url),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function route(fetch, options = {}) {
  const commonJsModule = { exports: {} };
  const gateCalls = [];
  const accountGateCalls = [];
  let passwordChecks = 0;
  class TestEducatorRequestError extends Error {
    constructor(code, status = 400) {
      super(code);
      this.code = code;
      this.status = status;
    }
  }
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route module harness
  new Function('require', 'module', 'exports', 'fetch', js)(
    (id) => {
      if (id.includes('request-guard')) {
        return {
          allowAccountRequest: async (...args) => {
            accountGateCalls.push(args);
            return (
              options.gates?.[args[0]] || {
                allowed: true,
                retryAfterSeconds: 0,
              }
            );
          },
          allowRequest: async (...args) => {
            gateCalls.push(args);
            return (
              options.gates?.[args[1]] || {
                allowed: true,
                retryAfterSeconds: 0,
              }
            );
          },
          rateLimited: (gate) =>
            Response.json(
              {
                ok: false,
                error: gate.unavailable
                  ? 'rate_limit_unavailable'
                  : 'rate_limited',
              },
              { status: gate.unavailable ? 503 : 429 },
            ),
        };
      }
      if (id.includes('educator-request-security')) {
        return {
          EducatorRequestError: TestEducatorRequestError,
          readEducatorAuthRequest: async (request) => ({
            input: JSON.parse(await request.text()),
            bodySha256: 'b'.repeat(64),
          }),
        };
      }
      return {
        authenticatedEducator: async () => options.authenticatedUser || null,
        authUrl: (path) => `https://auth.test${path}`,
        createLocalEducatorSession: async () => ({
          user: { email: 'educator@test' },
          cookieValue: 'local-session',
        }),
        educatorCookie: () => 'session=cleared-or-created',
        educatorProxyRequestAllowed: async () => options.proxyAllowed !== false,
        EDUCATOR_AUTH_USER_ID: '47c90485-e057-4ebe-a25c-9d7f236c5bd6',
        EDUCATOR_COOKIE: 'cza_educator_session',
        EDUCATOR_EMAIL: 'celikzihin.akademisi@gmail.com',
        readCookie: () => options.cookieValue || '',
        revokeLocalEducatorSession: async () => {
          if (options.revocationError) throw options.revocationError;
          return options.sessionType || 'local-session';
        },
        verifyEducatorPassword: async () => {
          passwordChecks += 1;
          return options.passwordValid !== false;
        },
      };
    },
    commonJsModule,
    commonJsModule.exports,
    fetch,
  );
  return {
    post: commonJsModule.exports.POST,
    gateCalls,
    accountGateCalls,
    passwordChecks: () => passwordChecks,
  };
}

function request(body, headers = {}) {
  return new Request('https://cza.test/api/educator-auth', {
    method: 'POST',
    headers: {
      origin: 'https://cza.test',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('reset forwards trusted origin and creates a local educator session', async () => {
  const { post } = route(async (url, options) => {
    assert.equal(url, 'https://auth.test/reset-password');
    assert.equal(options.headers.origin, 'https://cza.test');
    assert.equal(JSON.parse(options.body).token, 'test-token');
    return Response.json({ status: true });
  });
  const response = await post(
    request({
      action: 'reset',
      token: 'test-token',
      newPassword: 'test-password',
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('set-cookie'),
    'session=cleared-or-created',
  );
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.signedIn, true);
  assert.equal(body.build, '2026-09-14-auth-hardening-v2.2');
});

test('provider failure is not falsely described as an expired link', async () => {
  for (const [code, status, error] of [
    ['MISSING_ORIGIN', 502, 'reset_unavailable'],
    ['INVALID_TOKEN', 400, 'invalid_reset'],
  ]) {
    const { post } = route(async () =>
      Response.json({ code }, { status: 400 }),
    );
    const response = await post(
      request({
        action: 'reset',
        token: 'test-token',
        newPassword: 'test-password',
      }),
    );
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, error);
  }
});

test('foreign origins never reach the authentication provider', async () => {
  const { post } = route(() => {
    throw new Error('must not call');
  });
  const response = await post(
    request({ action: 'me' }, { origin: 'https://foreign.test' }),
  );
  assert.equal(response.status, 403);
});

test('direct origin and forged identity headers are rejected before authentication', async () => {
  const { post } = route(
    () => {
      throw new Error('must not call');
    },
    { proxyAllowed: false },
  );
  const response = await post(
    request(
      { action: 'me' },
      { 'oai-authenticated-user-email': 'habipcann65@gmail.com' },
    ),
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'trusted_proxy_required',
    build: '2026-09-14-auth-hardening-v2.2',
  });
});

test('logout preserves the cookie when durable revocation fails', async () => {
  const { post } = route(
    () => {
      throw new Error('must not call');
    },
    { revocationError: new Error('database unavailable') },
  );
  const response = await post(request({ action: 'logout' }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'logout_revocation_failed',
    build: '2026-09-14-auth-hardening-v2.2',
  });
});

test('external logout clears the cookie only after upstream sign-out succeeds', async () => {
  const failed = route(async () => Response.json({}, { status: 502 }), {
    sessionType: 'external-session',
    cookieValue: 'external-token',
  });
  const failedResponse = await failed.post(request({ action: 'logout' }));
  assert.equal(failedResponse.status, 503);
  assert.equal(failedResponse.headers.get('set-cookie'), null);

  const succeeded = route(
    async (url, init) => {
      assert.equal(url, 'https://auth.test/sign-out');
      assert.equal(init.headers.cookie, 'cza_educator_session=external-token');
      return Response.json({ ok: true });
    },
    { sessionType: 'external-session', cookieValue: 'external-token' },
  );
  const succeededResponse = await succeeded.post(request({ action: 'logout' }));
  assert.equal(succeededResponse.status, 200);
  assert.equal(
    succeededResponse.headers.get('set-cookie'),
    'session=cleared-or-created',
  );
});

test('reset request, reset completion and login use separate distributed limits', async () => {
  const first = route(async () => Response.json({ ok: true }));
  await first.post(
    request({
      action: 'request-reset',
      email: 'celikzihin.akademisi@gmail.com',
    }),
  );
  await first.post(
    request({
      action: 'reset',
      token: 'test-token',
      newPassword: 'test-password',
    }),
  );
  await first.post(
    request({
      action: 'login',
      email: 'celikzihin.akademisi@gmail.com',
      password: 'test-password',
    }),
  );
  assert.deepEqual(
    first.gateCalls.map((call) => call[1]),
    [
      'educator-reset-request-address',
      'educator-reset-complete-address',
      'educator-login-address',
    ],
  );
  assert.deepEqual(
    first.accountGateCalls.map((call) => [call[0], call[3]]),
    [
      [
        'educator-reset-request-account',
        '47c90485-e057-4ebe-a25c-9d7f236c5bd6',
      ],
      [
        'educator-reset-complete-account',
        '47c90485-e057-4ebe-a25c-9d7f236c5bd6',
      ],
      ['educator-login-account', '47c90485-e057-4ebe-a25c-9d7f236c5bd6'],
    ],
  );

  let providerCalls = 0;
  const blocked = route(
    async () => {
      providerCalls += 1;
      return Response.json({ ok: true });
    },
    {
      gates: {
        'educator-reset-complete-account': {
          allowed: false,
          retryAfterSeconds: 60,
        },
      },
    },
  );
  const blockedResponse = await blocked.post(
    request({
      action: 'reset',
      token: 'blocked-token',
      newPassword: 'test-password',
    }),
  );
  assert.equal(blockedResponse.status, 429);
  assert.equal(providerCalls, 0);

  const blockedLogin = route(
    async () => {
      throw new Error('must not call');
    },
    {
      gates: {
        'educator-login-account': {
          allowed: false,
          retryAfterSeconds: 60,
        },
      },
    },
  );
  const blockedLoginResponse = await blockedLogin.post(
    request({
      action: 'login',
      email: 'celikzihin.akademisi@gmail.com',
      password: 'test-password',
    }),
  );
  assert.equal(blockedLoginResponse.status, 429);
  assert.equal(blockedLogin.passwordChecks(), 0);
});
