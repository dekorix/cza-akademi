// LOCAL ONLY. Disposable PGlite. No live Neon, Worker, or remote SQL.
// Windows, from the repo root after `npm ci`:
//   node --test tests/a-demo-02-local-session-e2e.test.mjs
//
// PIN login stays on canonical `cza_student_login` (not in this repo) and, when
// isolated QA is off, `/api/core` login/start/finish still require CZA_CORE_API_URL.
// This test persists the same student_sessions row a successful login writes,
// completes the assigned session through the existing QA work function, then
// reads the real panel/history/profile/result routes with that cookie.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = process.cwd();
const ACADEMY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT = '20000000-0000-4000-8000-000000000001';
const USER = '10000000-0000-4000-8000-000000000001';
const RECIPE = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';
const OTHER_ACADEMY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_STUDENT = '20000000-0000-4000-8000-000000000002';
const OTHER_USER = '10000000-0000-4000-8000-000000000002';
const TOKEN = 'synthetic-local-student-a-session';
const OTHER_TOKEN = 'synthetic-local-student-b-session';
const hashOf = (value) => crypto.createHash('sha256').update(value).digest('hex');
const HASH = hashOf(TOKEN);
const OTHER_HASH = hashOf(OTHER_TOKEN);
const read = (file) => fs.readFileSync(file, 'utf8');

function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`cannot resolve ${base}`);
}

function loadRoutes(db) {
  const cache = new Map();
  const query = async (text, params = []) => {
    try {
      return (await db.query(text, params)).rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`SQL_FAIL ${message}\n${text.slice(0, 400)}`);
      throw new Error(`${message}\nSQL ${text.slice(0, 240)}`);
    }
  };
  const neon = () => {
    const tag = (strings, ...values) => {
      let text = '';
      const params = [];
      strings.forEach((part, index) => {
        text += part;
        if (index < values.length) {
          params.push(values[index]);
          text += `$${params.length}`;
        }
      });
      return query(text, params);
    };
    return Object.assign(tag, { query });
  };
  const localRequire = (specifier, fromFile) => {
    if (specifier === '@neondatabase/serverless') return { neon };
    if (specifier === 'node:crypto') return crypto;
    if (specifier.startsWith('@/')) return loadFile(resolveFile(path.join(root, specifier.slice(2))));
    if (specifier.startsWith('.')) return loadFile(resolveFile(path.resolve(path.dirname(fromFile), specifier)));
    throw new Error(`unsupported local import ${specifier}`);
  };
  const nodeRequire = (specifier) => {
    if (specifier === 'node:crypto' || specifier === 'crypto') return crypto;
    return loadRoutes.nodeRequire(specifier);
  };
  function loadFile(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = read(file);
    const javascript = file.endsWith('.ts') || file.endsWith('.tsx')
      ? ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      }).outputText
      : source;
    const module = { exports: {} };
    cache.set(file, module);
    const runner = new Function('require', 'module', 'exports', 'process', 'Buffer', javascript);
    runner((specifier) => {
      if (specifier === '@neondatabase/serverless') return { neon };
      if (specifier.startsWith('@/') || specifier.startsWith('.')) return localRequire(specifier, file);
      return nodeRequire(specifier);
    }, module, module.exports, process, Buffer);
    return module.exports;
  }
  return {
    dashboard: loadFile(resolveFile(path.join(root, 'app/api/core/dashboard/route'))),
    assignments: loadFile(resolveFile(path.join(root, 'app/api/core/assignments/route'))),
    history: loadFile(resolveFile(path.join(root, 'app/api/core/history/route'))),
    profile: loadFile(resolveFile(path.join(root, 'app/api/core/learning-profile/route'))),
    results: loadFile(resolveFile(path.join(root, 'app/api/core/work-results/route'))),
  };
}
loadRoutes.nodeRequire = (await import('node:module')).createRequire(import.meta.url);

