import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/educator-auth.ts', import.meta.url), 'utf8');

test('private Site owner identity is mapped to the central educator', () => {
  assert.match(source, /oai-authenticated-user-email/);
  assert.match(source, /siteEmail === SITE_OWNER_EMAIL/);
  assert.match(source, /id: EDUCATOR_AUTH_USER_ID/);
  assert.doesNotMatch(source, /neon\(process\.env\.DATABASE_URL\)/);
});

test('the existing Neon session remains as a fallback', () => {
  assert.match(source, /readCookie\(request, EDUCATOR_COOKIE\)/);
  assert.match(source, /\/get-session/);
  assert.match(source, /data\.user\?\.id === EDUCATOR_AUTH_USER_ID/);
  assert.match(source, /userEmail === EDUCATOR_EMAIL/);
});
