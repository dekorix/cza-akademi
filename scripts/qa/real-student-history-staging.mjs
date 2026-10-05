import crypto from 'node:crypto';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';

const url = process.env.CZA_STAGING_DATABASE_URL || '';
if (!url) {
  console.error('REAL_HISTORY_STAGING=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('REAL_HISTORY_STAGING=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('REAL_HISTORY_STAGING=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

const sql = neon(url);

try {
  const schema = await sql`
    SELECT
      to_regclass('public.learning_records')::text AS learning_records,
      to_regclass('public.learning_evidence')::text AS learning_evidence,
      to_regprocedure(
        'public.cza_student_record_learning(uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb)'
      )::text AS record_function
  `;
  const schemaRow = schema[0] || {};
  if (!schemaRow.learning_records || !schemaRow.learning_evidence || !schemaRow.record_function) {
    console.error('REAL_HISTORY_STAGING=BLOCKED');
    console.error('REASON=CANONICAL_LEDGER_SCHEMA_MISSING');
    process.exit(2);
  }

  const fixtures = await sql`
    SELECT
      ts.id AS training_session_id,
      ts.academy_id,
      ts.student_id,
      ts.module_code,
      l.teacher_id AS educator_user_id
    FROM public.training_sessions ts
    JOIN public.students s
      ON s.id = ts.student_id
     AND s.academy_id = ts.academy_id
    JOIN public.modules m
      ON m.code = ts.module_code
     AND m.is_active = true
    JOIN public.teacher_student_links l
      ON l.student_id = ts.student_id
     AND l.can_view = true
    JOIN public.users t
      ON t.id = l.teacher_id
     AND t.is_active = true
    ORDER BY COALESCE(ts.completed_at, ts.started_at) DESC NULLS LAST
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('REAL_HISTORY_STAGING=BLOCKED');
    console.error('REASON=NO_LINKED_STUDENT_TRAINING_SESSION_FIXTURE');
    process.exit(2);
  }

  const fixture = fixtures[0];
  const clientRecordId = crypto.randomUUID();
  const marker = 'CZA-QA-REAL-HISTORY-' + Date.now();
  const completedAt = new Date();
  const startedAt = new Date(completedAt.getTime() - 15000);
  const performance = {
    total: 3,
    correct: 2,
    wrong: 1,
    accuracy: 67,
    durationMs: 15000,
    source: 'SYNTHETIC_QA',
  };
  const skills = ['qa_history'];
  const metadata = {
    source: 'SYNTHETIC_QA',
    qaMarker: marker,
    diagnosticUse: false,
  };

  const tx = await sql.transaction([
    sql`
      SELECT learning_record_id, replayed, canonical_payload_hash
      FROM public.cza_student_record_learning(
        ${fixture.academy_id}::uuid,
        ${fixture.student_id}::uuid,
        ${fixture.training_session_id}::uuid,
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
        ${JSON.stringify(performance)}::jsonb,
        ${JSON.stringify(skills)}::jsonb,
        ${JSON.stringify(metadata)}::jsonb
      )
    `,
    sql`
      SELECT id, academy_id, student_id, training_session_id, module_code,
             performance, skills, metadata
      FROM public.learning_records
      WHERE academy_id = ${fixture.academy_id}::uuid
        AND student_id = ${fixture.student_id}::uuid
        AND client_record_id = ${clientRecordId}::uuid
      LIMIT 1
    `,
    sql`
      SELECT lr.id, lr.academy_id, lr.student_id, lr.training_session_id, lr.module_code
      FROM public.learning_records lr
      WHERE lr.academy_id = ${fixture.academy_id}::uuid
        AND lr.student_id = ${fixture.student_id}::uuid
        AND lr.client_record_id = ${clientRecordId}::uuid
        AND EXISTS (
          SELECT 1
          FROM public.teacher_student_links l
          JOIN public.users t ON t.id = l.teacher_id
          WHERE l.student_id = lr.student_id
            AND l.teacher_id = ${fixture.educator_user_id}::uuid
            AND l.can_view = true
            AND t.is_active = true
        )
      LIMIT 1
    `,
    sql`
      SELECT learning_record_id, replayed, canonical_payload_hash
      FROM public.cza_student_record_learning(
        ${fixture.academy_id}::uuid,
        ${fixture.student_id}::uuid,
        ${fixture.training_session_id}::uuid,
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
        ${JSON.stringify(performance)}::jsonb,
        ${JSON.stringify(skills)}::jsonb,
        ${JSON.stringify(metadata)}::jsonb
      )
    `,
    sql`
      DELETE FROM public.learning_records
      WHERE academy_id = ${fixture.academy_id}::uuid
        AND client_record_id = ${clientRecordId}::uuid
        AND metadata->>'qaMarker' = ${marker}
      RETURNING id
    `,
  ]);

  const first = tx[0]?.[0];
  const studentRead = tx[1]?.[0];
  const educatorRead = tx[2]?.[0];
  const replay = tx[3]?.[0];
  const deleted = tx[4] || [];

  const checks = {
    firstInsert: Boolean(first?.learning_record_id) && first?.replayed === false,
    studentReadback: String(studentRead?.id || '') === String(first?.learning_record_id || ''),
    educatorReadback: String(educatorRead?.id || '') === String(first?.learning_record_id || ''),
    sameStudent: String(studentRead?.student_id || '') === String(fixture.student_id),
    sameAcademy: String(studentRead?.academy_id || '') === String(fixture.academy_id),
    sameSession: String(studentRead?.training_session_id || '') === String(fixture.training_session_id),
    sameModule: studentRead?.module_code === fixture.module_code,
    replayed: replay?.replayed === true && String(replay?.learning_record_id || '') === String(first?.learning_record_id || ''),
    sameHash: replay?.canonical_payload_hash === first?.canonical_payload_hash,
    cleanupInTransaction: deleted.length === 1,
  };

  if (Object.values(checks).some(value => value !== true)) {
    throw new Error('staging_readback_mismatch:' + JSON.stringify(checks));
  }

  const residue = await sql`
    SELECT count(*)::int AS count
    FROM public.learning_records
    WHERE academy_id = ${fixture.academy_id}::uuid
      AND client_record_id = ${clientRecordId}::uuid
  `;
  if (Number(residue[0]?.count || 0) !== 0) {
    throw new Error('staging_qa_residue_detected');
  }

  const hostHash = crypto.createHash('sha256').update(host).digest('hex');
  console.log('REAL_HISTORY_STAGING=PASS');
  console.log('CANONICAL_WRITE=PASS');
  console.log('STUDENT_READBACK=PASS');
  console.log('EDUCATOR_READBACK=PASS');
  console.log('IDEMPOTENT_REPLAY=PASS');
  console.log('TRANSACTIONAL_CLEANUP=PASS');
  console.log('HOST_SHA256=' + hostHash);
} catch (error) {
  console.error('REAL_HISTORY_STAGING=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