async function setup() {
  const db = new PGlite({ extensions: { pgcrypto } });
  for (const file of [
    '20260912_staging_core_prerequisites_v1.sql',
    '20260913_canonical_learning_ledger_v1.sql',
    '20260916_u1_student_panel_core_v1.sql',
    '20260917_u2_work_center_core_v1.sql',
    '20260917_u5_assignment_management_v1.sql',
    '20260917_u5_cancelled_assignment_write_barrier_v1.sql',
    '20260921_k3c_engine_provenance_v1.sql',
  ]) await db.exec(read(`db/migrations/${file}`));
  await db.exec(read('tests/fixtures/v04-live-canonical-functions.sql'));
  const config = JSON.stringify({
    mode: 'finger-read', rounds: 10, digits: 1, pool: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    minDigits: 1, maxDigits: 1, minValue: 1, maxValue: 900,
  });
  await db.exec(`CREATE ROLE cza_t5_test_owner; CREATE ROLE cza_v01_app_runtime_min;
    GRANT USAGE, CREATE ON SCHEMA public TO cza_t5_test_owner; GRANT USAGE ON SCHEMA public TO cza_v01_app_runtime_min;
    ALTER TABLE public.users ADD COLUMN academy_id uuid;
    ALTER TABLE public.training_sessions ADD COLUMN source text DEFAULT 'free_practice',
      ADD COLUMN settings_snapshot jsonb NOT NULL DEFAULT '{}', ADD COLUMN question_count integer DEFAULT 0,
      ADD COLUMN answered_count integer DEFAULT 0, ADD COLUMN correct_count integer DEFAULT 0,
      ADD COLUMN wrong_count integer DEFAULT 0, ADD COLUMN accuracy numeric DEFAULT 0;
    INSERT INTO academies(id,name,environment) VALUES ('${ACADEMY}','LOCAL A-DEMO','staging');
    INSERT INTO users(id,username,role,academy_id) VALUES ('${USER}','local-synthetic-student','student','${ACADEMY}');
    INSERT INTO students(id,academy_id,user_id,first_name,last_name,is_demo)
      VALUES ('${STUDENT}','${ACADEMY}','${USER}','Local','Synthetic',true);
    INSERT INTO student_sessions(id,academy_id,student_id,student_user_id,token_hash,expires_at,created_at)
      VALUES (gen_random_uuid(),'${ACADEMY}','${STUDENT}','${USER}','${HASH}',now()+interval '1 day',now()-interval '2 days');
    INSERT INTO training_recipes(id,academy_id,student_id,module_code,source,name,settings)
      VALUES ('${RECIPE}','${ACADEMY}','${STUDENT}','finger_read','teacher_assignment','Existing local recipe','${config}');
    DO $$ DECLARE x record; BEGIN
      FOR x IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO cza_t5_test_owner', x.tablename);
      END LOOP;
      FOR x IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname LIKE 'cza_%' LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO cza_t5_test_owner', x.signature);
      END LOOP;
    END $$;
    SELECT set_config('neon.project_id','patient-firefly-51111834',false),
           set_config('neon.branch_id','br-withered-queen-b15ltb40',false);
    SET ROLE cza_t5_test_owner;`);
  for (const file of ['v03-student-read.sql', 'v03-session-lifecycle.sql', 'v04-assigned-work.sql']) {
    await db.exec(read(`db/qa/${file}`).replaceAll("'cza_t5_synthetic'", "'postgres'"));
  }
  await db.exec('RESET ROLE');
  await db.exec(`INSERT INTO academies(id,name,environment) VALUES ('${OTHER_ACADEMY}','LOCAL OTHER','staging');
    INSERT INTO users(id,username,role,academy_id) VALUES ('${OTHER_USER}','local-other-student','student','${OTHER_ACADEMY}');
    INSERT INTO students(id,academy_id,user_id,first_name,last_name,is_demo)
      VALUES ('${OTHER_STUDENT}','${OTHER_ACADEMY}','${OTHER_USER}','Other','Synthetic',true);
    INSERT INTO student_sessions(id,academy_id,student_id,student_user_id,token_hash,expires_at,created_at)
      VALUES (gen_random_uuid(),'${OTHER_ACADEMY}','${OTHER_STUDENT}','${OTHER_USER}','${OTHER_HASH}',now()+interval '1 day',now()-interval '1 day');
    CREATE TABLE public.coaching_programs (academy_id uuid, student_id uuid, status text);
    CREATE TABLE public.coaching_plans (id uuid, academy_id uuid, student_id uuid, program_id uuid, status text, title text, period_start date, period_end date, version int);
    CREATE TABLE public.coaching_study_logs (academy_id uuid, student_id uuid);
    CREATE TABLE public.coaching_exam_results (id uuid, academy_id uuid, student_id uuid, program_id uuid, template_id uuid, exam_date date, total_net numeric, provenance text);
    CREATE TABLE public.coaching_meetings (academy_id uuid, student_id uuid);
    CREATE TABLE public.coaching_goals (id uuid, academy_id uuid, student_id uuid, program_id uuid, revision int, target jsonb, provenance text, created_at timestamptz);
    CREATE TABLE public.coaching_plan_items (id uuid, academy_id uuid, student_id uuid, recipe_id uuid, plan_id uuid, scheduled_for date);`);
  await db.exec('SET ROLE cza_v01_app_runtime_min');
  return db;
}

