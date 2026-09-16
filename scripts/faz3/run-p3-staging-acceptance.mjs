#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import readline from 'node:readline';
import postgres from 'postgres';
import { createServer } from 'vite';

const ALLOWED_STAGING_HOSTS = new Set([
  'ep-winter-mode-b2djq0wx.c-6.eu-central-1.aws.neon.tech',
  'ep-winter-mode-b2djq0wx-pooler.c-6.eu-central-1.aws.neon.tech',
]);
const DEMO = Object.freeze({
  academyId: 'a3000000-0000-4000-8000-000000000001',
  studentId: '23000000-0000-4000-8000-000000000001',
  sessionId: '33000000-0000-4000-8000-000000000001',
  trainingId: '43000000-0000-4000-8000-000000000001',
  clientRecordId: '63000000-0000-4000-8000-000000000002',
  rollbackTrainingId: '43000000-0000-4000-8000-000000000098',
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function readSecretLine() {
  const input = readline.createInterface({ input: process.stdin, terminal: false });
  for await (const line of input) {
    input.close();
    return line.trim();
  }
  return '';
}

function canonicalRecord(correct = true) {
  return {
    recordType: 'module_record',
    schemaVersion: 'CZA_MODULE_RECORD_V1',
    contractVersion: '1.1.0',
    clientRecordId: DEMO.clientRecordId,
    trainingSessionId: DEMO.trainingId,
    moduleId: 'finger_read',
    moduleVersion: '1.0.0',
    activityType: 'number_recognition',
    startedAt: '2026-09-16T19:22:00.000Z',
    completedAt: '2026-09-16T19:23:00.000Z',
    supportLevel: 'independent',
    performance: {
      correct,
      expected: 10,
      given: correct ? 10 : 9,
      errorType: correct ? 'OK' : 'RESPONSE_ERROR',
      demo: true,
    },
    skills: ['number_recognition', 'visual_attention'],
    metadata: {
      dataClass: 'synthetic_demo',
      p1RunId: 35134327735,
      p1WalRunId: '01K2ANG8T31E2F3713704CD2B4',
    },
  };
}

function request(record, token = '') {
  return new Request('https://staging.cza.invalid/api/core', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cza-contract-version': '1.1.0',
      'x-real-ip': '192.0.2.33',
      ...(token ? { cookie: `cza_student_session=${encodeURIComponent(token)}` } : {}),
    },
    body: JSON.stringify({ action: 'module_record', record }),
  });
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) fail('P3_OUTPUT_PATH_REQUIRED');

  const connectionString = await readSecretLine();
  if (!connectionString) fail('P3_DATABASE_URL_REQUIRED');
  const databaseUrl = new URL(connectionString);
  if (!ALLOWED_STAGING_HOSTS.has(databaseUrl.hostname)) {
    fail('P3_DATABASE_HOST_NOT_APPROVED_STAGING');
  }
  if (databaseUrl.hostname.includes('pooler')) {
    fail('P3_DIRECT_DATABASE_URL_REQUIRED');
  }

  const sessionToken = randomBytes(32).toString('base64url');
  const sessionTokenHash = createHash('sha256').update(sessionToken).digest('hex');
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = connectionString;

  const sql = postgres(connectionString, {
    max: 4,
    connect_timeout: 10,
    idle_timeout: 5,
    prepare: false,
  });
  let vite;
  try {
    const health = await sql`
      SELECT current_database() AS database,
             current_setting('server_version') AS server_version,
             pg_is_in_recovery() AS replica
    `;
    await sql`
      UPDATE public.student_sessions
      SET token_hash = ${sessionTokenHash},
          expires_at = clock_timestamp() + interval '1 day',
          revoked_at = NULL
      WHERE id = ${DEMO.sessionId}::uuid
        AND academy_id = ${DEMO.academyId}::uuid
        AND student_id = ${DEMO.studentId}::uuid
    `;

    vite = await createServer({
      root: process.cwd(),
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      resolve: { alias: { '@': process.cwd() } },
    });
    const route = await vite.ssrLoadModule('/app/api/core/route.ts');
    const record = canonicalRecord(true);

    const unauthorized = await route.POST(request(record));
    const unauthorizedBody = await unauthorized.json();
    if (unauthorized.status !== 401 || unauthorizedBody.error !== 'session_required') {
      fail('P3_UNAUTHORIZED_REQUEST_NOT_REJECTED');
    }

    const first = await route.POST(request(record, sessionToken));
    const firstBody = await first.json();
    if (first.status !== 201 || firstBody.ok !== true || firstBody.replayed !== false) {
      fail('P3_APPLICATION_WRITE_FAILED');
    }

    const replay = await route.POST(request(record, sessionToken));
    const replayBody = await replay.json();
    if (replay.status !== 200 || replayBody.replayed !== true) {
      fail('P3_APPLICATION_IDEMPOTENCY_FAILED');
    }

    const conflict = await route.POST(request(canonicalRecord(false), sessionToken));
    const conflictBody = await conflict.json();
    if (conflict.status !== 409 || conflictBody.error !== 'IDEMPOTENCY_KEY_REUSED') {
      fail('P3_APPLICATION_DUPLICATE_CONFLICT_FAILED');
    }

    try {
      await sql.begin(async transaction => {
        await transaction`
          INSERT INTO public.training_sessions (
            id, academy_id, student_id, module_code, status, started_at
          ) VALUES (
            ${DEMO.rollbackTrainingId}::uuid,
            ${DEMO.academyId}::uuid,
            ${DEMO.studentId}::uuid,
            'finger_read', 'active', clock_timestamp()
          )
        `;
        throw new Error('P3_EXPECTED_ROLLBACK');
      });
    } catch (error) {
      if (error?.message !== 'P3_EXPECTED_ROLLBACK') throw error;
    }
    const rollbackRows = await sql`
      SELECT count(*)::integer AS count
      FROM public.training_sessions
      WHERE id = ${DEMO.rollbackTrainingId}::uuid
    `;
    if (rollbackRows[0]?.count !== 0) fail('P3_TRANSACTION_ROLLBACK_FAILED');

    const history = await sql`
      SELECT records.id, records.client_record_id, records.activity_type,
             records.verification_status, records.completed_at,
             records.performance
      FROM public.learning_records AS records
      WHERE records.academy_id = ${DEMO.academyId}::uuid
        AND records.student_id = ${DEMO.studentId}::uuid
      ORDER BY records.completed_at, records.id
    `;
    const privileges = await sql`
      SELECT
        has_table_privilege('cza_app_runtime', 'public.learning_records', 'SELECT') AS runtime_direct_select,
        has_function_privilege(
          'cza_app_runtime',
          'public.cza_student_record_learning(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb)',
          'EXECUTE'
        ) AS runtime_append,
        has_function_privilege(
          'cza_app_runtime',
          'public.cza_append_verified_evidence(uuid,text,text,text,timestamptz,text,jsonb)',
          'EXECUTE'
        ) AS runtime_evidence_append
    `;

    const observation = {
      schemaVersion: 'CZA-FAZ3-P3-LIVE-OBSERVATION-V1',
      observedAt: new Date().toISOString(),
      target: {
        environment: 'staging',
        projectId: 'orange-resonance-01270480',
        branchId: 'br-lucky-rain-b2po93vx',
        database: health[0].database,
        host: databaseUrl.hostname,
      },
      health: {
        connected: true,
        serverVersion: health[0].server_version,
        primary: health[0].replica === false,
      },
      application: {
        route: 'POST /api/core',
        unauthorizedStatus: unauthorized.status,
        unauthorizedError: unauthorizedBody.error,
        createStatus: first.status,
        replayStatus: replay.status,
        conflictStatus: conflict.status,
        learningRecordId: firstBody.learningRecordId,
        payloadHash: firstBody.payloadHash,
        verificationStatus: firstBody.verificationStatus,
      },
      transactionRollback: {
        passed: true,
        residualRows: rollbackRows[0].count,
      },
      authorization: {
        runtimeDirectSelect: privileges[0].runtime_direct_select,
        runtimeAppendFunction: privileges[0].runtime_append,
        runtimeEvidenceAppendFunction: privileges[0].runtime_evidence_append,
      },
      demoData: {
        classification: 'synthetic_demo',
        academyId: DEMO.academyId,
        studentId: DEMO.studentId,
        trainingSessionId: DEMO.trainingId,
        historyEntryCount: history.length,
        allEntriesSynthetic: history.every(row => row.performance?.demo === true),
      },
      productionAccessed: false,
      productionMutation: false,
    };
    await writeFile(outputPath, `${JSON.stringify(observation, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(`${JSON.stringify({ result: 'PASS', observation: outputPath })}\n`);
  } finally {
    if (vite) await vite.close();
    await sql.end({ timeout: 5 });
    delete process.env.DATABASE_URL;
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ result: 'FAIL', error: error?.code || 'P3_LIVE_ACCEPTANCE_FAILED' })}\n`);
  process.exitCode = 1;
}
