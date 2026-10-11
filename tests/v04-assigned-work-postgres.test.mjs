/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
// Executes real proposed SQL against existing migrations and captured live QA functions.
// Local fixture identities only. Does not claim live Worker/Neon/Chrome acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const read = (p) => fs.readFileSync(p, 'utf8');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  S = '20000000-0000-4000-8000-000000000001',
  U = '10000000-0000-4000-8000-000000000001',
  R = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4',
  H = 'a'.repeat(64);
const config = {
  mode: 'finger-read',
  rounds: 10,
  digits: 1,
  pool: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  minDigits: 1,
  maxDigits: 1,
  minValue: 1,
  maxValue: 900,
};
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
  ])
    await db.exec(read('db/migrations/' + file));
  await db.exec(read('tests/fixtures/v04-live-canonical-functions.sql'));
  await db.exec(`CREATE ROLE cza_t5_test_owner;CREATE ROLE cza_v01_app_runtime_min;GRANT USAGE,CREATE ON SCHEMA public TO cza_t5_test_owner;GRANT USAGE ON SCHEMA public TO cza_v01_app_runtime_min;
 ALTER TABLE public.users ADD COLUMN academy_id uuid;
 -- Minimal fresh migrations omit these columns; live QA already has them (read-only verified).
 ALTER TABLE public.training_sessions ADD COLUMN source text DEFAULT 'free_practice',ADD COLUMN settings_snapshot jsonb NOT NULL DEFAULT '{}',ADD COLUMN question_count integer DEFAULT 0,ADD COLUMN answered_count integer DEFAULT 0,ADD COLUMN correct_count integer DEFAULT 0,ADD COLUMN wrong_count integer DEFAULT 0,ADD COLUMN accuracy numeric DEFAULT 0;
 INSERT INTO academies(id,name,environment)VALUES('${A}','LOCAL V04','staging');
 INSERT INTO users(id,username,role,academy_id)VALUES('${U}','local-v04','student','${A}');
 INSERT INTO students(id,academy_id,user_id,first_name,last_name,is_demo)VALUES('${S}','${A}','${U}','Local','Synthetic',true);
 INSERT INTO student_sessions(id,academy_id,student_id,student_user_id,token_hash,expires_at,created_at)VALUES(gen_random_uuid(),'${A}','${S}','${U}','${H}',now()+interval '1 day',now()-interval '2 days');
 INSERT INTO training_recipes(id,academy_id,student_id,module_code,source,name,settings)VALUES('${R}','${A}','${S}','finger_read','teacher_assignment','Existing local recipe','${JSON.stringify(config)}');
 DO $$DECLARE x record;BEGIN FOR x IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('ALTER TABLE public.%I OWNER TO cza_t5_test_owner',x.tablename);END LOOP;
 FOR x IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'cza_%' LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO cza_t5_test_owner',x.signature);END LOOP;END$$;
 SELECT set_config('neon.project_id','patient-firefly-51111834',false),set_config('neon.branch_id','br-withered-queen-b15ltb40',false);SET ROLE cza_t5_test_owner;`);
  for (const file of [
    'v03-student-read.sql',
    'v03-session-lifecycle.sql',
    'v04-assigned-work.sql',
  ])
    await db.exec(
      read('db/qa/' + file).replaceAll("'cza_t5_synthetic'", "'postgres'"),
    );
  await db.exec('SET ROLE cza_v01_app_runtime_min');
  return db;
}
async function call(db, op, input = {}, session = null, recipe = R, hash = H) {
  return (
    await db.query(
      'SELECT public.cza_v04_qa_assigned_work($1,$2,$3,$4,$5::jsonb) result',
      [hash, op, recipe, session, JSON.stringify(input)],
    )
  ).rows[0].result;
}
const start = (db) =>
  call(db, 'start', {
    clientSessionId: randomUUID(),
    moduleCode: 'finger_read',
    source: 'teacher_assignment',
  });
