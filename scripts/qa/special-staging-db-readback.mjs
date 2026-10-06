import crypto from 'node:crypto';
import process from 'node:process';
import readline from 'node:readline';
import { neon } from '@neondatabase/serverless';

async function readSecretLine() {
  const input = readline.createInterface({ input: process.stdin, terminal: false });
  for await (const line of input) {
    input.close();
    return line.trim();
  }
  return '';
}

const url = process.env.CZA_STAGING_DATABASE_URL || await readSecretLine();
if (!url) {
  console.error('STAGING_DB_READBACK=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('STAGING_DB_READBACK=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (!host || !host.endsWith('.neon.tech') || parsed.pathname !== '/cza_learning' || /(^|[.-])(prod|production)([.-]|$)/.test(host)) {
  console.error('STAGING_DB_READBACK=BLOCKED');
  console.error('REASON=PRODUCTION_LIKE_HOST_REJECTED');
  process.exit(2);
}

const sql = neon(url);
const academyId = crypto.randomUUID();
const teacherUserId = crypto.randomUUID();
const studentUserId = crypto.randomUUID();
const studentId = crypto.randomUUID();
const linkId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const suffix = Date.now().toString(36);
const marker = 'CZA-QA-SPECIAL-' + suffix;
const academySlug = 'cza-qa-special-' + suffix;
const studentUsername = 'qa-special-' + suffix;
const taskCode = 'DYS-PH01';

async function cleanup() {
  try {
    await sql`DELETE FROM public.assessment_sessions WHERE id = ${sessionId}::uuid`;
  } catch {}
  try {
    await sql`DELETE FROM public.academies WHERE id = ${academyId}::uuid`;
  } catch {}
}

try {
  const schema = await sql`
    SELECT
      to_regclass('public.academies')::text AS academies,
      to_regclass('public.users')::text AS users,
      to_regclass('public.students')::text AS students,
      to_regclass('public.teacher_student_links')::text AS links,
      to_regclass('public.assessment_sessions')::text AS sessions,
      to_regclass('public.assessment_attempts')::text AS attempts,
      to_regclass('public.assessment_observations')::text AS observations
  `;
  const row = schema[0] || {};
  if (Object.values(row).some(value => !value)) {
    throw new Error('canonical_qa_tables_missing');
  }

  await cleanup();

  await sql`
    INSERT INTO public.academies (id, name, slug, environment)
    VALUES (${academyId}::uuid, 'CZA Synthetic QA Academy', ${academySlug}, 'staging_qa')
  `;

  await sql`
    INSERT INTO public.users (
      id, academy_id, role, username, display_name, is_active
    ) VALUES
      (
        ${teacherUserId}::uuid,
        ${academyId}::uuid,
        'educator'::public.app_role,
        ${'qa-educator-' + suffix},
        'CZA QA Educator',
        true
      ),
      (
        ${studentUserId}::uuid,
        ${academyId}::uuid,
        'student'::public.app_role,
        ${studentUsername},
        'CZA QA Student',
        true
      )
  `;

  await sql`
    INSERT INTO public.students (
      id, academy_id, user_id, first_name, last_name, status, is_demo
    ) VALUES (
      ${studentId}::uuid,
      ${academyId}::uuid,
      ${studentUserId}::uuid,
      'CZA_SYNTH_SPECIAL',
      'READBACK_QA',
      'active',
      true
    )
  `;

  await sql`
    INSERT INTO public.teacher_student_links (
      id, academy_id, teacher_id, student_id, can_view, can_coach
    ) VALUES (
      ${linkId}::uuid,
      ${academyId}::uuid,
      ${teacherUserId}::uuid,
      ${studentId}::uuid,
      true,
      true
    )
  `;

  const linkedFixture = await sql`
    SELECT s.id AS student_id
    FROM public.students s
    JOIN public.users student_user
      ON student_user.id = s.user_id
      AND student_user.role = 'student'::public.app_role
    JOIN public.teacher_student_links link
      ON link.student_id = s.id
      AND link.academy_id = s.academy_id
      AND link.can_view = true
    JOIN public.users educator_user
      ON educator_user.id = link.teacher_id
      AND educator_user.academy_id = s.academy_id
      AND educator_user.role = 'educator'::public.app_role
      AND educator_user.is_active = true
    WHERE s.id = ${studentId}::uuid
      AND s.academy_id = ${academyId}::uuid
      AND s.status = 'active'
      AND s.is_demo = true
    LIMIT 1
  `;
  if (linkedFixture.length !== 1) throw new Error('synthetic_linked_student_create_failed');

  await sql`
    INSERT INTO public.assessment_sessions (
      id, student_id, template_code, student_label, status, current_task_code, metadata
    ) VALUES (
      ${sessionId}::uuid,
      ${studentId}::uuid,
      'CZA_SPECIAL_V1_DYS',
      ${marker},
      'active',
      ${taskCode},
      ${JSON.stringify({
        version: 1,
        moduleCode: 'special_education_assessment',
        profileCode: 'SP-DYS',
        centralStudentId: studentId,
        source: 'SYNTHETIC_QA',
        diagnosticUse: false,
        qaMarker: marker,
      })}::jsonb
    )
  `;

  await sql`
    INSERT INTO public.assessment_attempts (
      session_id, task_code, shown_at, completed_at, answer_text, answer_payload,
      answer_changes, support_level, self_corrected, rubric_scores,
      response_latency_ms, total_response_time_ms
    ) VALUES (
      ${sessionId}::uuid,
      ${taskCode},
      now(),
      now(),
      'al',
      ${JSON.stringify({
        profileCode: 'SP-DYS',
        verdict: 'MATCH',
        supportLevel: 'INDEPENDENT',
        firstMatch: true,
        flags: [],
        note: 'synthetic staging readback',
        source: 'SYNTHETIC_QA',
        schemaVersion: 1,
      })}::jsonb,
      0, 0, false, '{}'::jsonb, 1250, 2100
    )
  `;

  await sql`
    INSERT INTO public.assessment_observations (
      session_id, task_code, observation_codes, educator_note, confidence
    ) VALUES (
      ${sessionId}::uuid,
      ${taskCode},
      ${JSON.stringify(['SYNTHETIC_QA'])}::jsonb,
      'synthetic staging readback',
      5
    )
  `;

  const readback = await sql`
    SELECT
      s.id AS session_id,
      s.student_id,
      s.template_code,
      s.status,
      s.metadata->>'profileCode' AS profile_code,
      s.metadata->>'qaMarker' AS qa_marker,
      a.task_code,
      a.answer_text,
      a.support_level,
      a.response_latency_ms,
      a.answer_payload->>'verdict' AS verdict,
      a.answer_payload->>'supportLevel' AS support_label,
      o.educator_note
    FROM public.assessment_sessions s
    JOIN public.assessment_attempts a ON a.session_id = s.id
    JOIN public.assessment_observations o ON o.session_id = s.id AND o.task_code = a.task_code
    WHERE s.id = ${sessionId}::uuid
    LIMIT 1
  `;

  if (readback.length !== 1) throw new Error('readback_row_missing');
  const proof = readback[0];

  const checks = {
    sessionId: String(proof.session_id) === sessionId,
    studentId: String(proof.student_id) === studentId,
    template: proof.template_code === 'CZA_SPECIAL_V1_DYS',
    profile: proof.profile_code === 'SP-DYS',
    marker: proof.qa_marker === marker,
    task: proof.task_code === taskCode,
    answer: proof.answer_text === 'al',
    verdict: proof.verdict === 'MATCH',
    support: Number(proof.support_level) === 0 && proof.support_label === 'INDEPENDENT',
    latency: Number(proof.response_latency_ms) === 1250,
    observation: proof.educator_note === 'synthetic staging readback',
  };

  if (Object.values(checks).some(value => value !== true)) {
    throw new Error('readback_mismatch:' + JSON.stringify(checks));
  }

  await cleanup();

  const residue = await sql`
    SELECT
      (SELECT count(*)::int FROM public.academies WHERE id = ${academyId}::uuid) AS academies,
      (SELECT count(*)::int FROM public.users WHERE id IN (${teacherUserId}::uuid, ${studentUserId}::uuid)) AS users,
      (SELECT count(*)::int FROM public.students WHERE id = ${studentId}::uuid) AS students,
      (SELECT count(*)::int FROM public.teacher_student_links WHERE id = ${linkId}::uuid) AS links,
      (SELECT count(*)::int FROM public.assessment_sessions WHERE id = ${sessionId}::uuid) AS sessions,
      (SELECT count(*)::int FROM public.assessment_attempts WHERE session_id = ${sessionId}::uuid) AS attempts,
      (SELECT count(*)::int FROM public.assessment_observations WHERE session_id = ${sessionId}::uuid) AS observations
  `;
  const clean = residue[0] || {};
  if (Object.values(clean).some(value => Number(value) !== 0)) {
    throw new Error('qa_cleanup_failed:' + JSON.stringify(clean));
  }

  const hostHash = crypto.createHash('sha256').update(host).digest('hex');
  console.log('STAGING_DB_READBACK=PASS');
  console.log('SYNTHETIC_LINKED_STUDENT=CREATED');
  console.log('REAL_STUDENT_TOUCHED=NO');
  console.log('PROFILE=SP-DYS');
  console.log('TASK=DYS-PH01');
  console.log('SESSION_WRITE=PASS');
  console.log('ATTEMPT_WRITE=PASS');
  console.log('OBSERVATION_WRITE=PASS');
  console.log('READBACK=PASS');
  console.log('CLEANUP=PASS');
  console.log('HOST_SHA256=' + hostHash);
} catch (error) {
  await cleanup();
  console.error('STAGING_DB_READBACK=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
