/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
const read = (p) => fs.readFileSync(p, 'utf8');
function load(path, dependencies = {}, extra = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(read(path), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (n) => {
        if (n in dependencies) return dependencies[n];
        throw new Error('Unexpected dependency ' + n);
      },
      Error,
      Response,
      Request,
      Headers,
      URL,
      TextEncoder,
      TextDecoder,
      process: { env: { DATABASE_URL: 'LOCAL_ONLY', NODE_ENV: 'production' } },
      ...extra,
    },
  );
  return exports;
}
const engine = load('lib/exercise-engine.ts');
const recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';
const session = '40000000-0000-4000-8000-000000000001';
const config = {
  ...engine.defaultConfig,
  mode: 'finger-read',
  digits: 1,
  rounds: 10,
  pool: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  minDigits: 1,
  maxDigits: 1,
  minValue: 1,
  maxValue: 900,
};

test('durable server questions still use the existing finger engine and invalid plans fail closed', () => {
  const { assignedQuestionPlan: plan } = load('lib/assigned-question-plan.ts', {
    './exercise-engine': engine,
  });
  const questions = Array.from({ length: 10 }, (_, i) => ({
    answer: (i % 9) + 1,
    sequence: [(i % 9) + 1],
    questionId: 'stable-' + i,
  }));
  assert.equal(plan(undefined, config), null);
  assert.deepEqual(
    JSON.parse(JSON.stringify(plan(questions, config))),
    questions,
  );
  for (const bad of [
    [],
    questions.map((q, i) => (i === 0 ? { ...q, sequence: [99] } : q)),
    questions.map((q, i) => (i === 0 ? { ...q, answer: 0 } : q)),
  ])
    assert.throws(() => plan(bad, config), /invalid_assigned_question_plan/);
  assert.throws(
    () => plan(questions, { ...config, mode: 'audio' }),
    /invalid_assigned_question_plan/,
  );
});

test('uncertain response preserves exact UUID, answer and time across reload; acknowledged progress clears stale draft', () => {
  const data = new Map();
  const sessionStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  const subject = () =>
    load('lib/assigned-attempt-retry.ts', {}, { sessionStorage });
  const draft = {
    sessionId: session,
    questionIndex: 2,
    attempt: { given: 7, elapsedMs: 1100 },
    payload: {
      clientAttemptId: '60000000-0000-4000-8000-000000000001',
      questionIndex: 2,
      studentNumericAnswer: 7,
      totalResponseTimeMs: 1100,
    },
  };
  subject().savePendingAssignedAttempt(draft);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(subject().readPendingAssignedAttempt(session, 2)),
    ),
    draft,
  );
  assert.equal(subject().readPendingAssignedAttempt(session, 3), null);
  assert.equal(data.size, 0);
  subject().savePendingAssignedAttempt(draft);
  subject().clearPendingAssignedAttempt(session);
  assert.equal(subject().readPendingAssignedAttempt(session, 2), null);
  data.set('cza-assigned-answer-v1:' + session, 'invalid-json');
  assert.equal(subject().readPendingAssignedAttempt(session, 2), null);
});
function adapter(options = {}) {
  const queries = [];
  const sql = async (strings, ...values) => {
    queries.push({ sql: strings.join('?'), values });
    if (options.failure) throw new Error(options.failure);
    return [
      { result: { sessionId: session, status: 'completed', attemptCount: 10 } },
    ];
  };
  const readRequestCookie = (r, n) => {
    const cookies = Object.fromEntries(
      (r.headers.get('cookie') || '').split('; ').map((x) => x.split('=')),
    );
    return cookies[n] || '';
  };
  const subject = load('lib/qa-assigned-work.ts', {
    'node:crypto': crypto,
    '@neondatabase/serverless': { neon: () => sql },
    '@/lib/isolated-qa-auth': { isolatedQaEnabled: () => options.qa !== false },
    '@/lib/qa-student-read': {
      assertQaStudentTarget: async () => {
        if (options.target === false) throw new Error('target_rejected');
      },
      studentReadSql: async () => async () => [
        { id: 'canonical-student', username: 'qa', display_name: 'Local QA' },
      ],
    },
    '@/lib/student-session': {
      authenticatedStudent: async () =>
        options.auth === false
          ? null
          : {
              student_id: 'canonical-student',
              academy_id: 'canonical-academy',
              student_user_id: 'canonical-user',
            },
      readRequestCookie,
      STUDENT_COOKIE: 'cza_student_session',
    },
    '@/lib/request-guard': {
      allowRequest: async () => ({ allowed: options.rate !== false }),
      rateLimited: () => Response.json({}, { status: 429 }),
    },
  });
  const request = new Request('https://qa.test/api/core', {
    headers: {
      cookie:
        'cza_student_session=LOCAL-UNIT-TOKEN; cza_assignment_recipe=' + recipe,
    },
  });
  return {
    invoke: (input) => subject.isolatedQaAssignedAction(request, input),
    subject,
    request,
    queries,
  };
}
test('QA adapter derives identity only from canonical cookie and preserves non-QA upstream path', async () => {
  const outside = adapter({ qa: false });
  assert.equal(await outside.invoke({ action: 'start' }), null);
  assert.equal(outside.queries.length, 0);
  const qa = adapter();
  assert.equal(await qa.invoke({ action: 'interaction' }), null);
  const me = await qa.invoke({ action: 'me', studentId: 'forged' });
  assert.equal((await me.json()).student.id, 'canonical-student');
  const response = await qa.invoke({
    action: 'start',
    recipeId: recipe,
    clientSessionId: session,
    moduleCode: 'finger_read',
    source: 'teacher_assignment',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(qa.queries[0].sql, /cza_v04_qa_assigned_work/);
  assert.equal(
    qa.queries[0].values[0],
    crypto.createHash('sha256').update('LOCAL-UNIT-TOKEN').digest('hex'),
  );
  assert.equal(qa.queries[0].values[2], recipe);
  assert.equal(qa.queries[0].values[3], null);
  assert.ok(!JSON.stringify(qa.queries).includes('canonical-student'));
});
test('QA adapter rejects absent auth, wrong target/launch, rate limit and sanitized persistence failure', async () => {
  for (const [option, expected] of [
    [{ auth: false }, 401],
    [{ target: false }, 503],
    [{ rate: false }, 429],
    [{ failure: 'CZA_WORK_INCOMPLETE' }, 409],
    [{ failure: 'secret-db-detail' }, 503],
  ]) {
    const subject = adapter(option);
    const r = await subject.invoke({ action: 'finish', sessionId: session });
    assert.equal(r.status, expected);
    assert.ok(!JSON.stringify(await r.json()).includes('secret-db-detail'));
  }
  assert.equal(
    (await adapter().invoke({ action: 'start', recipeId: 'foreign' })).status,
    403,
  );
});
test('actual core route retains origin/body/transport checks before the QA adapter', async () => {
  const security = load('lib/core-request-security.ts');
  let calls = 0;
  const dependencies = new Proxy(
    {
      '@/lib/core-request-security': security,
      '@/lib/qa-assigned-work': {
        isolatedQaAssignedAction: async () => {
          calls++;
          return Response.json({ ok: true });
        },
      },
      '@/lib/student-session': { readRequestCookie: () => 'LOCAL-UNIT-TOKEN' },
    },
    { has: () => true, get: (o, k) => o[k] || {} },
  );
  const route = load('app/api/core/route.ts', dependencies);
  const request = (
    body,
    origin = 'https://qa.test',
    url = 'https://qa.test/api/core',
  ) =>
    new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify(body),
    });
  assert.equal((await route.POST(request({ action: 'me' }))).status, 200);
  assert.equal(calls, 1);
  assert.equal(
    (await route.POST(request({ action: 'me' }, 'https://foreign.test')))
      .status,
    403,
  );
  assert.equal(
    (await route.POST(request({ action: 'me', studentId: 'spoof' }))).status,
    400,
  );
  assert.equal(
    (
      await route.POST(
        request({ action: 'me' }, 'http://qa.test', 'http://qa.test/api/core'),
      )
    ).status,
    400,
  );
  assert.equal(calls, 1);
});

