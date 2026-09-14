import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migration = fs.readFileSync(
  new URL(
    '../db/migrations/20260913_canonical_learning_ledger_v1.sql',
    import.meta.url,
  ),
  'utf8',
);

const ID = Object.freeze({
  academy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user1: '10000000-0000-4000-8000-000000000001',
  user2: '10000000-0000-4000-8000-000000000002',
  student1: '20000000-0000-4000-8000-000000000001',
  student2: '20000000-0000-4000-8000-000000000002',
  session1: '30000000-0000-4000-8000-000000000001',
  training1: '40000000-0000-4000-8000-000000000001',
  training2: '40000000-0000-4000-8000-000000000002',
  record1: '50000000-0000-4000-8000-000000000001',
  record2: '50000000-0000-4000-8000-000000000002',
  client1: '60000000-0000-4000-8000-000000000001',
  client2: '60000000-0000-4000-8000-000000000002',
  client3: '60000000-0000-4000-8000-000000000003',
  evidence1: '70000000-0000-4000-8000-000000000001',
});

const startedAt = '2026-09-13T10:00:00.000Z';
const completedAt = '2026-09-13T10:01:00.000Z';
const tokenHash = 'a'.repeat(64);

async function upgradedDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    CREATE EXTENSION pgcrypto;
    CREATE TABLE public.academies (id uuid PRIMARY KEY);
    CREATE TABLE public.users (
      id uuid PRIMARY KEY,
      is_active boolean NOT NULL,
      role text NOT NULL
    );
    CREATE TABLE public.students (
      id uuid PRIMARY KEY,
      academy_id uuid NOT NULL,
      user_id uuid NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE public.modules (
      code text PRIMARY KEY,
      is_active boolean NOT NULL
    );
    CREATE TABLE public.student_sessions (
      id uuid PRIMARY KEY,
      academy_id uuid NOT NULL,
      student_id uuid NOT NULL,
      student_user_id uuid NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.training_sessions (
      id uuid PRIMARY KEY,
      academy_id uuid NOT NULL,
      student_id uuid NOT NULL,
      module_code text NOT NULL,
      started_at timestamptz NOT NULL,
      completed_at timestamptz NULL
    );

    INSERT INTO public.academies VALUES ('${ID.academy}');
    INSERT INTO public.users VALUES
      ('${ID.user1}', true, 'student'),
      ('${ID.user2}', true, 'student');
    INSERT INTO public.students VALUES
      ('${ID.student1}', '${ID.academy}', '${ID.user1}', 'active'),
      ('${ID.student2}', '${ID.academy}', '${ID.user2}', 'active');
    INSERT INTO public.modules VALUES ('finger_read', true);
    INSERT INTO public.student_sessions (
      id, academy_id, student_id, student_user_id, token_hash,
      expires_at, created_at
    ) VALUES (
      '${ID.session1}', '${ID.academy}', '${ID.student1}', '${ID.user1}',
      '${tokenHash}', now() + interval '1 day', '${startedAt}'::timestamptz - interval '1 minute'
    );
    INSERT INTO public.training_sessions VALUES
      ('${ID.training1}', '${ID.academy}', '${ID.student1}', 'finger_read', '${startedAt}', NULL),
      ('${ID.training2}', '${ID.academy}', '${ID.student2}', 'finger_read', '${startedAt}', NULL);

    -- Exact PR #31 table shapes and index names.
    CREATE TABLE public.learning_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
      module_code text NOT NULL REFERENCES public.modules(code),
      training_session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
      client_record_id uuid NOT NULL,
      payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
      record_type text NOT NULL DEFAULT 'module_record' CHECK (record_type = 'module_record'),
      contract_version text NOT NULL,
      schema_version text NOT NULL CHECK (schema_version = 'CZA_MODULE_RECORD_V1'),
      module_version text NOT NULL,
      activity_type text NOT NULL,
      started_at timestamptz NOT NULL,
      completed_at timestamptz NOT NULL,
      support_level text NOT NULL,
      performance jsonb NOT NULL DEFAULT '{}'::jsonb,
      skills jsonb NOT NULL DEFAULT '[]'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (completed_at >= started_at),
      UNIQUE (academy_id, client_record_id),
      UNIQUE (id, academy_id, student_id)
    );
    CREATE INDEX idx_learning_records_student_completed
      ON public.learning_records(student_id, completed_at DESC);
    CREATE INDEX idx_learning_records_session
      ON public.learning_records(training_session_id, created_at);
    CREATE INDEX idx_learning_records_module_student
      ON public.learning_records(module_code, student_id, completed_at DESC);

    CREATE TABLE public.learning_evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      learning_record_id uuid NOT NULL,
      academy_id uuid NOT NULL,
      student_id uuid NOT NULL,
      evidence_type text NOT NULL,
      skill_code text NULL,
      support_level text NOT NULL,
      observed_at timestamptz NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT learning_evidence_record_identity_fkey
        FOREIGN KEY (learning_record_id, academy_id, student_id)
        REFERENCES public.learning_records(id, academy_id, student_id)
        ON DELETE CASCADE
    );
    CREATE INDEX idx_learning_evidence_student_observed
      ON public.learning_evidence(student_id, observed_at DESC);
    CREATE INDEX idx_learning_evidence_skill_student
      ON public.learning_evidence(skill_code, student_id, observed_at DESC)
      WHERE skill_code IS NOT NULL;
  `);

  const legacyHash = await db.query(`
    SELECT encode(
      digest(
        convert_to(
          jsonb_build_object(
            'academyId', '${ID.academy}'::uuid,
            'studentId', '${ID.student1}'::uuid,
            'trainingSessionId', '${ID.training1}'::uuid,
            'clientRecordId', '${ID.client1}'::uuid,
            'recordType', 'module_record'::text,
            'contractVersion', '1.0.0'::text,
            'schemaVersion', 'CZA_MODULE_RECORD_V1'::text,
            'moduleId', 'finger_read'::text,
            'moduleVersion', '1.0.0'::text,
            'activityType', 'number_recognition'::text,
            'startedAt', '${startedAt}'::timestamptz,
            'completedAt', '${completedAt}'::timestamptz,
            'supportLevel', 'independent'::text,
            'performance', '{"correct":8}'::jsonb,
            'skills', '["number_recognition"]'::jsonb,
            'metadata', '{}'::jsonb
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) AS hash
  `);

  await db.exec(`
    INSERT INTO public.learning_records (
      id, academy_id, student_id, module_code, training_session_id,
      client_record_id, payload_hash, record_type, contract_version,
      schema_version, module_version, activity_type, started_at, completed_at,
      support_level, performance, skills, metadata, created_at
    ) VALUES
      (
        '${ID.record1}', '${ID.academy}', '${ID.student1}', 'finger_read',
        '${ID.training1}', '${ID.client1}', '${legacyHash.rows[0].hash}',
        'module_record', '1.0.0', 'CZA_MODULE_RECORD_V1', '1.0.0',
        'number_recognition', '${startedAt}', '${completedAt}', 'independent',
        '{"correct":8}', '["number_recognition"]', '{}', '${completedAt}'
      ),
      (
        '${ID.record2}', '${ID.academy}', '${ID.student2}', 'finger_read',
        '${ID.training2}', '${ID.client2}', '${'0'.repeat(64)}',
        'module_record', '1.0.0', 'CZA_MODULE_RECORD_V1', '1.0.0',
        'number_recognition', '${startedAt}', '${completedAt}', 'guided',
        '{}', '[]', '{}', '${completedAt}'
      );
    INSERT INTO public.learning_evidence (
      id, learning_record_id, academy_id, student_id, evidence_type,
      skill_code, support_level, observed_at, payload
    ) VALUES (
      '${ID.evidence1}', '${ID.record1}', '${ID.academy}', '${ID.student1}',
      'skill_observation', 'number_recognition', 'independent', '${completedAt}', '{}'
    );
  `);

  await db.exec(migration);
  return db;
}

async function withRole(db, role, operation) {
  await db.exec(`SET ROLE ${role}`);
  try {
    return await operation();
  } finally {
    await db.exec('RESET ROLE');
  }
}

const recordCall = ({
  clientId = ID.client3,
  contractVersion = '1.1.0',
  supportLevel = 'independent',
} = {}) => `
  SELECT * FROM public.cza_student_record_learning(
    '${ID.academy}', '${ID.student1}', '${ID.session1}', '${ID.training1}',
    '${clientId}', 'module_record', '${contractVersion}', 'CZA_MODULE_RECORD_V1',
    'finger_read', '1.0.0', 'number_recognition', '${startedAt}', '${completedAt}',
    '${supportLevel}', '{"correct":8}', '["number_recognition"]', '{}'
  )
`;

test('real PostgreSQL engine upgrades populated PR31 schema without data loss', async () => {
  const db = await upgradedDatabase();
  try {
    const records = await db.query(`
      SELECT id, student_session_id, record_origin
      FROM public.learning_records
      ORDER BY id
    `);
    assert.equal(records.rows.length, 2);
    assert.equal(records.rows[0].student_session_id, ID.session1);
    assert.equal(records.rows[0].record_origin, 'legacy_client_reported');
    assert.equal(records.rows[1].student_session_id, null);
    assert.equal(records.rows[1].record_origin, 'legacy_client_reported');

    const evidence = await db.query(`
      SELECT verification_status, verification_authority
      FROM public.learning_evidence
      WHERE id = '${ID.evidence1}'
    `);
    assert.deepEqual(evidence.rows[0], {
      verification_status: 'legacy_client_reported',
      verification_authority: 'legacy_unverified_import',
    });

    const indexes = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('learning_records', 'learning_evidence')
    `);
    assert.equal(
      indexes.rows.some(
        (row) => row.indexname === 'idx_learning_records_student_completed',
      ),
      false,
    );
    assert.equal(
      indexes.rows.some((row) =>
        row.indexdef.includes('(academy_id, student_id, completed_at DESC)'),
      ),
      true,
    );
  } finally {
    await db.close();
  }
});

