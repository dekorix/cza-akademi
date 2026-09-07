import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('../app/api/core/route.ts', import.meta.url), 'utf8');
const report = fs.readFileSync(new URL('../app/api/educator-report/route.ts', import.meta.url), 'utf8');
const guard = fs.readFileSync(new URL('../lib/request-guard.ts', import.meta.url), 'utf8');

test('sensitive API routes use a shared request guard', () => {
  assert.match(core, /allowRequest\(request, 'student-login', 6, 10 \* 60 \* 1000\)/);
  assert.match(report, /allowRequest\(request,'educator-report',20,10\*60\*1000\)/);
  assert.match(guard, /status: 429/);
  assert.match(guard, /retry-after/);
});

test('educator reporting requires central auth and a server-only database connection', () => {
  assert.match(report, /authenticatedEducator\(request\)/);
  assert.match(report, /process\.env\.DATABASE_URL/);
  assert.match(report, /teacher_student_links/);
});
