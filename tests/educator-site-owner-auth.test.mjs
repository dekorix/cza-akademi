import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/educator-auth.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const SECRET = 'test-only-proxy-secret-with-at-least-32-bytes';
const OWNER_EMAIL = 'habipcann65@gmail.com';
const TEST_DATABASE_URL = 'postgresql://test.invalid/cza';

function loadAuth({ nonceStore = new Set(), databaseError = false } = {}) {
  const commonJsModule = { exports: {} };
  let databaseCalls = 0;
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require', 'module', 'exports', js)(
    (id) => {
      if (id === 'node:crypto') return crypto;
      if (id.includes('educator-request-security')) {
        return {
          requestBodySha256: async (request) =>
            crypto
              .createHash('sha256')
              .update(Buffer.from(await request.clone().arrayBuffer()))
              .digest('hex'),
        };
      }
      if (id === '@neondatabase/serverless') {
        return {
          neon: () => async (_strings, nonceHash) => {
            databaseCalls += 1;
            if (databaseError) throw new Error('database unavailable');
            if (nonceStore.has(nonceHash)) return [{ consumed: false }];
            nonceStore.add(nonceHash);
            return [{ consumed: true }];
          },
        };
      }
      throw new Error(`unexpected import: ${id}`);
    },
    commonJsModule,
    commonJsModule.exports,
  );
  return {
    auth: commonJsModule.exports,
    databaseCalls: () => databaseCalls,
  };
}

function signedRequest({
  email = OWNER_EMAIL,
  timestamp = Math.floor(Date.now() / 1000),
  nonce = crypto.randomBytes(16).toString('hex'),
  signature = '',
  method = 'POST',
  body = method === 'GET' || method === 'HEAD'
    ? ''
    : JSON.stringify({ action: 'me' }),
  signedBody = body,
  cookie = '',
} = {}) {
  const url = 'https://cza.test/api/educator-auth?source=site';
  const bodySha256 = crypto.createHash('sha256').update(signedBody).digest('hex');
  const headers = new Headers({
    'content-type': 'application/json',
    'oai-authenticated-user-email': email,
    'x-cza-proxy-timestamp': String(timestamp),
    'x-cza-proxy-nonce': nonce,
  });
  const payload = [
    'cza-educator-proxy-v2',
    String(timestamp),
    nonce,
    method,
    '/api/educator-auth?source=site',
    bodySha256,
    email.toLowerCase(),
  ].join('\n');
  headers.set(
    'x-cza-proxy-signature',
    signature || crypto.createHmac('sha256', SECRET).update(payload).digest('hex'),
  );
  if (cookie) headers.set('cookie', cookie);
  return new Request(url, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body }),
  });
}

async function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const proxyEnvironment = {
  CZA_TRUSTED_PROXY_HMAC_SECRET: SECRET,
  DATABASE_URL: TEST_DATABASE_URL,
};

test('signed body and single-use nonce map the private Site owner', async () => {
  await withEnvironment(proxyEnvironment, async () => {
    const { auth, databaseCalls } = loadAuth();
    const user = await auth.authenticatedEducator(signedRequest());
    assert.deepEqual(user, {
      id: auth.EDUCATOR_AUTH_USER_ID,
      email: auth.EDUCATOR_EMAIL,
      name: 'Habip Çelik',
    });
    assert.equal(databaseCalls(), 1);
  });
});

test('captured signature cannot authorize a different POST body', async () => {
  await withEnvironment(proxyEnvironment, async () => {
    const { auth, databaseCalls } = loadAuth();
    const request = signedRequest({
      signedBody: JSON.stringify({ action: 'me' }),
      body: JSON.stringify({ action: 'logout' }),
    });
    assert.equal(await auth.authenticatedEducator(request), null);
    assert.equal(databaseCalls(), 0);
  });
});

