import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/educator-special-programs/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/educator/special-program/page.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../db/migrations/20261005_special_education_programs_v1.sql', import.meta.url), 'utf8');

test('special program API requires central educator-student authorization', () => {
  assert.match(route, /authenticatedEducator\(request\)/);
  assert.match(route, /teacher_student_links/);
  assert.match(route, /l\.can_view = true/);
  assert.match(route, /s\.id = \$\{studentId\}::uuid/);
});

test('program can only originate from completed special assessment', () => {
  assert.match(route, /status = 'completed'/);
  assert.match(route, /template_code LIKE 'CZA_SPECIAL_V1_%'/);
  assert.match(route, /buildSpecialLearningProfile/);
  assert.match(route, /insufficient_special_evidence/);
});

test('educator approval is an explicit write gate', () => {
  assert.match(route, /if \(input\.confirm !== true\)/);
  assert.match(route, /educator_approval_required/);
  assert.match(route, /INSERT INTO public\.special_education_programs/);
  assert.match(page, /Eğitimci onayı:/);
  assert.match(page, /confirm: true/);
});

test('schema keeps program in central identity and prevents duplicate active profile plans', () => {
  assert.match(migration, /academy_id uuid NOT NULL REFERENCES public\.academies/);
  assert.match(migration, /student_id uuid NOT NULL REFERENCES public\.students/);
  assert.match(migration, /assessment_session_id uuid NOT NULL REFERENCES public\.assessment_sessions/);
  assert.match(migration, /approved_by uuid NOT NULL REFERENCES public\.users/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS uq_special_education_programs_active_profile/);
  assert.match(migration, /WHERE status = 'active'/);
});
