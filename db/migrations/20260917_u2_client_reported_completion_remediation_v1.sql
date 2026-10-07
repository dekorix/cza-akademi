-- U2 trust-boundary remediation.
-- Additive/idempotent: replaces only the U2 completion function. Historical
-- evidence is deliberately preserved for audit and is never mutated here.
BEGIN;

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
    'evidenceClass', 'client_reported_attempts',
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

  -- U2 attempts remain client-reported. Without a server-authoritative evaluator,
  -- completion must not mint server_verified learning_evidence.
  v_evidence_id := NULL;

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

REVOKE ALL ON FUNCTION public.cza_complete_assigned_work(
  uuid, uuid, uuid, uuid, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cza_complete_assigned_work(
  uuid, uuid, uuid, uuid, boolean
) TO cza_app_runtime;

COMMIT;