test('Studio me reuses the actual approved V03 dashboard_1 SQL hash without expanding read projections', async () => {
  const origin =
    'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
  const calls = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    calls.push({ query, values });
    if (query.includes('current_user'))
      return [
        {
          role: 'cza_v01_app_runtime_min',
          database: 'cza_t5_synthetic',
          project: 'patient-firefly-51111834',
          branch: 'br-withered-queen-b15ltb40',
        },
      ];
    assert.match(query, /cza_v03_qa_student_read/);
    assert.equal(values[1], 'dashboard_1');
    return [
      {
        rows: [
          { id: 'canonical', username: 'local-qa', display_name: 'Local QA' },
        ],
      },
    ];
  };
  const auth = {
    authenticatedStudent: async () => ({
      student_id: 'canonical',
      academy_id: 'canonical-academy',
      student_user_id: 'canonical-user',
    }),
    readRequestCookie: () => 'LOCAL-UNIT-TOKEN',
    STUDENT_COOKIE: 'cza_student_session',
  };
  const isolated = {
    isolatedQaEnabled: () => true,
    QA_EDUCATOR_ORIGIN: origin,
  };
  const shared = {
    'node:crypto': crypto,
    '@neondatabase/serverless': { neon: () => sql },
    '@/lib/isolated-qa-auth': isolated,
    '@/lib/student-session': auth,
  };
  const qaRead = load('lib/qa-student-read.ts', {
    ...shared,
    '@/lib/qa-student-read-contract': load('lib/qa-student-read-contract.ts'),
  });
  const api = load('lib/qa-assigned-work.ts', {
    ...shared,
    '@/lib/qa-student-read': qaRead,
    '@/lib/request-guard': {},
  });
  const response = await api.isolatedQaAssignedAction(
    new Request(origin + '/api/core'),
    { action: 'me' },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).student.id, 'canonical');
  assert.equal(
    calls.filter((c) => c.query.includes('cza_v03_qa_student_read')).length,
    1,
  );
});
