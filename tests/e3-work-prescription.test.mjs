import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const recommendations = fs.readFileSync(new URL('../lib/e3-work-recommendations.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../app/api/educator-e3-assignments/route.ts', import.meta.url), 'utf8');
const report = fs.readFileSync(new URL('../app/educator/assessment/e3/report/page.tsx', import.meta.url), 'utf8');

test('E3 Work Panel bridge is age gated and keeps preschool sessions guided', () => {
  assert.match(recommendations, /ageMonths >= 39/);
  assert.match(recommendations, /ageMonths >= 42/);
  assert.match(recommendations, /ageMonths >= 45/);
  assert.match(recommendations, /practiceMode: 'guided_practice'/);
  assert.match(recommendations, /countdownEnabled: false/);
  assert.doesNotMatch(recommendations, /practiceMode: 'performance'/);
});

test('E3 does not force language social motor or daily living evidence into Anzan recipes', () => {
  assert.match(recommendations, /developmentalOnly/);
  assert.match(recommendations, /'receptive_language'/);
  assert.match(recommendations, /'expressive_language'/);
  assert.match(recommendations, /'social_emotion_play'/);
  assert.match(recommendations, /'motor_graphomotor'/);
  assert.match(recommendations, /'daily_living_safety'/);
  assert.match(recommendations, /zorla eşlemek pedagojik olarak uygun değildir/);
});

test('E3 prescription approval revalidates educator, student, completed E3 session and server recommendation', () => {
  assert.match(api, /authenticatedEducator\(request\)/);
  assert.match(api, /teacher_student_links/);
  assert.match(api, /student_id = \$\{studentId\}::uuid/);
  assert.match(api, /template_code = \$\{E3_TEMPLATE_CODE\}/);
  assert.match(api, /status = 'completed'/);
  assert.match(api, /buildE3SectionReport/);
  assert.match(api, /buildE3WorkRecommendations/);
  assert.match(api, /recipeSettingsFromRecommendation/);
  assert.match(api, /INSERT INTO public\.training_recipes/);
  assert.doesNotMatch(api, /INSERT INTO public\.students/);
  assert.doesNotMatch(api, /INSERT INTO public\.users/);
});

test('E3 report requires educator approval before real assignment', () => {
  assert.match(report, /E3 → CZA Çalışma Paneli/);
  assert.match(report, /Onayla ve ata/);
  assert.match(report, /educator-e3-assignments/);
  assert.match(report, /assessmentSessionId:sessionId/);
  assert.match(report, /studentId:session\.student_id/);
  assert.match(report, /Eğitimci onayı olmadan öğrenciye hiçbir şey atanmaz/);
});
