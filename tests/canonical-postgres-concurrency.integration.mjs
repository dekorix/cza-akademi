import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import postgres from 'postgres';

const connectionString = process.env.CZA_TEST_DATABASE_URL;
const confirmation = process.env.CZA_TEST_DATABASE_CONFIRM;
const allowedHostSha256 = (
  process.env.CZA_ALLOWED_POSTGRES_HOST_SHA256 || ''
).trim();

if (
  !connectionString ||
  confirmation !== 'ephemeral' ||
  !/^[0-9a-f]{64}$/.test(allowedHostSha256)
) {
  throw new Error(
    'Disposable URL, explicit confirmation and one allowed host hash are required',
  );
}

const testUrl = new URL(connectionString);
const databaseName = decodeURIComponent(testUrl.pathname.slice(1));
if (!/^cza_security_test(?:_|$)/.test(databaseName)) {
  throw new Error(
    'Concurrency tests require a disposable cza_security_test_* database',
  );
}
if (testUrl.hostname.includes('-pooler.')) {
  throw new Error('Migration tests require a direct, unpooled connection');
}
const testHostHash = createHash('sha256')
  .update(testUrl.hostname.toLowerCase())
  .digest('hex');
if (allowedHostSha256 !== testHostHash) {
  throw new Error('Disposable database host must match the guarded host');
}

const migration = fs.readFileSync(
  new URL(
    '../db/migrations/20260913_canonical_learning_ledger_v1.sql',
    import.meta.url,
  ),
  'utf8',
);
const sql = postgres(connectionString, {
  max: 32,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
});

const ID = Object.freeze({
  academy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user: '10000000-0000-4000-8000-000000000001',
  student: '20000000-0000-4000-8000-000000000001',
  session: '30000000-0000-4000-8000-000000000001',
  training: '40000000-0000-4000-8000-000000000001',
  client: '60000000-0000-4000-8000-000000000010',
  tamperClient: '60000000-0000-4000-8000-000000000011',
  raceClient: '60000000-0000-4000-8000-000000000012',
  legacyRecord: '70000000-0000-4000-8000-000000000001',
  legacyClient: '60000000-0000-4000-8000-000000000001',
  legacyEvidence: '80000000-0000-4000-8000-000000000001',
});
const tokenHash = 'a'.repeat(64);
const startedAt = '2026-09-13T10:00:00.000Z';
const completedAt = '2026-09-13T10:01:00.000Z';

