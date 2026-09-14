import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function importTypeScript(relativePath) {
  const source = fs.readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
  );
}

const security = await importTypeScript('../lib/core-request-security.ts');
const contract = await importTypeScript('../lib/learning-contract-server.ts');
const addressSecurity = await importTypeScript(
  '../lib/trusted-client-address.ts',
);
const route = fs.readFileSync(
  new URL('../app/api/core/route.ts', import.meta.url),
  'utf8',
);
const session = fs.readFileSync(
  new URL('../lib/student-session.ts', import.meta.url),
  'utf8',
);
const repository = fs.readFileSync(
  new URL('../lib/persistence/canonical-repository.ts', import.meta.url),
  'utf8',
);
const guard = fs.readFileSync(
  new URL('../lib/request-guard.ts', import.meta.url),
  'utf8',
);
const migration = fs.readFileSync(
  new URL(
    '../db/migrations/20260913_canonical_learning_ledger_v1.sql',
    import.meta.url,
  ),
  'utf8',
);

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

test('strict action schemas reject unknown, missing and cross-action root fields', () => {
  assert.deepEqual(security.parseCoreRequest({ action: 'me' }), {
    action: 'me',
  });
  assert.deepEqual(
    security.parseCoreRequest({
      action: 'login',
      username: 'student',
      pin: '1234',
    }),
    { action: 'login', username: 'student', pin: '1234' },
  );
  assert.throws(
    () => security.parseCoreRequest({ action: 'me', admin: true }),
    (error) => error.code === 'invalid_request_schema',
  );
  assert.throws(
    () => security.parseCoreRequest({ action: 'login', username: 'student' }),
    (error) => error.code === 'invalid_request_schema',
  );
  assert.throws(
    () =>
      security.parseCoreRequest({
        action: 'logout',
        sessionToken: 'attacker-value',
      }),
    (error) => error.code === 'invalid_request_schema',
  );
  const polluted = JSON.parse(
    '{"action":"attempt","sessionId":"11111111-1111-4111-8111-111111111111","payload":{"__proto__":{"admin":true}}}',
  );
  assert.throws(
    () => security.parseCoreRequest(polluted),
    (error) => error.code === 'invalid_request_schema',
  );
  assert.throws(
    () => security.parseCoreRequest({ action: 'unknown' }),
    (error) => error.code === 'invalid_action',
  );
});

test('valid state-changing action is normalized and bounded', () => {
  const parsed = security.parseCoreRequest({
    action: 'start',
    moduleCode: 'finger_read',
    source: 'free_practice',
    clientSessionId: UUID_A,
    recipeId: null,
    settings: { rounds: 10 },
  });
  assert.equal(parsed.moduleCode, 'finger_read');
  assert.equal(parsed.clientSessionId, UUID_A);
  assert.throws(
    () =>
      security.parseCoreRequest({ ...parsed, settings: { nested: Infinity } }),
    (error) => error.code === 'invalid_request_schema',
  );
});

test('stream reader stops oversized chunked bodies before JSON parsing', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('{"action":"me","padding":"'));
      controller.enqueue(new Uint8Array(128));
      controller.close();
    },
  });
  await assert.rejects(
    security.readBoundedJson(
      {
        headers: new Headers({ 'content-type': 'application/json' }),
        body,
      },
      64,
    ),
    (error) => error.code === 'request_too_large' && error.status === 413,
  );
});

test('stream reader enforces media type, declared size and valid JSON', async () => {
  await assert.rejects(
    security.readBoundedJson(
      {
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: new Blob(['{}']).stream(),
      },
      64,
    ),
    (error) => error.code === 'unsupported_media_type' && error.status === 415,
  );
  await assert.rejects(
    security.readBoundedJson(
      {
        headers: new Headers({
          'content-type': 'application/json',
          'content-length': '65',
        }),
        body: new Blob(['{}']).stream(),
      },
      64,
    ),
    (error) => error.code === 'request_too_large' && error.status === 413,
  );
  const parsed = await security.readBoundedJson(
    {
      headers: new Headers({
        'content-type': 'application/json; charset=utf-8',
      }),
      body: new Blob(['{"action":"me"}']).stream(),
    },
    64,
  );
  assert.deepEqual(parsed, { action: 'me' });
});

test('Core upstream configuration fails closed and requires HTTPS allowlisting', () => {
  assert.throws(
    () => security.configuredCoreUrl({}),
    (error) =>
      error.code === 'core_configuration_unavailable' && error.status === 503,
  );
  assert.throws(
    () =>
      security.configuredCoreUrl({
        CZA_CORE_API_URL: 'http://core.example.test/',
        CZA_CORE_API_ALLOWED_HOSTS: 'core.example.test',
      }),
    (error) => error.code === 'core_configuration_unavailable',
  );
  assert.throws(
    () =>
      security.configuredCoreUrl({
        CZA_CORE_API_URL: 'https://evil.example.test/',
        CZA_CORE_API_ALLOWED_HOSTS: 'core.example.test',
      }),
    (error) => error.code === 'core_configuration_unavailable',
  );
  assert.equal(
    security.configuredCoreUrl({
      CZA_CORE_API_URL: 'https://core.example.test/v1',
      CZA_CORE_API_ALLOWED_HOSTS: 'core.example.test',
    }),
    'https://core.example.test/v1',
  );
});

