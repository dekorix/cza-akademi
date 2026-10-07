/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

const previousEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  preview: process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW,
  previewSecret: process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET,
  proxySecret: process.env.CZA_TRUSTED_PROXY_HMAC_SECRET,
  databaseUrl: process.env.DATABASE_URL,
};

let auth;
let previewRoute;
let sessionRoute;
let ticket;
let vite;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET = 'f'.repeat(64);
  delete process.env.CZA_TRUSTED_PROXY_HMAC_SECRET;
  delete process.env.DATABASE_URL;
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': process.cwd() } },
  });
  auth = await vite.ssrLoadModule('/lib/book-preparation-preview-auth.ts');
  sessionRoute = await vite.ssrLoadModule(
    '/app/api/book-preparation/session/route.ts',
  );
  previewRoute = await vite.ssrLoadModule(
    '/app/api/book-preparation/preview/route.ts',
  );
  ticket = auth.issueBookPreparationBootstrapTicket(
    'educator-preview:session-route-test',
  );
});

after(async () => {
  await vite.close();
  for (const [name, value] of [
    ['NODE_ENV', previousEnvironment.nodeEnv],
    ['CZA_BOOK_PREPARATION_ISOLATED_PREVIEW', previousEnvironment.preview],
    [
      'CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET',
      previousEnvironment.previewSecret,
    ],
    ['CZA_TRUSTED_PROXY_HMAC_SECRET', previousEnvironment.proxySecret],
    ['DATABASE_URL', previousEnvironment.databaseUrl],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function request(action, { authorization = '', cookie = '' } = {}) {
  const headers = new Headers({
    origin: 'https://preview.test',
    'content-type': 'application/json',
    'x-real-ip': '198.51.100.44',
  });
  if (authorization) headers.set('authorization', `Bearer ${authorization}`);
  if (cookie) headers.set('cookie', cookie);
  return new Request('https://preview.test/api/book-preparation/session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action }),
  });
}

test('bootstrap exchanges one-use authorization for a hardened preview cookie', async () => {
  const hidden = await sessionRoute.POST(request('bootstrap'));
  assert.equal(hidden.status, 404);

  const forged = await sessionRoute.POST(
    request('bootstrap', { authorization: `${ticket}x` }),
  );
  assert.equal(forged.status, 404);

  const response = await sessionRoute.POST(
    request('bootstrap', { authorization: ticket }),
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(
    cookie,
    /^__Host-cza_book_preparation_educator_preview=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800$/,
  );
  const replay = await sessionRoute.POST(
    request('bootstrap', { authorization: ticket }),
  );
  assert.equal(replay.status, 404);
});

test('logout revokes server state before clearing the browser cookie', async () => {
  const freshTicket = auth.issueBookPreparationBootstrapTicket(
    'educator-preview:logout-test',
  );
  const bootstrap = await sessionRoute.POST(
    request('bootstrap', { authorization: freshTicket }),
  );
  const cookiePair = bootstrap.headers.get('set-cookie').split(';', 1)[0];

  const logout = await sessionRoute.POST(
    request('logout', { cookie: cookiePair }),
  );
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);

  const stale = await previewRoute.POST(
    new Request('https://preview.test/api/book-preparation/preview', {
      method: 'POST',
      headers: {
        origin: 'https://preview.test',
        'content-type': 'application/json',
        cookie: cookiePair,
        'x-real-ip': '198.51.100.45',
      },
      body: JSON.stringify({ action: 'preview', draft: {} }),
    }),
  );
  assert.equal(stale.status, 404);
});

test('central educator authentication exchanges into the scoped cookie', async () => {
  let authenticationCalls = 0;
  const centralPost = sessionRoute.createBookPreparationSessionPost(
    async () => {
      authenticationCalls += 1;
      return { id: '47c90485-e057-4ebe-a25c-9d7f236c5bd6' };
    },
  );
  const response = await centralPost(request('bootstrap'));
  assert.equal(authenticationCalls, 1);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('set-cookie'),
    /^__Host-cza_book_preparation_educator_preview=/,
  );
});

test('session route hides production even with valid exchange material', async () => {
  try {
    process.env.NODE_ENV = 'production';
    const response = await sessionRoute.POST(
      request('bootstrap', { authorization: ticket }),
    );
    assert.equal(response.status, 404);
  } finally {
    process.env.NODE_ENV = 'test';
  }
});
