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
const label = 'CZA TEST T5 20261009';
const note = 'SENTETİK T5 TEST KANITI — gerçek öğrenci verisi değil.';
const sessions = await sql`
  SELECT id, template_code, status, metadata
  FROM public.assessment_sessions
  WHERE student_id IS NULL
    AND student_label = ${label}
    AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
    AND metadata->>'profileCode' = 'SP-DYS'
    AND started_at >= '2026-10-09 00:00:00+03'::timestamptz
`;
if (sessions.length !== 1) throw new Error('UI_SESSION_NOT_UNIQUE_IN_STAGING_DB');
const session = sessions[0];
const attempts = await sql`
  SELECT id, task_code, answer_text
  FROM public.assessment_attempts
  WHERE session_id = ${session.id}::uuid AND task_code = 'DYS-PH01'
`;
const observations = await sql`
  SELECT id, task_code, educator_note
  FROM public.assessment_observations
  WHERE session_id = ${session.id}::uuid AND task_code = 'DYS-PH01'
`;
if (session.status !== 'active' || attempts.length !== 1 ||
    attempts[0].answer_text !== 'al' ||
    observations.length !== 1 || observations[0].educator_note !== note) {
  throw new Error('UI_CENTRAL_EVIDENCE_MISMATCH');
}
console.log('T5_UI_SESSION_AND_CENTRAL_EVIDENCE=PASS');
const cleanup = await sql`
  DELETE FROM public.assessment_sessions
  WHERE id = ${session.id}::uuid
    AND student_id IS NULL AND student_label = ${label}
    AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
    AND metadata->>'profileCode' = 'SP-DYS'
  RETURNING id
`;
if (cleanup.length !== 1) throw new Error('UI_SYNTHETIC_CLEANUP_FAILED');
console.log('T5_UI_SYNTHETIC_CLEANUP=PASS');