async function call(db, op, input = {}, session = null) {
  return (await db.query(
    'SELECT public.cza_v04_qa_assigned_work($1,$2,$3,$4,$5::jsonb) result',
    [HASH, op, RECIPE, session, JSON.stringify(input)],
  )).rows[0].result;
}

function answer(question, index, correct = true) {
  const value = correct ? question.answer : question.answer + 10;
  return {
    clientAttemptId: crypto.randomUUID(),
    questionIndex: index,
    questionId: question.questionId,
    targetNumber: question.answer,
    studentNumericAnswer: value,
    isCorrect: true,
    patternValid: true,
    errorType: 'OK',
    stimulusDurationMs: 1200,
    responseLatencyMs: 1100,
    totalResponseTimeMs: 1100,
    metadata: {
      sequence: [question.answer],
      attemptType: 'PRIMARY',
      responsePayload: { value },
      skills: ['FORGED'],
      supportLevel: 'independent',
      strategy: 'invented',
    },
  };
}

function request(pathname, token) {
  const headers = { 'x-real-ip': '127.0.0.1' };
  if (token) headers.cookie = `cza_student_session=${encodeURIComponent(token)}`;
  return new Request(`https://local.test${pathname}`, { headers });
}

async function bodyOf(response) {
  const text = await response.text();
  let body = {};
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  return { status: response.status, body };
}

