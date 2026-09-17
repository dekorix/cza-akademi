-- U5 HIGH remediation: a cancelled/inactive assignment cannot produce any
-- subsequent attempt, progress, completion, result, evidence, or timeline state.
-- Historical U2 migrations remain immutable; their implementations are retained
-- behind private legacy names and can only be reached by these locked wrappers.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.cza_record_assigned_work_attempt_u5_legacy(uuid,uuid,uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.cza_record_assigned_work_attempt(uuid,uuid,uuid,jsonb)
      RENAME TO cza_record_assigned_work_attempt_u5_legacy;
  END IF;
  IF to_regprocedure('public.cza_complete_assigned_work_u5_legacy(uuid,uuid,uuid,uuid,boolean)') IS NULL THEN
    ALTER FUNCTION public.cza_complete_assigned_work(uuid,uuid,uuid,uuid,boolean)
      RENAME TO cza_complete_assigned_work_u5_legacy;
  END IF;
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
  v_recipe public.training_recipes%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT sessions.* INTO v_session
  FROM public.training_sessions AS sessions
  WHERE sessions.id = p_training_session_id
    AND sessions.academy_id = p_academy_id
    AND sessions.student_id = p_student_id
    AND sessions.recipe_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT recipes.* INTO v_recipe
  FROM public.training_recipes AS recipes
  WHERE recipes.id = v_session.recipe_id
    AND recipes.academy_id = p_academy_id
    AND recipes.student_id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_CLOSED' USING ERRCODE = '55000';
  END IF;
  IF NOT v_recipe.is_active OR v_recipe.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_CLOSED' USING ERRCODE = '55000';
  END IF;
  IF (v_recipe.starts_at IS NOT NULL AND v_recipe.starts_at > v_now)
     OR (v_recipe.expires_at IS NOT NULL AND v_recipe.expires_at <= v_now) THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_CLOSED' USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT * FROM public.cza_record_assigned_work_attempt_u5_legacy(
    p_academy_id, p_student_id, p_training_session_id, p_payload
  );
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
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT sessions.* INTO v_session
  FROM public.training_sessions AS sessions
  WHERE sessions.id = p_training_session_id
    AND sessions.academy_id = p_academy_id
    AND sessions.student_id = p_student_id
    AND sessions.recipe_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT recipes.* INTO v_recipe
  FROM public.training_recipes AS recipes
  WHERE recipes.id = v_session.recipe_id
    AND recipes.academy_id = p_academy_id
    AND recipes.student_id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_recipe.is_active OR v_recipe.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_CLOSED' USING ERRCODE = '55000';
  END IF;
  IF (v_recipe.starts_at IS NOT NULL AND v_recipe.starts_at > v_now)
     OR (v_recipe.expires_at IS NOT NULL AND v_recipe.expires_at <= v_now) THEN
    RAISE EXCEPTION 'CZA_WORK_ASSIGNMENT_CLOSED' USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT * FROM public.cza_complete_assigned_work_u5_legacy(
    p_academy_id, p_student_id, p_student_session_id,
    p_training_session_id, p_aborted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cza_record_assigned_work_attempt_u5_legacy(
  uuid, uuid, uuid, jsonb
) FROM PUBLIC, cza_app_runtime;
REVOKE ALL ON FUNCTION public.cza_complete_assigned_work_u5_legacy(
  uuid, uuid, uuid, uuid, boolean
) FROM PUBLIC, cza_app_runtime;

REVOKE ALL ON FUNCTION public.cza_record_assigned_work_attempt(
  uuid, uuid, uuid, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_complete_assigned_work(
  uuid, uuid, uuid, uuid, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_record_assigned_work_attempt(
  uuid, uuid, uuid, jsonb
) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_complete_assigned_work(
  uuid, uuid, uuid, uuid, boolean
) TO cza_app_runtime;

COMMIT;
