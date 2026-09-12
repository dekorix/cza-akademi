import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const educatorAssignments = fs.readFileSync(new URL('../app/api/educator-assignments/route.ts', import.meta.url), 'utf8');
const studentAssignments = fs.readFileSync(new URL('../app/api/core/assignments/route.ts', import.meta.url), 'utf8');
const coreRoute = fs.readFileSync(new URL('../app/api/core/route.ts', import.meta.url), 'utf8');
const studio = fs.readFileSync(new URL('../app/studio/page.tsx', import.meta.url), 'utf8');
const students = fs.readFileSync(new URL('../components/educator-students.tsx', import.meta.url), 'utf8');
const educatorAuth = fs.readFileSync(new URL('../lib/educator-auth.ts', import.meta.url), 'utf8');
const educatorAuthRoute = fs.readFileSync(new URL('../app/api/educator-auth/route.ts', import.meta.url), 'utf8');

test('educator assignment creation reuses central student identity and existing training_recipes', () => {
  assert.match(educatorAssignments, /teacher_student_links/);
  assert.match(educatorAssignments, /l\.can_view = true/);
  assert.match(educatorAssignments, /s\.id = \$\{studentId\}::uuid/);
  assert.match(educatorAssignments, /INSERT INTO public\.training_recipes/);
  assert.match(educatorAssignments, /'teacher_assignment'/);
  assert.doesNotMatch(educatorAssignments, /INSERT INTO public\.students/);
  assert.doesNotMatch(educatorAssignments, /INSERT INTO public\.users/);
});

test('student assignment queue is scoped to the authenticated student session', () => {
  assert.match(studentAssignments, /authenticatedStudent\(request\)/);
  assert.match(studentAssignments, /tr\.student_id = \$\{student\.student_id\}::uuid/);
  assert.match(studentAssignments, /tr\.academy_id = \$\{student\.academy_id\}::uuid/);
  assert.match(studentAssignments, /source = 'teacher_assignment'/);
  assert.match(studentAssignments, /cza_assignment_recipe/);
  assert.match(studentAssignments, /Path=\/api\/core/);
});

test('Core start validates assignment ownership and records the server recipe', () => {
  assert.match(coreRoute, /const ASSIGNMENT_COOKIE = 'cza_assignment_recipe'/);
  assert.match(coreRoute, /authenticatedStudent\(request\)/);
  assert.match(coreRoute, /training_recipes/);
  assert.match(coreRoute, /payload\.recipeId = recipe\.id/);
  assert.match(coreRoute, /payload\.moduleCode = recipe\.module_code/);
  assert.match(coreRoute, /payload\.source = 'teacher_assignment'/);
  assert.match(coreRoute, /payload\.settings = recipe\.settings/);
});

test('assigned studio settings are loaded and locked for the assigned session', () => {
  assert.match(studio, /readAssignedProgram/);
  assert.match(studio, /setAssignmentId\(recipeId\)/);
  assert.match(studio, /disabled=\{active \|\| Boolean\(assignmentId\)\}/);
  assert.match(students, /action: 'create', studentId: student\.id, moduleCode/);
  assert.match(students, /Öğrenciye ata/);
});

test('educator password login creates a local CZA session instead of depending on an upstream cookie', () => {
  assert.match(educatorAuth, /INSERT INTO public\.educator_sessions/);
  assert.match(educatorAuth, /randomBytes\(32\)/);
  assert.match(educatorAuth, /tokenHash\(token\)/);
  assert.match(educatorAuth, /revoked_at IS NULL/);
  assert.match(educatorAuthRoute, /createLocalEducatorSession\(request\)/);
  assert.match(educatorAuthRoute, /educatorCookie\(local\.cookieValue/);
  assert.doesNotMatch(educatorAuthRoute, /upstream\.headers\.get\('set-cookie'\)/);
});
