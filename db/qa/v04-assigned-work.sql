-- QA ONLY. NOT APPLIED: separate architect approval required.
DO $guard$
BEGIN
  IF current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user<>'cza_t5_test_owner' THEN RAISE EXCEPTION 'v04_qa_target_rejected'; END IF;
END $guard$;

CREATE FUNCTION public.cza_v04_qa_assigned_work(
  p_hash text,p_operation text,p_recipe uuid,p_session uuid,p_input jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $body$
DECLARE
  v_auth record; v_recipe public.training_recipes%ROWTYPE;
  v_session public.training_sessions%ROWTYPE; v_existing public.question_attempts%ROWTYPE;
  v_bound record; v_attempt record; v_record record;
  v_questions jsonb; v_payload jsonb; v_metadata jsonb; v_performance jsonb;
  v_count integer; v_correct integer; v_timeouts integer; v_average numeric; v_fastest integer; v_index integer; v_expected integer; v_answer bigint;
  v_numeric record; v_timeout boolean; v_now timestamptz:=clock_timestamp(); v_evidence uuid;
BEGIN
  IF current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
    OR p_operation IS NULL OR p_operation NOT IN ('start','attempt','finish')
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

  IF p_operation='start' THEN
    IF p_input->>'moduleCode' IS DISTINCT FROM 'finger_read'
      OR p_input->>'source' IS DISTINCT FROM 'teacher_assignment' THEN
      RAISE EXCEPTION 'v04_qa_recipe_contract_rejected' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_bound FROM public.cza_bind_assigned_work_session_k3c(
      v_auth.academy_id,v_auth.student_id,p_recipe,(p_input->>'clientSessionId')::uuid,
      gen_random_uuid(),v_now,NULL,NULL);
    SELECT * INTO v_session FROM public.training_sessions s WHERE s.id=v_bound.training_session_id FOR UPDATE;
    IF v_session.status='completed' THEN RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE='55000'; END IF;
    IF v_session.settings_snapshot->>'v04Version' IS NULL THEN
      IF v_bound.resumed THEN RAISE EXCEPTION 'v04_qa_legacy_session_rejected' USING ERRCODE='42501'; END IF;
      -- Deterministic seeded selection from the existing finger-read pool.
      -- Same session/question index always has the same stimulus across tabs/reloads.
      SELECT jsonb_agg(jsonb_build_object('sequence',jsonb_build_array(n),'answer',n,
        'questionId','v04:'||v_session.id::text||':'||i) ORDER BY i) INTO v_questions
      FROM (SELECT i,((('x'||substr(md5(v_session.id::text||':'||i),1,8))::bit(32)::bigint)%9+1)::int n
        FROM generate_series(1,10) i) q;
      UPDATE public.training_sessions SET source='teacher_assignment',question_count=10,
        settings_snapshot=v_recipe.settings||jsonb_build_object('v04Version',1,'v04QuestionPlan',v_questions)
        WHERE id=v_session.id RETURNING * INTO v_session;
    END IF;
  ELSE
    SELECT * INTO v_session FROM public.training_sessions s
      WHERE s.id=p_session AND s.recipe_id=p_recipe AND s.student_id=v_auth.student_id
        AND s.academy_id=v_auth.academy_id AND s.module_code='finger_read' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CZA_WORK_SESSION_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  END IF;
  v_questions:=v_session.settings_snapshot->'v04QuestionPlan';
  IF v_session.settings_snapshot->>'v04Version' IS DISTINCT FROM '1'
    OR jsonb_array_length(v_questions) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'v04_qa_legacy_session_rejected' USING ERRCODE='42501'; END IF;
  SELECT count(*)::int,count(*) FILTER(WHERE a.is_correct)::int,
    count(*) FILTER(WHERE a.error_type='TIMEOUT')::int,round(avg(a.response_latency_ms)),
    min(a.response_latency_ms) FILTER(WHERE a.is_correct)
    INTO v_count,v_correct,v_timeouts,v_average,v_fastest
    FROM public.question_attempts a WHERE a.training_session_id=v_session.id
      AND a.student_id=v_auth.student_id AND a.academy_id=v_auth.academy_id
      AND COALESCE(a.metadata->>'attemptType','PRIMARY')<>'RETRY_AFTER_FEEDBACK';

  IF p_operation='attempt' THEN
    v_index:=(p_input->>'questionIndex')::integer;
    IF v_index IS NULL OR v_index<1 OR v_index>10 THEN
      RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE='22023'; END IF;
    v_expected:=(v_questions->(v_index-1)->>'answer')::integer;
    -- Validate reported numbers before integer casts; malformed values fail closed.
    FOR v_numeric IN SELECT key,p_input->key value FROM unnest(ARRAY[
      'studentNumericAnswer','responseLatencyMs','totalResponseTimeMs','stimulusDurationMs']) key LOOP
      IF jsonb_typeof(v_numeric.value) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE='22023'; END IF;
      IF (v_numeric.value::text)::numeric<>trunc((v_numeric.value::text)::numeric)
        OR (v_numeric.value::text)::numeric NOT BETWEEN
          (CASE WHEN v_numeric.key='studentNumericAnswer' THEN -1 ELSE 0 END)
          AND (CASE WHEN v_numeric.key='studentNumericAnswer' THEN 9999999 ELSE 86400000 END) THEN
        RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE='22023'; END IF;
    END LOOP;
    v_answer:=(p_input->>'studentNumericAnswer')::bigint;
    v_timeout:=COALESCE((p_input->'metadata'->>'timeout')::boolean,false);
    IF p_input->>'questionId' IS DISTINCT FROM v_questions->(v_index-1)->>'questionId'
      OR (p_input->>'targetNumber')::integer IS DISTINCT FROM v_expected
      OR jsonb_typeof(p_input->'studentNumericAnswer') IS DISTINCT FROM 'number'
      OR (p_input->>'studentNumericAnswer')::numeric<>v_answer
      OR v_answer<-1 OR v_answer>9999999 OR (v_answer=-1 AND NOT v_timeout)
      OR (v_timeout AND v_answer<>-1)
      OR (p_input->'metadata'->>'attemptType') IS DISTINCT FROM 'PRIMARY'
      OR p_input->'metadata'->'sequence' IS DISTINCT FROM jsonb_build_array(v_expected)
      OR (p_input->'metadata'->'responsePayload'->>'value')::bigint IS DISTINCT FROM v_answer THEN
      RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_existing FROM public.question_attempts a WHERE a.academy_id=v_auth.academy_id
      AND a.client_attempt_id=(p_input->>'clientAttemptId')::uuid;
    IF FOUND THEN
      IF v_existing.training_session_id<>v_session.id OR v_existing.student_id<>v_auth.student_id
        OR v_existing.metadata->>'v04PayloadHash' IS DISTINCT FROM encode(public.digest(p_input::text,'sha256'),'hex') THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001'; END IF;
      RETURN jsonb_build_object('attemptId',v_existing.id,'replayed',true,'attemptCount',v_count,
        'correctCount',v_correct,'lastQuestionIndex',v_count);
    END IF;
    IF v_session.status<>'active' THEN RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE='55000'; END IF;
    IF v_index<>v_count+1 THEN RAISE EXCEPTION 'v04_qa_question_conflict' USING ERRCODE='P0001'; END IF;
    -- Preserve reported event data, explicitly label it; never accept claimed skills/support/strategy.
    v_metadata:=jsonb_build_object('attemptType','PRIMARY','sequence',jsonb_build_array(v_expected),
      'responseType','numeric','responsePayload',jsonb_build_object('value',v_answer),
      'timeout',v_timeout,'supportLevel','unknown','strategy',NULL,'skills','[]'::jsonb,
      'questionAuthority','v04_qa_server_plan','timingProvenance','CLIENT_REPORTED',
      'answerStartedAt',p_input->'metadata'->'answerStartedAt',
      'answeredAt',p_input->'metadata'->'answeredAt',
      'presentationStartedAt',p_input->'metadata'->'presentationStartedAt',
      'presentationEndedAt',p_input->'metadata'->'presentationEndedAt',
      'v04PayloadHash',encode(public.digest(p_input::text,'sha256'),'hex'));
    v_payload:=p_input||jsonb_build_object('isCorrect',NOT v_timeout AND v_answer=v_expected,
      'patternValid',NOT v_timeout,'errorType',CASE WHEN v_timeout THEN 'TIMEOUT'
        WHEN v_answer=v_expected THEN 'OK' ELSE 'RESPONSE_ERROR' END,
      'errorDetail',CASE WHEN v_timeout THEN 'Cevap süresi doldu.' WHEN v_answer=v_expected THEN 'Doğru cevap'
        ELSE 'Girilen cevap beklenen sonuçla eşleşmedi.' END,'learningMode','guided_practice',
      'difficultyLevel',1,'attemptNumber',1,'metadata',v_metadata);
    SELECT * INTO v_attempt FROM public.cza_record_assigned_work_attempt(
      v_auth.academy_id,v_auth.student_id,v_session.id,v_payload);
    RETURN jsonb_build_object('attemptId',v_attempt.question_attempt_id,'replayed',v_attempt.replayed,
      'attemptCount',v_attempt.attempt_count,'correctCount',v_attempt.correct_count,
      'lastQuestionIndex',v_attempt.last_question_index);
  END IF;

  IF p_operation='finish' THEN
    IF v_session.status='completed' THEN RETURN v_session.progress||jsonb_build_object(
      'sessionId',v_session.id,'status','completed','replayed',true); END IF;
    IF v_session.status<>'active' THEN RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE='55000'; END IF;
    IF COALESCE((p_input->>'aborted')::boolean,false) THEN
      RETURN jsonb_build_object('sessionId',v_session.id,'status','in_progress','attemptCount',v_count);
    END IF;
    IF v_count<>10 THEN RAISE EXCEPTION 'CZA_WORK_INCOMPLETE' USING ERRCODE='P0001'; END IF;
    -- Existing live completion infers support from mode and trusts generic client attempts.
    -- Do not replace it globally. Reuse the canonical ledger with explicit mixed provenance.
    v_performance:=jsonb_build_object('total',v_count,'correct',v_correct,'wrong',v_count-v_correct,
      'accuracy',round(100.0*v_correct/v_count));
    v_metadata:=jsonb_build_object('recipeId',p_recipe,'assignmentSource','teacher_assignment',
      'evidenceClass','server_evaluated_answers','timingProvenance','CLIENT_REPORTED',
      'supportObservation','unknown','strategy',NULL,'workCenterVersion','v04-qa-v1');
    SELECT * INTO v_record FROM public.cza_student_record_learning(v_auth.academy_id,v_auth.student_id,
      v_auth.session_id,v_session.id,v_session.completion_client_record_id,'module_record','1.1.0',
      'CZA_MODULE_RECORD_V1','finger_read','1.0.0','assigned_work',v_session.started_at,v_now,
      'unknown',v_performance,'[]'::jsonb,v_metadata);
    v_evidence:=public.cza_append_verified_evidence(v_record.learning_record_id,'activity_result',NULL,
      'unknown',v_now,'v04_qa_server_answer_evaluator:v1',v_performance);
    UPDATE public.training_sessions SET status='completed',completed_at=v_now,last_activity_at=v_now,
      answered_count=v_count,correct_count=v_correct,wrong_count=v_count-v_correct,
      accuracy=round(100.0*v_correct/v_count),progress=jsonb_build_object('attemptCount',v_count,
        'correctCount',v_correct,'lastQuestionIndex',v_count,'resumeAvailable',false,
        'learningRecordId',v_record.learning_record_id,'evidenceId',v_evidence,
        'timeoutCount',v_timeouts,'averageResponseMs',v_average,'fastestCorrectMs',v_fastest,
        'timingProvenance','CLIENT_REPORTED')
      WHERE id=v_session.id;
    RETURN jsonb_build_object('sessionId',v_session.id,'status','completed','replayed',false,
      'learningRecordId',v_record.learning_record_id,'evidenceId',v_evidence,
      'attemptCount',v_count,'correctCount',v_correct,'timeoutCount',v_timeouts,
      'averageResponseMs',v_average,'fastestCorrectMs',v_fastest,'timingProvenance','CLIENT_REPORTED');
  END IF;
  RETURN jsonb_build_object('sessionId',v_session.id,'resumed',v_bound.resumed,'startedAt',v_session.started_at,
    'workStatus','in_progress','workProgress',jsonb_build_object('attemptCount',v_count,'correctCount',v_correct),
    'questions',v_questions,'settings',v_recipe.settings);
END $body$;
ALTER FUNCTION public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb) TO cza_v01_app_runtime_min;
