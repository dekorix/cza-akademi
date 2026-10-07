/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let auth;
let vite;

const enabledEnvironment = {
  NODE_ENV: 'test',
  CZA_BOOK_PREPARATION_ISOLATED_PREVIEW: 'true',
  CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET: 'e'.repeat(64),
};

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  auth = await vite.ssrLoadModule('/lib/book-preparation-preview-auth.ts');
});

after(async () => {
  await vite.close();
});

test('signed educator preview identity is scoped and expires', () => {
  const issuedAt = 2_000_000;
  const token = auth.issueBookPreparationPreviewIdentity(
    'educator-preview:unit-test',
    issuedAt,
    enabledEnvironment,
  );
  assert.deepEqual(
    auth.verifyBookPreparationPreviewIdentity(
      token,
      issuedAt + 60_000,
      enabledEnvironment,
    ),
    { subject: 'educator-preview:unit-test', role: 'educator' },
  );
  assert.equal(
    auth.verifyBookPreparationPreviewIdentity(
      token,
      issuedAt + 30 * 60_000,
      enabledEnvironment,
    ),
    null,
  );
});

test('forged identity, weak secret and production verification fail closed', () => {
  const token = auth.issueBookPreparationPreviewIdentity(
    'educator-preview:unit-test',
    2_000_000,
    enabledEnvironment,
  );
  assert.equal(
    auth.verifyBookPreparationPreviewIdentity(
      `${token}x`,
      2_000_100,
      enabledEnvironment,
    ),
    null,
  );
  assert.equal(
    auth.verifyBookPreparationPreviewIdentity(token, 2_000_100, {
      ...enabledEnvironment,
      NODE_ENV: 'production',
    }),
    null,
  );
  assert.throws(
    () =>
      auth.issueBookPreparationPreviewIdentity(
        'educator-preview:unit-test',
        2_000_000,
        {
          ...enabledEnvironment,
          CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET: 'weak',
        },
      ),
    /book_preview_identity_configuration_invalid/,
  );
});

test('malformed cookie encoding is rejected without throwing', () => {
  const request = new Request('http://preview.test/book-preparation', {
    headers: {
      cookie: `${auth.BOOK_PREPARATION_PREVIEW_COOKIE}=%E0%A4%A`,
    },
  });
  assert.equal(auth.readBookPreparationPreviewCookie(request), '');
});