test('canonical telemetry rejects header omission, identity injection and time tampering', () => {
  const now = Date.now();
  const record = {
    recordType: 'module_record',
    schemaVersion: 'CZA_MODULE_RECORD_V1',
    contractVersion: '1.0.0',
    clientRecordId: UUID_A,
    trainingSessionId: UUID_B,
    moduleId: 'finger_read',
    moduleVersion: '1.0.0',
    activityType: 'number_recognition',
    startedAt: new Date(now - 10_000).toISOString(),
    completedAt: new Date(now).toISOString(),
    supportLevel: 'independent',
    performance: { correct: 8, total: 10 },
    skills: ['number_recognition'],
    metadata: {},
  };
  assert.equal(
    contract.parseCanonicalLearningRecord(record, '1.0.0').moduleId,
    'finger_read',
  );
  assert.throws(
    () => contract.parseCanonicalLearningRecord(record, null),
    /cza_contract_header_mismatch/,
  );
  assert.throws(
    () =>
      contract.parseCanonicalLearningRecord(
        { ...record, studentId: UUID_A },
        '1.0.0',
      ),
    /cza_record_unknown_field/,
  );
  assert.throws(
    () =>
      contract.parseCanonicalLearningRecord(
        {
          ...record,
          completedAt: new Date(now + 10 * 60_000).toISOString(),
        },
        '1.0.0',
      ),
    /cza_record_time_order_invalid/,
  );
});

test('production client IP requires an unforgeable Cloudflare runtime boundary', () => {
  const forged = new Request('https://cza.example/api/core', {
    headers: { 'cf-connecting-ip': '203.0.113.10' },
  });
  assert.equal(
    addressSecurity.trustedRequestAddress(forged, {
      NODE_ENV: 'production',
      CZA_TRUSTED_EDGE: 'cloudflare',
    }),
    '',
  );

  const cloudflare = new Request('https://cza.example/api/core', {
    headers: { 'cf-connecting-ip': '203.0.113.10' },
  });
  Object.defineProperty(cloudflare, 'cf', { value: { colo: 'IST' } });
  assert.equal(
    addressSecurity.trustedRequestAddress(cloudflare, {
      NODE_ENV: 'production',
      CZA_TRUSTED_EDGE: 'cloudflare',
    }),
    '203.0.113.10',
  );
  assert.equal(
    addressSecurity.trustedRequestAddress(cloudflare, {
      NODE_ENV: 'production',
      CZA_TRUSTED_EDGE: 'untrusted-proxy',
    }),
    '',
  );
});

test('distributed limiter delegates atomic storage and global retention to PostgreSQL', () => {
  assert.match(guard, /createHash\('sha256'\)/);
  assert.match(guard, /public\.cza_consume_rate_limit/);
  assert.match(guard, /unavailable: true/);
  assert.match(
    migration,
    /PRIMARY KEY \(scope, subject_hash, window_started_at\)/,
  );
  assert.match(
    migration,
    /ON CONFLICT \(scope, subject_hash, window_started_at\)/,
  );
  assert.match(migration, /request_count = LEAST/);
  assert.match(migration, /cza_prune_rate_limit_windows\(1000\)/);
  assert.match(migration, /WHERE windows\.expires_at <= clock_timestamp\(\)/);
});

test('logout and record ingestion serialize on the server session row', () => {
  assert.match(route, /await revokeStudentSession\(request\)/);
  assert.match(session, /cza_touch_authenticated_student/);
  assert.match(session, /cza_revoke_student_session/);
  assert.match(repository, /student\.session_id/);
  assert.match(migration, /CZA_STUDENT_SESSION_REVOKED/);
  assert.match(
    migration,
    /FROM public\.student_sessions AS sessions[\s\S]*FOR SHARE;/,
  );
});

test('logout cookies clear only after durable revocation succeeds', () => {
  assert.match(route, /action === 'login' \|\| action === 'start'/);
  assert.match(route, /assignmentCookie\('', 0, secure\)/);
  assert.match(
    route,
    /await revokeStudentSession\(request\);[\s\S]*sessionCookie\('', 0/,
  );
  assert.match(
    route,
    /Preserve both cookies so the user can retry durable revocation/,
  );
  assert.match(route, /assignment_launch_required/);
  assert.match(route, /payload\.source = 'free_practice'/);
});

test('client telemetry cannot create server-verified pedagogical evidence', () => {
  const ingestion = migration
    .split('CREATE FUNCTION public.cza_student_record_learning')[1]
    .split('CREATE OR REPLACE FUNCTION public.cza_append_verified_evidence')[0]
    .replace(/^\s*--.*$/gm, '');
  assert.match(migration, /record_origin[^\n]+client_reported/);
  assert.match(migration, /verification_status[^\n]+server_verified/);
  assert.doesNotMatch(ingestion, /INSERT INTO public\.learning_evidence/);
  assert.match(repository, /verificationStatus: result\.verification_status/);
});

test('ledger parent deletion, mutation and truncation are all blocked', () => {
  assert.doesNotMatch(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE RESTRICT/g);
  assert.match(
    migration,
    /BEFORE UPDATE OR DELETE ON public\.learning_records/,
  );
  assert.match(migration, /BEFORE TRUNCATE ON public\.learning_records/);
  assert.match(
    migration,
    /BEFORE UPDATE OR DELETE ON public\.learning_evidence/,
  );
  assert.match(migration, /BEFORE TRUNCATE ON public\.learning_evidence/);
  assert.match(migration, /CZA_IMMUTABLE_LEDGER/);
});

test('idempotency conflict path locks and compares the server canonical hash', () => {
  assert.match(migration, /UNIQUE \(academy_id, client_record_id\)/);
  assert.match(
    migration,
    /digest\(convert_to\(v_canonical_payload::text, 'UTF8'\), 'sha256'\)/,
  );
  assert.match(migration, /IF v_existing_hash <> v_payload_hash THEN/);
  assert.match(migration, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(
    migration,
    /client_record_id = p_client_record_id[\s\S]*FOR SHARE;/,
  );
});