function answer(q, index, correct = true) {
  const value = correct ? q.answer : q.answer + 10;
  return {
    clientAttemptId: randomUUID(),
    questionIndex: index,
    questionId: q.questionId,
    targetNumber: q.answer,
    studentNumericAnswer: value,
    isCorrect: true,
    patternValid: true,
    errorType: 'OK',
    stimulusDurationMs: 1200,
    responseLatencyMs: 1100,
    totalResponseTimeMs: 1100,
    metadata: {
      sequence: [q.answer],
      attemptType: 'PRIMARY',
      responsePayload: { value },
      skills: ['FORGED'],
      supportLevel: 'independent',
      strategy: 'invented',
    },
  };
}
async function owner(db, sql) {
  await db.exec('SET ROLE cza_t5_test_owner');
  try {
    return sql.includes(';') ? await db.exec(sql) : await db.query(sql);
  } finally {
    await db.exec('SET ROLE cza_v01_app_runtime_min');
  }
}

test('bounded start/resume, real answers, retries, finish and profile evidence use one canonical chain', async () => {
  const db = await setup();
  try {
    const first = await start(db),
      second = await start(db);
    assert.equal(second.sessionId, first.sessionId);
    assert.equal(second.resumed, true);
    assert.deepEqual(first.questions, second.questions);
    assert.equal(first.questions.length, 10);
    await assert.rejects(
      call(db, 'finish', {}, first.sessionId),
      /CZA_WORK_INCOMPLETE/,
    );
    const p = answer(first.questions[0], 1, false);
    await call(db, 'attempt', p, first.sessionId);
    const replay = await call(db, 'attempt', p, first.sessionId);
    assert.equal(replay.replayed, true);
    assert.equal(replay.attemptCount, 1);
    await assert.rejects(
      call(db, 'attempt', { ...p, responseLatencyMs: 1200 }, first.sessionId),
      /IDEMPOTENCY_KEY_REUSED/,
    );
    await assert.rejects(
      call(db, 'attempt', answer(first.questions[0], 1), first.sessionId),
      /question_conflict/,
    );
    await assert.rejects(
      call(
        db,
        'attempt',
        { ...answer(first.questions[1], 2), targetNumber: 99 },
        first.sessionId,
      ),
      /ATTEMPT_INVALID/,
    );
    await assert.rejects(
      call(
        db,
        'attempt',
        { ...answer(first.questions[1], 2), responseLatencyMs: 1.5 },
        first.sessionId,
      ),
      /ATTEMPT_INVALID/,
    );
    const resumed = await start(db);
    assert.equal(resumed.workProgress.attemptCount, 1);
    assert.deepEqual(resumed.questions, first.questions);
    assert.equal(
      (await call(db, 'finish', { aborted: true }, first.sessionId)).status,
      'in_progress',
    );
    for (let i = 1; i < 10; i++)
      await call(
        db,
        'attempt',
        answer(first.questions[i], i + 1),
        first.sessionId,
      );
    const done = await call(db, 'finish', {}, first.sessionId);
    assert.equal(done.status, 'completed');
    assert.equal(done.attemptCount, 10);
    assert.equal(done.correctCount, 9);
    assert.equal(done.averageResponseMs, 1100);
    const done2 = await call(db, 'finish', {}, first.sessionId);
    assert.equal(done2.learningRecordId, done.learningRecordId);
    assert.equal(done2.evidenceId, done.evidenceId);
    assert.equal(done2.replayed, true);
    assert.equal(
      (await call(db, 'attempt', p, first.sessionId)).replayed,
      true,
    );
    await assert.rejects(start(db), /SESSION_CLOSED/);
    const attempts = (
      await owner(db, 'SELECT * FROM question_attempts ORDER BY question_index')
    ).rows;
    assert.equal(attempts.length, 10);
    assert.equal(attempts[0].is_correct, false);
    assert.equal(attempts[0].error_type, 'RESPONSE_ERROR');
    assert.equal(attempts[0].metadata.supportLevel, 'unknown');
    assert.deepEqual(attempts[0].metadata.skills, []);
    assert.equal(attempts[0].metadata.strategy, null);
    assert.equal(attempts[0].metadata.timingProvenance, 'CLIENT_REPORTED');
    const records = (await owner(db, 'SELECT * FROM learning_records')).rows;
    assert.equal(records.length, 1);
    assert.equal(records[0].student_id, S);
    assert.equal(records[0].verification_status, 'client_reported');
    assert.equal(records[0].support_level, 'unknown');
    assert.equal(records[0].performance.correct, 9);
    const evidence = (await owner(db, 'SELECT * FROM learning_evidence')).rows;
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].verification_status, 'server_verified');
    assert.equal(
      evidence[0].verification_authority,
      'v04_qa_server_answer_evaluator:v1',
    );
    assert.deepEqual(evidence[0].payload, {
      total: 10,
      correct: 9,
      wrong: 1,
      accuracy: 90,
    });
    const chain = (
      await db.query(
        "SELECT public.cza_v03_qa_student_read($1,'profile_8') rows",
        [H],
      )
    ).rows[0].rows;
    assert.equal(chain[0].record_id, done.learningRecordId);
    assert.equal(chain[0].evidence_id, done.evidenceId);
  } finally {
    await db.close();
  }
});

