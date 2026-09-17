/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const prerequisites = read(
  '../db/migrations/20260912_staging_core_prerequisites_v1.sql',
);
const ledger = read(
  '../db/migrations/20260913_canonical_learning_ledger_v1.sql',
);
const u1 = read('../db/migrations/20260916_u1_student_panel_core_v1.sql');
const u2 = read('../db/migrations/20260917_u2_work_center_core_v1.sql');

const ids = {
  academy: 'a2000000-0000-4000-8000-000000000001',
  userA: 'a2000000-0000-4000-8000-000000000002',
  userB: 'a2000000-0000-4000-8000-000000000003',
  studentA: 'a2000000-0000-4000-8000-000000000004',
  studentB: 'a2000000-0000-4000-8000-000000000005',
  loginA: 'a2000000-0000-4000-8000-000000000006',
  loginB: 'a2000000-0000-4000-8000-000000000007',
  recipeA: 'a2000000-0000-4000-8000-000000000008',
  recipeB: 'a2000000-0000-4000-8000-000000000009',
  trainingA: 'a2000000-0000-4000-8000-000000000010',
  clientSessionA: 'a2000000-0000-4000-8000-000000000011',
  attempt1: 'a2000000-0000-4000-8000-000000000012',
  attempt2: 'a2000000-0000-4000-8000-000000000013',
};

function attempt(clientAttemptId, questionIndex, correct, errorType) {
  return {
    clientAttemptId,
    questionIndex,
    questionId: `u2-demo-${questionIndex}`,
    targetNumber: questionIndex + 3,
    studentNumericAnswer: correct ? questionIndex + 3 : questionIndex + 2,
    patternValid: true,
    isCorrect: correct,
    errorType,
    errorDetail: correct ? 'Doğru cevap' : 'Demo hata kanıtı',
    stimulusDurationMs: 700,
    responseLatencyMs: 950,
    totalResponseTimeMs: 950,
    learningMode: 'guided_practice',
    difficultyLevel: 1,
    attemptNumber: 1,
    metadata: {
      attemptType: 'PRIMARY',
      skills: ['number-recognition'],
      demo: true,
    },
  };
}

async function fingerprint(db) {
  const result = await db.query(`
    SELECT string_agg(identity, E'\n' ORDER BY identity) AS value
    FROM (
      SELECT 'column:' || table_name || ':' || column_name || ':' || data_type AS identity
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'training_sessions'
      UNION ALL
      SELECT 'index:' || indexname || ':' || indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'training_sessions'
      UNION ALL
      SELECT 'function:' || p.proname || ':' || pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'cza_%assigned_work%'
    ) items
  `);
  return result.rows[0].value;
}

test('U2 migration is additive-only', () => {
  assert.doesNotMatch(
    u2,
    /\b(?:drop|truncate)\b|\bdelete\s+from\b|\balter\s+table\b[^;]*\bdrop\b/i,
  );
});

