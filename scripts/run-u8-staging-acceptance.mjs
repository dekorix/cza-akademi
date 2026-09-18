#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline';
import postgres from 'postgres';

const ALLOWED_STAGING_HOSTS = new Set([
  'ep-winter-mode-b2djq0wx.c-6.eu-central-1.aws.neon.tech',
  'ep-winter-mode-b2djq0wx-pooler.c-6.eu-central-1.aws.neon.tech',
]);
const STUDENTS = Object.freeze([
  'c2000000-0000-4000-8000-000000000003',
  'c2000000-0000-4000-8000-000000000011',
]);
const BASE_URL = 'http://127.0.0.1:4198';

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

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => finish(new Error('U8_STAGING_SERVER_TIMEOUT')), 30_000);
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onStdout = (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes('CZA_U8_E2E_READY')) finish();
    };
    const onStderr = (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    };
    const onExit = (code) => finish(new Error(`U8_STAGING_SERVER_EXIT_${code}:${stderr}`));
    const onError = (error) => finish(error);
    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

function runAcceptance(environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tests/u8-staging-e2e.mjs'], {
      cwd: process.cwd(),
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('U8_STAGING_ACCEPTANCE_TIMEOUT'));
    }, 120_000);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => finish(error));
    child.once('exit', (code) => {
      if (code !== 0) {
        finish(new Error(`U8_STAGING_ACCEPTANCE_EXIT_${code}:${stderr.slice(-4000)}`));
        return;
      }
      try {
        finish(null, JSON.parse(stdout.trim()));
      } catch {
        finish(new Error('U8_STAGING_ACCEPTANCE_OUTPUT_INVALID'));
      }
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main() {
  const connectionString = await readSecretLine();
  if (!connectionString) fail('U8_DATABASE_URL_REQUIRED');
  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    fail('U8_DATABASE_URL_INVALID');
  }
  if (!ALLOWED_STAGING_HOSTS.has(databaseUrl.hostname)) {
    fail('U8_DATABASE_HOST_NOT_APPROVED_STAGING');
  }
  if (databaseUrl.pathname !== '/neondb') fail('U8_DATABASE_NOT_APPROVED_STAGING');

  const tokens = STUDENTS.map(() => randomBytes(32).toString('base64url'));
  const sessionIds = STUDENTS.map(() => randomUUID());
  const tokenHashes = tokens.map((token) => createHash('sha256').update(token).digest('hex'));
  const proxySecret = randomBytes(48).toString('base64url');
  const sql = postgres(connectionString, {
    max: 4,
    connect_timeout: 10,
    idle_timeout: 5,
    prepare: false,
  });
  const insertedSessionIds = [];
  let server;
  let report;
  let operationError;
  try {
    const target = await sql`
      SELECT current_database() AS database,
             current_setting('server_version') AS server_version,
             pg_is_in_recovery() AS replica
    `;
    if (target[0]?.database !== 'neondb' || target[0]?.replica !== false) {
      fail('U8_STAGING_TARGET_NOT_PRIMARY');
    }

    const demoStudents = await sql`
      SELECT id, academy_id, user_id
      FROM public.students
      WHERE id = ANY(${STUDENTS}::uuid[])
        AND status = 'active'
        AND is_demo = true
      ORDER BY id
    `;
    if (demoStudents.length !== STUDENTS.length) fail('U8_APPROVED_DEMO_STUDENTS_MISSING');
    const byId = new Map(demoStudents.map((row) => [row.id, row]));
    for (let index = 0; index < STUDENTS.length; index += 1) {
      const student = byId.get(STUDENTS[index]);
      if (!student) fail('U8_APPROVED_DEMO_STUDENT_MISSING');
      await sql`
        INSERT INTO public.student_sessions (
          id, academy_id, student_id, student_user_id, token_hash, expires_at
        ) VALUES (
          ${sessionIds[index]}::uuid,
          ${student.academy_id}::uuid,
          ${student.id}::uuid,
          ${student.user_id}::uuid,
          ${tokenHashes[index]},
          clock_timestamp() + interval '1 hour'
        )
      `;
      insertedSessionIds.push(sessionIds[index]);
    }

    const sharedEnvironment = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: connectionString,
      CZA_TRUSTED_PROXY_HMAC_SECRET: proxySecret,
      CZA_TIMELINE_CURSOR_SECRET: proxySecret,
    };
    server = spawn(process.execPath, ['tests/u8-staging-e2e-server.mjs'], {
      cwd: process.cwd(),
      env: sharedEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForReady(server);
    const acceptance = await runAcceptance({
      ...sharedEnvironment,
      U8_BASE_URL: BASE_URL,
      U8_STUDENT_TOKEN_A: tokens[0],
      U8_STUDENT_TOKEN_B: tokens[1],
    });
    const nonDemo = await sql`
      SELECT count(*)::integer AS count
      FROM public.coaching_programs AS program
      JOIN public.students AS student ON student.id = program.student_id
      WHERE student.is_demo IS NOT TRUE
    `;
    if (nonDemo[0]?.count !== 0) fail('U8_NON_DEMO_DATA_MUTATED');
    report = {
      result: 'PASS',
      target: {
        environment: 'staging',
        projectId: 'orange-resonance-01270480',
        branchId: 'br-lucky-rain-b2po93vx',
        database: target[0].database,
        primary: true,
      },
      acceptance,
      dataClassification: 'synthetic_demo_only',
      productionAccessed: false,
      productionMutation: false,
    };
  } catch (error) {
    operationError = error;
  }

  let cleanupError;
  try {
    await stopChild(server);
    if (insertedSessionIds.length) {
      const revoked = await sql`
        UPDATE public.student_sessions
        SET revoked_at = COALESCE(revoked_at, clock_timestamp())
        WHERE id = ANY(${insertedSessionIds}::uuid[])
        RETURNING id
      `;
      if (revoked.length !== insertedSessionIds.length) {
        fail('U8_TEMPORARY_SESSION_CLEANUP_INCOMPLETE');
      }
    }
  } catch (error) {
    cleanupError = error;
  }
  try {
    await sql.end({ timeout: 5 });
  } catch (error) {
    cleanupError ||= error;
  }
  if (cleanupError) throw cleanupError;
  if (operationError) throw operationError;
  if (!report) fail('U8_STAGING_ACCEPTANCE_REPORT_MISSING');
  process.stdout.write(`${JSON.stringify({ ...report, sessionCleanup: 'revoked' })}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    result: 'FAIL',
    error: error?.code || String(error?.message || 'U8_STAGING_ACCEPTANCE_FAILED').split(':')[0],
  })}\n`);
  process.exitCode = 1;
}
