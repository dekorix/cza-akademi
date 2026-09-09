import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/legacy-handoff/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

test('legacy handoff is server-validated and creates an HttpOnly scoped session', () => {
  assert.match(route, /consumeWorkPanelHandoff/);
  assert.match(route, /student_external_identifiers/);
  assert.match(route, /randomBytes\(32\)/);
  assert.match(route, /createHash\('sha256'\)/);
  assert.match(route, /HttpOnly/);
  assert.match(route, /Path=\/api\/core/);
  assert.match(route, /SameSite=Lax/);
  assert.doesNotMatch(route, /pin_hash/);
});

test('work panel consumes the handoff before checking the current session', () => {
  assert.match(page, /legacy-handoff/);
  assert.match(page, /URLSearchParams\(window\.location\.search\)\.get\('handoff'\)/);
  assert.match(page, /history\.replaceState/);
});
