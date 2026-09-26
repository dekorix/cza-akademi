import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root =
  process.env.K3E_TEST_ROOT ?? path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
function loader(overrides, fetcher) {
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name, exports);
    const code = ts.transpileModule(read(name), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    vm.runInNewContext(
      code,
      {
        exports,
        require(id) {
          if (id in overrides) return overrides[id];
          const resolved = id.startsWith('@/')
            ? id.slice(2)
            : path.join(path.dirname(name), id);
          return load(resolved + '.ts');
        },
        process: { env: { DATABASE_URL: 'synthetic', NODE_ENV: 'test' } },
        fetch: fetcher,
        URL,
        Request,
        Response,
        Headers,
        AbortController,
        setTimeout,
        clearTimeout,
        Buffer,
        Date,
        Error,
        Object,
        console,
      },
      { filename: name },
    );
    return exports;
  }
  return load;
}

test('actual route and repository: assigned finish has one SQL owner', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    for (const file of [
      '20260912_staging_core_prerequisites_v1.sql',
      '20260913_canonical_learning_ledger_v1.sql',
      '20260916_u1_student_panel_core_v1.sql',
      '20260917_u2_work_center_core_v1.sql',
      '20260917_u5_assignment_management_v1.sql',
      '20260921_k3c_engine_provenance_v1.sql',
    ])
      await db.exec(read('db/migrations/' + file));
    const academy = randomUUID(),
      student = randomUUID(),
      user = randomUUID(),
      login = randomUUID(),
      recipe = randomUUID(),
      session = randomUUID();
    await db.query(
      `INSERT INTO academies(id,name,environment) VALUES($1,'Synthetic','staging')`,
      [academy],
    );
    await db.query(
      `INSERT INTO users(id,username,role) VALUES($1,'synthetic','student')`,
      [user],
    );
    await db.query(
      `INSERT INTO students(id,academy_id,user_id,first_name,last_name,is_demo) VALUES($1,$2,$3,'Synthetic','Test',true)`,
      [student, academy, user],
    );
    await db.query(
      `INSERT INTO student_sessions(id,academy_id,student_id,student_user_id,token_hash,expires_at) VALUES($1,$2,$3,$4,repeat('a',64),now()+interval '1 day')`,
      [login, academy, student, user],
    );
    await db.query(
      `INSERT INTO training_recipes(id,academy_id,student_id,module_code,source,name,settings) VALUES($1,$2,$3,'flash_anzan','teacher_assignment','Synthetic','{"rounds":1}')`,
      [recipe, academy, student],
    );
    const identity = {
      academy_id: academy,
      student_id: student,
      session_id: login,
    };
    let authenticated = identity,
      upstreamCalls = 0;
    const neon =
      () =>
      async (strings, ...values) =>
        (
          await db.query(
            strings.reduce((sql, p, i) => sql + (i ? '$' + i : '') + p, ''),
            values,
          )
        ).rows;
    const overrides = {
      '@neondatabase/serverless': { neon },
      '@/lib/request-guard': { allowRequest: async () => ({ allowed: true }) },
      '@/lib/k3e-staging-diagnostics': {
        stagingDiagnosticsEnabled: () => false,
      },
      '@/lib/student-session': {
        authenticatedStudent: async () => authenticated,
        readRequestCookie: (_r, name) =>
          name === 'cza_assignment_recipe' ? recipe : 'synthetic-token',
      },
      '@/lib/core-request-security': {
        parseCoreRequest: (x) => x,
        readBoundedJson: (r) => r.json(),
        configuredCoreUrl: () => 'https://core.invalid/api/student',
        CoreRequestError: class extends Error {},
      },
      '@/lib/learning-contract-server': {},
      '@/lib/persistence/canonical-repository': {},
    };
    const load = loader(overrides, async (_url, options) => {
      upstreamCalls++;
      const body = JSON.parse(options.body);
      // Legacy service double: its dangerous early completion is deliberately
      // observable. Canonical persistence below is real PostgreSQL, not mocked.
      if (body.action === 'finish')
        await db.query(
          `UPDATE training_sessions SET status='completed' WHERE id=$1`,
          [body.sessionId],
        );
      return new Response(JSON.stringify({ ok: true, sessionId: session }));
    });
    const repo = load('lib/persistence/work-center-repository.ts');
    const route = load('app/api/core/route.ts');
    const request = async (action, extra = {}) =>
      route.POST(
        new Request('https://staging.invalid/api/core', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, sessionId: session, ...extra }),
        }),
      );
    const count = async () =>
      (
        await db.query(
          `SELECT status,(SELECT count(*)::int FROM question_attempts WHERE training_session_id=$1) attempts,(SELECT count(*)::int FROM learning_records WHERE training_session_id=$1) records,(SELECT count(*)::int FROM learning_evidence e JOIN learning_records l ON e.learning_record_id=l.id WHERE l.training_session_id=$1) evidence FROM training_sessions WHERE id=$1`,
          [session],
        )
      ).rows[0];
    await t.test(
      'start reaches canonical active and can resume with zero attempts',
      async () => {
        const response = await request('start', {
          clientSessionId: randomUUID(),
          recipeId: recipe,
          source: 'teacher_assignment',
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.workStatus, 'in_progress');
        assert.equal(body.workProgress.attemptCount, 0);
        assert.equal((await count()).status, 'active');
        const replay = await request('start', {
          clientSessionId: randomUUID(),
          recipeId: recipe,
          source: 'teacher_assignment',
        });
        assert.equal(replay.status, 200);
        assert.equal((await replay.json()).sessionId, session);
      },
    );
    await t.test(
      'zero-attempt finish rejects before legacy fetch and leaves active, no ledger',
      async () => {
        const before = upstreamCalls;
        const response = await request('finish');
        assert.equal(response.status, 409);
        assert.equal((await response.json()).error, 'work_incomplete');
        assert.equal(upstreamCalls, before);
        assert.deepEqual(await count(), {
          status: 'active',
          attempts: 0,
          records: 0,
          evidence: 0,
        });
      },
    );
    await t.test(
      'interruption stays resumable without legacy completion',
      async () => {
        const before = upstreamCalls;
        const response = await request('finish', { aborted: true });
        assert.equal(response.status, 200);
        assert.equal(
          (await response.json()).workCompletion.status,
          'in_progress',
        );
        assert.equal(upstreamCalls, before);
        assert.equal((await count()).status, 'active');
      },
    );
    await t.test(
      'one attempt and replay persist only one physical attempt',
      async () => {
        const payload = {
          clientAttemptId: randomUUID(),
          questionIndex: 1,
          questionId: 'synthetic-q1',
          targetNumber: 4,
          studentNumericAnswer: 4,
          isCorrect: true,
          errorType: 'OK',
          totalResponseTimeMs: 1000,
          metadata: {
            attemptType: 'PRIMARY',
            responseType: 'numeric',
            responsePayload: { value: 4 },
          },
        };
        for (let i = 0; i < 2; i++)
          assert.equal((await request('attempt', { payload })).status, 200);
        assert.equal((await count()).attempts, 1);
      },
    );
    await t.test(
      'finish and finish replay produce one linked record and evidence',
      async () => {
        const before = upstreamCalls;
        const first = await request('finish');
        assert.equal(first.status, 200);
        const a = (await first.json()).workCompletion;
        const second = await request('finish');
        assert.equal(second.status, 200);
        const b = (await second.json()).workCompletion;
        assert.equal(a.learningRecordId, b.learningRecordId);
        assert.equal(a.evidenceId, b.evidenceId);
        assert.equal(b.replayed, true);
        assert.equal(upstreamCalls, before);
        assert.deepEqual(await count(), {
          status: 'completed',
          attempts: 1,
          records: 1,
          evidence: 1,
        });
        assert.equal(
          (await repo.assignedSessionForRecipe(identity, recipe)).status,
          'completed',
        );
      },
    );
    await t.test(
      'ownership denial remains before completion or upstream',
      async () => {
        const before = upstreamCalls;
        authenticated = { ...identity, student_id: randomUUID() };
        assert.equal((await request('finish')).status, 404);
        authenticated = null;
        assert.equal((await request('finish')).status, 401);
        authenticated = identity;
        assert.equal(upstreamCalls, before);
      },
    );
    await t.test(
      'zero-attempt completed artefact is explicit conflict, not assignment success',
      async () => {
        await db.query(
          `UPDATE training_sessions SET status='active' WHERE id=$1`,
          [session],
        );
        const artefact = randomUUID();
        await db.query(
          `INSERT INTO training_sessions(id,academy_id,student_id,module_code,recipe_id,status,started_at,completed_at) VALUES($1,$2,$3,'flash_anzan',$4,'completed',now(),now())`,
          [artefact, academy, student, recipe],
        );
        await assert.rejects(
          repo.assignedSessionForRecipe(identity, recipe),
          (e) => e.code === 'work_completion_inconsistent',
        );
        const before = upstreamCalls;
        const response = await request('start', {
          recipeId: recipe,
          source: 'teacher_assignment',
        });
        assert.equal(response.status, 409);
        assert.equal(
          (await response.json()).error,
          'work_completion_inconsistent',
        );
        assert.equal(upstreamCalls, before);
      },
    );
    await t.test(
      'free-practice finish still uses legacy upstream',
      async () => {
        const free = randomUUID();
        await db.query(
          `INSERT INTO training_sessions(id,academy_id,student_id,module_code,status,started_at) VALUES($1,$2,$3,'flash_anzan','active',now())`,
          [free, academy, student],
        );
        const before = upstreamCalls;
        assert.equal(
          (await request('finish', { sessionId: free })).status,
          200,
        );
        assert.equal(upstreamCalls, before + 1);
      },
    );
  } finally {
    await db.close();
  }
});

