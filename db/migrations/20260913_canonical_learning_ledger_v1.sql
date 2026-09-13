-- CZA Faz 2: Canonical Learning Ledger v1
-- Yıkıcı değildir; mevcut training_sessions/question_attempts yollarını değiştirmez.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.learning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  module_code text NOT NULL REFERENCES public.modules(code),
  training_session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  client_record_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  record_type text NOT NULL DEFAULT 'module_record' CHECK (record_type = 'module_record'),
  contract_version text NOT NULL,
  schema_version text NOT NULL CHECK (schema_version = 'CZA_MODULE_RECORD_V1'),
  module_version text NOT NULL,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  support_level text NOT NULL CHECK (
    support_level IN ('independent', 'prompted', 'guided', 'modeled', 'unknown')
  ),
  performance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(performance) = 'object'),
  skills jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(skills) = 'array'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at >= started_at),
  UNIQUE (academy_id, client_record_id),
  UNIQUE (id, academy_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_records_student_completed
  ON public.learning_records(student_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_records_session
  ON public.learning_records(training_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_learning_records_module_student
  ON public.learning_records(module_code, student_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.learning_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_record_id uuid NOT NULL,
  academy_id uuid NOT NULL,
  student_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('activity_result', 'skill_observation')),
  skill_code text NULL,
  support_level text NOT NULL CHECK (
    support_level IN ('independent', 'prompted', 'guided', 'modeled', 'unknown')
  ),
  observed_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_evidence_record_identity_fkey
    FOREIGN KEY (learning_record_id, academy_id, student_id)
    REFERENCES public.learning_records(id, academy_id, student_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learning_evidence_student_observed
  ON public.learning_evidence(student_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_evidence_skill_student
  ON public.learning_evidence(skill_code, student_id, observed_at DESC)
  WHERE skill_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cza_student_record_learning(
  p_academy_id uuid,
  p_student_id uuid,
  p_training_session_id uuid,
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

  v_canonical_payload := jsonb_build_object(
    'academyId', p_academy_id,
    'studentId', p_student_id,
    'trainingSessionId', p_training_session_id,
    'clientRecordId', p_client_record_id,
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
  uuid, uuid, uuid, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, text, jsonb, jsonb, jsonb
) FROM PUBLIC;

COMMENT ON TABLE public.learning_records IS
  'CZA immutable canonical learning ledger and idempotency receipt.';

COMMENT ON TABLE public.learning_evidence IS
  'Queryable pedagogical evidence derived transactionally from canonical learning records.';

COMMIT;
