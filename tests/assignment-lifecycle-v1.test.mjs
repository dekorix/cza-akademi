import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studentRoute = fs.readFileSync(new URL('../app/api/core/assignments/route.ts', import.meta.url), 'utf8');
const educatorRoute = fs.readFileSync(new URL('../app/api/educator-assignments/route.ts', import.meta.url), 'utf8');
const studentUi = fs.readFileSync(new URL('../components/assigned-work-banner.tsx', import.meta.url), 'utf8');
const educatorUi = fs.readFileSync(new URL('../components/educator-students.tsx', import.meta.url), 'utf8');
const assignmentPage = fs.readFileSync(new URL('../app/assignment/page.tsx', import.meta.url), 'utf8');
const coreRoute = fs.readFileSync(new URL('../app/api/core/route.ts', import.meta.url), 'utf8');
const studio = fs.readFileSync(new URL('../app/studio/page.tsx', import.meta.url), 'utf8');

test('student assignment lifecycle is derived from canonical training sessions', () => {
  assert.match(studentRoute, /if \(row\.completed_session_id\) return 'completed'/);
  assert.match(studentRoute, /if \(row\.active_session_id\) return 'in_progress'/);
  assert.match(studentRoute, /return 'available'/);
  assert.match(studentRoute, /latest_learning_record_id/);
  assert.match(studentRoute, /FROM public\.learning_records/);
  assert.match(studentRoute, /JOIN public\.training_sessions ts ON ts\.id = lr\.training_session_id/);
});

test('student can only read and launch own academy assignment', () => {
  assert.match(studentRoute, /tr\.student_id = \$\{student\.student_id\}::uuid/);
  assert.match(studentRoute, /tr\.academy_id = \$\{student\.academy_id\}::uuid/);
  assert.match(studentRoute, /tr\.source = 'teacher_assignment'/);
  assert.match(studentRoute, /assignment_completed/);
  assert.match(studentRoute, /'Path=\/api\/core'/);
});

test('educator assignment lifecycle is authorization-bound and canonical', () => {
  assert.match(educatorRoute, /teacher_student_links l\s+ON l\.teacher_id = t\.id AND l\.academy_id = t\.academy_id AND l\.can_view = true/);
  assert.match(educatorRoute, /tr\.academy_id = \$\{link\.academy_id\}::uuid/);
  assert.match(educatorRoute, /tr\.source = 'teacher_assignment'/);
  assert.match(educatorRoute, /latest_learning_record_id/);
  assert.match(educatorRoute, /FROM public\.learning_records/);
  assert.match(educatorRoute, /NOT EXISTS \([\s\S]*ts\.recipe_id = training_recipes\.id AND ts\.status = 'completed'/);
});

test('student UI exposes assigned, started and completed states', () => {
  assert.match(studentUi, /assigned: 'Atandı'/);
  assert.match(studentUi, /started: 'Başlandı'/);
  assert.match(studentUi, /completed: 'Tamamlandı'/);
  assert.match(studentUi, /Görev tamamlandı/);
  assert.match(studentUi, /Çalışmaya devam et/);
});

test('educator UI can list lifecycle and close open assignments', () => {
  assert.match(educatorUi, /action: 'list'/);
  assert.match(educatorUi, /action: 'deactivate'/);
  assert.match(educatorUi, /Atamaları göster/);
  assert.match(educatorUi, /canonical sonuç var/);
});

test('completed assignment cannot be launched and studio remains server-bound to recipe cookie', () => {
  assert.match(assignmentPage, /!details\.assignment\.launchPath/);
  assert.match(coreRoute, /const recipeId = readCookie\(request, ASSIGNMENT_COOKIE\)/);
  assert.match(coreRoute, /payload\.recipeId = recipe\.id/);
  assert.match(coreRoute, /payload\.source = 'teacher_assignment'/);
  assert.match(studio, /metadata: \{ source: 'student_work_center', assignmentId: null \}/);
  assert.match(studio, /if \(assignmentId\) await core\('finish',\{sessionId,aborted\}\)/);
});