void test('synthetic login session, study completion, and cookie-bound history agree', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://local-synthetic-only/pglite';
  process.env.CZA_TIMELINE_CURSOR_SECRET = 'local-only-long-cursor-secret-32-bytes';
  delete process.env.CZA_EDUCATOR_AUTH_MODE;
  const db = await setup();
  try {
    const started = await call(db, 'start', {
      clientSessionId: crypto.randomUUID(),
      moduleCode: 'finger_read',
      source: 'teacher_assignment',
    });
    assert.equal(started.questions.length, 10);
    for (let index = 0; index < 10; index += 1) {
      await call(db, 'attempt', answer(started.questions[index], index + 1, index > 1), started.sessionId);
    }
    const done = await call(db, 'finish', {}, started.sessionId);
    assert.equal(done.status, 'completed');
    assert.equal(done.attemptCount, 10);
    assert.equal(done.correctCount, 8);
    const sessionId = started.sessionId;
    const recordId = done.learningRecordId;

    await db.exec('RESET ROLE');
    const routes = loadRoutes(db);
    const anonymous = await bodyOf(await routes.dashboard.GET(request('/api/core/dashboard')));
    assert.equal(anonymous.status, 401);
    assert.equal((await bodyOf(await routes.history.GET(request('/api/core/history')))).status, 401);
    assert.equal((await bodyOf(await routes.results.GET(request('/api/core/work-results')))).status, 401);

    const dashboard = await bodyOf(await routes.dashboard.GET(request('/api/core/dashboard', TOKEN)));
    assert.equal(dashboard.status, 200, JSON.stringify(dashboard.body));
    assert.equal(dashboard.body.dashboard.profile.id, STUDENT);
    assert.equal(dashboard.body.dashboard.summary.completedSessions, 1);
    assert.equal(dashboard.body.dashboard.summary.totalAttempts, 10);
    assert.equal(dashboard.body.dashboard.summary.correctAttempts, 8);
    const activity = dashboard.body.dashboard.recentActivity.find((item) => item.id === sessionId);
    assert.equal(activity.status, 'completed');
    assert.equal(activity.attemptCount, 10);
    assert.equal(activity.correctCount, 8);
    const assignment = dashboard.body.dashboard.assignments.find((item) => item.id === RECIPE);
    assert.equal(assignment.status, 'completed');
    assert.equal(assignment.attemptCount, 10);

    const center = await bodyOf(await routes.assignments.GET(request('/api/core/assignments', TOKEN)));
    assert.equal(center.status, 200, JSON.stringify(center.body));
    assert.equal(center.body.assignments[0].id, RECIPE);
    assert.equal(center.body.assignments[0].status, 'completed');
    assert.equal(center.body.assignments[0].progress.attemptCount, 10);
    assert.equal(center.body.assignments[0].progress.percent, 100);

    const results = await bodyOf(await routes.results.GET(request(`/api/core/work-results?sessionId=${sessionId}`, TOKEN)));
    assert.equal(results.status, 200, JSON.stringify(results.body));
    assert.deepEqual(
      [results.body.results[0].total, results.body.results[0].correct, results.body.results[0].wrong],
      [10, 8, 2],
    );
    assert.equal(results.body.results[0].sessionId, sessionId);
    assert.equal(results.body.results[0].records[0].recordId, recordId);
    assert.doesNotMatch(JSON.stringify(results.body), /targetNumber|responsePayload|FORGED|invented|instructions/);

    const history = await bodyOf(await routes.history.GET(request('/api/core/history?limit=50', TOKEN)));
    assert.equal(history.status, 200, JSON.stringify(history.body));
    const events = history.body.timeline.events;
    assert.ok(events.every((event) => event.studentId === STUDENT));
    assert.ok(events.some((event) => event.eventType === 'WORK_COMPLETED' && event.trainingSessionId === sessionId));
    assert.ok(events.some((event) => event.eventType === 'LEARNING_RESULT' && event.learningRecordId === recordId));
    assert.equal(events.filter((event) => event.eventType === 'ERROR_OBSERVED').length, 2);

    const profile = await bodyOf(await routes.profile.GET(request('/api/core/learning-profile', TOKEN)));
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    assert.equal(profile.body.profile.student.id, STUDENT);
    assert.equal(profile.body.profile.coverage.attempts, 10);
    assert.equal(profile.body.profile.coverage.records, 1);
    assert.equal(profile.body.profile.coverage.evidence, 1);
    assert.equal(profile.body.profile.recentRecords[0].sessionId, sessionId);
    assert.equal(profile.body.profile.recentRecords[0].recordId, recordId);
    assert.equal(profile.body.profile.studyPattern.sessions.completed, 1);

    const override = await bodyOf(await routes.results.GET(request(`/api/core/work-results?studentId=${OTHER_STUDENT}`, TOKEN)));
    assert.equal(override.status, 403);
    const foreign = await bodyOf(await routes.results.GET(request(`/api/core/work-results?sessionId=${sessionId}`, OTHER_TOKEN)));
    assert.equal(foreign.status, 404);
    const otherHistory = await bodyOf(await routes.history.GET(request('/api/core/history?limit=50', OTHER_TOKEN)));
    assert.equal(otherHistory.status, 200, JSON.stringify(otherHistory.body));
    assert.equal(otherHistory.body.timeline.events.length, 0);
    const otherDashboard = await bodyOf(await routes.dashboard.GET(request('/api/core/dashboard', OTHER_TOKEN)));
    assert.equal(otherDashboard.status, 200, JSON.stringify(otherDashboard.body));
    assert.equal(otherDashboard.body.dashboard.profile.id, OTHER_STUDENT);
    assert.equal(otherDashboard.body.dashboard.summary.totalAttempts, 0);
    assert.equal(otherDashboard.body.dashboard.recentActivity.length, 0);

    const educatorRoute = read('app/api/educator-student-history/route.ts');
    assert.match(educatorRoute, /teacher_student_links/);
    assert.match(educatorRoute, /link\.can_view=true/);
    assert.match(educatorRoute, /student\.academy_id=educator\.academy_id/);
    assert.doesNotMatch(educatorRoute, /SECURITY DEFINER|cza_a_demo_02_read/);

    await db.exec('SET ROLE cza_t5_test_owner');
    await db.exec(read('db/qa/a-demo-02-read.review.sql').replaceAll("'cza_t5_synthetic'", "'postgres'"));
    await db.exec('SET ROLE cza_v01_app_runtime_min');
    const qaResults = (await db.query(
      'SELECT public.cza_a_demo_02_read($1,$2,$3::jsonb) rows',
      [HASH, 'completed_results', JSON.stringify({ sessionId })],
    )).rows[0].rows;
    assert.deepEqual(qaResults, []);
    const qaTimeline = (await db.query(
      'SELECT public.cza_a_demo_02_read($1,$2,$3::jsonb) rows',
      [HASH, 'timeline', JSON.stringify({
        filters: { from: null, to: null, moduleCode: null, eventType: 'WORK_COMPLETED', verificationStatus: null },
        cursor: null,
        limit: 20,
      })],
    )).rows[0].rows;
    assert.ok(qaTimeline.some((event) => event.training_session_id === sessionId));
  } finally {
    await db.close();
  }
});
