/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const timelineSource = read('../lib/persistence/learning-timeline.ts');
const studentRoute = read('../app/api/core/history/route.ts');
const educatorRoute = read('../app/api/educator-student-history/route.ts');
const timelineUi = read('../components/learning-timeline.tsx');
const studentUi = read('../components/student-dashboard.tsx');
const educatorUi = read('../components/educator-student-core.tsx');

function transpile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
}

function loadTimelineModule() {
  const commonJsModule = { exports: {} };
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require', 'module', 'exports', 'process', 'Buffer', transpile(timelineSource))(
    (id) => { if (id === 'node:crypto') return crypto; throw new Error(id); },
    commonJsModule, commonJsModule.exports, process, Buffer,
  );
  return commonJsModule.exports;
}

function loadRoute(source, { student = null, educator = null, authorized = [] } = {}) {
  const commonJsModule = { exports: {} };
  const timelineCalls = [];
  const queries = [];
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route harness
  new Function('require', 'module', 'exports', 'process', transpile(source))(
    (id) => {
      if (id.includes('student-session')) return { authenticatedStudent: async () => student };
      if (id.includes('educator-auth')) return { authenticatedEducator: async () => educator };
      if (id.includes('request-guard')) return { allowRequest: async () => ({ allowed: true }) };
      if (id.includes('learning-timeline')) return {
        TimelineInputError: class extends Error {},
        parseTimelineRequest: () => ({ limit: 20, cursor: null, filters: {} }),
        readLearningTimeline: async (input) => { timelineCalls.push(input); return { events: [], hasMore: false, nextCursor: null }; },
      };
      if (id === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
        queries.push({ sql: strings.join('?'), values }); return authorized;
      } };
      throw new Error(id);
    },
    commonJsModule, commonJsModule.exports, { env: { DATABASE_URL: 'test-only' } },
  );
  return { get: commonJsModule.exports.GET, timelineCalls, queries };
}

test('timeline contract uses canonical sources, deterministic cursor pagination, and no writes', () => {
  for (const relation of ['training_recipes', 'training_sessions', 'question_attempts', 'learning_records', 'learning_evidence']) {
    assert.match(timelineSource, new RegExp(`public\\.${relation}`));
  }
  assert.match(timelineSource, /ORDER BY occurred_at DESC, event_id DESC/);
  assert.match(timelineSource, /LIMIT \$\{fetchLimit\}::int/);
  assert.match(timelineSource, /MAX_TIMELINE_PAGE_SIZE = 50/);
  assert.doesNotMatch(timelineSource, /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/);
  assert.doesNotMatch(timelineSource, /student_history_copy|history_events_copy|student_timeline_cache/);
});

test('cursor is scope-bound, tamper-evident, and page size is bounded', () => {
  const timeline = loadTimelineModule();
  const previous = process.env.CZA_TIMELINE_CURSOR_SECRET;
  process.env.CZA_TIMELINE_CURSOR_SECRET = 'u4-test-cursor-secret-at-least-32-bytes';
  try {
    const filters = { from: null, to: null, moduleCode: null, eventType: null, verificationStatus: null };
    const event = { eventId: 'record:10000000-0000-4000-8000-000000000001', occurredAt: '2026-09-17T12:00:00.000Z' };
    const cursor = timeline.encodeTimelineCursor(event, 'student-a', filters);
    assert.deepEqual(timeline.decodeTimelineCursor(cursor, 'student-a', filters), {
      eventId: event.eventId, occurredAt: event.occurredAt,
    });
    assert.throws(() => timeline.decodeTimelineCursor(`${cursor.slice(0, -1)}x`, 'student-a', filters), /invalid_cursor/);
    assert.throws(() => timeline.decodeTimelineCursor(cursor, 'student-b', filters), /invalid_cursor/);
    const parsed = timeline.parseTimelineRequest(new URL('https://cza.test/api/core/history?limit=1000000'));
    assert.equal(parsed.limit, 50);
    assert.throws(() => timeline.parseTimelineRequest(new URL('https://cza.test/api/core/history?limit=0')), /invalid_limit/);
  } finally {
    if (previous === undefined) delete process.env.CZA_TIMELINE_CURSOR_SECRET;
    else process.env.CZA_TIMELINE_CURSOR_SECRET = previous;
  }
});

test('student history route derives identity from session and ignores forged studentId', async () => {
  const denied = loadRoute(studentRoute);
  assert.equal((await denied.get(new Request('https://cza.test/api/core/history?studentId=forged'))).status, 401);
  assert.equal(denied.timelineCalls.length, 0);

  const own = loadRoute(studentRoute, { student: {
    student_id: '10000000-0000-4000-8000-000000000001',
    academy_id: '10000000-0000-4000-8000-000000000002',
    student_user_id: '10000000-0000-4000-8000-000000000003', session_id: 's',
  } });
  assert.equal((await own.get(new Request('https://cza.test/api/core/history?studentId=20000000-0000-4000-8000-000000000001'))).status, 200);
  assert.equal(own.timelineCalls[0].studentId, '10000000-0000-4000-8000-000000000001');
});

test('educator history route denies invalid role/unlinked student before timeline reads', async () => {
  const studentRole = loadRoute(educatorRoute);
  assert.equal((await studentRole.get(new Request('https://cza.test/api/educator-student-history?studentId=10000000-0000-4000-8000-000000000001'))).status, 401);
  assert.equal(studentRole.timelineCalls.length, 0);

  const unlinked = loadRoute(educatorRoute, { educator: { id: 'educator-auth-id' }, authorized: [] });
  const response = await unlinked.get(new Request('https://cza.test/api/educator-student-history?studentId=10000000-0000-4000-8000-000000000001'));
  assert.equal(response.status, 403);
  assert.equal(unlinked.timelineCalls.length, 0);
  assert.match(unlinked.queries[0].sql, /educator\.role::text='educator'/);
  assert.match(unlinked.queries[0].sql, /link\.can_view=true/);
  assert.match(unlinked.queries[0].sql, /student\.academy_id=educator\.academy_id/);
});

test('student and educator use one readable responsive timeline UI with provenance', () => {
  assert.match(studentUi, /<LearningTimeline endpoint="\/api\/core\/history"/);
  assert.match(educatorUi, /<LearningTimeline[\s\S]*endpoint=\{`\/api\/educator-student-history/);
  for (const text of ['Öğrenme Geçmişi', 'Daha fazla yükle', 'Henüz çalışma geçmişi oluşmadı.', 'Doğrulanmış kanıt', 'Kaydedilen sonuç']) {
    assert.match(timelineUi, new RegExp(text));
  }
  assert.match(timelineUi, /sm:grid-cols-2/);
  assert.doesNotMatch(timelineUi, /min-w-\[[1-9][0-9]{3,}px\]/);
});
