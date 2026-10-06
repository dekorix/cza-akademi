import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync(new URL('../app/studio/page.tsx', import.meta.url), 'utf8');
const records = fs.readFileSync(new URL('../lib/core-records.ts', import.meta.url), 'utf8');
const studentHistory = fs.readFileSync(new URL('../app/api/student-history/route.ts', import.meta.url), 'utf8');
const studentSession = fs.readFileSync(new URL('../lib/student-session.ts', import.meta.url), 'utf8');
const canonicalRepository = fs.readFileSync(new URL('../lib/persistence/canonical-repository.ts', import.meta.url), 'utf8');
const sessionBindingMigration = fs.readFileSync(new URL('../db/migrations/20261005_canonical_learning_student_session_binding_v1.sql', import.meta.url), 'utf8');
const studentHistoryUi = fs.readFileSync(new URL('../components/student-learning-history.tsx', import.meta.url), 'utf8');
const studentPortal = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const educatorReport = fs.readFileSync(new URL('../app/api/educator-report/route.ts', import.meta.url), 'utf8');
const educatorUi = fs.readFileSync(new URL('../components/central-student-report.tsx', import.meta.url), 'utf8');

test('studio closes a session and publishes one canonical module record with a stable client id', () => {
  assert.match(studio, /canonicalRecordId = useRef\(''\)/);
  assert.match(studio, /core\('finish',\s*\{\s*sessionId\s*\}\)/);
  assert.match(studio, /core\('module_record',\s*\{\s*record\s*\}\)/);
  assert.match(studio, /canonicalSessionRecord\(/);
  assert.match(records, /schemaVersion:\s*'CZA_MODULE_RECORD_V1'/);
  assert.match(records, /contractVersion:\s*'1\.0\.0'/);
  assert.match(records, /trainingSessionId:/);
  assert.match(records, /canonicalSkillCode/);
  assert.match(records, /\.map\(canonicalSkillCode\)/);
});

test('authenticated student session identity is carried into canonical persistence', () => {
  assert.match(studentSession, /ss\.id AS student_session_id/);
  assert.match(studentSession, /student_session_id: string/);
  assert.match(canonicalRepository, /student\.student_session_id/);
  assert.match(canonicalRepository, /CZA_STUDENT_SESSION_OWNERSHIP_INVALID/);
  assert.match(sessionBindingMigration, /record_origin = 'client_reported'/);
  assert.match(sessionBindingMigration, /student_session_id IS NOT NULL/);
  assert.match(sessionBindingMigration, /CZA_STUDENT_SESSION_OWNERSHIP_INVALID/);
});

test('student history is session-bound and reads only the authenticated academy and student ledger', () => {
  assert.match(studentHistory, /authenticatedStudent\(request\)/);
  assert.match(studentHistory, /FROM public\.learning_records/);
  assert.match(studentHistory, /academy_id = \$\{student\.academy_id\}::uuid/);
  assert.match(studentHistory, /student_id = \$\{student\.student_id\}::uuid/);
  assert.doesNotMatch(studentHistory, /studentId\s*=\s*new URL/);
});

test('student work panel renders history from the canonical history endpoint', () => {
  assert.match(studentHistoryUi, /fetch\('\/api\/student-history'/);
  assert.match(studentPortal, /<StudentLearningHistory\s*\/>/);
  assert.match(studentHistoryUi, /Canonical Learning Record/);
});

test('educator report reads the same learning_records source after teacher-student authorization', () => {
  assert.match(educatorReport, /teacher_student_links/);
  assert.match(educatorReport, /l\.can_view = true/);
  assert.match(educatorReport, /FROM public\.learning_records/);
  assert.match(educatorReport, /student_id = \$\{student\.id\}/);
  assert.match(educatorUi, /Gerçek çalışma geçmişi/);
});


test('student session cookie is available to history APIs', () => {
  const sessionCookieBlock = coreRoute.match(/function sessionCookie[\\s\\S]*?function assignmentCookie/)?.[0] || '';
  assert.match(sessionCookieBlock, /'Path=\\/api'/);
  assert.doesNotMatch(sessionCookieBlock, /'Path=\\/api\\/core'/);
});
