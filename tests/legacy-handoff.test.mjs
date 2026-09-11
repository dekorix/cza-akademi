import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/legacy-handoff/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const campusHandoff = fs.readFileSync(new URL('../apps-script/Handoff.gs', import.meta.url), 'utf8');
const campusIndex = fs.readFileSync(new URL('../apps-script/Index.html', import.meta.url), 'utf8');

test('legacy handoff is server-validated and creates an HttpOnly scoped session', () => {
  assert.match(route, /consumeWorkPanelHandoff/);
  assert.match(route, /student_external_identifiers/);
  assert.match(route, /randomBytes\(32\)/);
  assert.match(route, /createHash\('sha256'\)/);
  assert.match(route, /HttpOnly/);
  assert.match(route, /Path=\/api\/core/);
  assert.match(route, /legacy_reference/);
  assert.match(route, /upper\(i\.identifier_value\) = upper/);
  assert.match(route, /SameSite=Lax/);
  assert.doesNotMatch(route, /pin_hash/);
});

test('work panel exchanges the handoff through a top-level redirect', () => {
  assert.match(page, /legacy-handoff/);
  assert.match(page, /URLSearchParams\(window\.location\.search\)\.get\('handoff'\)/);
  assert.match(page, /window\.location\.replace/);
  assert.match(route, /export async function GET/);
  assert.match(route, /Response\.redirect/);
  assert.match(route, /status: 303/);
});

test('campus issues short-lived single-use tickets without putting student credentials in the URL', () => {
  assert.match(campusHandoff, /createWorkPanelHandoff/);
  assert.match(campusHandoff, /requireSession_\(token\)/);
  assert.match(campusHandoff, /CZA_WORK_HANDOFF_SECONDS = 120/);
  assert.match(campusHandoff, /CacheService\.getScriptCache\(\)\.put/);
  assert.match(campusHandoff, /consumeWorkPanelHandoff/);
  assert.match(campusHandoff, /cache\.remove\(key\)/);
  assert.match(campusHandoff, /LockService\.getScriptLock\(\)/);
  assert.match(campusHandoff, /function doPost/);
  assert.doesNotMatch(campusHandoff, /pin/i);
});

test('campus Atölyelere Git shortcut requests a handoff then navigates to the work panel', () => {
  assert.match(campusIndex, /async function openWorkPanel\(\)/);
  assert.match(campusIndex, /server\('createWorkPanelHandoff', state\.token\)/);
  assert.match(campusIndex, /window\.location\.assign\(handoff\.url\)/);
  assert.match(campusIndex, /workshopShortcutButton'\)\.addEventListener\('click', openWorkPanel\)/);
  assert.doesNotMatch(campusIndex, /id="workshopShortcutButton"[^>]*data-view="workshops"/);
});
