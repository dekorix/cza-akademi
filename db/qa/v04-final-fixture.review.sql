-- REVIEW ONLY. NOT APPLIED. New architect approval required; all statements one transaction.
DO $guard$
BEGIN
  IF current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user<>'cza_t5_test_owner' THEN RAISE EXCEPTION 'v04_qa_target_rejected'; END IF;
END $guard$;

CREATE FUNCTION public.cza_v04_qa_final_fixture(
 p_hash text,p_operation text,p_recipe uuid,p_session uuid,p_input jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $body$
DECLARE
 v_auth record; v_recipe public.training_recipes%ROWTYPE; v_session public.training_sessions%ROWTYPE;
 v_bound record; v_questions jsonb; v_count integer; v_correct integer;
 v_fixture CONSTANT uuid:='40000004-0000-4000-8000-000000000091';
 v_now timestamptz:=clock_timestamp();
BEGIN
  IF current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
    OR p_operation IS NULL OR p_operation NOT IN ('launch','start','attempt','finish')
    OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'v04_qa_target_rejected' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_auth FROM public.cza_v03_qa_authenticated_student(p_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'v04_qa_session_rejected' USING ERRCODE='42501'; END IF;
  -- Serialize revocation against this write without exposing any session secret.
  PERFORM 1 FROM public.student_sessions ss WHERE ss.id=v_auth.session_id
    AND ss.token_hash=p_hash AND ss.revoked_at IS NULL AND ss.expires_at>clock_timestamp() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'v04_qa_session_rejected' USING ERRCODE='42501'; END IF;
  IF p_recipe IS DISTINCT FROM '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4'::uuid THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  -- All operations lock recipe before training_session: one lock order for races.
  SELECT r.* INTO v_recipe FROM public.training_recipes r JOIN public.modules m
    ON m.code=r.module_code AND m.is_active=true
    WHERE r.id=p_recipe AND r.student_id=v_auth.student_id AND r.academy_id=v_auth.academy_id
      AND r.source='teacher_assignment' AND r.module_code='finger_read'
      AND r.is_active=true AND r.cancelled_at IS NULL
      AND (r.starts_at IS NULL OR r.starts_at<=clock_timestamp())
      AND (r.expires_at IS NULL OR r.expires_at>clock_timestamp()) FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  -- Scope is the existing one-digit 10-round recipe, never a generic write API.
  IF v_recipe.settings->>'mode' IS DISTINCT FROM 'finger-read' OR v_recipe.settings->>'rounds' IS DISTINCT FROM '10'
    OR v_recipe.settings->>'digits' IS DISTINCT FROM '1' OR v_recipe.settings->'pool' IS DISTINCT FROM '[1,2,3,4,5,6,7,8,9]'::jsonb
    OR COALESCE(v_recipe.settings->>'minDigits','1')<>'1'
    OR COALESCE(v_recipe.settings->>'maxDigits','1')<>'1'
    OR COALESCE((v_recipe.settings->>'minValue')::integer,1)>1
    OR COALESCE((v_recipe.settings->>'maxValue')::integer,9)<9 THEN
    RAISE EXCEPTION 'v04_qa_recipe_contract_rejected' USING ERRCODE='42501';
  END IF;


  IF p_operation IN ('attempt','finish') THEN
    IF p_session IS DISTINCT FROM v_fixture THEN
      RAISE EXCEPTION 'CZA_WORK_SESSION_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    RETURN public.cza_v04_qa_assigned_work(p_hash,p_operation,p_recipe,p_session,p_input);
  END IF;
  -- The old accepted completed result is an immutable anchor, not a reset target.
  IF NOT EXISTS(SELECT 1 FROM public.training_sessions s
    WHERE s.id='bdb87fbc-0938-4eb1-82e5-0a2cb362d30f'::uuid
      AND s.recipe_id=p_recipe AND s.student_id=v_auth.student_id AND s.academy_id=v_auth.academy_id
      AND s.status='completed' AND s.answered_count=10 AND s.correct_count=8) THEN
    RAISE EXCEPTION 'v04_qa_anchor_rejected' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.training_sessions WHERE id=v_fixture AND status='completed') THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE='55000'; END IF;
  -- Read-only authorization for the fixture's launch cookie; old recipe stays completed.
  IF p_operation='launch' THEN RETURN jsonb_build_object('fixtureSessionId',v_fixture,
    'moduleCode','finger_read','settings',v_recipe.settings); END IF;
  IF p_input->>'moduleCode' IS DISTINCT FROM 'finger_read'
    OR p_input->>'source' IS DISTINCT FROM 'teacher_assignment' THEN
    RAISE EXCEPTION 'v04_qa_recipe_contract_rejected' USING ERRCODE='42501'; END IF;
  SELECT jsonb_agg(jsonb_build_object('sequence',jsonb_build_array(n),'answer',n,
    'questionId','v04:'||v_fixture::text||':'||i) ORDER BY i) INTO v_questions
    FROM (SELECT i,((('x'||substr(md5(v_fixture::text||':'||i),1,8))::bit(32)::bigint)%9+1)::int n
    FROM generate_series(1,10) i) q;
  INSERT INTO public.training_sessions(id,academy_id,student_id,module_code,recipe_id,
    client_session_id,source,status,started_at,last_activity_at,question_count,settings_snapshot,progress)
  VALUES(v_fixture,v_auth.academy_id,v_auth.student_id,'finger_read',p_recipe,
    (p_input->>'clientSessionId')::uuid,'teacher_assignment','active',v_now,v_now,10,
    v_recipe.settings||jsonb_build_object('v04Version',1,'v04QuestionPlan',v_questions,
      'v04QaFixture','final-acceptance-pr91'),
    jsonb_build_object('attemptCount',0,'correctCount',0,'lastQuestionIndex',0,'resumeAvailable',true))
  ON CONFLICT(id) DO NOTHING;
  SELECT * INTO v_session FROM public.training_sessions WHERE id=v_fixture FOR UPDATE;
  SELECT * INTO v_bound FROM public.cza_bind_assigned_work_session_k3c(
    v_auth.academy_id,v_auth.student_id,p_recipe,v_session.client_session_id,
    v_fixture,v_now,NULL,NULL);
  SELECT * INTO v_session FROM public.training_sessions WHERE id=v_fixture FOR UPDATE;
  IF v_bound.training_session_id IS DISTINCT FROM v_fixture
    OR v_session.settings_snapshot->>'v04QaFixture' IS DISTINCT FROM 'final-acceptance-pr91'
    OR v_session.status<>'active' THEN
    RAISE EXCEPTION 'v04_qa_fixture_identity_rejected' USING ERRCODE='42501'; END IF;
  SELECT count(*)::int,count(*) FILTER(WHERE is_correct)::int INTO v_count,v_correct
    FROM public.question_attempts WHERE training_session_id=v_fixture;
  RETURN jsonb_build_object('sessionId',v_fixture,'resumed',v_count>0,'startedAt',v_session.started_at,
    'workStatus','in_progress','workProgress',jsonb_build_object('attemptCount',v_count,'correctCount',v_correct),
    'questions',v_session.settings_snapshot->'v04QuestionPlan','settings',v_recipe.settings);
END $body$;
ALTER FUNCTION public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb) TO cza_v01_app_runtime_min;
