// V02 uses provisioned schema only; no runtime DDL or permission grants.
export const eligibleStudentsSql = `
SELECT s.id, concat_ws(' ',s.first_name,s.last_name) AS name,
       s.academy_id, academy.name AS academy_name,
       (SELECT i.identifier_value FROM public.student_external_identifiers i
        WHERE i.student_id=s.id AND i.identifier_type='campus_student_code'
        ORDER BY i.identifier_value LIMIT 1) AS code
FROM public.users u
JOIN public.teacher_student_links l ON l.teacher_id=u.id AND l.academy_id=u.academy_id
JOIN public.students s ON s.id=l.student_id AND s.academy_id=u.academy_id
JOIN public.academies academy ON academy.id=s.academy_id
WHERE u.auth_user_id=$1 AND u.is_active=true AND u.role::text='educator'
  AND l.can_view=true AND l.can_link_assessment=true AND s.status='active'
  AND ($2::boolean=false OR s.is_demo=true)
ORDER BY s.id LIMIT 100`;

// Lock authority rows against concurrent revocation, then the session against
// competing targets. UPDATE and audit INSERT share one atomic SQL statement.
export const bindAssessmentSql = `
WITH authority AS MATERIALIZED (
  SELECT u.id AS educator_id,u.academy_id,s.id AS student_id
  FROM public.users u
  JOIN public.teacher_student_links l ON l.teacher_id=u.id AND l.academy_id=u.academy_id
  JOIN public.students s ON s.id=l.student_id AND s.academy_id=u.academy_id
  WHERE u.auth_user_id=$1 AND u.is_active=true AND u.role::text='educator'
    AND l.can_view=true AND l.can_link_assessment=true AND s.status='active'
    AND s.id=$3::uuid AND ($4::boolean=false OR s.is_demo=true)
  FOR SHARE OF u,l,s
), locked AS MATERIALIZED (
  SELECT a.*,authority.educator_id,authority.academy_id
  FROM public.assessment_sessions a JOIN authority
    ON a.metadata->>'academyId'=authority.academy_id::text
  WHERE a.id=$2::uuid AND a.template_code LIKE 'CZA_SPECIAL_V1_%'
    AND a.metadata->>'createdByEducatorId'=$1
    AND a.metadata->>'source'='EDUCATOR_PRE_ENROLLMENT'
    AND a.metadata->>'candidateId' IS NOT NULL AND a.metadata->>'cycleId' IS NOT NULL
    AND a.status IN ('active','completed')
  FOR UPDATE OF a
), changed AS (
  UPDATE public.assessment_sessions a SET student_id=$3::uuid
  FROM locked WHERE a.id=locked.id AND a.student_id IS NULL
  RETURNING a.id,a.student_id,a.metadata
), audited AS (
  INSERT INTO public.assessment_student_link_audit
    (session_id,academy_id,educator_id,student_id,candidate_id,cycle_id)
  SELECT changed.id,locked.academy_id,locked.educator_id,changed.student_id,
         changed.metadata->>'candidateId',changed.metadata->>'cycleId'
  FROM changed JOIN locked ON locked.id=changed.id
  RETURNING session_id,student_id,linked_at
)
SELECT 'linked' AS outcome,session_id,student_id,linked_at FROM audited
UNION ALL
SELECT CASE WHEN locked.student_id=$3::uuid THEN 'already_linked' ELSE 'conflict' END,
       locked.id,locked.student_id,audit.linked_at
FROM locked LEFT JOIN public.assessment_student_link_audit audit ON audit.session_id=locked.id
WHERE locked.student_id IS NOT NULL`;

export const linkedHistorySql = `
SELECT a.id,a.student_id,a.template_code,a.status,a.metadata,
 (SELECT count(*)::int FROM public.assessment_attempts WHERE session_id=a.id) AS attempt_count,
 (SELECT count(*)::int FROM public.assessment_observations WHERE session_id=a.id) AS observation_count
FROM public.assessment_sessions a JOIN public.students s ON s.id=a.student_id
JOIN public.users u ON u.auth_user_id=$1 AND u.academy_id=s.academy_id
 AND u.is_active=true AND u.role::text='educator'
JOIN public.teacher_student_links l ON l.teacher_id=u.id AND l.student_id=s.id AND l.academy_id=s.academy_id
WHERE s.id=$2::uuid AND s.status='active' AND s.is_demo=true
 AND l.can_view=true AND l.can_link_assessment=true
 AND a.metadata->>'academyId'=s.academy_id::text
ORDER BY a.started_at DESC LIMIT 100`;
