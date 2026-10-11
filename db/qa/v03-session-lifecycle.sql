-- FOLLOW-UP QA ONLY: requires separate architect approval before application.
DO $guard$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user <> 'cza_t5_test_owner' THEN
    RAISE EXCEPTION 'v03_qa_target_rejected';
  END IF;
END $guard$;

CREATE FUNCTION public.cza_v03_qa_authenticated_student(p_token_hash text)
RETURNS TABLE(session_id uuid,student_id uuid,academy_id uuid,student_user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
  -- Reuse the approved exact-target, active/demo/role/session/academy validation.
  PERFORM public.cza_v03_qa_student_read(p_token_hash,'dashboard_1',NULL,CURRENT_TIMESTAMP);
  RETURN QUERY SELECT ss.id,ss.student_id,ss.academy_id,ss.student_user_id
    FROM public.student_sessions ss WHERE ss.token_hash=p_token_hash;
EXCEPTION WHEN SQLSTATE '42501' THEN RETURN;
END $body$;
ALTER FUNCTION public.cza_v03_qa_authenticated_student(text) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v03_qa_authenticated_student(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v03_qa_authenticated_student(text) TO cza_v01_app_runtime_min;

CREATE FUNCTION public.cza_v03_qa_revoke_student_session(p_token_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'v03_qa_target_rejected' USING ERRCODE='42501';
  END IF;
  -- Idempotent absent/revoked/expired logout; never operate on another student.
  IF EXISTS (
    SELECT 1 FROM public.student_sessions ss
    JOIN public.students s ON s.id=ss.student_id AND s.user_id=ss.student_user_id AND s.academy_id=ss.academy_id
    JOIN public.users u ON u.id=ss.student_user_id AND u.academy_id=ss.academy_id
    WHERE ss.token_hash=p_token_hash
      AND s.id='20000000-0000-4000-8000-000000000001'::uuid
      AND ss.academy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      AND s.is_demo=true AND u.role::text='student'
  ) THEN PERFORM public.cza_revoke_student_session(p_token_hash); END IF;
END $body$;
ALTER FUNCTION public.cza_v03_qa_revoke_student_session(text) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v03_qa_revoke_student_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v03_qa_revoke_student_session(text) TO cza_v01_app_runtime_min;
