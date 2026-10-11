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

const F = '40000004-0000-4000-8000-000000000091',
  OLD = 'bdb87fbc-0938-4eb1-82e5-0a2cb362d30f';
async function fixture(db, op, input = {}, session = null) {
  return (
    await db.query(
      'SELECT public.cza_v04_qa_final_fixture($1,$2,$3,$4,$5::jsonb) result',
      [H, op, R, session, JSON.stringify(input)],
    )
  ).rows[0].result;
}
test('review-only fixture isolates exactly one fresh work row and reuses unchanged accepted attempt/ledger functions', async () => {
  const db = await setup();
  try {
    await owner(
      db,
      `INSERT INTO training_sessions(id,academy_id,student_id,module_code,recipe_id,source,status,started_at,answered_count,correct_count) VALUES('${OLD}','${A}','${S}','finger_read','${R}','teacher_assignment','completed',now(),10,8)`,
    );
    const old = (
      await owner(
        db,
        `SELECT md5(to_jsonb(t)::text) hash FROM training_sessions t WHERE id='${OLD}'`,
      )
    ).rows[0].hash;
    await db.exec('SET ROLE cza_t5_test_owner');
    await db.exec(
      'BEGIN;' +
        read('db/qa/v04-final-fixture.review.sql').replaceAll(
          "'cza_t5_synthetic'",
          "'postgres'",
        ) +
        'COMMIT;',
    );
    await db.exec('SET ROLE cza_v01_app_runtime_min');
    const launch = await fixture(db, 'launch');
    assert.equal(launch.fixtureSessionId, F);
    assert.equal(
      (await owner(db, 'SELECT count(*) n FROM training_sessions')).rows[0].n,
      1,
    );
    const first = await fixture(db, 'start', {
      clientSessionId: randomUUID(),
      moduleCode: 'finger_read',
      source: 'teacher_assignment',
    });
    const second = await fixture(db, 'start', {
      clientSessionId: randomUUID(),
      moduleCode: 'finger_read',
      source: 'teacher_assignment',
    });
    assert.equal(first.sessionId, F);
    assert.equal(second.sessionId, F);
    assert.deepEqual(first.questions, second.questions);
    await assert.rejects(
      fixture(db, 'attempt', answer(first.questions[0], 1), OLD),
      /CZA_WORK_SESSION_NOT_FOUND/,
    );
    const p = answer(first.questions[0], 1, false);
    await fixture(db, 'attempt', p, F);
    const replay = await fixture(db, 'attempt', p, F);
    assert.equal(replay.replayed, true);
    await assert.rejects(
      fixture(
        db,
        'attempt',
        {
          ...p,
          studentNumericAnswer: p.studentNumericAnswer + 1,
          metadata: {
            ...p.metadata,
            responsePayload: { value: p.studentNumericAnswer + 1 },
          },
        },
        F,
      ),
      /IDEMPOTENCY_KEY_REUSED/,
    );
    await assert.rejects(
      fixture(db, 'attempt', { ...p, clientAttemptId: randomUUID() }, F),
      /question_conflict/,
    );
    for (let i = 2; i <= 10; i++)
      await fixture(
        db,
        'attempt',
        answer(first.questions[i - 1], i, i !== 3),
        F,
      );
    const done = await fixture(db, 'finish', {}, F);
    assert.equal(done.attemptCount, 10);
    assert.equal(done.correctCount, 8);
    const again = await fixture(db, 'finish', {}, F);
    assert.equal(again.learningRecordId, done.learningRecordId);
    assert.equal(again.evidenceId, done.evidenceId);
    await assert.rejects(fixture(db, 'launch'), /CZA_WORK_SESSION_CLOSED/);
    const rows = await owner(
      db,
      `SELECT (SELECT count(*) FROM training_sessions) sessions,(SELECT count(*) FROM question_attempts) attempts,(SELECT count(*) FROM learning_records) records,(SELECT count(*) FROM learning_evidence) evidence,has_function_privilege('cza_v01_app_runtime_min','public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb)','EXECUTE') allowed`,
    );
    assert.deepEqual(rows.rows[0], {
      sessions: 2,
      attempts: 10,
      records: 1,
      evidence: 1,
      allowed: true,
    });
    assert.equal(
      (
        await owner(
          db,
          `SELECT md5(to_jsonb(t)::text) hash FROM training_sessions t WHERE id='${OLD}'`,
        )
      ).rows[0].hash,
      old,
    );
    const publicAcl = await owner(
      db,
      "SELECT count(*) n FROM pg_proc p,LATERAL aclexplode(p.proacl) a WHERE p.proname='cza_v04_qa_final_fixture' AND a.grantee=0",
    );
    assert.equal(publicAcl.rows[0].n, 0);
  } finally {
    await db.close();
  }
});
