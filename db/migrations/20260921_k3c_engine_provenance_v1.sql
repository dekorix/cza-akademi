-- K3-C additive engine provenance and canonical response envelope.
-- Existing rows intentionally remain NULL: no historical engine identity is invented.

BEGIN;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS engine_id text NULL,
  ADD COLUMN IF NOT EXISTS engine_version text NULL;

ALTER TABLE public.question_attempts
  ADD COLUMN IF NOT EXISTS engine_id text NULL,
  ADD COLUMN IF NOT EXISTS engine_version text NULL,
  ADD COLUMN IF NOT EXISTS response_type text NULL,
  ADD COLUMN IF NOT EXISTS response_payload jsonb NULL;

ALTER TABLE public.learning_records
  ADD COLUMN IF NOT EXISTS engine_id text NULL,
  ADD COLUMN IF NOT EXISTS engine_version text NULL;

ALTER TABLE public.learning_evidence
  ADD COLUMN IF NOT EXISTS engine_id text NULL,
  ADD COLUMN IF NOT EXISTS engine_version text NULL;

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_engine_provenance_k3c_check,
  ADD CONSTRAINT training_sessions_engine_provenance_k3c_check CHECK (
    (engine_id IS NULL AND engine_version IS NULL)
    OR (
      engine_id IS NOT NULL
      AND engine_version IS NOT NULL
      AND engine_id ~ '^[A-Z][A-Z0-9_]{0,79}$'
      AND engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'
    )
  );

ALTER TABLE public.question_attempts
  DROP CONSTRAINT IF EXISTS question_attempts_engine_provenance_k3c_check,
  DROP CONSTRAINT IF EXISTS question_attempts_response_k3c_check,
  ADD CONSTRAINT question_attempts_engine_provenance_k3c_check CHECK (
    (engine_id IS NULL AND engine_version IS NULL)
    OR (
      engine_id IS NOT NULL
      AND engine_version IS NOT NULL
      AND engine_id ~ '^[A-Z][A-Z0-9_]{0,79}$'
      AND engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'
    )
  ),
  ADD CONSTRAINT question_attempts_response_k3c_check CHECK (
    (response_type IS NULL AND response_payload IS NULL)
    OR COALESCE(
      response_type IS NOT NULL
      AND response_payload IS NOT NULL
      AND response_type = 'numeric'
      AND jsonb_typeof(response_payload) = 'object'
      AND response_payload ? 'value'
      AND jsonb_typeof(response_payload->'value') = 'number'
      AND (response_payload->>'value') ~ '^-?[0-9]+$',
      false
    )
  );

ALTER TABLE public.learning_records
  DROP CONSTRAINT IF EXISTS learning_records_engine_provenance_k3c_check,
  ADD CONSTRAINT learning_records_engine_provenance_k3c_check CHECK (
    (engine_id IS NULL AND engine_version IS NULL)
    OR (
      engine_id IS NOT NULL
      AND engine_version IS NOT NULL
      AND engine_id ~ '^[A-Z][A-Z0-9_]{0,79}$'
      AND engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'
    )
  );

ALTER TABLE public.learning_evidence
  DROP CONSTRAINT IF EXISTS learning_evidence_engine_provenance_k3c_check,
  ADD CONSTRAINT learning_evidence_engine_provenance_k3c_check CHECK (
    (engine_id IS NULL AND engine_version IS NULL)
    OR (
      engine_id IS NOT NULL
      AND engine_version IS NOT NULL
      AND engine_id ~ '^[A-Z][A-Z0-9_]{0,79}$'
      AND engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'
    )
  );

CREATE OR REPLACE FUNCTION public.cza_k3c_stamp_question_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session public.training_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.training_sessions WHERE id = NEW.training_session_id;
  NEW.engine_id := v_session.engine_id;
  NEW.engine_version := v_session.engine_version;
  NEW.response_type := NULLIF(NEW.metadata->>'responseType', '');
  NEW.response_payload := NEW.metadata->'responsePayload';
  IF NEW.response_type IS NULL AND NEW.response_payload IS NULL
     AND NEW.student_numeric_answer IS NOT NULL THEN
    NEW.response_type := 'numeric';
    NEW.response_payload := jsonb_build_object('value', NEW.student_numeric_answer);
  ELSIF NEW.response_type IS NULL OR NEW.response_payload IS NULL THEN
    RAISE EXCEPTION 'CZA_GENERIC_RESPONSE_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_k3c_stamp_learning_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session public.training_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.training_sessions WHERE id = NEW.training_session_id;
  NEW.engine_id := v_session.engine_id;
  NEW.engine_version := v_session.engine_version;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_k3c_stamp_learning_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_record public.learning_records%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM public.learning_records WHERE id = NEW.learning_record_id;
  NEW.engine_id := v_record.engine_id;
  NEW.engine_version := v_record.engine_version;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_bind_assigned_work_session_k3c(
  p_academy_id uuid,
  p_student_id uuid,
  p_recipe_id uuid,
  p_client_session_id uuid,
  p_training_session_id uuid,
  p_started_at timestamptz,
  p_engine_id text,
  p_engine_version text
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
$$;

DROP TRIGGER IF EXISTS question_attempts_engine_response_k3c ON public.question_attempts;
CREATE TRIGGER question_attempts_engine_response_k3c
BEFORE INSERT ON public.question_attempts
FOR EACH ROW EXECUTE FUNCTION public.cza_k3c_stamp_question_attempt();

DROP TRIGGER IF EXISTS learning_records_engine_provenance_k3c ON public.learning_records;
CREATE TRIGGER learning_records_engine_provenance_k3c
BEFORE INSERT ON public.learning_records
FOR EACH ROW EXECUTE FUNCTION public.cza_k3c_stamp_learning_record();

DROP TRIGGER IF EXISTS learning_evidence_engine_provenance_k3c ON public.learning_evidence;
CREATE TRIGGER learning_evidence_engine_provenance_k3c
BEFORE INSERT ON public.learning_evidence
FOR EACH ROW EXECUTE FUNCTION public.cza_k3c_stamp_learning_evidence();

REVOKE ALL ON FUNCTION public.cza_bind_assigned_work_session_k3c(
  uuid, uuid, uuid, uuid, uuid, timestamptz, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_bind_assigned_work_session_k3c(
  uuid, uuid, uuid, uuid, uuid, timestamptz, text, text
) TO cza_app_runtime;

COMMIT;
