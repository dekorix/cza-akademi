import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync(new URL('../app/studio/page.tsx', import.meta.url), 'utf8');
const reportRoute = fs.readFileSync(new URL('../app/api/educator-report/route.ts', import.meta.url), 'utf8');
const students = fs.readFileSync(new URL('../components/educator-students.tsx', import.meta.url), 'utf8');

test('work panel uses the authenticated CZA Core session for start, attempts and finish', () => {
  assert.match(studio, /core\('me'\)/);
  assert.match(studio, /core\('start',\s*\{moduleCode:moduleCodeByMode\[config\.mode\]/);
  assert.match(studio, /core\('attempt',\s*\{sessionId,payload:/);
  assert.match(studio, /core\('finish',\s*\{sessionId\}\)/);
});

test('educator work reports resolve by central student id and read attempts by student_id', () => {
  assert.match(reportRoute, /const studentId = typeof body\.studentId === 'string'/);
  assert.match(reportRoute, /s\.id = \$\{studentId\}::uuid/);
  assert.match(reportRoute, /question_attempts WHERE student_id=\$\{student\.id\}/);
  assert.match(reportRoute, /teacher_student_links/);
  assert.match(reportRoute, /l\.can_view = true/);
});

test('student list opens the work report with Student ID even when no campus code exists', () => {
  assert.match(students, /onReport: \(studentId: string\) => void/);
  assert.match(students, /onReport\(student\.id\)/);
  assert.doesNotMatch(students, /disabled=\{!student\.code\}[^>]*>Çalışma raporu/);
});
