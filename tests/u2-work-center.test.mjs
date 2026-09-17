/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const workRoute = read('../app/api/core/assignments/route.ts');
const coreRoute = read('../app/api/core/route.ts');
const dashboardRoute = read('../app/api/core/dashboard/route.ts');
const repository = read('../lib/persistence/work-center-repository.ts');
const routing = read('../lib/work-center.ts');
const workPage = read('../components/work-center.tsx');
const studio = read('../app/studio/page.tsx');

test('work center and assignment APIs derive student identity from auth', () => {
  for (const source of [workRoute, coreRoute, dashboardRoute]) {
    assert.match(source, /authenticatedStudent\(request\)/);
  }
  assert.doesNotMatch(
    workRoute,
    /input\.studentId|searchParams\.get\(['"]studentId/,
  );
  assert.match(repository, /academy_id = \$\{student\.academy_id\}::uuid/);
  assert.match(repository, /student_id = \$\{student\.student_id\}::uuid/);
});

test('assignment module routing is allowlisted and unsupported modules fail closed', () => {
  for (const moduleCode of [
    'finger_read',
    'soroban_read',
    'soroban_write',
    'flash_anzan',
    'audio_anzan',
  ]) {
    assert.match(routing, new RegExp(`${moduleCode}: '/studio'`));
  }
  assert.match(workRoute, /unsupported_assignment_module/);
  assert.match(coreRoute, /isAssignedEngineModule/);
  assert.match(coreRoute, /unsupported_assignment_module/);
});

test('assigned session start, resume, attempt, result, and evidence are server-owned', () => {
  assert.match(coreRoute, /assignedSessionForRecipe/);
  assert.match(coreRoute, /bindAssignedSession/);
  assert.match(coreRoute, /recordAssignedAttempt/);
  assert.match(coreRoute, /completeAssignedSession/);
  assert.match(coreRoute, /ownedSession\(student, sessionId\)/);
  assert.match(
    studio,
    /source:assignmentId\?'teacher_assignment':'free_practice'/,
  );
  assert.match(studio, /serverAttemptCount/);
  assert.match(studio, /resumeOffset\+round\+1/);
});

test('real work center UI presents lifecycle, history, and responsive layout', () => {
  for (const label of [
    'Çalışma Merkezim',
    'Bugünkü çalışmalarım',
    'Aktif atamalarım',
    'Yaklaşan çalışmalarım',
    'Sonuçlarım',
    'Tamamladıklarım',
    'Beceri atölyeleri',
    'Son çalışma geçmişim',
  ]) {
    assert.match(workPage, new RegExp(label));
  }
  assert.match(workPage, /sm:grid-cols-2/);
  assert.match(workPage, /xl:grid-cols-/);
  assert.doesNotMatch(workPage, /min-w-\[[1-9][0-9]{3,}px\]/);
});

test('responses are allowlisted and do not expose secrets', () => {
  const combined = `${workRoute}\n${coreRoute}\n${dashboardRoute}\n${repository}`;
  for (const key of ['password', 'pin_hash', 'token_hash', 'DATABASE_URL:']) {
    assert.doesNotMatch(combined, new RegExp(`['"]${key}['"]`, 'i'));
  }
  assert.match(dashboardRoute, /profile:/);
  assert.match(dashboardRoute, /assignments:/);
  assert.match(dashboardRoute, /recentActivity:/);
  assert.match(dashboardRoute, /skillProfile:/);
});