test('database roles enforce telemetry/evidence separation and immutability', async () => {
  const db = await upgradedDatabase();
  try {
    const inserted = await withRole(db, 'cza_app_runtime', () =>
      db.query(recordCall()),
    );
    assert.equal(inserted.rows[0].replayed, false);
    assert.equal(inserted.rows[0].verification_status, 'client_reported');

    await assert.rejects(
      withRole(db, 'cza_app_runtime', () =>
        db.exec(`
          INSERT INTO public.learning_evidence (
            learning_record_id, academy_id, student_id, evidence_type,
            verification_status, verification_authority, skill_code,
            support_level, observed_at, payload
          ) VALUES (
            '${inserted.rows[0].learning_record_id}', '${ID.academy}', '${ID.student1}',
            'activity_result', 'server_verified', 'forged_client', NULL,
            'independent', now(), '{}'
          )
        `),
      ),
      /permission denied/i,
    );

    const verified = await withRole(db, 'cza_evidence_verifier', () =>
      db.query(`
        SELECT public.cza_append_verified_evidence(
          '${inserted.rows[0].learning_record_id}', 'skill_observation',
          'number_recognition', 'independent', now(),
          'assessment_service:v1', '{"score":8}'
        ) AS id
      `),
    );
    assert.match(verified.rows[0].id, /^[0-9a-f-]{36}$/);

    await assert.rejects(
      db.exec(
        `UPDATE public.learning_records SET metadata = '{"tampered":true}'`,
      ),
      /CZA_IMMUTABLE_LEDGER/,
    );
    await assert.rejects(
      db.exec(`DELETE FROM public.learning_evidence`),
      /CZA_IMMUTABLE_LEDGER/,
    );
    await assert.rejects(
      db.exec(`TRUNCATE public.learning_records`),
      /CZA_IMMUTABLE_LEDGER|referenced in a foreign key constraint/,
    );
    await assert.rejects(
      db.exec(`TRUNCATE public.learning_evidence`),
      /CZA_IMMUTABLE_LEDGER/,
    );
    await assert.rejects(
      db.exec(
        `DELETE FROM public.training_sessions WHERE id = '${ID.training1}'`,
      ),
      /violates (?:RESTRICT setting of )?foreign key constraint/i,
    );
  } finally {
    await db.close();
  }
});

