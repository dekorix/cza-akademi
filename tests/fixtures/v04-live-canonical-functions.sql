-- READ-ONLY capture of canonical QA function definitions, 2026-10-11.
-- Test fixture ONLY. Never deploy this file; V04 must not replace old functions.
CREATE OR REPLACE FUNCTION public.cza_append_verified_evidence(p_learning_record_id uuid, p_evidence_type text, p_skill_code text, p_support_level text, p_observed_at timestamp with time zone, p_verification_authority text, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_evidence_id uuid;
  v_academy_id uuid;
  v_student_id uuid;
BEGIN
  IF p_evidence_type NOT IN ('activity_result', 'skill_observation')
     OR p_support_level NOT IN ('independent', 'prompted', 'guided', 'modeled', 'unknown')
     OR p_verification_authority !~ '^[a-z0-9][a-z0-9_.:-]{2,79}$'
     OR jsonb_typeof(p_payload) <> 'object'
     OR (p_evidence_type = 'skill_observation' AND p_skill_code IS NULL)
     OR (p_evidence_type = 'activity_result' AND p_skill_code IS NOT NULL) THEN
    RAISE EXCEPTION 'CZA_VERIFIED_EVIDENCE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT records.academy_id, records.student_id
  INTO v_academy_id, v_student_id
  FROM public.learning_records AS records
  WHERE records.id = p_learning_record_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_LEARNING_RECORD_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.learning_evidence (
    learning_record_id, academy_id, student_id, evidence_type,
    verification_status, verification_authority, skill_code,
    support_level, observed_at, payload
  )
  VALUES (
    p_learning_record_id, v_academy_id, v_student_id, p_evidence_type,
    'server_verified', p_verification_authority, p_skill_code,
    p_support_level, p_observed_at, p_payload
  )
  RETURNING id INTO v_evidence_id;

  RETURN v_evidence_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cza_bind_assigned_work_session(p_academy_id uuid, p_student_id uuid, p_recipe_id uuid, p_client_session_id uuid, p_training_session_id uuid, p_started_at timestamp with time zone)
 RETURNS TABLE(training_session_id uuid, work_status text, resumed boolean, started_at timestamp with time zone, attempt_count integer, correct_count integer, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipe public.training_recipes%ROWTYPE;
  v_session public.training_sessions%ROWTYPE;
BEGIN
  SELECT recipes.*
  INTO v_recipe
  FROM public.training_recipes AS recipes
  JOIN public.modules AS modules
    ON modules.code = recipes.module_code
   AND modules.is_active = true
  WHERE recipes.id = p_recipe_id
    AND recipes.academy_id = p_academy_id
    AND recipes.student_id = p_student_id
    AND recipes.source = 'teacher_assignment'
    AND recipes.is_active = true
    AND (recipes.starts_at IS NULL OR recipes.starts_at <= clock_timestamp())
    AND (recipes.expires_at IS NULL OR recipes.expires_at > clock_timestamp())
  FOR UPDATE OF recipes;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;


  -- Inspect the exact Core-created row before the existing resume search.
  -- Lock order stays recipe -> session. No historical in_progress rows are scanned.
  SELECT sessions.* INTO v_session
  FROM public.training_sessions AS sessions
  WHERE sessions.id = p_training_session_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_session.academy_id IS DISTINCT FROM p_academy_id
       OR v_session.student_id IS DISTINCT FROM p_student_id
       OR v_session.recipe_id IS DISTINCT FROM p_recipe_id
       OR v_session.module_code IS DISTINCT FROM v_recipe.module_code
       OR v_session.source::text IS DISTINCT FROM 'teacher_assignment'
       OR (v_session.client_session_id IS NOT NULL
           AND v_session.client_session_id IS DISTINCT FROM p_client_session_id) THEN
      RAISE EXCEPTION 'CZA_WORK_SESSION_BIND_FAILED' USING ERRCODE = 'P0001';
    END IF;

    IF v_session.status = 'in_progress' THEN
      UPDATE public.training_sessions AS sessions
      SET status = 'active',
          client_session_id = COALESCE(sessions.client_session_id, p_client_session_id),
          last_activity_at = GREATEST(sessions.last_activity_at, p_started_at)
      WHERE sessions.id = p_training_session_id
        AND sessions.academy_id = p_academy_id
        AND sessions.student_id = p_student_id
        AND sessions.recipe_id = p_recipe_id
        AND sessions.module_code = v_recipe.module_code
        AND sessions.source = 'teacher_assignment'
        AND sessions.status = 'in_progress'
      RETURNING sessions.* INTO v_session;
    ELSIF v_session.status NOT IN ('active', 'completed') THEN
      RAISE EXCEPTION 'CZA_WORK_SESSION_BIND_FAILED' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY
    SELECT
      v_session.id,
      CASE WHEN v_session.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
      v_session.status = 'active',
      v_session.started_at,
      count(*) FILTER (
        WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
      )::integer,
      count(*) FILTER (
        WHERE attempts.is_correct
          AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
      )::integer,
      v_session.last_activity_at
    FROM public.question_attempts AS attempts
    WHERE attempts.academy_id = p_academy_id
      AND attempts.student_id = p_student_id
      AND attempts.training_session_id = v_session.id;
    RETURN;
  END IF;

  SELECT sessions.*
  INTO v_session
  FROM public.training_sessions AS sessions
  WHERE sessions.recipe_id = p_recipe_id
    AND sessions.academy_id = p_academy_id
    AND sessions.student_id = p_student_id
    AND sessions.module_code = v_recipe.module_code
    AND sessions.source = 'teacher_assignment'
    AND sessions.status IN ('active', 'completed')
  ORDER BY
    CASE WHEN sessions.status = 'completed' THEN 0 ELSE 1 END,
    sessions.last_activity_at DESC,
    sessions.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_session.id,
      CASE WHEN v_session.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
      v_session.status = 'active',
      v_session.started_at,
      count(*) FILTER (
        WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
      )::integer,
      count(*) FILTER (
        WHERE attempts.is_correct
          AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
      )::integer,
      v_session.last_activity_at
    FROM public.question_attempts AS attempts
    WHERE attempts.academy_id = p_academy_id
      AND attempts.student_id = p_student_id
      AND attempts.training_session_id = v_session.id;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.training_sessions (
      id, academy_id, student_id, module_code, recipe_id,
      client_session_id, source, status, started_at, last_activity_at, progress
    ) VALUES (
      p_training_session_id, p_academy_id, p_student_id, v_recipe.module_code,
      p_recipe_id, p_client_session_id, v_recipe.source, 'active', p_started_at, p_started_at,
      jsonb_build_object(
        'attemptCount', 0,
        'correctCount', 0,
        'lastQuestionIndex', 0,
        'resumeAvailable', true
      )
    )
    ON CONFLICT (id) DO UPDATE
    SET recipe_id = EXCLUDED.recipe_id,
        client_session_id = COALESCE(public.training_sessions.client_session_id, EXCLUDED.client_session_id),
        last_activity_at = GREATEST(public.training_sessions.last_activity_at, EXCLUDED.last_activity_at)
    WHERE public.training_sessions.academy_id = EXCLUDED.academy_id
      AND public.training_sessions.student_id = EXCLUDED.student_id
      AND public.training_sessions.module_code = EXCLUDED.module_code
      AND public.training_sessions.recipe_id = EXCLUDED.recipe_id
      AND public.training_sessions.source = 'teacher_assignment'
      AND public.training_sessions.status = 'active'
    RETURNING * INTO v_session;
  EXCEPTION WHEN unique_violation THEN
    SELECT sessions.*
    INTO v_session
    FROM public.training_sessions AS sessions
    WHERE sessions.recipe_id = p_recipe_id
      AND sessions.academy_id = p_academy_id
      AND sessions.student_id = p_student_id
      AND sessions.module_code = v_recipe.module_code
      AND sessions.source = 'teacher_assignment'
      AND sessions.status = 'active'
    ORDER BY sessions.last_activity_at DESC, sessions.id DESC
    LIMIT 1
    FOR UPDATE;
  END;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_BIND_FAILED' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT
    v_session.id,
    'in_progress'::text,
    false,
    v_session.started_at,
    0,
    0,
    v_session.last_activity_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cza_bind_assigned_work_session_k3c(p_academy_id uuid, p_student_id uuid, p_recipe_id uuid, p_client_session_id uuid, p_training_session_id uuid, p_started_at timestamp with time zone, p_engine_id text, p_engine_version text)
 RETURNS TABLE(training_session_id uuid, work_status text, resumed boolean, started_at timestamp with time zone, attempt_count integer, correct_count integer, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_bound record;
BEGIN
  IF NOT (
    (p_engine_id IS NULL AND p_engine_version IS NULL)
    OR (
      p_engine_id IS NOT NULL
      AND p_engine_version IS NOT NULL
      AND p_engine_id ~ '^[A-Z][A-Z0-9_]{0,79}$'
      AND p_engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'
    )
  ) THEN
    RAISE EXCEPTION 'CZA_ENGINE_PROVENANCE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bound
  FROM public.cza_bind_assigned_work_session(
    p_academy_id, p_student_id, p_recipe_id, p_client_session_id,
    p_training_session_id, p_started_at
  );

  UPDATE public.training_sessions
  SET engine_id = p_engine_id, engine_version = p_engine_version
  WHERE id = v_bound.training_session_id
    AND academy_id = p_academy_id
    AND student_id = p_student_id
    AND (
      (engine_id IS NULL AND engine_version IS NULL)
      OR (engine_id = p_engine_id AND engine_version = p_engine_version)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_ENGINE_PROVENANCE_CONFLICT' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT
    v_bound.training_session_id::uuid,
    v_bound.work_status::text,
    v_bound.resumed::boolean,
    v_bound.started_at::timestamptz,
    v_bound.attempt_count::integer,
    v_bound.correct_count::integer,
    v_bound.last_activity_at::timestamptz;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cza_record_assigned_work_attempt(p_academy_id uuid, p_student_id uuid, p_training_session_id uuid, p_payload jsonb)
 RETURNS TABLE(question_attempt_id uuid, replayed boolean, attempt_count integer, correct_count integer, last_question_index integer, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_session public.training_sessions%ROWTYPE;
  v_existing public.question_attempts%ROWTYPE;
  v_attempt_id uuid;
  v_replayed boolean := false;
  v_client_attempt_id uuid;
  v_question_index integer;
  v_question_id text;
  v_target_number bigint;
  v_student_numeric_answer bigint;
  v_pattern_valid boolean;
  v_is_correct boolean;
  v_error_type text;
  v_error_detail text;
  v_stimulus_duration_ms integer;
  v_response_latency_ms integer;
  v_total_response_time_ms integer;
  v_learning_mode text;
  v_difficulty_level integer;
  v_attempt_number integer;
  v_metadata jsonb;
  v_attempt_count integer;
  v_correct_count integer;
  v_last_question_index integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT sessions.*
  INTO v_session
  FROM public.training_sessions AS sessions
  WHERE sessions.id = p_training_session_id
    AND sessions.academy_id = p_academy_id
    AND sessions.student_id = p_student_id
    AND sessions.recipe_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE = '55000';
  END IF;

  BEGIN
    v_client_attempt_id := (p_payload->>'clientAttemptId')::uuid;
    v_question_index := (p_payload->>'questionIndex')::integer;
    v_question_id := p_payload->>'questionId';
    v_target_number := CASE
      WHEN jsonb_typeof(p_payload->'targetNumber') = 'number'
      THEN (p_payload->>'targetNumber')::bigint ELSE NULL END;
    v_student_numeric_answer := CASE
      WHEN jsonb_typeof(p_payload->'studentNumericAnswer') = 'number'
      THEN (p_payload->>'studentNumericAnswer')::bigint ELSE NULL END;
    v_pattern_valid := COALESCE((p_payload->>'patternValid')::boolean, true);
    v_is_correct := (p_payload->>'isCorrect')::boolean;
    v_error_type := p_payload->>'errorType';
    v_error_detail := p_payload->>'errorDetail';
    v_stimulus_duration_ms := NULLIF(p_payload->>'stimulusDurationMs', '')::integer;
    v_response_latency_ms := NULLIF(p_payload->>'responseLatencyMs', '')::integer;
    v_total_response_time_ms := NULLIF(p_payload->>'totalResponseTimeMs', '')::integer;
    v_learning_mode := p_payload->>'learningMode';
    v_difficulty_level := NULLIF(p_payload->>'difficultyLevel', '')::integer;
    v_attempt_number := COALESCE(NULLIF(p_payload->>'attemptNumber', '')::integer, 1);
    v_metadata := COALESCE(p_payload->'metadata', '{}'::jsonb);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE = '22023';
  END;

  IF v_question_id IS NULL
     OR v_error_type IS NULL
     OR v_is_correct IS NULL
     OR jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'CZA_WORK_ATTEMPT_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.question_attempts (
    academy_id, student_id, training_session_id, module_code,
    client_attempt_id, question_index, question_id, target_number,
    student_numeric_answer, pattern_valid, is_correct, error_type,
    error_detail, stimulus_duration_ms, response_latency_ms,
    total_response_time_ms, learning_mode, difficulty_level,
    attempt_number, metadata
  ) VALUES (
    p_academy_id, p_student_id, p_training_session_id, v_session.module_code,
    v_client_attempt_id, v_question_index, v_question_id, v_target_number,
    v_student_numeric_answer, v_pattern_valid, v_is_correct, v_error_type,
    v_error_detail, v_stimulus_duration_ms, v_response_latency_ms,
    v_total_response_time_ms, v_learning_mode, v_difficulty_level,
    v_attempt_number, v_metadata
  )
  ON CONFLICT (academy_id, client_attempt_id) DO NOTHING
  RETURNING id INTO v_attempt_id;

  IF v_attempt_id IS NULL THEN
    SELECT attempts.*
    INTO v_existing
    FROM public.question_attempts AS attempts
    WHERE attempts.academy_id = p_academy_id
      AND attempts.client_attempt_id = v_client_attempt_id
    FOR SHARE;

    IF v_existing.id IS NULL
       OR v_existing.student_id <> p_student_id
       OR v_existing.training_session_id <> p_training_session_id
       OR v_existing.module_code <> v_session.module_code
       OR v_existing.question_index <> v_question_index
       OR v_existing.question_id <> v_question_id
       OR v_existing.target_number IS DISTINCT FROM v_target_number
       OR v_existing.student_numeric_answer IS DISTINCT FROM v_student_numeric_answer
       OR v_existing.pattern_valid <> v_pattern_valid
       OR v_existing.is_correct <> v_is_correct
       OR v_existing.error_type <> v_error_type
       OR v_existing.error_detail IS DISTINCT FROM v_error_detail
       OR v_existing.metadata <> v_metadata THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;
    v_attempt_id := v_existing.id;
    v_replayed := true;
  END IF;

  SELECT
    count(*) FILTER (
      WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
    )::integer,
    count(*) FILTER (
      WHERE attempts.is_correct
        AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
    )::integer,
    COALESCE(max(attempts.question_index), 0)::integer
  INTO v_attempt_count, v_correct_count, v_last_question_index
  FROM public.question_attempts AS attempts
  WHERE attempts.academy_id = p_academy_id
    AND attempts.student_id = p_student_id
    AND attempts.training_session_id = p_training_session_id;

  UPDATE public.training_sessions
  SET last_activity_at = v_now,
      progress = jsonb_build_object(
        'attemptCount', v_attempt_count,
        'correctCount', v_correct_count,
        'lastQuestionIndex', v_last_question_index,
        'resumeAvailable', true
      )
  WHERE id = p_training_session_id
    AND academy_id = p_academy_id
    AND student_id = p_student_id;

  RETURN QUERY SELECT
    v_attempt_id,
    v_replayed,
    v_attempt_count,
    v_correct_count,
    v_last_question_index,
    v_now;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cza_student_record_learning(p_academy_id uuid, p_student_id uuid, p_student_session_id uuid, p_training_session_id uuid, p_client_record_id uuid, p_record_type text, p_contract_version text, p_schema_version text, p_module_code text, p_module_version text, p_activity_type text, p_started_at timestamp with time zone, p_completed_at timestamp with time zone, p_support_level text, p_performance jsonb, p_skills jsonb, p_metadata jsonb)
 RETURNS TABLE(learning_record_id uuid, replayed boolean, canonical_payload_hash text, verification_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_record_id uuid;
  v_existing_hash text;
  v_payload_hash text;
  v_canonical_payload jsonb;
BEGIN
  IF p_record_type <> 'module_record'
     OR p_contract_version NOT IN ('1.0.0', '1.1.0')
     OR p_schema_version <> 'CZA_MODULE_RECORD_V1' THEN
    RAISE EXCEPTION 'CZA_CONTRACT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF p_completed_at < p_started_at
     OR p_completed_at - p_started_at > interval '24 hours'
     OR p_started_at > clock_timestamp() + interval '5 minutes'
     OR p_completed_at > clock_timestamp() + interval '5 minutes' THEN
    RAISE EXCEPTION 'CZA_RECORD_TIME_ORDER_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_performance) <> 'object'
     OR jsonb_typeof(p_skills) <> 'array'
     OR jsonb_array_length(p_skills) > 32
     OR jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'CZA_RECORD_JSON_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.student_sessions AS sessions
  WHERE sessions.id = p_student_session_id
    AND sessions.academy_id = p_academy_id
    AND sessions.student_id = p_student_id
    AND sessions.revoked_at IS NULL
    AND sessions.expires_at > clock_timestamp()
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_STUDENT_SESSION_REVOKED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.training_sessions AS training
  JOIN public.modules AS modules
    ON modules.code = training.module_code
   AND modules.is_active = true
  WHERE training.id = p_training_session_id
    AND training.academy_id = p_academy_id
    AND training.student_id = p_student_id
    AND training.module_code = p_module_code
    AND p_started_at >= training.started_at - interval '5 minutes'
    AND p_completed_at <= COALESCE(training.completed_at, clock_timestamp()) + interval '5 minutes'
  FOR SHARE OF training;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_SESSION_OWNERSHIP_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF p_contract_version = '1.0.0' THEN
    v_canonical_payload := jsonb_build_object(
      'academyId', p_academy_id, 'studentId', p_student_id,
      'trainingSessionId', p_training_session_id, 'clientRecordId', p_client_record_id,
      'recordType', p_record_type, 'contractVersion', p_contract_version,
      'schemaVersion', p_schema_version, 'moduleId', p_module_code,
      'moduleVersion', p_module_version, 'activityType', p_activity_type,
      'startedAt', p_started_at, 'completedAt', p_completed_at,
      'supportLevel', p_support_level, 'performance', p_performance,
      'skills', p_skills, 'metadata', p_metadata
    );
  ELSE
    v_canonical_payload := jsonb_build_object(
      'academyId', p_academy_id, 'studentId', p_student_id,
      'studentSessionId', p_student_session_id, 'trainingSessionId', p_training_session_id,
      'clientRecordId', p_client_record_id, 'recordType', p_record_type,
      'contractVersion', p_contract_version, 'schemaVersion', p_schema_version,
      'moduleId', p_module_code, 'moduleVersion', p_module_version,
      'activityType', p_activity_type, 'startedAt', p_started_at,
      'completedAt', p_completed_at, 'reportedSupportLevel', p_support_level,
      'reportedPerformance', p_performance, 'reportedSkills', p_skills,
      'metadata', p_metadata, 'recordOrigin', 'client_reported',
      'verificationStatus', 'client_reported'
    );
  END IF;

  v_payload_hash := encode(
    public.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.learning_records (
    academy_id, student_id, student_session_id, module_code,
    training_session_id, client_record_id, payload_hash, record_type,
    record_origin, verification_status, contract_version, schema_version,
    module_version, activity_type, started_at, completed_at, support_level,
    performance, skills, metadata
  )
  VALUES (
    p_academy_id, p_student_id, p_student_session_id, p_module_code,
    p_training_session_id, p_client_record_id, v_payload_hash, p_record_type,
    'client_reported', 'client_reported', p_contract_version, p_schema_version,
    p_module_version, p_activity_type, p_started_at, p_completed_at,
    p_support_level, p_performance, p_skills, p_metadata
  )
  ON CONFLICT (academy_id, client_record_id) DO NOTHING
  RETURNING id INTO v_record_id;

  IF v_record_id IS NULL THEN
    SELECT records.id, records.payload_hash
    INTO v_record_id, v_existing_hash
    FROM public.learning_records AS records
    WHERE records.academy_id = p_academy_id
      AND records.client_record_id = p_client_record_id
    FOR SHARE;

    IF v_record_id IS NULL THEN
      RAISE EXCEPTION 'CZA_IDEMPOTENCY_LOOKUP_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF v_existing_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_record_id, true, v_existing_hash, 'client_reported'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_record_id, false, v_payload_hash, 'client_reported'::text;
END;
$function$
;

