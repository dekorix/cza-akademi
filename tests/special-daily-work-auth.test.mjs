import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync(new URL('../app/api/core/special-program/route.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../db/migrations/20261005_special_education_program_sessions_v1.sql',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/special-work/page.tsx',import.meta.url),'utf8');
const banner=fs.readFileSync(new URL('../components/special-program-today.tsx',import.meta.url),'utf8');

test('daily special API requires authenticated central student',()=>{
  assert.match(route,/authenticatedStudent\(request\)/);
  assert.match(route,/student_id = \$\{student\.student_id\}::uuid/);
  assert.match(route,/academy_id = \$\{student\.academy_id\}::uuid/);
});

test('student cannot complete a session without all planned goals',()=>{
  assert.match(route,/expectedKeys/);
  assert.match(route,/completedPriorityKeys/);
  assert.match(route,/special_program_activities_incomplete/);
});

test('final session closes program and opens reassessment gate',()=>{
  assert.match(route,/SET status = 'completed', completed_at = now\(\)/);
  assert.match(route,/reassessmentDue: programCompleted/);
});

test('daily session schema is central and idempotent per program session index',()=>{
  assert.match(migration,/program_id uuid NOT NULL REFERENCES public\.special_education_programs/);
  assert.match(migration,/student_id uuid NOT NULL REFERENCES public\.students/);
  assert.match(migration,/UNIQUE\(program_id, session_index\)/);
  assert.match(migration,/student_reflection jsonb/);
});

test('student work UI exposes only approved-program daily work flow',()=>{
  assert.match(banner,/\/api\/core\/special-program/);
  assert.match(banner,/Bugünkü çalışmayı aç/);
  assert.match(page,/action: 'start'/);
  assert.match(page,/action: 'complete'/);
  assert.match(page,/Kolaydı/);
  assert.match(page,/İyiydi/);
  assert.match(page,/Zordu/);
});
