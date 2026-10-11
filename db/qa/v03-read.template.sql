-- QA ONLY. Exact project/branch/database lock; no table grants or policy changes.
DO $guard$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user <> 'cza_t5_test_owner' THEN
    RAISE EXCEPTION 'v03_qa_target_rejected';
  END IF;
END $guard$;

CREATE FUNCTION public.cza_v03_qa_student_read(
  p_token_hash text, p_projection text, p_recipe uuid DEFAULT NULL,
  p_at timestamptz DEFAULT CURRENT_TIMESTAMP
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
DECLARE v_student uuid; v_academy uuid; v_user uuid; v_result jsonb;
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'v03_qa_session_rejected' USING ERRCODE='42501';
  END IF;
  -- Same canonical session validity checks as cza_touch_authenticated_student,
  -- without its last_seen_at UPDATE. Never accept student/academy from caller.
  SELECT ss.student_id,ss.academy_id,ss.student_user_id INTO v_student,v_academy,v_user
  FROM public.student_sessions ss
  JOIN public.students s ON s.id=ss.student_id AND s.user_id=ss.student_user_id AND s.academy_id=ss.academy_id
  JOIN public.users u ON u.id=ss.student_user_id AND u.academy_id=ss.academy_id
  WHERE ss.token_hash=p_token_hash AND ss.revoked_at IS NULL AND ss.expires_at>statement_timestamp()
    AND s.status='active' AND s.is_demo=true AND u.is_active=true AND u.role::text='student'
    AND s.id='20000000-0000-4000-8000-000000000001'::uuid
    AND ss.academy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'v03_qa_session_rejected' USING ERRCODE='42501'; END IF;
  CASE p_projection
-- STATIC_PROJECTIONS
    ELSE RAISE EXCEPTION 'v03_qa_projection_rejected' USING ERRCODE='42501';
  END CASE;
  RETURN v_result;
END $body$;
ALTER FUNCTION public.cza_v03_qa_student_read(text,text,uuid,timestamptz) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v03_qa_student_read(text,text,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v03_qa_student_read(text,text,uuid,timestamptz) TO cza_v01_app_runtime_min;

-- Credential validation and session INSERT remain in the existing login function.
-- This wrapper is an authentication permission, separate from the read projection.
CREATE FUNCTION public.cza_v03_qa_student_login(p_username text,p_pin text,p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40' THEN
    RAISE EXCEPTION 'v03_qa_target_rejected' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.students s ON s.user_id=u.id AND s.academy_id=u.academy_id
    WHERE u.id='10000000-0000-4000-8000-000000000001'::uuid
      AND s.id='20000000-0000-4000-8000-000000000001'::uuid
      AND s.academy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      AND s.is_demo=true AND s.status='active' AND u.is_active=true AND u.role::text='student'
      AND lower(u.username)=lower(trim(p_username))
  ) THEN RETURN jsonb_build_object('ok',false,'error','invalid_credentials'); END IF;
  RETURN public.cza_student_login(p_username,p_pin,left(p_user_agent,500));
END $body$;
ALTER FUNCTION public.cza_v03_qa_student_login(text,text,text) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v03_qa_student_login(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v03_qa_student_login(text,text,text) TO cza_v01_app_runtime_min;