test('legacy hash replay remains valid and tampered replay returns conflict', async () => {
  const db = await upgradedDatabase();
  try {
    const replay = await withRole(db, 'cza_app_runtime', () =>
      db.query(recordCall({ clientId: ID.client1, contractVersion: '1.0.0' })),
    );
    assert.equal(replay.rows[0].replayed, true);
    assert.equal(replay.rows[0].learning_record_id, ID.record1);

    await assert.rejects(
      withRole(db, 'cza_app_runtime', () =>
        db.query(
          recordCall({
            clientId: ID.client1,
            contractVersion: '1.0.0',
            supportLevel: 'guided',
          }),
        ),
      ),
      /IDEMPOTENCY_KEY_REUSED/,
    );
  } finally {
    await db.close();
  }
});

test('distributed limiter counts atomically and globally prunes expired subjects', async () => {
  const db = await upgradedDatabase();
  try {
    await db.exec(`
      INSERT INTO public.api_rate_limit_windows
        (scope, subject_hash, window_started_at, request_count, expires_at)
      VALUES
        ('old-subject', '${'b'.repeat(64)}', now() - interval '2 minutes', 1, now() - interval '1 minute')
    `);

    const decisions = [];
    await withRole(db, 'cza_app_runtime', async () => {
      for (let index = 0; index < 3; index += 1) {
        const result = await db.query(`
          SELECT * FROM public.cza_consume_rate_limit(
            'student-login', '${'c'.repeat(64)}', 2, 60
          )
        `);
        decisions.push(result.rows[0].allowed);
      }
    });
    assert.deepEqual(decisions, [true, true, false]);

    const expired = await db.query(`
      SELECT count(*)::integer AS count
      FROM public.api_rate_limit_windows
      WHERE expires_at <= now()
    `);
    assert.equal(expired.rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('trusted proxy nonces are globally single-use and inaccessible to runtime SQL', async () => {
  const db = await upgradedDatabase();
  const nonceHash = 'd'.repeat(64);
  try {
    const first = await withRole(db, 'cza_app_runtime', () =>
      db.query(`
        SELECT public.cza_consume_trusted_proxy_nonce(
          '${nonceHash}', now() + interval '2 minutes'
        ) AS consumed
      `),
    );
    const replay = await withRole(db, 'cza_app_runtime', () =>
      db.query(`
        SELECT public.cza_consume_trusted_proxy_nonce(
          '${nonceHash}', now() + interval '2 minutes'
        ) AS consumed
      `),
    );
    assert.equal(first.rows[0].consumed, true);
    assert.equal(replay.rows[0].consumed, false);

    await assert.rejects(
      withRole(db, 'cza_app_runtime', () =>
        db.exec(`
          INSERT INTO public.trusted_proxy_nonces (nonce_hash, expires_at)
          VALUES ('${'e'.repeat(64)}', now() + interval '2 minutes')
        `),
      ),
      /permission denied/i,
    );

    await db.exec(migration);
    const retained = await db.query(`
      SELECT count(*)::integer AS count
      FROM public.trusted_proxy_nonces
      WHERE nonce_hash = '${nonceHash}'
    `);
    assert.equal(retained.rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('authentication touch and revocation are atomic database operations', async () => {
  const db = await upgradedDatabase();
  try {
    const active = await withRole(db, 'cza_app_runtime', () =>
      db.query(
        `SELECT * FROM public.cza_touch_authenticated_student('${tokenHash}')`,
      ),
    );
    assert.equal(active.rows[0].session_id, ID.session1);

    await withRole(db, 'cza_app_runtime', () =>
      db.query(`SELECT public.cza_revoke_student_session('${tokenHash}')`),
    );
    const revoked = await withRole(db, 'cza_app_runtime', () =>
      db.query(
        `SELECT * FROM public.cza_touch_authenticated_student('${tokenHash}')`,
      ),
    );
    assert.equal(revoked.rows.length, 0);

    await assert.rejects(
      withRole(db, 'cza_app_runtime', () => db.query(recordCall())),
      /CZA_STUDENT_SESSION_REVOKED/,
    );
  } finally {
    await db.close();
  }
});
