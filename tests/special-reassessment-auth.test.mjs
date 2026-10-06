import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync(new URL('../app/api/educator-special-reassessment/route.ts',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/educator/special-reassessment/page.tsx',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../db/migrations/20261005_special_education_reassessments_v1.sql',import.meta.url),'utf8');

test('reassessment requires authorized educator and linked student',()=>{
  assert.match(route,/authenticatedEducator\(request\)/);
  assert.match(route,/teacher_student_links/);
  assert.match(route,/l\.can_view=true/);
  assert.match(route,/s\.id=\$\{studentId\}::uuid/);
});

test('reassessment only opens after completed special program',()=>{
  assert.match(route,/special_program_not_completed/);
  assert.match(route,/program\.status!=='completed'/);
  assert.match(route,/template_code LIKE 'CZA_SPECIAL_V1_%'/);
});

test('three fresh probes are required for every selected area',()=>{
  assert.match(route,/area\.probes\.length===3/);
  assert.match(route,/reassessment_evidence_incomplete/);
  assert.match(page,/3 yeni örnek/);
});

test('one closure comparison is stored per program',()=>{
  assert.match(migration,/UNIQUE\(program_id\)/);
  assert.match(migration,/comparison jsonb NOT NULL/);
  assert.match(migration,/baseline_session_id uuid NOT NULL REFERENCES public\.assessment_sessions/);
});

test('comparison remains educational and does not auto-diagnose',()=>{
  assert.match(page,/Aynı soruları tekrar kullanma/);
  assert.match(route,/compareSpecialReassessment/);
});
