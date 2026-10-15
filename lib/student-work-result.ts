export type StudentWorkResult = {
  sessionId: string; assignmentId: string; assignmentTitle: string;
  moduleCode: string; moduleName: string; startedAt: string; completedAt: string;
  total: number; correct: number; wrong: number;
  sourceReference: string;
  records: Array<{ recordId: string; recordOrigin: string; verificationStatus: string;
    evidenceId: string | null; evidenceVerificationStatus: string | null; verificationAuthority: string | null }>;
};
export function mapWorkResult(row: Record<string, unknown>): StudentWorkResult {
  const total = Number(row.attempt_count), correct = Number(row.correct_count);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(correct) || total < 0 || correct < 0 || correct > total
    || !Array.isArray(row.records)) throw new Error('work_result_invalid');
  const time = (value: unknown) => {
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isFinite(date.getTime())) throw new Error('work_result_invalid');
    return date.toISOString();
  };
  return { sessionId: String(row.session_id), assignmentId: String(row.assignment_id),
    assignmentTitle: String(row.assignment_title), moduleCode: String(row.module_code), moduleName: String(row.module_name),
    startedAt: time(row.started_at), completedAt: time(row.completed_at), total, correct, wrong: total - correct,
    sourceReference: 'training_sessions, question_attempts, learning_records, learning_evidence',
    records: row.records as StudentWorkResult['records'] };
}
export const COMPLETED_WORK_QUERY = `
SELECT s.id AS session_id,s.recipe_id AS assignment_id,r.name AS assignment_title,
       s.module_code,m.name AS module_name,s.started_at,s.completed_at,
       (SELECT count(*)::int FROM public.question_attempts q
        WHERE q.training_session_id=s.id AND q.student_id=s.student_id AND q.academy_id=s.academy_id
          AND COALESCE(q.metadata->>'attemptType','PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS attempt_count,
       (SELECT count(*)::int FROM public.question_attempts q
        WHERE q.training_session_id=s.id AND q.student_id=s.student_id AND q.academy_id=s.academy_id AND q.is_correct
          AND COALESCE(q.metadata->>'attemptType','PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS correct_count,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'recordId',lr.id,'recordOrigin',lr.record_origin,'verificationStatus',lr.verification_status,
          'evidenceId',e.id,'evidenceVerificationStatus',e.verification_status,'verificationAuthority',e.verification_authority)
          ORDER BY lr.completed_at DESC,lr.id,e.id),'[]'::jsonb)
        FROM public.learning_records lr LEFT JOIN public.learning_evidence e
          ON e.learning_record_id=lr.id AND e.student_id=lr.student_id AND e.academy_id=lr.academy_id
        WHERE lr.training_session_id=s.id AND lr.student_id=s.student_id AND lr.academy_id=s.academy_id) AS records
FROM public.training_sessions s
JOIN public.training_recipes r ON r.id=s.recipe_id AND r.student_id=s.student_id AND r.academy_id=s.academy_id
JOIN public.modules m ON m.code=s.module_code
WHERE s.academy_id=$1::uuid AND s.student_id=$2::uuid AND s.status='completed'
  AND r.source='teacher_assignment' AND ($3::uuid IS NULL OR s.id=$3::uuid)
ORDER BY s.completed_at DESC,s.id DESC
LIMIT 50`;
