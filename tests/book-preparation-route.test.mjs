/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const previousEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  preview: process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW,
  previewSecret: process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET,
  databaseUrl: process.env.DATABASE_URL,
};

let auth;
let core;
let identityToken;
let route;
let vite;
let requestSequence = 0;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET = 'c'.repeat(64);
  delete process.env.DATABASE_URL;
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: {
      alias: { '@': process.cwd() },
      dedupe: ['react', 'react-dom'],
    },
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  });
  core = await vite.ssrLoadModule('/lib/book-preparation-core.ts');
  auth = await vite.ssrLoadModule('/lib/book-preparation-preview-auth.ts');
  identityToken = auth.issueBookPreparationPreviewIdentity(
    'educator-preview:route-test',
  );
  route = await vite.ssrLoadModule(
    '/app/api/book-preparation/preview/route.ts',
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
    ['DATABASE_URL', previousEnvironment.databaseUrl],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function post(
  body,
  { includeOrigin = true, token = identityToken } = {},
) {
  requestSequence += 1;
  const headers = new Headers({
    'content-type': 'application/json',
    'x-real-ip': `198.51.100.${requestSequence}`,
  });
  if (includeOrigin) headers.set('origin', 'http://preview.test');
  if (token) {
    headers.set(
      'cookie',
      `${auth.BOOK_PREPARATION_PREVIEW_COOKIE}=${encodeURIComponent(token)}`,
    );
  }
  const response = await route.POST(
    new Request('http://preview.test/api/book-preparation/preview', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

test('book preview route hides its existence outside the authorized boundary', async () => {
  const noOrigin = await post(
    { action: 'preview', draft: core.SYNTHETIC_BOOK_DRAFT },
    { includeOrigin: false },
  );
  assert.equal(noOrigin.response.status, 404);
  assert.equal(noOrigin.body.error, 'not_found');

  const noIdentity = await post(
    { action: 'preview', draft: core.SYNTHETIC_BOOK_DRAFT },
    { token: '' },
  );
  assert.equal(noIdentity.response.status, 404);
  assert.equal(noIdentity.body.error, 'not_found');

  const forgedIdentity = await post(
    { action: 'preview', draft: core.SYNTHETIC_BOOK_DRAFT },
    { token: `${identityToken}x` },
  );
  assert.equal(forgedIdentity.response.status, 404);

  let production;
  try {
    process.env.NODE_ENV = 'production';
    production = await post({
      action: 'preview',
      draft: core.SYNTHETIC_BOOK_DRAFT,
    });
  } finally {
    process.env.NODE_ENV = 'test';
  }
  assert.equal(production.response.status, 404);
  assert.equal(production.body.error, 'not_found');
});

test('book preview route returns a server-verified content summary', async () => {
  const result = await post({
    action: 'preview',
    draft: core.SYNTHETIC_BOOK_DRAFT,
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.identity.authenticated, true);
  assert.equal(result.body.identity.role, 'educator');
  assert.equal(
    result.body.summary.summaryType,
    'server_verified_content_summary',
  );
  assert.equal(Object.hasOwn(result.body.summary, 'previewId'), false);
  assert.equal(result.body.summary.serverValidated, true);
  assert.equal(result.body.summary.persistenceEnabled, false);
  assert.equal(result.body.summary.productionLedgerEligible, false);
  assert.match(result.body.summary.contentHash, /^[0-9a-f]{64}$/);
});

test('book preview route rejects unknown roots, client hashes and oversized JSON', async () => {
  const extraRoot = await post({
    action: 'preview',
    draft: core.SYNTHETIC_BOOK_DRAFT,
    force: true,
  });
  assert.equal(extraRoot.response.status, 400);
  assert.equal(extraRoot.body.error, 'book_request_invalid');

  const clientHash = await post({
    action: 'preview',
    draft: { ...core.SYNTHETIC_BOOK_DRAFT, contentHash: '0'.repeat(64) },
  });
  assert.equal(clientHash.response.status, 400);
  assert.equal(clientHash.body.error, 'book_draft_invalid');

  const oversized = await post(
    JSON.stringify({
      action: 'preview',
      draft: {
        ...core.SYNTHETIC_BOOK_DRAFT,
        title: 'x'.repeat(33 * 1024),
      },
    }),
  );
  assert.equal(oversized.response.status, 413);
});

test('teacher workspace renders meaningful controls without an HTML injection sink', async () => {
  const { BookPreparationWorkspace } = await vite.ssrLoadModule(
    '/components/book-preparation-workspace.tsx',
  );
  const html = renderToStaticMarkup(
    React.createElement(BookPreparationWorkspace),
  );
  assert.match(html, /Kitap Hazırlama Stüdyosu/);
  assert.match(html, /Sunucuda doğrula ve önizle/);
  assert.match(html, /Persistence kapalı/);

  const componentSource = fs.readFileSync(
    new URL('../components/book-preparation-workspace.tsx', import.meta.url),
    'utf8',
  );
  const routeSource = fs.readFileSync(
    new URL('../app/api/book-preparation/preview/route.ts', import.meta.url),
    'utf8',
  );
  const pageSource = fs.readFileSync(
    new URL('../app/book-preparation/page.tsx', import.meta.url),
    'utf8',
  );
  const pageGuardSource = fs.readFileSync(
    new URL('../lib/book-preparation-page-guard.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(routeSource, /neon|DATABASE_URL|persist/i);
  assert.match(pageSource, /requireBookPreparationPageIdentity\(\)/);
  assert.match(pageGuardSource, /notFound\(\)/);
  assert.match(pageGuardSource, /verifyBookPreparationPreviewIdentity/);
});
