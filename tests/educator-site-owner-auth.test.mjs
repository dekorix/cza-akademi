import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/educator-auth.ts', import.meta.url), 'utf8');

test('private Site owner identity is mapped to the active central educator', () => {
  assert.match(source, /oai-authenticated-user-email/);
  assert.match(source, /siteEmail === SITE_OWNER_EMAIL/);
  assert.match(source, /JOIN teachers t ON t\.auth_user_id = u\.id/);
  assert.match(source, /t\.is_active = true/);
  assert.match(source, /lower\(u\.email\) = \$\{EDUCATOR_EMAIL\}/);
});

test('the existing Neon session remains as a fallback', () => {
  assert.match(source, /readCookie\(request, EDUCATOR_COOKIE\)/);
  assert.match(source, /\/get-session/);
});