test('real Studio finish handler completes primary rounds; early exit only is aborted', async () => {
  const source = read('app/studio/page.tsx');
  const handler = source.slice(
    source.indexOf('  async function finishSession()'),
    source.indexOf(
      '  function reset()',
      source.indexOf('  async function finishSession()'),
    ),
  );
  for (const [attempts, resumeOffset, expected] of [
    [[], 0, true],
    [[{ attemptType: 'PRIMARY' }], 0, false],
    [[{ attemptType: 'RETRY_AFTER_FEEDBACK' }], 0, true],
    [[], 1, false],
  ]) {
    const calls = [];
    const context = {
      sessionId: 's',
      savingAttempt: false,
      assignmentId: 'r',
      attempts,
      resumeOffset,
      runConfig: { rounds: 1 },
      setSync: () => {},
      setError: () => {},
      completePlayer: () => {},
      window: { location: { assign: () => {} } },
      core: async (...args) => calls.push(args),
    };
    await vm.runInNewContext(handler + '\nfinishSession()', context);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].aborted, expected);
  }
});

test('real Studio start handler enters one-question sequence after successful assigned bind', async () => {
  const source = read('app/studio/page.tsx');
  const handler = source.slice(
    source.indexOf('  async function start()'),
    source.indexOf('  async function submit('),
  );
  const load = loader({}, () => {
    throw new Error('unexpected network');
  });
  const engine = load('lib/exercise-engine.ts');
  const modes = load('lib/practice-mode.ts');
  const config = {
    ...engine.defaultConfig,
    mode: 'flash',
    rounds: 1,
    digits: 1,
    terms: 4,
    practiceMode: 'guided_practice',
    feedbackMode: 'immediate',
    countdownEnabled: false,
  };
  const calls = [],
    phases = [],
    errors = [];
  let questions;
  const no = () => {};
  const context = {
    student: {},
    assignmentId: 'recipe',
    config,
    crypto: { randomUUID },
    ...engine,
    ...modes,
    trainingSettings: (x) => x,
    moduleCodeByMode: { flash: 'flash_anzan' },
    core: async (action, payload) => {
      calls.push({ action, payload });
      return { sessionId: 'session', workProgress: { attemptCount: 0 } };
    },
    setSync: no,
    setSessionId: no,
    setResumeOffset: no,
    setQuestions: (x) => {
      questions = x;
    },
    setRunConfig: no,
    setAttempts: no,
    setReviewAttempt: no,
    setError: (x) => errors.push(x),
    setSaved: no,
    beginPlayer: (x) => phases.push(x),
    completePlayer: () => phases.push('finished'),
    setSettingsOpen: no,
    sessionStart: { current: 0 },
    friendlyCoreError: (e) => e.message,
  };
  const js = ts.transpileModule(handler + '\nstart();', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  await vm.runInNewContext(js, context);
  assert.equal(questions.length, 1);
  assert.deepEqual(phases, ['sequence']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'start');
  assert.deepEqual(errors, ['']);
});