test('target, session, recipe, module and direct privileges fail closed without broader grants', async () => {
  const db = await setup();
  try {
    await assert.rejects(
      call(db, 'start', {}, null, R, 'b'.repeat(64)),
      /session_rejected/,
    );
    await assert.rejects(
      call(db, 'start', {}, null, randomUUID()),
      /ASSIGNMENT_NOT_FOUND/,
    );
    await assert.rejects(
      call(db, 'start', {
        moduleCode: 'flash_anzan',
        source: 'teacher_assignment',
        clientSessionId: randomUUID(),
      }),
      /contract_rejected/,
    );
    const active = await start(db);
    await assert.rejects(
      call(db, 'attempt', {}, randomUUID()),
      /SESSION_NOT_FOUND/,
    );
    await assert.rejects(
      db.exec('UPDATE training_recipes SET is_active=false'),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        'SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)',
        [A, S, active.sessionId, '{}'],
      ),
      /permission denied/,
    );
    const changes = [
      ['student_sessions', 'revoked_at', 'now()'],
      ['student_sessions', 'expires_at', "now()-interval '1 hour'"],
      ['students', 'is_demo', 'false'],
      ['students', 'status', "'inactive'"],
      ['users', 'is_active', 'false'],
      ['users', 'academy_id', "'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"],
      ['training_recipes', 'cancelled_at', 'now()'],
      ['training_recipes', 'expires_at', "now()-interval '1 minute'"],
      ['modules', 'is_active', 'false'],
      ['training_recipes', 'settings', "'{}'::jsonb"],
    ];
    for (const [table, column, value] of changes) {
      await db.exec('BEGIN;SET ROLE cza_t5_test_owner');
      await db.exec(
        `UPDATE ${table} SET ${column}=${value}${column === 'cancelled_at' ? `,is_active=false,cancelled_by='${U}'` : ''}`,
      );
      await db.exec('SET ROLE cza_v01_app_runtime_min');
      await assert.rejects(
        start(db),
        /session_rejected|ASSIGNMENT_NOT_FOUND|contract_rejected/,
        table + '.' + column,
      );
      await db.exec('ROLLBACK;SET ROLE cza_v01_app_runtime_min');
    }
    await db.query("SELECT set_config('neon.branch_id','wrong',false)");
    await assert.rejects(start(db), /target_rejected/);
    const roles = (
      await db.query(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='cza_v01_app_runtime_min'",
      )
    ).rows[0];
    assert.deepEqual(roles, { rolsuper: false, rolbypassrls: false });
  } finally {
    await db.close();
  }
});

test('ledger failure rolls back completion and evidence; same session can finish after recovery', async () => {
  const db = await setup();
  try {
    const session = await start(db);
    for (let i = 0; i < 10; i++)
      await call(
        db,
        'attempt',
        answer(session.questions[i], i + 1),
        session.sessionId,
      );
    await owner(
      db,
      `CREATE FUNCTION public.v04_local_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'LOCAL_LEDGER_FAILURE';END$$;CREATE TRIGGER v04_fail BEFORE INSERT ON learning_evidence FOR EACH ROW EXECUTE FUNCTION public.v04_local_fail();`,
    );
    await assert.rejects(
      call(db, 'finish', {}, session.sessionId),
      /LOCAL_LEDGER_FAILURE/,
    );
    assert.equal(
      (await owner(db, 'SELECT count(*)::int n FROM learning_records')).rows[0]
        .n,
      0,
    );
    assert.equal(
      (await owner(db, 'SELECT status FROM training_sessions')).rows[0].status,
      'active',
    );
    await owner(db, 'DROP TRIGGER v04_fail ON learning_evidence');
    assert.equal(
      (await call(db, 'finish', {}, session.sessionId)).status,
      'completed',
    );
  } finally {
    await db.close();
  }
});
