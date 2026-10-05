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
  const constraintRows = await sql`
    SELECT pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'learning_records'
      AND c.conname = 'learning_records_session_binding_check'
    LIMIT 1
  `;
  console.log('SESSION_BINDING_CONSTRAINT=' + (constraintRows[0]?.definition || 'NOT_FOUND'));

  const compatibilityColumns = await sql`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('student_session_id', 'record_origin')
    ORDER BY table_name, column_name
  `;
  console.log('HISTORY_COMPAT_COLUMNS=' + JSON.stringify(compatibilityColumns));

  const compatibilityConstraints = await sql`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'learning_records'
      AND (
        pg_get_constraintdef(c.oid) ILIKE '%student_session_id%'
        OR pg_get_constraintdef(c.oid) ILIKE '%record_origin%'
      )
    ORDER BY c.conname
  `;
  console.log('HISTORY_COMPAT_CONSTRAINTS=' + JSON.stringify(compatibilityConstraints));

  const sessionColumns = await sql`
    SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('student_sessions', 'training_sessions')
    ORDER BY table_name, ordinal_position
  `;
  console.log('SESSION_TABLE_COLUMNS=' + JSON.stringify(sessionColumns));

  const sessionConstraints = await sql`
    SELECT t.relname AS table_name, c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN ('student_sessions', 'training_sessions')
    ORDER BY t.relname, c.conname
  `;
  console.log('SESSION_TABLE_CONSTRAINTS=' + JSON.stringify(sessionConstraints));

  const schema = await sql`
    SELECT
      to_regclass('public.learning_records')::text AS learning_records,
      to_regclass('public.learning_evidence')::text AS learning_evidence,
      to_regprocedure(
        'public.cza_student_record_learning(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb)'
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
      ts.started_at AS session_started_at,
      ts.completed_at AS session_completed_at,
      session_seed.student_user_id,
      l.teacher_id AS educator_user_id
    FROM public.training_sessions ts
    JOIN public.students s
      ON s.id = ts.student_id
     AND s.academy_id = ts.academy_id
    JOIN public.modules m
      ON m.code = ts.module_code
     AND m.is_active = true
    JOIN LATERAL (
      SELECT ss.student_user_id
      FROM public.student_sessions ss
      JOIN public.users su
        ON su.id = ss.student_user_id
       AND su.is_active = true
       AND su.role = 'student'
      WHERE ss.student_id = ts.student_id
        AND ss.academy_id = ts.academy_id
      ORDER BY ss.created_at DESC
      LIMIT 1
    ) session_seed ON true
    JOIN public.teacher_student_links l
      ON l.student_id = ts.student_id
     AND l.can_view = true
    JOIN public.users t
      ON t.id = l.teacher_id
     AND t.is_active = true
    WHERE ts.status = 'completed'
      AND ts.completed_at IS NOT NULL
    ORDER BY ts.completed_at DESC
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('REAL_HISTORY_STAGING=BLOCKED');
    console.error('REASON=NO_LINKED_STUDENT_TRAINING_SESSION_FIXTURE');
    process.exit(2);
  }

  const fixture = fixtures[0];
  const clientRecordId = crypto.randomUUID();
  const studentSessionId = crypto.randomUUID();
  const marker = 'CZA-QA-REAL-HISTORY-' + Date.now();
  const qaTokenHash = crypto.createHash('sha256').update(marker + ':session').digest('hex');
  const startedAt = new Date(fixture.session_started_at);
  const completedAt = new Date(fixture.session_completed_at);
  const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
  const performance = {
    total: 3,
    correct: 2,
    wrong: 1,
    accuracy: 67,
    durationMs,
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
        'CZA_REAL_HISTORY_QA'
      )
      RETURNING id
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
        ${JSON.stringify(performance)}::jsonb,
        ${JSON.stringify(skills)}::jsonb,
        ${JSON.stringify(metadata)}::jsonb
      )
    `,
    sql`
      SELECT id, academy_id, student_id, training_session_id, student_session_id,
             record_origin, module_code, performance, skills, metadata
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
    sql`
      DELETE FROM public.student_sessions
      WHERE id = ${studentSessionId}::uuid
        AND token_hash = ${qaTokenHash}
      RETURNING id
    `,
  ]);

  const createdSession = tx[0]?.[0];
  const first = tx[1]?.[0];
  const studentRead = tx[2]?.[0];
  const educatorRead = tx[3]?.[0];
  const replay = tx[4]?.[0];
  const deleted = tx[5] || [];
  const deletedSession = tx[6] || [];

  const checks = {
    authenticatedSessionCreated: String(createdSession?.id || '') === studentSessionId,
    firstInsert: Boolean(first?.learning_record_id) && first?.replayed === false,
    studentReadback: String(studentRead?.id || '') === String(first?.learning_record_id || ''),
    educatorReadback: String(educatorRead?.id || '') === String(first?.learning_record_id || ''),
    sameStudent: String(studentRead?.student_id || '') === String(fixture.student_id),
    sameAcademy: String(studentRead?.academy_id || '') === String(fixture.academy_id),
    sameSession: String(studentRead?.training_session_id || '') === String(fixture.training_session_id),
    sameStudentSession: String(studentRead?.student_session_id || '') === studentSessionId,
    currentOrigin: studentRead?.record_origin === 'client_reported',
    sameModule: studentRead?.module_code === fixture.module_code,
    replayed: replay?.replayed === true && String(replay?.learning_record_id || '') === String(first?.learning_record_id || ''),
    sameHash: replay?.canonical_payload_hash === first?.canonical_payload_hash,
    cleanupInTransaction: deleted.length === 1 && deletedSession.length === 1,
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
  const sessionResidue = await sql`
    SELECT count(*)::int AS count
    FROM public.student_sessions
    WHERE id = ${studentSessionId}::uuid
  `;
  if (Number(residue[0]?.count || 0) !== 0 || Number(sessionResidue[0]?.count || 0) !== 0) {
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
