import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const url = process.env.CZA_STAGING_DATABASE_URL;
if (!url) throw new Error('STAGING_DB_URL_MISSING');
const target = new URL(url);
if (!target.hostname.endsWith('.neon.tech') ||
    target.pathname !== '/cza_learning' ||
    /(^|[.-])(prod|production)([.-]|$)/.test(target.hostname)) {
  throw new Error('STAGING_TARGET_REJECTED');
}

const sql = neon(url);
const secondConnection = neon(url);
const academyA = crypto.randomUUID();
const academyB = crypto.randomUUID();
const educatorA = crypto.randomUUID();
const educatorB = crypto.randomUUID();
const educatorC = crypto.randomUUID();
const teacherA = crypto.randomUUID();
const teacherB = crypto.randomUUID();
const teacherC = crypto.randomUUID();
const candidateA = crypto.randomUUID();
const candidateB = crypto.randomUUID();
const cycleA = crypto.randomUUID();
const cycleB = crypto.randomUUID();
const suffix = crypto.randomBytes(6).toString('hex');
const createdSessions = [];
const templateCode = 'CZA_SPECIAL_V1_DYS';

function metadata(academyId, educatorId, candidateId, cycleId) {
  return JSON.stringify({
    source: 'EDUCATOR_PRE_ENROLLMENT',
    academyId, createdByEducatorId: educatorId, candidateId, cycleId,
    profileCode: 'SP-DYS', version: 'staging-qa',
  });
}

async function create(academyId, educatorId, candidateId, cycleId) {
  const inserted = await sql`
    INSERT INTO public.assessment_sessions
      (student_id, template_code, student_label, metadata)
    VALUES
      (NULL, ${templateCode}, 'CZA_SYNTH_T5_SAME_NAME',
       ${metadata(academyId, educatorId, candidateId, cycleId)}::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  if (inserted.length) createdSessions.push(String(inserted[0].id));
  const existing = await sql`
    SELECT id FROM public.assessment_sessions
    WHERE student_id IS NULL AND status = 'active'
      AND template_code = ${templateCode}
      AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
      AND metadata->>'academyId' = ${academyId}
      AND metadata->>'createdByEducatorId' = ${educatorId}
      AND metadata->>'candidateId' = ${candidateId}
      AND metadata->>'cycleId' = ${cycleId}
  `;
  if (existing.length !== 1) throw new Error('CANDIDATE_ACTIVE_COUNT_INVALID');
  return String(existing[0].id);
}

async function authorized(sessionId, authUserId) {
  return secondConnection`
    SELECT a.id FROM public.assessment_sessions a
    WHERE a.id = ${sessionId}::uuid
      AND EXISTS (
        SELECT 1 FROM public.users t
        WHERE t.auth_user_id = ${authUserId}
          AND t.role = 'educator' AND t.is_active = true
          AND a.student_id IS NULL
          AND a.metadata->>'createdByEducatorId' = ${authUserId}
          AND a.metadata->>'academyId' = t.academy_id::text
      )
  `;
}

async function cleanup() {
  for (const id of new Set(createdSessions)) {
    await sql`DELETE FROM public.assessment_sessions WHERE id = ${id}::uuid`;
  }
  await sql`DELETE FROM public.academies WHERE id IN (${academyA}::uuid, ${academyB}::uuid)`;
}

try {
  await sql`
    INSERT INTO public.academies (id, name, slug, environment)
    VALUES
      (${academyA}::uuid, 'CZA Synthetic T5 A', ${'cza-t5-a-' + suffix}, 'staging'),
      (${academyB}::uuid, 'CZA Synthetic T5 B', ${'cza-t5-b-' + suffix}, 'staging')
  `;
  await sql`
    INSERT INTO public.users
      (id, academy_id, role, username, display_name, is_active, auth_user_id)
    VALUES
      (${teacherA}::uuid, ${academyA}::uuid, 'educator'::public.app_role,
       ${'t5-a-' + suffix}, 'Synthetic T5 A', true, ${educatorA}),
      (${teacherB}::uuid, ${academyA}::uuid, 'educator'::public.app_role,
       ${'t5-b-' + suffix}, 'Synthetic T5 B', true, ${educatorB}),
      (${teacherC}::uuid, ${academyB}::uuid, 'educator'::public.app_role,
       ${'t5-c-' + suffix}, 'Synthetic T5 C', true, ${educatorC})
  `;

  const parallel = await Promise.all(Array.from({ length: 8 },
    () => create(academyA, educatorA, candidateA, cycleA)));
  if (new Set(parallel).size !== 1) throw new Error('CONCURRENT_DOUBLE_SESSION');
  const primary = parallel[0];
  const resumed = await create(academyA, educatorA, candidateA, cycleA);
  if (resumed !== primary) throw new Error('RESTART_NOT_RESUMED');
  console.log('T5_CONCURRENT_CREATE_AND_RESUME=PASS');

  const differentCandidate = await create(academyA, educatorA, candidateB, cycleA);
  const differentCycle = await create(academyA, educatorA, candidateA, cycleB);
  const differentEducator = await create(academyA, educatorB, candidateA, cycleA);
  const differentAcademy = await create(academyB, educatorC, candidateA, cycleA);
  if (new Set([primary, differentCandidate, differentCycle,
    differentEducator, differentAcademy]).size !== 5) {
    throw new Error('CANDIDATE_OR_TENANT_COLLISION');
  }
  console.log('T5_CANDIDATE_CYCLE_AND_TENANT_ISOLATION=PASS');

  await sql`
    INSERT INTO public.assessment_attempts
      (session_id, task_code, answer_text, answer_payload, completed_at)
    VALUES
      (${primary}::uuid, 'DYS-PH01', 'SYNTH_T5', '{"verdict":"MATCH"}'::jsonb, now())
  `;
  await sql`
    INSERT INTO public.assessment_observations
      (session_id, task_code, observation_codes, educator_note)
    VALUES
      (${primary}::uuid, 'DYS-PH01', '["SYNTH_T5"]'::jsonb, 'synthetic')
  `;
  const attempt = await secondConnection`
    SELECT task_code, answer_text FROM public.assessment_attempts
    WHERE session_id = ${primary}::uuid
  `;
  const observation = await secondConnection`
    SELECT task_code, observation_codes FROM public.assessment_observations
    WHERE session_id = ${primary}::uuid
  `;
  if (attempt.length !== 1 || attempt[0].answer_text !== 'SYNTH_T5' ||
      observation.length !== 1 ||
      !observation[0].observation_codes.includes('SYNTH_T5')) {
    throw new Error('CENTRAL_RELOAD_READBACK_FAILED');
  }
  console.log('T5_CENTRAL_ATTEMPT_OBSERVATION_READBACK=PASS');

  if ((await authorized(primary, educatorA)).length !== 1 ||
      (await authorized(primary, educatorB)).length !== 0 ||
      (await authorized(primary, educatorC)).length !== 0 ||
      (await authorized(differentAcademy, educatorA)).length !== 0) {
    throw new Error('UNAUTHORIZED_SESSION_VISIBLE');
  }
  console.log('T5_AUTH_AND_CROSS_ACADEMY_DENIAL=PASS');
} finally {
  await cleanup();
  console.log('T5_SYNTHETIC_CLEANUP=PASS');
}
