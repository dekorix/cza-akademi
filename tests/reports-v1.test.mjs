import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/educator-report/route.ts', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../components/central-student-report.tsx', import.meta.url), 'utf8');

test('reports v1 remains educator-authorized and student-linked', () => {
  assert.match(route, /authenticatedEducator\(request\)/);
  assert.match(route, /teacher_student_links l ON l\.teacher_id = t\.id AND l\.can_view = true/);
  assert.match(route, /t\.auth_user_id = \$\{educator\.id\}/);
  assert.match(route, /student_not_found/);
});

test('reports v1 aggregates canonical learning records without a parallel report table', () => {
  assert.match(route, /FROM public\.learning_records/);
  assert.match(route, /metadata->>'source' = 'teacher_assignment'/);
  assert.match(route, /jsonb_typeof\(performance->'total'\)/);
  assert.match(route, /jsonb_typeof\(performance->'correct'\)/);
  assert.match(route, /jsonb_typeof\(performance->'durationMs'\)/);
  assert.doesNotMatch(route, /INSERT INTO public\..*report/i);
});

test('reports v1 derives assignment progress from recipes and sessions', () => {
  assert.match(route, /FROM public\.training_recipes tr/);
  assert.match(route, /tr\.source = 'teacher_assignment'/);
  assert.match(route, /tr\.academy_id = \$\{student\.academy_id\}::uuid/);
  assert.match(route, /tr\.student_id = \$\{student\.id\}::uuid/);
  assert.match(route, /ts\.status = 'completed'/);
  assert.match(route, /END AS status/);
});

test('reports v1 exposes error summary from real question attempts', () => {
  assert.match(route, /FROM public\.question_attempts/);
  assert.match(route, /AND NOT is_correct/);
  assert.match(route, /GROUP BY COALESCE\(error_type, 'RESPONSE_ERROR'\)/);
  assert.match(route, /errorSummary/);
});

test('educator UI renders the decision-oriented report blocks', () => {
  assert.match(ui, /Raporlar V1/);
  assert.match(ui, /Çalışma ve ödev gelişim özeti/);
  assert.match(ui, /Canonical doğruluk/);
  assert.match(ui, /Ödev ilerlemesi/);
  assert.match(ui, /Hata ve tekrar sinyalleri/);
  assert.match(ui, /Modül bazlı gelişim/);
  assert.match(ui, /Son ödevler/);
});

test('reports v1 preserves clinical boundary and canonical history', () => {
  assert.match(ui, /Bu alan tanı veya norm üretmez/);
  assert.match(ui, /Canonical Learning Record/);
  assert.match(ui, /Tek Student ID/);
});
