-- CZA U2 Work Center core v1
--
-- Extends the canonical U1 assignment/session/attempt model with durable
-- resume metadata and atomic assigned-work completion. The migration is
-- additive, contains no user data, and is safe to apply repeatedly.

BEGIN;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS client_session_id uuid NULL,
  ADD COLUMN IF NOT EXISTS completion_client_record_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.training_sessions
SET completion_client_record_id = gen_random_uuid()
WHERE completion_client_record_id IS NULL;

UPDATE public.training_sessions
SET last_activity_at = COALESCE(completed_at, started_at, created_at)
WHERE last_activity_at IS NULL;

ALTER TABLE public.training_sessions
  ALTER COLUMN completion_client_record_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN completion_client_record_id SET NOT NULL,
  ALTER COLUMN last_activity_at SET DEFAULT now(),
  ALTER COLUMN last_activity_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_sessions_progress_object_u2_check'
      AND conrelid = 'public.training_sessions'::regclass
  ) THEN
    ALTER TABLE public.training_sessions
      ADD CONSTRAINT training_sessions_progress_object_u2_check
      CHECK (jsonb_typeof(progress) = 'object');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_client_identity_u2
  ON public.training_sessions(academy_id, student_id, client_session_id)
  WHERE client_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_one_active_recipe_u2
  ON public.training_sessions(recipe_id)
  WHERE recipe_id IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_training_sessions_recipe_status_activity_u2
  ON public.training_sessions(recipe_id, status, last_activity_at DESC, id DESC)
  WHERE recipe_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cza_bind_assigned_work_session(
  p_academy_id uuid,
  p_student_id uuid,
  p_recipe_id uuid,
  p_client_session_id uuid,
  p_training_session_id uuid,
  p_started_at timestamptz
)
RETURNS TABLE (
  training_session_id uuid,
  work_status text,
  resumed boolean,
  started_at timestamptz,
  attempt_count integer,
  correct_count integer,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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

  SELECT sessions.*
  INTO v_session
  FROM public.training_sessions AS sessions
  WHERE sessions.recipe_id = p_recipe_id
    AND sessions.academy_id = p_academy_id
    AND sessions.student_id = p_student_id
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
      client_session_id, status, started_at, last_activity_at, progress
    ) VALUES (
      p_training_session_id, p_academy_id, p_student_id, v_recipe.module_code,
      p_recipe_id, p_client_session_id, 'active', p_started_at, p_started_at,
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
      AND public.training_sessions.status = 'active'
    RETURNING * INTO v_session;
  EXCEPTION WHEN unique_violation THEN
    SELECT sessions.*
    INTO v_session
    FROM public.training_sessions AS sessions
    WHERE sessions.recipe_id = p_recipe_id
      AND sessions.academy_id = p_academy_id
      AND sessions.student_id = p_student_id
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
$$;

CREATE OR REPLACE FUNCTION public.cza_record_assigned_work_attempt(
  p_academy_id uuid,
  p_student_id uuid,
  p_training_session_id uuid,
  p_payload jsonb
)
RETURNS TABLE (
  question_attempt_id uuid,
  replayed boolean,
  attempt_count integer,
  correct_count integer,
  last_question_index integer,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.cza_complete_assigned_work(
  p_academy_id uuid,
  p_student_id uuid,
  p_student_session_id uuid,
  p_training_session_id uuid,
  p_aborted boolean
)
RETURNS TABLE (
  training_session_id uuid,
  work_status text,
  replayed boolean,
  learning_record_id uuid,
  evidence_id uuid,
  attempt_count integer,
  correct_count integer,
  timeout_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session public.training_sessions%ROWTYPE;
  v_recipe public.training_recipes%ROWTYPE;
  v_attempt_count integer;
  v_correct_count integer;
  v_timeout_count integer;
  v_expected_count integer;
  v_average_response_ms integer;
  v_skills jsonb;
  v_errors jsonb;
  v_support_level text;
  v_performance jsonb;
  v_metadata jsonb;
  v_completed_at timestamptz := clock_timestamp();
  v_learning_record_id uuid;
  v_evidence_id uuid;
  v_record_replayed boolean;
BEGIN
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

  -- The completion timestamp is part of the canonical idempotency payload.
  -- Replays must therefore reuse the first durable completion timestamp.
  v_completed_at := COALESCE(v_session.completed_at, v_completed_at);

  SELECT recipes.*
  INTO v_recipe
  FROM public.training_recipes AS recipes
  WHERE recipes.id = v_session.recipe_id
    AND recipes.academy_id = p_academy_id
    AND recipes.student_id = p_student_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    count(*) FILTER (
      WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
    )::integer,
    count(*) FILTER (
      WHERE attempts.is_correct
        AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
    )::integer,
    count(*) FILTER (
      WHERE attempts.error_type LIKE '%TIMEOUT%'
        AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
    )::integer,
    COALESCE(round(avg(attempts.total_response_time_ms))::integer, 0)
  INTO v_attempt_count, v_correct_count, v_timeout_count, v_average_response_ms
  FROM public.question_attempts AS attempts
  WHERE attempts.academy_id = p_academy_id
    AND attempts.student_id = p_student_id
    AND attempts.training_session_id = p_training_session_id;

  IF p_aborted THEN
    IF v_session.status = 'completed' THEN
      RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE = '55000';
    END IF;
    UPDATE public.training_sessions
    SET status = 'active',
        completed_at = NULL,
        last_activity_at = v_completed_at,
        progress = progress || jsonb_build_object(
          'attemptCount', v_attempt_count,
          'correctCount', v_correct_count,
          'resumeAvailable', true
        )
    WHERE id = p_training_session_id;
    RETURN QUERY SELECT
      p_training_session_id, 'in_progress'::text, false,
      NULL::uuid, NULL::uuid,
      v_attempt_count, v_correct_count, v_timeout_count;
    RETURN;
  END IF;

  IF v_session.status = 'cancelled' THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE = '55000';
  END IF;

  v_expected_count := COALESCE(
    CASE WHEN jsonb_typeof(v_recipe.settings->'rounds') = 'number'
      THEN (v_recipe.settings->>'rounds')::integer END,
    CASE WHEN jsonb_typeof(v_recipe.settings->'questionCount') = 'number'
      THEN (v_recipe.settings->>'questionCount')::integer END,
    CASE WHEN jsonb_typeof(v_recipe.settings->'exercise') = 'object'
           AND jsonb_typeof(v_recipe.settings->'exercise'->'rounds') = 'number'
      THEN (v_recipe.settings->'exercise'->>'rounds')::integer END,
    1
  );
  v_expected_count := GREATEST(1, LEAST(10000, v_expected_count));

  IF v_attempt_count < v_expected_count THEN
    RAISE EXCEPTION 'CZA_WORK_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(skill_rows.skill ORDER BY skill_rows.skill), '[]'::jsonb)
  INTO v_skills
  FROM (
    SELECT DISTINCT skill_values.skill
    FROM public.question_attempts AS attempts
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(attempts.metadata->'skills') = 'array'
        THEN attempts.metadata->'skills' ELSE '[]'::jsonb END
    ) AS skill_values(skill)
    WHERE attempts.academy_id = p_academy_id
      AND attempts.student_id = p_student_id
      AND attempts.training_session_id = p_training_session_id
    ORDER BY skill_values.skill
    LIMIT 32
  ) AS skill_rows;

  SELECT COALESCE(jsonb_object_agg(error_rows.error_type, error_rows.total), '{}'::jsonb)
  INTO v_errors
  FROM (
    SELECT attempts.error_type, count(*)::integer AS total
    FROM public.question_attempts AS attempts
    WHERE attempts.academy_id = p_academy_id
      AND attempts.student_id = p_student_id
      AND attempts.training_session_id = p_training_session_id
      AND NOT attempts.is_correct
      AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
    GROUP BY attempts.error_type
    ORDER BY attempts.error_type
  ) AS error_rows;

  SELECT CASE
    WHEN bool_or(attempts.learning_mode IN ('guided', 'guided_practice')) THEN 'guided'
    ELSE 'independent'
  END
  INTO v_support_level
  FROM public.question_attempts AS attempts
  WHERE attempts.academy_id = p_academy_id
    AND attempts.student_id = p_student_id
    AND attempts.training_session_id = p_training_session_id;
  v_support_level := COALESCE(v_support_level, 'unknown');

  v_performance := jsonb_build_object(
    'total', v_attempt_count,
    'correct', v_correct_count,
    'wrong', GREATEST(0, v_attempt_count - v_correct_count),
    'timeout', v_timeout_count,
    'accuracy', round(100.0 * v_correct_count / GREATEST(v_attempt_count, 1)),
    'averageResponseMs', v_average_response_ms
  );
  v_metadata := jsonb_build_object(
    'recipeId', v_recipe.id,
    'assignmentSource', v_recipe.source,
    'errors', v_errors,
    'evidenceClass', 'server_aggregated_attempts',
    'workCenterVersion', 'u2-v1'
  );

  SELECT result.learning_record_id, result.replayed
  INTO v_learning_record_id, v_record_replayed
  FROM public.cza_student_record_learning(
    p_academy_id,
    p_student_id,
    p_student_session_id,
    p_training_session_id,
    v_session.completion_client_record_id,
    'module_record',
    '1.1.0',
    'CZA_MODULE_RECORD_V1',
    v_session.module_code,
    '1.0.0',
    'assigned_work',
    v_session.started_at,
    v_completed_at,
    v_support_level,
    v_performance,
    v_skills,
    v_metadata
  ) AS result;

  IF NOT v_record_replayed THEN
    v_evidence_id := public.cza_append_verified_evidence(
      v_learning_record_id,
      'activity_result',
      NULL,
      v_support_level,
      v_completed_at,
      'work_center_completion:v1',
      v_performance || jsonb_build_object('errors', v_errors)
    );
  ELSE
    SELECT evidence.id
    INTO v_evidence_id
    FROM public.learning_evidence AS evidence
    WHERE evidence.learning_record_id = v_learning_record_id
      AND evidence.evidence_type = 'activity_result'
      AND evidence.verification_authority = 'work_center_completion:v1'
    ORDER BY evidence.created_at, evidence.id
    LIMIT 1;
  END IF;

  UPDATE public.training_sessions
  SET status = 'completed',
      completed_at = COALESCE(completed_at, v_completed_at),
      last_activity_at = v_completed_at,
      progress = jsonb_build_object(
        'attemptCount', v_attempt_count,
        'correctCount', v_correct_count,
        'lastQuestionIndex', v_attempt_count,
        'resumeAvailable', false,
        'learningRecordId', v_learning_record_id,
        'evidenceId', v_evidence_id
      )
  WHERE id = p_training_session_id
    AND academy_id = p_academy_id
    AND student_id = p_student_id;

  RETURN QUERY SELECT
    p_training_session_id,
    'completed'::text,
    v_session.status = 'completed' OR v_record_replayed,
    v_learning_record_id,
    v_evidence_id,
    v_attempt_count,
    v_correct_count,
    v_timeout_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cza_bind_assigned_work_session(
  uuid, uuid, uuid, uuid, uuid, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_record_assigned_work_attempt(
  uuid, uuid, uuid, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_complete_assigned_work(
  uuid, uuid, uuid, uuid, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cza_bind_assigned_work_session(
  uuid, uuid, uuid, uuid, uuid, timestamptz
) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_record_assigned_work_attempt(
  uuid, uuid, uuid, jsonb
) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_complete_assigned_work(
  uuid, uuid, uuid, uuid, boolean
) TO cza_app_runtime;

COMMIT;
