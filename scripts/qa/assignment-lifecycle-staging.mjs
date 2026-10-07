import crypto from 'node:crypto';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';

const url = process.env.CZA_STAGING_DATABASE_URL || '';
if (!url) {
  console.error('ASSIGNMENT_LIFECYCLE_STAGING=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('ASSIGNMENT_LIFECYCLE_STAGING=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('ASSIGNMENT_LIFECYCLE_STAGING=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

const sql = neon(url);
const recipeId = crypto.randomUUID();
const studentSessionId = crypto.randomUUID();
const clientRecordId = crypto.randomUUID();
const qaTokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
const marker = 'CZA-QA-ASSIGNMENT-' + Date.now();

try {
  const fixtures = await sql`
    SELECT
      ts.id AS training_session_id,
      ts.status::text AS original_status,
      ts.recipe_id AS original_recipe_id,
      ts.completed_at AS original_completed_at,
      ts.academy_id,
      ts.student_id,
      ts.module_code,
      l.teacher_id AS educator_user_id,
      ss.student_user_id
    FROM public.training_sessions ts
    JOIN public.students s
      ON s.id = ts.student_id
     AND s.academy_id = ts.academy_id
     AND s.status = 'active'
    JOIN public.teacher_student_links l
      ON l.student_id = ts.student_id
     AND l.can_view = true
    JOIN public.users t
      ON t.id = l.teacher_id
     AND t.is_active = true
    JOIN public.student_sessions ss
      ON ss.student_id = ts.student_id
     AND ss.academy_id = ts.academy_id
    WHERE ts.status::text IN ('active','started','in_progress')
      AND NOT EXISTS (
        SELECT 1 FROM public.training_recipes existing
        WHERE existing.academy_id=ts.academy_id AND existing.student_id=ts.student_id
          AND existing.module_code=ts.module_code AND existing.is_active=true
      )
    ORDER BY ts.started_at DESC NULLS LAST
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('ASSIGNMENT_LIFECYCLE_STAGING=BLOCKED');
    console.error('REASON=NO_ACTIVE_LINKED_SESSION_FIXTURE');
    process.exit(2);
  }

  const fixture = fixtures[0];
  const startedAt = new Date(Date.now() - 15000);
  const completedAt = new Date();

  let rollbackProof = false;
  try {
    await sql.transaction([
      sql`
        CREATE TEMP TABLE cza_assignment_lifecycle_checks (
          stage text PRIMARY KEY,
          passed boolean NOT NULL
        ) ON COMMIT DROP
      `,
      sql`
        INSERT INTO public.training_recipes (
          id, academy_id, student_id, module_code, assigned_by, source,
          name, settings, is_active, starts_at, expires_at
        ) VALUES (
          ${recipeId}::uuid,
          ${fixture.academy_id}::uuid,
          ${fixture.student_id}::uuid,
          ${fixture.module_code}::text,
          ${fixture.educator_user_id}::uuid,
          'teacher_assignment',
          ${marker},
          '{"practiceMode":"guided_practice","rounds":10}'::jsonb,
          true,
          now(),
          now() + interval '14 days'
        )
      `,
      sql`
        INSERT INTO cza_assignment_lifecycle_checks(stage, passed)
        SELECT 'assigned',
          EXISTS (
            SELECT 1 FROM public.training_recipes tr
            WHERE tr.id = ${recipeId}::uuid
              AND tr.academy_id = ${fixture.academy_id}::uuid
              AND tr.student_id = ${fixture.student_id}::uuid
              AND tr.source = 'teacher_assignment'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.recipe_id = ${recipeId}::uuid
          )
      `,
      sql`
        UPDATE public.training_sessions
        SET recipe_id = ${recipeId}::uuid
        WHERE id = ${fixture.training_session_id}::uuid
      `,
      sql`
        INSERT INTO cza_assignment_lifecycle_checks(stage, passed)
        SELECT 'started',
          EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.recipe_id = ${recipeId}::uuid
              AND ts.status::text <> 'completed'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.recipe_id = ${recipeId}::uuid
              AND ts.status::text = 'completed'
          )
      `,
      sql`
        UPDATE public.training_sessions
        SET status = 'completed',
            completed_at = COALESCE(completed_at, now())
        WHERE id = ${fixture.training_session_id}::uuid
      `,
      sql`
        INSERT INTO public.student_sessions (
          id, academy_id, student_id, student_user_id, token_hash,
          expires_at, last_seen_at, user_agent
        ) VALUES (
          ${studentSessionId}::uuid,
          ${fixture.academy_id}::uuid,
          ${fixture.student_id}::uuid,
          ${fixture.student_user_id}::uuid,
          ${qaTokenHash},
          now() + interval '1 hour',
          now(),
          ${marker}
        )
      `,
      sql`
        SELECT learning_record_id, replayed, canonical_payload_hash
        FROM public.cza_student_record_learning(
          ${fixture.academy_id}::uuid,
          ${fixture.student_id}::uuid,
          ${fixture.training_session_id}::uuid,
          ${studentSessionId}::uuid,
          ${clientRecordId}::uuid,
          'module_record',
          '1.0.0',
          'CZA_MODULE_RECORD_V1',
          ${fixture.module_code}::text,
          '1.0.0',
          'practice_session',
          ${startedAt.toISOString()}::timestamptz,
          ${completedAt.toISOString()}::timestamptz,
          'unknown',
          '{"total":3,"correct":2,"wrong":1,"accuracy":67,"durationMs":15000}'::jsonb,
          '["qa_assignment"]'::jsonb,
          ${JSON.stringify({ source: 'teacher_assignment', assignmentId: recipeId, qaMarker: marker })}::jsonb
        )
      `,
      sql`
        INSERT INTO cza_assignment_lifecycle_checks(stage, passed)
        SELECT 'completed',
          EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.recipe_id = ${recipeId}::uuid
              AND ts.status::text = 'completed'
          )
          AND EXISTS (
            SELECT 1
            FROM public.learning_records lr
            JOIN public.training_sessions ts ON ts.id = lr.training_session_id
            WHERE ts.recipe_id = ${recipeId}::uuid
              AND lr.academy_id = ${fixture.academy_id}::uuid
              AND lr.student_id = ${fixture.student_id}::uuid
              AND lr.client_record_id = ${clientRecordId}::uuid
          )
      `,
      sql`
        INSERT INTO cza_assignment_lifecycle_checks(stage, passed)
        SELECT 'educator_readback',
          EXISTS (
            SELECT 1
            FROM public.training_recipes tr
            WHERE tr.id = ${recipeId}::uuid
              AND tr.academy_id = ${fixture.academy_id}::uuid
              AND tr.student_id = ${fixture.student_id}::uuid
              AND tr.source = 'teacher_assignment'
              AND EXISTS (
                SELECT 1
                FROM public.teacher_student_links l
                JOIN public.users t ON t.id = l.teacher_id
                WHERE l.student_id = tr.student_id
                  AND l.teacher_id = ${fixture.educator_user_id}::uuid
                  AND l.can_view = true
                  AND t.is_active = true
              )
              AND EXISTS (
                SELECT 1 FROM public.training_sessions ts
                WHERE ts.recipe_id = tr.id AND ts.status::text = 'completed'
              )
          )
      `,
      sql`
        SELECT CAST(
          'QA_ASSIGNMENT_ROLLBACK_' ||
          CASE
            WHEN count(*) = 4 AND bool_and(passed) THEN 'PASS'
            ELSE 'FAIL'
          END
          AS integer
        )
        FROM cza_assignment_lifecycle_checks
      `,
    ]);
    throw new Error('qa_assignment_transaction_unexpected_commit');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('QA_ASSIGNMENT_ROLLBACK_PASS')) throw error;
    rollbackProof = true;
  }

  const [recipeResidue, sessionState, studentSessionResidue, learningResidue] = await Promise.all([
    sql`SELECT count(*)::int AS count FROM public.training_recipes WHERE id = ${recipeId}::uuid`,
    sql`
      SELECT status::text AS status, recipe_id, completed_at
      FROM public.training_sessions
      WHERE id = ${fixture.training_session_id}::uuid
      LIMIT 1
    `,
    sql`SELECT count(*)::int AS count FROM public.student_sessions WHERE id = ${studentSessionId}::uuid`,
    sql`SELECT count(*)::int AS count FROM public.learning_records WHERE client_record_id = ${clientRecordId}::uuid`,
  ]);

  const restored = sessionState[0];
  const originalRecipe = fixture.original_recipe_id ? String(fixture.original_recipe_id) : null;
  const restoredRecipe = restored?.recipe_id ? String(restored.recipe_id) : null;
  const originalCompleted = fixture.original_completed_at ? new Date(fixture.original_completed_at).toISOString() : null;
  const restoredCompleted = restored?.completed_at ? new Date(restored.completed_at).toISOString() : null;

  if (
    !rollbackProof ||
    Number(recipeResidue[0]?.count || 0) !== 0 ||
    Number(studentSessionResidue[0]?.count || 0) !== 0 ||
    Number(learningResidue[0]?.count || 0) !== 0 ||
    restored?.status !== fixture.original_status ||
    restoredRecipe !== originalRecipe ||
    restoredCompleted !== originalCompleted
  ) {
    throw new Error('assignment_staging_rollback_residue_detected');
  }

  console.log('ASSIGNMENT_LIFECYCLE_STAGING=PASS');
  console.log('ASSIGNED_STATE=PASS');
  console.log('STARTED_STATE=PASS');
  console.log('COMPLETED_STATE=PASS');
  console.log('EDUCATOR_READBACK=PASS');
  console.log('CANONICAL_RESULT_LINK=PASS');
  console.log('TRANSACTIONAL_ROLLBACK=PASS');
  console.log('ZERO_QA_RESIDUE=PASS');
  console.log('HOST_SHA256=' + crypto.createHash('sha256').update(host).digest('hex'));
} catch (error) {
  console.error('ASSIGNMENT_LIFECYCLE_STAGING=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