async function bootstrap() {
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
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
    CREATE TABLE public.learning_records (
      id uuid PRIMARY KEY,
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
      id uuid PRIMARY KEY,
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
    INSERT INTO public.academies VALUES ('${ID.academy}');
    INSERT INTO public.users VALUES ('${ID.user}', true, 'student');
    INSERT INTO public.students VALUES (
      '${ID.student}', '${ID.academy}', '${ID.user}', 'active'
    );
    INSERT INTO public.modules VALUES ('finger_read', true);
    INSERT INTO public.student_sessions (
      id, academy_id, student_id, student_user_id, token_hash, expires_at
    ) VALUES (
      '${ID.session}', '${ID.academy}', '${ID.student}', '${ID.user}',
      '${tokenHash}', now() + interval '1 day'
    );
    INSERT INTO public.training_sessions VALUES (
      '${ID.training}', '${ID.academy}', '${ID.student}', 'finger_read',
      '${startedAt}', NULL
    );
    INSERT INTO public.learning_records (
      id, academy_id, student_id, module_code, training_session_id,
      client_record_id, payload_hash, contract_version, schema_version,
      module_version, activity_type, started_at, completed_at, support_level,
      performance, skills, metadata
    ) VALUES (
      '${ID.legacyRecord}', '${ID.academy}', '${ID.student}', 'finger_read',
      '${ID.training}', '${ID.legacyClient}', '${'0'.repeat(64)}', '1.0.0',
      'CZA_MODULE_RECORD_V1', '1.0.0', 'number_recognition',
      '${startedAt}', '${completedAt}', 'independent', '{"correct":8}',
      '["number_recognition"]', '{}'
    );
    INSERT INTO public.learning_evidence (
      id, learning_record_id, academy_id, student_id, evidence_type,
      skill_code, support_level, observed_at, payload
    ) VALUES (
      '${ID.legacyEvidence}', '${ID.legacyRecord}', '${ID.academy}',
      '${ID.student}', 'skill_observation', 'number_recognition',
      'independent', '${completedAt}', '{}'
    );
  `);
  await sql.unsafe(migration);
  const afterFirstMigration = await sql`
    SELECT student_session_id, record_origin, verification_status
    FROM public.learning_records
    WHERE id = ${ID.legacyRecord}::uuid
  `;
  assert.equal(afterFirstMigration[0].student_session_id, ID.session);
  assert.equal(afterFirstMigration[0].record_origin, 'legacy_client_reported');
  assert.equal(afterFirstMigration[0].verification_status, 'client_reported');

  const evidenceAfterFirstMigration = await sql`
    SELECT verification_status, verification_authority
    FROM public.learning_evidence
    WHERE id = ${ID.legacyEvidence}::uuid
  `;
  assert.deepEqual(evidenceAfterFirstMigration[0], {
    verification_status: 'legacy_client_reported',
    verification_authority: 'legacy_unverified_import',
  });

  await sql.unsafe(migration);
  const afterSecondMigration = await sql`
    SELECT count(*)::integer AS count
    FROM public.learning_records
    WHERE id = ${ID.legacyRecord}::uuid
  `;
  assert.equal(afterSecondMigration[0].count, 1);
}

async function withRuntimeRole(callback) {
  return sql.begin(async (transaction) => {
    await transaction.unsafe('SET LOCAL ROLE cza_app_runtime');
    return callback(transaction);
  });
}

function ingest(connection, clientId, performance = '{"correct":8}') {
  return connection`
    SELECT * FROM public.cza_student_record_learning(
      ${ID.academy}::uuid,
      ${ID.student}::uuid,
      ${ID.session}::uuid,
      ${ID.training}::uuid,
      ${clientId}::uuid,
      'module_record'::text,
      '1.1.0'::text,
      'CZA_MODULE_RECORD_V1'::text,
      'finger_read'::text,
      '1.0.0'::text,
      'number_recognition'::text,
      ${startedAt}::timestamptz,
      ${completedAt}::timestamptz,
      'independent'::text,
      ${performance}::jsonb,
      '["number_recognition"]'::jsonb,
      '{}'::jsonb
    )
  `;
}

test('real PostgreSQL parallel limiter, idempotency and logout races', async () => {
  await bootstrap();
  try {
    const currentRole = await sql`SELECT current_user`;
    await sql`GRANT cza_app_runtime TO ${sql(currentRole[0].current_user)}`;

    const rateResults = await Promise.all(
      Array.from(
        { length: 50 },
        () => sql`
        SELECT * FROM public.cza_consume_rate_limit(
          'parallel-test', ${'d'.repeat(64)}, 17, 60
        )
      `,
      ),
    );
    assert.equal(rateResults.filter((rows) => rows[0].allowed).length, 17);
    assert.equal(rateResults.filter((rows) => !rows[0].allowed).length, 33);
    const storedCount = await sql`
      SELECT request_count
      FROM public.api_rate_limit_windows
      WHERE scope = 'parallel-test'
    `;
    assert.equal(storedCount[0].request_count, 18);

    const idempotent = await Promise.all(
      Array.from({ length: 20 }, () => ingest(sql, ID.client)),
    );
    assert.equal(idempotent.filter((rows) => !rows[0].replayed).length, 1);
    assert.equal(idempotent.filter((rows) => rows[0].replayed).length, 19);
    assert.equal(
      new Set(idempotent.map((rows) => rows[0].learning_record_id)).size,
      1,
    );

    const tamper = await Promise.allSettled([
      ingest(sql, ID.tamperClient, '{"correct":8}'),
      ingest(sql, ID.tamperClient, '{"correct":7}'),
    ]);
    assert.equal(
      tamper.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      tamper.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.match(
      String(tamper.find((result) => result.status === 'rejected').reason),
      /IDEMPOTENCY_KEY_REUSED/,
    );

    await assert.rejects(
      withRuntimeRole(
        (runtime) => runtime`
        INSERT INTO public.learning_evidence (
          learning_record_id, academy_id, student_id, evidence_type,
          verification_status, verification_authority, skill_code,
          support_level, observed_at, payload
        ) VALUES (
          ${idempotent[0][0].learning_record_id}::uuid, ${ID.academy}::uuid,
          ${ID.student}::uuid, 'skill_observation', 'server_verified',
          'runtime-forbidden', 'number_recognition', 'independent',
          ${completedAt}::timestamptz, '{}'::jsonb
        )
      `,
      ),
      /permission denied/i,
    );
    await assert.rejects(
      withRuntimeRole(
        (runtime) => runtime`
        SELECT public.cza_append_verified_evidence(
          ${idempotent[0][0].learning_record_id}::uuid,
          'skill_observation', 'number_recognition', 'independent',
          ${completedAt}::timestamptz, 'runtime-forbidden', '{}'::jsonb
        )
      `,
      ),
      /permission denied/i,
    );
    await assert.rejects(
      withRuntimeRole(
        (runtime) => runtime`
        UPDATE public.learning_records
        SET metadata = '{"tampered":true}'::jsonb
        WHERE id = ${idempotent[0][0].learning_record_id}::uuid
      `,
      ),
      /permission denied/i,
    );

    let markLocked;
    let releaseLock;
    const locked = new Promise((resolve) => {
      markLocked = resolve;
    });
    const release = new Promise((resolve) => {
      releaseLock = resolve;
    });

    const ingestTransaction = sql.begin(async (transaction) => {
      const rows = await ingest(transaction, ID.raceClient);
      markLocked();
      await release;
      return rows;
    });
    await locked;

    let logoutCompleted = false;
    const logout = sql`
      SELECT public.cza_revoke_student_session(${tokenHash})
    `.then((result) => {
      logoutCompleted = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(logoutCompleted, false);

    releaseLock();
    const [accepted] = await ingestTransaction;
    assert.equal(accepted.replayed, false);
    await logout;

    await assert.rejects(
      ingest(sql, '60000000-0000-4000-8000-000000000013'),
      /CZA_STUDENT_SESSION_REVOKED/,
    );
  } finally {
    const cleanupRole = await sql`SELECT current_user`.catch(() => []);
    if (cleanupRole[0]?.current_user) {
      await sql`
        REVOKE cza_app_runtime FROM ${sql(cleanupRole[0].current_user)}
      `.catch(() => {});
    }
    await sql
      .unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      DROP ROLE IF EXISTS cza_app_runtime;
      DROP ROLE IF EXISTS cza_evidence_verifier;
      DROP ROLE IF EXISTS cza_ledger_reader;
    `)
      .catch(() => {});
    await sql.end({ timeout: 5 });
  }
});
