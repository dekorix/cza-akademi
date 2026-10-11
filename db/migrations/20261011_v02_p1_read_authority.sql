-- P1: additive read authority; binding function, audit and data remain unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.cza_v02_readable_students(actor_auth_id text, qa_only boolean) RETURNS TABLE(id uuid,name text,academy_id uuid,academy_name text,code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
#variable_conflict use_column
BEGIN
 IF current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_database() <> 'cza_t5_synthetic' THEN
   RAISE EXCEPTION 'V02 isolated QA target required' USING ERRCODE='42501';
 END IF;
 IF qa_only IS DISTINCT FROM true THEN RAISE EXCEPTION 'V02 QA only'; END IF;
 RETURN QUERY

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
  AND l.can_view=true AND s.status='active'
  AND ($2::boolean=false OR s.is_demo=true)
ORDER BY s.id LIMIT 100;
END $fn$;
ALTER FUNCTION public.cza_v02_readable_students(text,boolean) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v02_readable_students(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v02_readable_students(text,boolean) TO cza_v01_app_runtime_min;

CREATE OR REPLACE FUNCTION public.cza_v02_student_history(actor_auth_id text, target_student uuid) RETURNS TABLE(id uuid,student_id uuid,template_code text,status text,metadata jsonb,attempt_count integer,observation_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
#variable_conflict use_column
BEGIN
 IF current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_database() <> 'cza_t5_synthetic' THEN
   RAISE EXCEPTION 'V02 isolated QA target required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY

SELECT a.id,a.student_id,a.template_code,a.status,a.metadata,
 (SELECT count(*)::int FROM public.assessment_attempts WHERE session_id=a.id) AS attempt_count,
 (SELECT count(*)::int FROM public.assessment_observations WHERE session_id=a.id) AS observation_count
FROM public.assessment_sessions a JOIN public.students s ON s.id=a.student_id
JOIN public.users u ON u.auth_user_id=$1 AND u.academy_id=s.academy_id
 AND u.is_active=true AND u.role::text='educator'
JOIN public.teacher_student_links l ON l.teacher_id=u.id AND l.student_id=s.id AND l.academy_id=s.academy_id
WHERE s.id=$2::uuid AND s.status='active' AND s.is_demo=true
 AND l.can_view=true
 AND a.metadata->>'academyId'=s.academy_id::text
ORDER BY a.started_at DESC LIMIT 100;
END $fn$;
REVOKE ALL ON FUNCTION public.cza_v02_student_history(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v02_student_history(text,uuid) TO cza_v01_app_runtime_min;

COMMIT;
