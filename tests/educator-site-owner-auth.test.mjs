import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const source = fs.readFileSync(
  new URL('../lib/educator-auth.ts', import.meta.url),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const SECRET = 'test-only-proxy-secret-with-at-least-32-bytes';
const OWNER_EMAIL = 'habipcann65@gmail.com';
const TEST_DATABASE_URL = 'postgresql://test.invalid/cza';

function loadAuth({
  nonceStore = new Set(),
  databaseError = false,
  canonicalRole = 'educator',
  active = true,
  database,
} = {}) {
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
          neon:
            () =>
            async (strings, ...values) => {
              databaseCalls += 1;
              if (databaseError) throw new Error('database unavailable');
              if (database) {
                const query = strings.reduce(
                  (text, part, index) =>
                    text + (index ? `$${index}` : '') + part,
                  '',
                );
                return (await database.query(query, values)).rows;
              }
              const query = strings.join('?');
              if (query.includes('FROM public.users')) {
                return canonicalRole === 'educator' && active
                  ? [
                      {
                        id: 'd3000000-0000-4000-8000-000000000001',
                        academy_id: 'd3000000-0000-4000-8000-000000000002',
                        auth_user_id: values[0],
                        email: 'celikzihin.akademisi@gmail.com',
                        display_name: 'Habip Çelik',
                      },
                    ]
                  : [];
              }
              const nonceHash = values[0];
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
  const bodySha256 = crypto
    .createHash('sha256')
    .update(signedBody)
    .digest('hex');
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
    signature ||
      crypto.createHmac('sha256', SECRET).update(payload).digest('hex'),
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
    assert.equal(databaseCalls(), 2);
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
    assert.ok(
      await auth.authenticatedEducator(signedRequest({ timestamp, nonce })),
    );
    assert.equal(
      await auth.authenticatedEducator(signedRequest({ timestamp, nonce })),
      null,
    );
    assert.equal(databaseCalls(), 3);
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
    assert.equal(databaseCalls(), 3);
  });
});

test('valid external identity is denied unless canonical DB role is educator', async () => {
  await withEnvironment(proxyEnvironment, async () => {
    const studentRole = loadAuth({ canonicalRole: 'student' });
    assert.equal(
      await studentRole.auth.authenticatedEducator(signedRequest()),
      null,
    );
    assert.equal(studentRole.databaseCalls(), 2);

    const inactiveEducator = loadAuth({ active: false });
    assert.equal(
      await inactiveEducator.auth.authenticatedEducator(signedRequest()),
      null,
    );
    assert.equal(inactiveEducator.databaseCalls(), 2);
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
    {
      CZA_TRUSTED_PROXY_HMAC_SECRET: undefined,
      DATABASE_URL: TEST_DATABASE_URL,
    },
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
    assert.throws(
      () => auth.authUrl('/get-session'),
      /auth_configuration_unavailable/,
    );
  });
  await withEnvironment(
    { CZA_NEON_AUTH_BASE_URL: 'http://auth.test/cza/auth' },
    async () => {
      const { auth } = loadAuth();
      assert.throws(
        () => auth.authUrl('/get-session'),
        /auth_configuration_unavailable/,
      );
    },
  );
  await withEnvironment(
    { CZA_NEON_AUTH_BASE_URL: 'https://auth.test/cza/auth/' },
    async () => {
      const { auth } = loadAuth();
      assert.equal(
        auth.authUrl('/get-session'),
        'https://auth.test/cza/auth/get-session',
      );
    },
  );
});

