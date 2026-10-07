/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const route = read('../app/api/educator-assignments/route.ts');
const studentRoute = read('../app/api/core/assignments/route.ts');
const dashboard = read('../app/api/core/dashboard/route.ts');
const migration = read('../db/migrations/20260917_u5_assignment_management_v1.sql');
const manager = read('../components/educator-assignment-manager.tsx');
const timeline = read('../lib/persistence/learning-timeline.ts');

test('U5 migration is additive, repeatable, and preserves history', () => {
  assert.doesNotMatch(migration, /\b(?:drop|truncate)\b|\bdelete\s+from\b|\balter\s+table\b[^;]*\bdrop\b/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS instructions/);
  assert.match(migration, /idx_training_recipes_idempotency_u5/);
  assert.match(migration, /cancelled_at IS NOT NULL.*is_active = false/s);
});

test('U5 educator writes require canonical educator, academy, link, and ownership', () => {
  assert.match(route, /t\.is_active = true/);
  assert.match(route, /t\.role::text IN \('admin','teacher','educator'\)/);
  assert.match(route, /l\.academy_id = t\.academy_id AND l\.can_view = true/);
  assert.match(route, /s\.academy_id = t\.academy_id/);
  assert.match(route, /assigned_by=\$\{link\.educator_user_id\}/);
  assert.doesNotMatch(route, /input\.(?:educator_id|educatorId|teacher_id|teacherId|academy_id|academyId)/);
  assert.match(route, /action === 'cancel'/);
  assert.doesNotMatch(route, /DELETE FROM public\.training_recipes/i);
});

test('U5 create is idempotent, assignment engine is fail closed, and student reads are scoped', () => {
  assert.match(route, /clientRequestId/);
  assert.match(route, /idempotency_conflict/);
  assert.match(route, /ON CONFLICT \(academy_id, assigned_by, client_request_id\)/);
  assert.match(route, /isAssignableModule\(moduleCode\)/);
  assert.match(studentRoute, /tr\.student_id = \$\{student\.student_id\}::uuid/);
  assert.match(studentRoute, /unsupported_assignment_module/);
  assert.match(studentRoute, /assignedEnginePath/);
  assert.match(dashboard, /tr\.instructions/);
});

test('U5 UI supports responsive create, update, cancel, filtering and student instructions', () => {
  for (const token of ['Ödev oluştur', 'Düzenle', 'İptal', 'Durum', 'Eğitmen talimatı', 'md:grid-cols-2']) assert.match(manager, new RegExp(token));
  assert.match(manager, /crypto\.randomUUID\(\)/);
  assert.match(manager, /action: 'list'/);
});

test('U5 assignment lifecycle remains server-owned without client-derived verified claims', () => {
  for (const event of ['ASSIGNMENT_CREATED', 'ASSIGNMENT_STARTED', 'ASSIGNMENT_COMPLETED', 'ASSIGNMENT_CANCELLED']) assert.match(timeline, new RegExp(event));
  const recipeArm = timeline.slice(timeline.indexOf("SELECT 'assignment:"), timeline.indexOf('UNION ALL'));
  assert.match(recipeArm, /server_authoritative.*server_verified/s);
  assert.doesNotMatch(recipeArm, /is_correct|correctCount|accuracy|performance|skillCode/);
  const sessionArm = timeline.slice(timeline.indexOf("SELECT 'session:"), timeline.indexOf('UNION ALL', timeline.indexOf("SELECT 'session:")));
  assert.doesNotMatch(sessionArm, /is_correct|correctCount|accuracy|performance|skillCode/);
});
