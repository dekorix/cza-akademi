-- CZA Real Student History V1: bind canonical client-reported learning records
-- to the authenticated student session without weakening legacy compatibility.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.student_sessions') IS NULL THEN
    RAISE EXCEPTION 'CZA_STUDENT_SESSIONS_TABLE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF to_regclass('public.learning_records') IS NULL THEN
    RAISE EXCEPTION 'CZA_LEARNING_RECORDS_TABLE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

ALTER TABLE public.learning_records
  ADD COLUMN IF NOT EXISTS record_origin text;

ALTER TABLE public.learning_records
  ADD COLUMN IF NOT EXISTS student_session_id uuid;

-- Records that predate session binding are honestly marked as legacy.
UPDATE public.learning_records
SET record_origin = 'legacy_client_reported'
WHERE record_origin IS NULL
   OR (record_origin = 'client_reported' AND student_session_id IS NULL);

ALTER TABLE public.learning_records
  ALTER COLUMN record_origin SET DEFAULT 'client_reported',
  ALTER COLUMN record_origin SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.learning_records'::regclass
      AND conname = 'learning_records_record_origin_check'
  ) THEN
    ALTER TABLE public.learning_records
      ADD CONSTRAINT learning_records_record_origin_check
      CHECK (record_origin IN ('client_reported', 'legacy_client_reported'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.learning_records'::regclass
      AND conname = 'learning_records_student_session_id_fkey'
  ) THEN
    ALTER TABLE public.learning_records
      ADD CONSTRAINT learning_records_student_session_id_fkey
      FOREIGN KEY (student_session_id)
      REFERENCES public.student_sessions(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.learning_records'::regclass
      AND conname = 'learning_records_session_binding_check'
  ) THEN
    ALTER TABLE public.learning_records
      ADD CONSTRAINT learning_records_session_binding_check
      CHECK (
        record_origin = 'legacy_client_reported'
        OR student_session_id IS NOT NULL
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_learning_records_student_session
  ON public.learning_records(student_session_id, created_at DESC)
  WHERE student_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cza_student_record_learning(
  p_academy_id uuid,
  p_student_id uuid,
  p_training_session_id uuid,
  p_student_session_id uuid,
  p_client_record_id uuid,
  p_record_type text,
  p_contract_version text,
  p_schema_version text,
  p_module_code text,
  p_module_version text,
  p_activity_type text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_support_level text,
  p_performance jsonb,
  p_skills jsonb,
  p_metadata jsonb
)
RETURNS TABLE (
  learning_record_id uuid,
  replayed boolean,
  canonical_payload_hash text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_id uuid;
  v_existing_hash text;
  v_payload_hash text;
  v_canonical_payload jsonb;
BEGIN
  IF p_record_type <> 'module_record'
     OR p_contract_version <> '1.0.0'
     OR p_schema_version <> 'CZA_MODULE_RECORD_V1' THEN
    RAISE EXCEPTION 'CZA_CONTRACT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF p_completed_at < p_started_at THEN
    RAISE EXCEPTION 'CZA_RECORD_TIME_ORDER_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_performance) <> 'object'
     OR jsonb_typeof(p_skills) <> 'array'
     OR jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'CZA_RECORD_JSON_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.training_sessions ts
  JOIN public.modules m
    ON m.code = ts.module_code
   AND m.is_active = true
  WHERE ts.id = p_training_session_id
    AND ts.academy_id = p_academy_id
    AND ts.student_id = p_student_id
    AND ts.module_code = p_module_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_SESSION_OWNERSHIP_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.student_sessions ss
  WHERE ss.id = p_student_session_id
    AND ss.academy_id = p_academy_id
    AND ss.student_id = p_student_id
    AND ss.revoked_at IS NULL
    AND ss.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_STUDENT_SESSION_OWNERSHIP_INVALID' USING ERRCODE = 'P0001';
  END IF;

  v_canonical_payload := jsonb_build_object(
    'academyId', p_academy_id,
    'studentId', p_student_id,
    'trainingSessionId', p_training_session_id,
    'studentSessionId', p_student_session_id,
    'clientRecordId', p_client_record_id,
    'recordOrigin', 'client_reported',
    'recordType', p_record_type,
    'contractVersion', p_contract_version,
    'schemaVersion', p_schema_version,
    'moduleId', p_module_code,
    'moduleVersion', p_module_version,
    'activityType', p_activity_type,
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'supportLevel', p_support_level,
    'performance', p_performance,
    'skills', p_skills,
    'metadata', p_metadata
  );

  v_payload_hash := encode(
    digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.learning_records (
    academy_id,
    student_id,
    module_code,
    training_session_id,
    student_session_id,
    record_origin,
    client_record_id,
    payload_hash,
    record_type,
    contract_version,
    schema_version,
    module_version,
    activity_type,
    started_at,
    completed_at,
    support_level,
    performance,
    skills,
    metadata
  )
  VALUES (
    p_academy_id,
    p_student_id,
    p_module_code,
    p_training_session_id,
    p_student_session_id,
    'client_reported',
    p_client_record_id,
    v_payload_hash,
    p_record_type,
    p_contract_version,
    p_schema_version,
    p_module_version,
    p_activity_type,
    p_started_at,
    p_completed_at,
    p_support_level,
    p_performance,
    p_skills,
    p_metadata
  )
  ON CONFLICT (academy_id, client_record_id) DO NOTHING
  RETURNING id INTO v_record_id;

  IF v_record_id IS NULL THEN
    SELECT lr.id, lr.payload_hash
    INTO v_record_id, v_existing_hash
    FROM public.learning_records lr
    WHERE lr.academy_id = p_academy_id
      AND lr.client_record_id = p_client_record_id;

    IF v_record_id IS NULL THEN
      RAISE EXCEPTION 'CZA_IDEMPOTENCY_LOOKUP_FAILED' USING ERRCODE = 'P0001';
    END IF;

    IF v_existing_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_record_id, true, v_existing_hash;
    RETURN;
  END IF;

  IF jsonb_array_length(p_skills) = 0 THEN
    INSERT INTO public.learning_evidence (
      learning_record_id,
      academy_id,
      student_id,
      evidence_type,
      skill_code,
      support_level,
      observed_at,
      payload
    )
    VALUES (
      v_record_id,
      p_academy_id,
      p_student_id,
      'activity_result',
      NULL,
      p_support_level,
      p_completed_at,
      jsonb_build_object('performance', p_performance, 'metadata', p_metadata)
    );
  ELSE
    INSERT INTO public.learning_evidence (
      learning_record_id,
      academy_id,
      student_id,
      evidence_type,
      skill_code,
      support_level,
      observed_at,
      payload
    )
    SELECT
      v_record_id,
      p_academy_id,
      p_student_id,
      'skill_observation',
      skill.value,
      p_support_level,
      p_completed_at,
      jsonb_build_object('performance', p_performance, 'metadata', p_metadata)
    FROM (
      SELECT DISTINCT value
      FROM jsonb_array_elements_text(p_skills)
    ) AS skill;
  END IF;

  RETURN QUERY SELECT v_record_id, false, v_payload_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.cza_student_record_learning(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, text, jsonb, jsonb, jsonb
) FROM PUBLIC;

COMMENT ON COLUMN public.learning_records.student_session_id IS
  'Authenticated CZA student session that authorized a client-reported canonical record.';

COMMENT ON COLUMN public.learning_records.record_origin IS
  'Origin of the canonical record: current authenticated client report or legacy pre-binding report.';

COMMIT;