test('U2 assigned work lifecycle is isolated, resumable, idempotent, and atomic', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(prerequisites);
    await db.exec(ledger);
    await db.exec(u1);
    await db.exec(u2);
    const firstFingerprint = await fingerprint(db);
    await db.exec(u2);
    assert.equal(await fingerprint(db), firstFingerprint);

    await db.exec(`
      INSERT INTO public.academies (id, name, environment)
      VALUES ('${ids.academy}', 'CZA U2 Demo', 'staging');
      INSERT INTO public.users (id, username, role) VALUES
        ('${ids.userA}', 'u2-demo-a', 'student'),
        ('${ids.userB}', 'u2-demo-b', 'student');
      INSERT INTO public.students (id, academy_id, user_id, first_name, last_name, is_demo) VALUES
        ('${ids.studentA}', '${ids.academy}', '${ids.userA}', 'Demo', 'A', true),
        ('${ids.studentB}', '${ids.academy}', '${ids.userB}', 'Demo', 'B', true);
      INSERT INTO public.student_sessions (
        id, academy_id, student_id, student_user_id, token_hash, expires_at
      ) VALUES
        ('${ids.loginA}', '${ids.academy}', '${ids.studentA}', '${ids.userA}', repeat('a', 64), now() + interval '1 day'),
        ('${ids.loginB}', '${ids.academy}', '${ids.studentB}', '${ids.userB}', repeat('b', 64), now() + interval '1 day');
      INSERT INTO public.training_recipes (
        id, academy_id, student_id, module_code, source, name, settings
      ) VALUES
        ('${ids.recipeA}', '${ids.academy}', '${ids.studentA}', 'finger_read', 'teacher_assignment', 'U2 Demo A', '{"rounds":2,"demo":true}'),
        ('${ids.recipeB}', '${ids.academy}', '${ids.studentB}', 'flash_anzan', 'teacher_assignment', 'U2 Demo B', '{"rounds":2,"demo":true}');
    `);

    const started = await db.query(
      `SELECT * FROM public.cza_bind_assigned_work_session($1,$2,$3,$4,$5,now())`,
      [
        ids.academy,
        ids.studentA,
        ids.recipeA,
        ids.clientSessionA,
        ids.trainingA,
      ],
    );
    assert.equal(started.rows[0].work_status, 'in_progress');
    assert.equal(started.rows[0].resumed, false);

    const resumed = await db.query(
      `SELECT * FROM public.cza_bind_assigned_work_session($1,$2,$3,$4,$5,now())`,
      [
        ids.academy,
        ids.studentA,
        ids.recipeA,
        ids.clientSessionA,
        ids.trainingA,
      ],
    );
    assert.equal(resumed.rows[0].training_session_id, ids.trainingA);
    assert.equal(resumed.rows[0].resumed, true);

    await assert.rejects(
      db.query(
        `SELECT * FROM public.cza_bind_assigned_work_session($1,$2,$3,$4,$5,now())`,
        [
          ids.academy,
          ids.studentA,
          ids.recipeB,
          ids.clientSessionA,
          ids.trainingA,
        ],
      ),
      /CZA_WORK_ASSIGNMENT_NOT_FOUND/,
    );
    await assert.rejects(
      db.query(
        `SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`,
        [
          ids.academy,
          ids.studentB,
          ids.trainingA,
          JSON.stringify(attempt(ids.attempt1, 1, true, 'OK')),
        ],
      ),
      /CZA_WORK_SESSION_NOT_FOUND/,
    );

    const firstAttempt = await db.query(
      `SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`,
      [
        ids.academy,
        ids.studentA,
        ids.trainingA,
        JSON.stringify(attempt(ids.attempt1, 1, true, 'OK')),
      ],
    );
    assert.equal(firstAttempt.rows[0].attempt_count, 1);
    assert.equal(firstAttempt.rows[0].replayed, false);

    const replayedAttempt = await db.query(
      `SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`,
      [
        ids.academy,
        ids.studentA,
        ids.trainingA,
        JSON.stringify(attempt(ids.attempt1, 1, true, 'OK')),
      ],
    );
    assert.equal(replayedAttempt.rows[0].replayed, true);
    assert.equal(replayedAttempt.rows[0].attempt_count, 1);

    await assert.rejects(
      db.query(
        `SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`,
        [
          ids.academy,
          ids.studentA,
          ids.trainingA,
          JSON.stringify(attempt(ids.attempt1, 1, false, 'RESPONSE_ERROR')),
        ],
      ),
      /IDEMPOTENCY_KEY_REUSED/,
    );

    await assert.rejects(
      db.query(
        `SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`,
        [ids.academy, ids.studentA, ids.loginA, ids.trainingA],
      ),
      /CZA_WORK_INCOMPLETE/,
    );
    const noPartial = await db.query(`
      SELECT
        (SELECT count(*)::int FROM public.learning_records WHERE training_session_id = '${ids.trainingA}') AS records,
        (SELECT count(*)::int FROM public.learning_evidence WHERE student_id = '${ids.studentA}') AS evidence,
        (SELECT status FROM public.training_sessions WHERE id = '${ids.trainingA}') AS status
    `);
    assert.deepEqual(noPartial.rows, [
      { records: 0, evidence: 0, status: 'active' },
    ]);

    const paused = await db.query(
      `SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,true)`,
      [ids.academy, ids.studentA, ids.loginA, ids.trainingA],
    );
    assert.equal(paused.rows[0].work_status, 'in_progress');

    await db.query(
      `SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`,
      [
        ids.academy,
        ids.studentA,
        ids.trainingA,
        JSON.stringify(attempt(ids.attempt2, 2, false, 'RESPONSE_ERROR')),
      ],
    );
    const completed = await db.query(
      `SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`,
      [ids.academy, ids.studentA, ids.loginA, ids.trainingA],
    );
    assert.equal(completed.rows[0].work_status, 'completed');
    assert.equal(completed.rows[0].attempt_count, 2);
    assert.equal(completed.rows[0].correct_count, 1);
    assert.ok(completed.rows[0].learning_record_id);
    assert.ok(completed.rows[0].evidence_id);

    const replayedCompletion = await db.query(
      `SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`,
      [ids.academy, ids.studentA, ids.loginA, ids.trainingA],
    );
    assert.equal(replayedCompletion.rows[0].replayed, true);
    assert.equal(
      replayedCompletion.rows[0].learning_record_id,
      completed.rows[0].learning_record_id,
    );
    assert.equal(
      replayedCompletion.rows[0].evidence_id,
      completed.rows[0].evidence_id,
    );

    const chain = await db.query(`
      SELECT s.is_demo, tr.id AS assignment_id, ts.status,
             count(DISTINCT qa.id)::int AS attempts,
             count(DISTINCT lr.id)::int AS history_records,
             count(DISTINCT le.id)::int AS evidence_records,
             max(lr.skills::text) AS learning_profile_skills
      FROM public.students s
      JOIN public.training_recipes tr ON tr.student_id = s.id AND tr.academy_id = s.academy_id
      JOIN public.training_sessions ts ON ts.recipe_id = tr.id AND ts.student_id = s.id
      LEFT JOIN public.question_attempts qa ON qa.training_session_id = ts.id AND qa.student_id = s.id
      LEFT JOIN public.learning_records lr ON lr.training_session_id = ts.id AND lr.student_id = s.id
      LEFT JOIN public.learning_evidence le ON le.learning_record_id = lr.id AND le.student_id = s.id
      WHERE s.id = '${ids.studentA}'
      GROUP BY s.is_demo, tr.id, ts.status
    `);
    assert.deepEqual(chain.rows, [
      {
        is_demo: true,
        assignment_id: ids.recipeA,
        status: 'completed',
        attempts: 2,
        history_records: 1,
        evidence_records: 1,
        learning_profile_skills: '["number-recognition"]',
      },
    ]);
  } finally {
    await db.close();
  }
});