test('a valid POST nonce is rejected when replayed by another request', async () => {
  await withEnvironment(proxyEnvironment, async () => {
    const nonceStore = new Set();
    const { auth, databaseCalls } = loadAuth({ nonceStore });
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 'a'.repeat(32);
    assert.ok(await auth.authenticatedEducator(signedRequest({ timestamp, nonce })));
    assert.equal(
      await auth.authenticatedEducator(signedRequest({ timestamp, nonce })),
      null,
    );
    assert.equal(databaseCalls(), 2);
  });
});

test('a valid privileged GET nonce is rejected when replayed', async () => {
  await withEnvironment(proxyEnvironment, async () => {
    const nonceStore = new Set();
    const { auth, databaseCalls } = loadAuth({ nonceStore });
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 'b'.repeat(32);
    assert.ok(
      await auth.authenticatedEducator(
        signedRequest({ method: 'GET', timestamp, nonce }),
      ),
    );
    assert.equal(
      await auth.authenticatedEducator(
        signedRequest({ method: 'GET', timestamp, nonce }),
      ),
      null,
    );
    assert.equal(databaseCalls(), 2);
  });
});

test('forged, unsigned, expired and nonce-store-failed requests are rejected', async () => {
  await withEnvironment(proxyEnvironment, async () => {
    const { auth, databaseCalls } = loadAuth();
    const unsigned = new Request('https://cza.test/api/educator-auth', {
      headers: { 'oai-authenticated-user-email': OWNER_EMAIL },
    });
    assert.equal(await auth.authenticatedEducator(unsigned), null);
    assert.equal(
      await auth.authenticatedEducator(
        signedRequest({ signature: '0'.repeat(64) }),
      ),
      null,
    );
    assert.equal(
      await auth.authenticatedEducator(
        signedRequest({ timestamp: Math.floor(Date.now() / 1000) - 61 }),
      ),
      null,
    );
    assert.equal(databaseCalls(), 0);

    const failedStore = loadAuth({ databaseError: true });
    assert.equal(
      await failedStore.auth.authenticatedEducator(signedRequest()),
      null,
    );
    assert.equal(failedStore.databaseCalls(), 1);
  });
});

test('direct origin access is rejected when the proxy secret is absent', async () => {
  await withEnvironment(
    { CZA_TRUSTED_PROXY_HMAC_SECRET: undefined, DATABASE_URL: TEST_DATABASE_URL },
    async () => {
      const { auth, databaseCalls } = loadAuth();
      const direct = new Request('https://origin.internal/api/educator-auth', {
        headers: { cookie: 'cza_educator_session=local.fake' },
      });
      assert.equal(await auth.educatorProxyRequestAllowed(direct), false);
      assert.equal(await auth.authenticatedEducator(direct), null);
      assert.equal(databaseCalls(), 0);
    },
  );
});

test('malformed percent-encoded cookies are rejected without throwing', async () => {
  const { auth } = loadAuth();
  const request = new Request('https://cza.test/api/educator-auth', {
    headers: { cookie: `${auth.EDUCATOR_COOKIE}=%E0%A4%A` },
  });
  assert.doesNotThrow(() => auth.readCookie(request, auth.EDUCATOR_COOKIE));
  assert.equal(auth.readCookie(request, auth.EDUCATOR_COOKIE), '');
});

test('Neon Auth base URL has no fallback and fails closed on unsafe configuration', async () => {
  await withEnvironment({ CZA_NEON_AUTH_BASE_URL: undefined }, async () => {
    const { auth } = loadAuth();
    assert.throws(() => auth.authUrl('/get-session'), /auth_configuration_unavailable/);
  });
  await withEnvironment(
    { CZA_NEON_AUTH_BASE_URL: 'http://auth.test/cza/auth' },
    async () => {
      const { auth } = loadAuth();
      assert.throws(() => auth.authUrl('/get-session'), /auth_configuration_unavailable/);
    },
  );
  await withEnvironment(
    { CZA_NEON_AUTH_BASE_URL: 'https://auth.test/cza/auth/' },
    async () => {
      const { auth } = loadAuth();
      assert.equal(auth.authUrl('/get-session'), 'https://auth.test/cza/auth/get-session');
    },
  );
});
