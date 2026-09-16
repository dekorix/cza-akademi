import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const prerequisites = fs.readFileSync(
  new URL('../db/migrations/20260912_staging_core_prerequisites_v1.sql', import.meta.url),
  'utf8',
);
const migration = fs.readFileSync(
  new URL('../db/migrations/20260916_u1_student_panel_core_v1.sql', import.meta.url),
  'utf8',
);

const ids = {
  academy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userA: '10000000-0000-4000-8000-000000000001',
  userB: '10000000-0000-4000-8000-000000000002',
  studentA: '20000000-0000-4000-8000-000000000001',
  studentB: '20000000-0000-4000-8000-000000000002',
  recipeA: '30000000-0000-4000-8000-000000000001',
  recipeB: '30000000-0000-4000-8000-000000000002',
  sessionA: '40000000-0000-4000-8000-000000000001',
  sessionB: '40000000-0000-4000-8000-000000000002',
  attemptA: '50000000-0000-4000-8000-000000000001',
  attemptB: '50000000-0000-4000-8000-000000000002',
};

async function schemaFingerprint(db) {
  const result = await db.query(`
    SELECT string_agg(identity, E'\n' ORDER BY identity) AS fingerprint
    FROM (
      SELECT 'table:' || table_name AS identity
      FROM information_schema.tables
      WHERE table_schema = 'public'
      UNION ALL
      SELECT 'column:' || table_name || ':' || column_name || ':' || data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('students', 'training_recipes', 'training_sessions', 'question_attempts')
      UNION ALL
      SELECT 'index:' || indexname || ':' || indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('training_recipes', 'training_sessions', 'question_attempts')
    ) AS schema_items
  `);
  return result.rows[0].fingerprint;
}

test('U1 additive schema is idempotent and preserves cross-student isolation', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(prerequisites);
    await db.exec(migration);
    const firstFingerprint = await schemaFingerprint(db);
    await db.exec(migration);
    assert.equal(await schemaFingerprint(db), firstFingerprint);

    await db.exec(`
      INSERT INTO public.academies (id, name, environment)
      VALUES ('${ids.academy}', 'CZA U1 Test', 'staging');
      INSERT INTO public.users (id, username, role)
      VALUES
        ('${ids.userA}', 'u1-demo-a', 'student'),
        ('${ids.userB}', 'u1-demo-b', 'student');
      INSERT INTO public.students (id, academy_id, user_id, first_name, last_name, is_demo)
      VALUES
        ('${ids.studentA}', '${ids.academy}', '${ids.userA}', 'Deniz', 'A', true),
        ('${ids.studentB}', '${ids.academy}', '${ids.userB}', 'Deniz', 'B', true);
      INSERT INTO public.training_recipes (
        id, academy_id, student_id, module_code, source, name, settings
      ) VALUES
        ('${ids.recipeA}', '${ids.academy}', '${ids.studentA}', 'finger_read', 'teacher_assignment', 'A çalışması', '{}'),
        ('${ids.recipeB}', '${ids.academy}', '${ids.studentB}', 'flash_anzan', 'teacher_assignment', 'B çalışması', '{}');
      INSERT INTO public.training_sessions (
        id, academy_id, student_id, module_code, recipe_id, status, started_at, completed_at
      ) VALUES
        ('${ids.sessionA}', '${ids.academy}', '${ids.studentA}', 'finger_read', '${ids.recipeA}', 'completed', now() - interval '5 minutes', now()),
        ('${ids.sessionB}', '${ids.academy}', '${ids.studentB}', 'flash_anzan', '${ids.recipeB}', 'completed', now() - interval '5 minutes', now());
      INSERT INTO public.question_attempts (
        academy_id, student_id, training_session_id, module_code,
        client_attempt_id, question_index, question_id, is_correct,
        error_type, error_detail, metadata
      ) VALUES
        ('${ids.academy}', '${ids.studentA}', '${ids.sessionA}', 'finger_read', '${ids.attemptA}', 1, 'a-1', true, 'OK', 'Doğru cevap', '{}'),
        ('${ids.academy}', '${ids.studentB}', '${ids.sessionB}', 'flash_anzan', '${ids.attemptB}', 1, 'b-1', false, 'RESPONSE_ERROR', 'Yanlış cevap', '{}');
    `);

    const studentA = await db.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE is_correct)::int AS correct
      FROM public.question_attempts
      WHERE student_id = '${ids.studentA}'::uuid
    `);
    assert.deepEqual(studentA.rows, [{ total: 1, correct: 1 }]);

    const assignmentsA = await db.query(`
      SELECT id FROM public.training_recipes
      WHERE student_id = '${ids.studentA}'::uuid
        AND academy_id = '${ids.academy}'::uuid
      ORDER BY id
    `);
    assert.deepEqual(assignmentsA.rows, [{ id: ids.recipeA }]);

    await assert.rejects(
      db.exec(`
        INSERT INTO public.question_attempts (
          academy_id, student_id, training_session_id, module_code,
          client_attempt_id, question_index, question_id, is_correct, error_type
        ) VALUES (
          '${ids.academy}', '${ids.studentB}', '${ids.sessionA}', 'finger_read',
          '50000000-0000-4000-8000-000000000003', 2, 'cross-student', false, 'RESPONSE_ERROR'
        )
      `),
      /foreign key|violates foreign key constraint/i,
    );

    await assert.rejects(
      db.exec(`
        INSERT INTO public.question_attempts (
          academy_id, student_id, training_session_id, module_code,
          client_attempt_id, question_index, question_id, is_correct, error_type
        ) VALUES (
          '${ids.academy}', '${ids.studentA}', '${ids.sessionA}', 'finger_read',
          '${ids.attemptA}', 2, 'duplicate', true, 'OK'
        )
      `),
      /unique|duplicate key/i,
    );

    await db.exec(`
      BEGIN;
      INSERT INTO public.question_attempts (
        academy_id, student_id, training_session_id, module_code,
        client_attempt_id, question_index, question_id, is_correct, error_type
      ) VALUES (
        '${ids.academy}', '${ids.studentA}', '${ids.sessionA}', 'finger_read',
        '50000000-0000-4000-8000-000000000004', 3, 'rollback', true, 'OK'
      );
      ROLLBACK;
    `);
    const rolledBack = await db.query(`
      SELECT count(*)::int AS total FROM public.question_attempts
      WHERE client_attempt_id = '50000000-0000-4000-8000-000000000004'::uuid
    `);
    assert.equal(rolledBack.rows[0].total, 0);

    await db.exec(`
      ALTER TABLE public.academies DROP CONSTRAINT academies_environment_check;
      UPDATE public.academies SET environment = 'production' WHERE id = '${ids.academy}';
    `);
    await assert.rejects(
      db.exec(`UPDATE public.students SET is_demo = true WHERE id = '${ids.studentA}'`),
      /CZA_DEMO_STUDENT_ENVIRONMENT_REJECTED/,
    );
  } finally {
    await db.close();
  }
});
