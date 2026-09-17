/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const listRoute = read('../app/api/educator-students/route.ts');
const detailRoute = read('../app/api/educator-student-detail/route.ts');
const panel = read('../components/educator-student-core.tsx');
const educatorPage = read('../app/educator/page.tsx');
const migration = read('../db/migrations/20260917_u3_educator_student_access_v1.sql');

test('U3 migration is additive and binds both identities to one academy', () => {
  assert.doesNotMatch(
    migration,
    /\b(?:drop|truncate)\b|\bdelete\s+from\b|\balter\s+table\b[^;]*\bdrop\b/i,
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.teacher_student_links/);
  assert.match(migration, /FOREIGN KEY \(teacher_id, academy_id\)/);
  assert.match(migration, /FOREIGN KEY \(student_id, academy_id\)/);
  assert.match(migration, /WHERE can_view = true/);
});

test('U3 educator identity and student authorization are server-side', () => {
  for (const route of [listRoute, detailRoute]) {
    assert.match(route, /authenticatedEducator\(request\)/);
    assert.match(route, /teacher_student_links/);
    assert.match(route, /link\.can_view = true|l\.can_view = true/);
    assert.match(route, /educator_user\.auth_user_id|t\.auth_user_id/);
    assert.match(route, /educator_user\.academy_id|t\.academy_id/);
    assert.match(route, /educator_user\.role::text = 'educator'|t\.role::text = 'educator'/);
  }
  assert.match(detailRoute, /student_not_authorized/);
  assert.match(detailRoute, /s\.id = \$\{studentId\}::uuid/);
  assert.doesNotMatch(detailRoute, /INSERT INTO|UPDATE public|DELETE FROM/);
});

test('U3 canonical educator role cannot be replaced by external claims or links', () => {
  const auth = read('../lib/educator-auth.ts');
  assert.match(auth, /role::text = 'educator'/);
  assert.doesNotMatch(auth, /role::text IN \('admin','teacher'\)/);
  assert.match(auth, /canonicalEducatorByAuthId\(EDUCATOR_AUTH_USER_ID\)/);
});

test('U3 reads canonical U1 and U2 persistence without parallel models', () => {
  for (const relation of [
    'training_recipes',
    'training_sessions',
    'question_attempts',
    'learning_records',
    'learning_evidence',
  ]) {
    assert.match(detailRoute, new RegExp(`public\\.${relation}`));
  }
  assert.doesNotMatch(detailRoute, /educator_student_history|educator_learning_profile/);
});

test('U3 keeps client_reported and server_verified provenance separate', () => {
  assert.match(detailRoute, /provenance: 'client_reported'/);
  assert.match(detailRoute, /verificationStatus === 'server_verified'/);
  assert.match(detailRoute, /clientReportedSkills/);
  assert.match(detailRoute, /serverVerifiedSkills/);
  assert.match(panel, /Öğrenci\/istemci bildirimi/);
  assert.match(panel, /Sunucu doğrulamalı/);
  assert.match(panel, /İstemci sonuçları evidence olarak gösterilmez/);
});

test('U3 panel provides responsive student list, detail, work, errors, history, and profile', () => {
  assert.match(educatorPage, /<EducatorStudentCore/);
  for (const label of [
    'Yetkili öğrencilerim',
    'Aktif ve devam eden çalışmalar',
    'Tamamlanan çalışmalar',
    'Son attempt ve sonuçlar',
    'Hata görünümü',
    'Evidence görünümü',
    'Kronolojik öğrenci geçmişi',
    'Student Learning Profile özeti',
  ]) {
    assert.match(panel, new RegExp(label));
  }
  assert.match(panel, /xl:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(panel, /sm:grid-cols-4/);
  assert.doesNotMatch(panel, /min-w-\[[1-9][0-9]{3,}px\]/);
});

test('U3 response surfaces avoid credential and secret fields', () => {
  const combined = `${listRoute}\n${detailRoute}`;
  for (const secret of ['password', 'token_hash', 'DATABASE_URL:']) {
    assert.doesNotMatch(combined, new RegExp(`['"]${secret}['"]`, 'i'));
  }
});
