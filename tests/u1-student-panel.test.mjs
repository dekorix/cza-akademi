import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const route = read('../app/api/core/dashboard/route.ts');
const page = read('../app/page.tsx');
const dashboard = read('../components/student-dashboard.tsx');
const assignmentRoute = read('../app/api/core/assignments/route.ts');
const coreRoute = read('../app/api/core/route.ts');
const persistence = read('../lib/persistence/canonical-repository.ts');
const learningMigration = read(
  '../db/migrations/20260913_canonical_learning_ledger_v1.sql',
);
const stagingMigration = read(
  '../db/migrations/20260912_staging_core_prerequisites_v1.sql',
);

test('U1 starts from the authenticated canonical student identity', () => {
  assert.match(route, /authenticatedStudent\(request\)/);
  assert.match(route, /student\.student_id/);
  assert.match(route, /student\.academy_id/);
  assert.match(route, /student\.student_user_id/);
});

test('unauthenticated dashboard requests fail closed', () => {
  assert.match(
    route,
    /if \(!student\) return json\(\{ ok: false, error: 'session_required' \}, 401\)/,
  );
});

test('student identity cannot be selected from query or request body', () => {
  assert.doesNotMatch(route, /searchParams|request\.json\(/);
  assert.doesNotMatch(route, /studentId\s*=|student_id\s*=\s*input/);
});

test('profile lookup binds all three canonical identity dimensions', () => {
  assert.match(route, /s\.id = \$\{student\.student_id\}::uuid/);
  assert.match(route, /s\.academy_id = \$\{student\.academy_id\}::uuid/);
  assert.match(route, /s\.user_id = \$\{student\.student_user_id\}::uuid/);
});

test('student A cannot read student B assignment queue', () => {
  assert.match(
    route,
    /tr\.student_id = \$\{student\.student_id\}::uuid[\s\S]*tr\.academy_id = \$\{student\.academy_id\}::uuid/,
  );
  assert.match(assignmentRoute, /authenticatedStudent\(request\)/);
  assert.match(assignmentRoute, /tr\.student_id = \$\{student\.student_id\}::uuid/);
});

test('assignment launch remains server-authoritative', () => {
  assert.match(coreRoute, /authenticatedStudent\(request\)/);
  assert.match(coreRoute, /payload\.recipeId = recipe\.id/);
  assert.match(coreRoute, /payload\.settings = recipe\.settings/);
});

test('attempt and result persistence bind to the authenticated student', () => {
  assert.match(coreRoute, /persistCanonicalLearningRecord\(student, record\)/);
  assert.match(persistence, /\$\{student\.student_id\}::uuid/);
  assert.match(persistence, /\$\{student\.session_id\}::uuid/);
});

test('error and evidence fields remain part of the persisted learning chain', () => {
  assert.match(learningMigration, /CREATE TABLE IF NOT EXISTS public\.learning_evidence/);
  assert.match(learningMigration, /p_performance jsonb/);
  assert.match(learningMigration, /p_skills jsonb/);
  assert.match(learningMigration, /p_metadata jsonb/);
});

test('history is student-scoped and deterministically ordered', () => {
  assert.match(
    route,
    /ts\.student_id = \$\{student\.student_id\}::uuid[\s\S]*ts\.academy_id = \$\{student\.academy_id\}::uuid/,
  );
  assert.match(
    route,
    /ORDER BY COALESCE\(ts\.completed_at, ts\.started_at\) DESC, ts\.id DESC/,
  );
});

test('duplicate and failed writes retain atomic fail-closed behavior', () => {
  assert.match(learningMigration, /ON CONFLICT \(academy_id, client_record_id\) DO NOTHING/);
  assert.match(learningMigration, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(learningMigration, /BEGIN;/);
  assert.match(learningMigration, /COMMIT;/);
});

test('dashboard response uses an explicit safe allowlist', () => {
  for (const forbidden of [
    'password',
    'pin_hash',
    'token_hash',
    'sessionToken',
    'DATABASE_URL:',
    'credential',
  ]) {
    assert.doesNotMatch(route, new RegExp(`['"]${forbidden}['"]`, 'i'));
  }
  assert.match(route, /profile:/);
  assert.match(route, /summary:/);
  assert.match(route, /assignments:/);
  assert.match(route, /recentActivity:/);
  assert.match(route, /skillProfile:/);
});

test('demo fixtures cannot be directed to production by U1', () => {
  assert.match(stagingMigration, /CHECK \(environment = 'staging'\)/);
  assert.doesNotMatch(
    `${route}\n${page}\n${dashboard}`,
    /INSERT INTO public\.(students|users|academies)/,
  );
});

test('student auth guard and durable logout are not regressed', () => {
  assert.match(coreRoute, /revokeStudentSession\(request\)/);
  assert.match(coreRoute, /session_required/);
  assert.match(coreRoute, /secure_transport_required/);
});

test('root route now renders the real student panel instead of an external redirect', () => {
  assert.match(page, /return <StudentPortal area="main" \/>/);
  assert.doesNotMatch(page, /window\.location\.replace\(CAMPUS_V14_URL\)/);
  assert.match(page, /fetch\('\/api\/core\/dashboard'/);
});

test('responsive U1 UI exposes all required student destinations', () => {
  for (const label of [
    'Çalışma Merkezim',
    'Atanan Çalışmalar',
    'Sonuçlarım',
    'Geçmişim',
    'Beceri Profilim',
    'CZA modülleri',
  ]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /sm:grid-cols-2/);
  assert.match(dashboard, /xl:grid-cols/);
  assert.match(dashboard, /klinik tanı veya sağlık etiketi üretmez/);
});