test('signed educator identity uses real SQL and denies ambiguous or ineligible mappings', async (t) => {
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE TABLE public.users (
        id uuid PRIMARY KEY, academy_id uuid, auth_user_id uuid,
        email text, display_name text, role text, is_active boolean
      );
      CREATE TABLE public.test_nonces (hash text PRIMARY KEY);
      CREATE FUNCTION public.cza_consume_trusted_proxy_nonce(n text, expiry timestamptz)
      RETURNS boolean LANGUAGE sql AS $$
        WITH added AS (INSERT INTO public.test_nonces VALUES(n) ON CONFLICT DO NOTHING RETURNING hash)
        SELECT EXISTS(SELECT 1 FROM added)
      $$;
      INSERT INTO public.users VALUES
        ('d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003','Synthetic@Example.invalid','Synthetic Educator','educator',true),
        ('d3000000-0000-4000-8000-000000000011','d3000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000013','student@example.invalid','Student','student',true),
        ('d3000000-0000-4000-8000-000000000021','d3000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000023','inactive@example.invalid','Inactive','educator',false),
        ('d3000000-0000-4000-8000-000000000031','d3000000-0000-4000-8000-000000000002',NULL,'unmapped@example.invalid','Unmapped','educator',true);
    `);
    await withEnvironment(proxyEnvironment, async () => {
      const { auth } = loadAuth({ database });
      const email = 'synthetic@example.invalid';
      await t.test(
        'SIGNED_UNIQUE_EDUCATOR_EMAIL=ALLOW (case-insensitive canonical identity)',
        async () => {
          assert.deepEqual(
            await auth.authenticatedEducator(signedRequest({ email })),
            {
              id: 'd3000000-0000-4000-8000-000000000003',
              email: 'Synthetic@Example.invalid',
              name: 'Synthetic Educator',
            },
          );
        },
      );
      for (const deniedEmail of [
        'student@example.invalid',
        'inactive@example.invalid',
        'unknown@example.invalid',
        'unmapped@example.invalid',
      ]) {
        await t.test(
          `signed ${deniedEmail} is denied even with a fixed-login cookie`,
          async () => {
            assert.equal(
              await auth.authenticatedEducator(
                signedRequest({
                  email: deniedEmail,
                  cookie: `cza_educator_session=local.${'a'.repeat(64)}`,
                }),
              ),
              null,
            );
          },
        );
      }
      await t.test(
        'unsigned, bad HMAC, expired signature and body tamper deny dynamic identity',
        async () => {
          assert.equal(
            await auth.authenticatedEducator(
              new Request('https://cza.test/api/educator-auth', {
                headers: { 'oai-authenticated-user-email': email },
              }),
            ),
            null,
          );
          for (const change of [
            { signature: '0'.repeat(64) },
            { timestamp: Math.floor(Date.now() / 1000) - 61 },
            { body: '{"action":"logout"}', signedBody: '{"action":"me"}' },
          ]) {
            assert.equal(
              await auth.authenticatedEducator(
                signedRequest({ email, ...change }),
              ),
              null,
            );
          }
        },
      );
      await t.test('dynamic identity nonce replay is denied', async () => {
        const nonce = crypto.randomBytes(16).toString('hex');
        assert.ok(
          await auth.authenticatedEducator(signedRequest({ email, nonce })),
        );
        assert.equal(
          await auth.authenticatedEducator(signedRequest({ email, nonce })),
          null,
        );
      });
      await t.test(
        'duplicate active educator across academies denies, including null auth mapping',
        async () => {
          await database.exec(
            `INSERT INTO public.users VALUES ('d3000000-0000-4000-8000-000000000041','d3000000-0000-4000-8000-000000000042',NULL,'SYNTHETIC@example.invalid','Other academy','educator',true)`,
          );
          assert.equal(
            await auth.authenticatedEducator(signedRequest({ email })),
            null,
          );
          await database.exec(
            `UPDATE public.users SET auth_user_id='d3000000-0000-4000-8000-000000000043' WHERE id='d3000000-0000-4000-8000-000000000041'`,
          );
          assert.equal(
            await auth.authenticatedEducator(signedRequest({ email })),
            null,
          );
        },
      );
    });
  } finally {
    await database.close();
  }
});
