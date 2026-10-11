/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
function load(source, modules, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: name => {
    if (!(name in modules)) throw new Error(name);
    return modules[name];
  }, Response, Request, URL, Date, ...extra });
  return exports;
}
const work = load(read('../lib/work-center.ts'), {});
const empty = () => null;
const { StudentDashboard } = load(read('../components/student-dashboard.tsx'), {
  'react/jsx-runtime': jsx,
  'lucide-react': new Proxy({}, { get: () => empty }),
  '@/components/ui/button': { Button: ({ children, ...props }) => React.createElement('button', props, children) },
  '@/lib/work-center': work,
  '@/components/learning-timeline': { LearningTimeline: empty },
  '@/components/student-learning-profile': { StudentLearningProfile: empty },
  '@/components/special-program-today': { SpecialProgramToday: empty },
  '@/components/coaching-center': { CoachingCenter: empty },
});
// Same synthetic Student ID recorded in PR #87 evidence; no student is created.
const studentId = '20000000-0000-4000-8000-000000000001';
const academyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assignment = (status, id = status) => ({
  id, status, title: status + ' çalışma', moduleName: 'Soroban', moduleCode: 'soroban_read',
  instructions: 'Eğitmen yönergesi', completedCount: 0, sessionCount: 1, progressPercent: 25,
});
function render(assignments, options = {}) {
  const dashboard = { profile: { id: studentId, name: 'Sentetik QA', username: 'qa' }, assignments,
    summary: { activeAssignments: 1, completedSessions: 0, totalAttempts: 0 }, recentActivity: [], skillProfile: [] };
  return renderToStaticMarkup(React.createElement(StudentDashboard, {
    dashboard, loading: false, error: '', onLogout() {}, ...options,
  }));
}
function route(html) { return html.split('id="route"')[1]?.split('</section>')[0] || ''; }
test('route resumes existing in-progress assignment ahead of a newer available assignment', () => {
  const html = route(render([assignment('available'), assignment('in_progress')]));
  assert.match(html, /Kaldığın yerden devam et/);
  assert.match(html, /recipe=in_progress/);
  assert.doesNotMatch(html, /recipe=available/);
  assert.match(html, /Eğitmen yönergesi/);
  assert.match(html, /%25/);
});
test('available assignment is next and terminal/future assignments never become the route', () => {
  for (const status of ['assigned', 'completed', 'expired', 'cancelled', 'closed']) {
    const html = render([assignment(status), assignment('available', 'existing-recipe')]);
    assert.match(route(html), /recipe=existing-recipe/);
    assert.doesNotMatch(route(html), new RegExp('recipe=' + status));
    assert.match(html, new RegExp(work.workStateLabel(status)));
    assert.match(html, /Atama ayrıntıları/);
  }
});
test('empty route, failure and loading do not claim that an assignment is ready', () => {
  assert.match(route(render([])), /başlayabileceğin atanmış çalışma yok/);
  assert.match(route(render([], { dashboard: null, error: 'Veri yüklenemedi' })), /yüklenemedi/);
  assert.doesNotMatch(render([], { loading: true }), /id="route"/);
  assert.doesNotMatch(render([]), /Sıradaki adımın hazır/);
});
test('same recipe survives repeated render and unsafe title/recipe text is escaped', () => {
  const item = { ...assignment('available', 'existing & recipe'), title: '<script>foreign()</script>' };
  const first = render([item]);
  assert.equal(first, render([item]));
  assert.match(first, /recipe=existing%20%26%20recipe/);
  assert.doesNotMatch(first, /<script>foreign/);
});
test('existing panel destinations and canonical profile remain available', () => {
  const html = render([]);
  for (const id of ['today', 'results', 'history', 'profile']) assert.match(html, new RegExp('id="' + id + '"'));
  for (const href of ['/work', '/learn', '/paritmetik', '#profile']) assert.ok(html.includes('href="' + href + '"'));
});

function dashboardRoute({ authenticated = true, identity = true, fail = false, forbidden = false } = {}) {
  const calls = [];
  const student = { student_id: studentId, academy_id: academyId, student_user_id: '10000000-0000-4000-8000-000000000001' };
  const sql = async (strings, ...values) => {
    const query = strings.join('?'); calls.push({ query, values });
    if (fail) throw new Error('database unavailable');
    if (forbidden) throw Object.assign(new Error('read denied'), { code: '42501' });
    if (query.includes('JOIN public.users')) return identity ? [{ id: studentId, username: 'qa', display_name: 'Sentetik QA' }] : [];
    if (query.includes('FROM public.training_recipes tr')) return [{
      id: '30000000-0000-4000-8000-000000000001', module_code: 'soroban_read', module_name: 'Soroban',
      name: 'Mevcut atama', is_active: true, settings: { rounds: 4 }, attempt_count: 1,
      active_session_id: '40000000-0000-4000-8000-000000000001',
    }];
    return [];
  };
  const exports = load(read('../app/api/core/dashboard/route.ts'), {
    '@neondatabase/serverless': { neon: () => sql },
    '@/lib/qa-student-read': { studentReadSql: async () => sql },
    '@/lib/request-guard': { allowRequest: async () => ({ allowed: true }) },
    '@/lib/student-session': { authenticatedStudent: async () => authenticated ? student : null },
    '@/lib/work-center': work,
  }, { process: { env: { DATABASE_URL: 'local-unit-fixture' } } });
  return { get: () => exports.GET(new Request('https://qa.invalid/api/core/dashboard?studentId=foreign&academyId=foreign')), calls, student };
}
test('dashboard ignores forged identity selectors and binds every query to the authenticated student/academy', async () => {
  const harness = dashboardRoute();
  const response = await harness.get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.equal(data.dashboard.profile.id, studentId);
  assert.equal(data.dashboard.assignments[0].id, '30000000-0000-4000-8000-000000000001');
  assert.equal(data.dashboard.assignments[0].status, 'in_progress');
  assert.equal(data.dashboard.assignments[0].progressPercent, 25);
  for (const { query, values } of harness.calls) {
    assert.ok(values.includes(studentId));
    assert.ok(values.includes(academyId));
    assert.ok(!values.includes('foreign'));
    assert.doesNotMatch(query, /INSERT|UPDATE|DELETE/);
  }
  assert.ok(harness.calls[0].values.includes(harness.student.student_user_id));
});
test('unauthenticated/revoked session denies before data queries; identity mismatch and DB failure fail closed', async () => {
  const denied = dashboardRoute({ authenticated: false });
  assert.equal((await denied.get()).status, 401);
  assert.equal(denied.calls.length, 0);
  assert.equal((await dashboardRoute({ identity: false }).get()).status, 404);
  assert.equal((await dashboardRoute({ fail: true }).get()).status, 503);
  assert.equal((await dashboardRoute({ forbidden: true }).get()).status, 403);
});
