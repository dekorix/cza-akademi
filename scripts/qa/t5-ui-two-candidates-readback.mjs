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
const label = 'CZA SYNTH T5 SAME NAME 20261009';
const sessions = await sql`
  SELECT id, status, metadata
  FROM public.assessment_sessions
  WHERE student_id IS NULL AND student_label = ${label}
    AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
    AND metadata->>'profileCode' = 'SP-DYS'
    AND started_at >= '2026-10-09 00:00:00+03'::timestamptz
`;
if (sessions.length !== 2 ||
    sessions.some((s) => s.status !== 'active') ||
    new Set(sessions.map((s) => s.metadata.candidateId)).size !== 2 ||
    new Set(sessions.map((s) => s.metadata.academyId)).size !== 1 ||
    new Set(sessions.map((s) => s.metadata.createdByEducatorId)).size !== 1) {
  throw new Error('TWO_CANDIDATE_IDENTITY_ISOLATION_FAILED');
}
const expected = new Map([
  ['SENTETİK T5 ADAY A — gerçek öğrenci verisi değil.', 'al'],
  ['SENTETİK T5 ADAY B — gerçek öğrenci verisi değil.', 'bal'],
]);
for (const session of sessions) {
  const attempts = await sql`
    SELECT answer_text FROM public.assessment_attempts
    WHERE session_id = ${session.id}::uuid AND task_code = 'DYS-PH01'
  `;
  const observations = await sql`
    SELECT educator_note FROM public.assessment_observations
    WHERE session_id = ${session.id}::uuid AND task_code = 'DYS-PH01'
  `;
  if (attempts.length !== 1 || observations.length !== 1 ||
      expected.get(observations[0].educator_note) !== attempts[0].answer_text) {
    throw new Error('TWO_CANDIDATE_EVIDENCE_CROSSED');
  }
  expected.delete(observations[0].educator_note);
}
if (expected.size !== 0) throw new Error('TWO_CANDIDATE_EVIDENCE_INCOMPLETE');
console.log('T5_TWO_CANDIDATES_UI_CENTRAL_ISOLATION=PASS');
console.log('T5_UI_CYCLE_RELATION=' +
  (new Set(sessions.map((s) => s.metadata.cycleId)).size === 1 ? 'SAME' : 'DISTINCT'));
for (const session of sessions) {
  const deleted = await sql`
    DELETE FROM public.assessment_sessions
    WHERE id = ${session.id}::uuid AND student_id IS NULL
      AND student_label = ${label}
      AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
      AND metadata->>'profileCode' = 'SP-DYS'
    RETURNING id
  `;
  if (deleted.length !== 1) throw new Error('TWO_CANDIDATE_CLEANUP_FAILED');
}
console.log('T5_TWO_CANDIDATES_SYNTHETIC_CLEANUP=PASS');
