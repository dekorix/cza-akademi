-- CZA Faz 2: Canonical Learning Ledger v1 + Security/Data Integrity hardening
-- Client telemetry is immutable but is never promoted to verified evidence.
-- Safe both for fresh databases and upgrades from the PR #31 schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cza_app_runtime') THEN
    CREATE ROLE cza_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cza_evidence_verifier') THEN
    CREATE ROLE cza_evidence_verifier NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cza_ledger_reader') THEN
    CREATE ROLE cza_ledger_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.api_rate_limit_windows (
  scope text NOT NULL,
  subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, subject_hash, window_started_at),
  CHECK (scope ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_windows_expiry
  ON public.api_rate_limit_windows(expires_at);

CREATE TABLE IF NOT EXISTS public.trusted_proxy_nonces (
  nonce_hash text PRIMARY KEY CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_trusted_proxy_nonces_expiry
  ON public.trusted_proxy_nonces(expires_at);

CREATE OR REPLACE FUNCTION public.cza_prune_rate_limit_windows(
  p_batch_size integer DEFAULT 1000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_batch_size < 1 OR p_batch_size > 10000 THEN
    RAISE EXCEPTION 'CZA_RATE_LIMIT_PRUNE_ARGUMENT_INVALID' USING ERRCODE = '22023';
  END IF;

  WITH expired AS (
    SELECT windows.ctid
    FROM public.api_rate_limit_windows AS windows
    WHERE windows.expires_at <= clock_timestamp()
    ORDER BY windows.expires_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.api_rate_limit_windows AS windows
  USING expired
  WHERE windows.ctid = expired.ctid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_consume_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_expires_at timestamptz;
  v_count integer;
BEGIN
  IF p_scope !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     OR p_subject_hash !~ '^[0-9a-f]{64}$'
     OR p_limit < 1 OR p_limit > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'CZA_RATE_LIMIT_ARGUMENT_INVALID' USING ERRCODE = '22023';
  END IF;

  -- One concurrent consumer performs a bounded global sweep. Every request can
  -- insert at most one row while the winner removes up to 1000 expired rows.
  IF pg_try_advisory_xact_lock(2147483647, 1129431378) THEN
    PERFORM public.cza_prune_rate_limit_windows(1000);
  END IF;

  v_window_started_at := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_started_at + make_interval(secs => p_window_seconds);

  INSERT INTO public.api_rate_limit_windows (
    scope,
    subject_hash,
    window_started_at,
    request_count,
    expires_at
  )
  VALUES (
    p_scope,
    p_subject_hash,
    v_window_started_at,
    1,
    v_expires_at
  )
  ON CONFLICT (scope, subject_hash, window_started_at)
  DO UPDATE SET
    request_count = LEAST(
      public.api_rate_limit_windows.request_count + 1,
      p_limit + 1
    )
  RETURNING request_count INTO v_count;

  RETURN QUERY SELECT
    v_count <= p_limit,
    CASE
      WHEN v_count <= p_limit THEN 0
      ELSE GREATEST(1, ceil(extract(epoch FROM (v_expires_at - v_now)))::integer)
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_consume_trusted_proxy_nonce(
  p_nonce_hash text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_inserted boolean;
BEGIN
  IF p_nonce_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at <= v_now
     OR p_expires_at > v_now + interval '5 minutes' THEN
    RAISE EXCEPTION 'CZA_PROXY_NONCE_INVALID' USING ERRCODE = '22023';
  END IF;

  WITH expired AS (
    SELECT nonces.ctid
    FROM public.trusted_proxy_nonces AS nonces
    WHERE nonces.expires_at <= v_now
    ORDER BY nonces.expires_at
    LIMIT 1000
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.trusted_proxy_nonces AS nonces
  USING expired
  WHERE nonces.ctid = expired.ctid;

  INSERT INTO public.trusted_proxy_nonces (nonce_hash, expires_at)
  VALUES (p_nonce_hash, p_expires_at)
  ON CONFLICT (nonce_hash) DO NOTHING
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_touch_authenticated_student(
  p_token_hash text
)
RETURNS TABLE (
  session_id uuid,
  student_id uuid,
  academy_id uuid,
  student_user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.student_sessions AS sessions
  SET last_seen_at = clock_timestamp()
  FROM public.students AS students, public.users AS users
  WHERE p_token_hash ~ '^[0-9a-f]{64}$'
    AND sessions.token_hash = p_token_hash
    AND sessions.revoked_at IS NULL
    AND sessions.expires_at > clock_timestamp()
    AND students.id = sessions.student_id
    AND users.id = sessions.student_user_id
    AND students.status = 'active'
    AND users.is_active = true
    AND users.role = 'student'
  RETURNING
    sessions.id,
    sessions.student_id,
    sessions.academy_id,
    sessions.student_user_id;
$$;

CREATE OR REPLACE FUNCTION public.cza_revoke_student_session(
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'CZA_SESSION_TOKEN_HASH_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE public.student_sessions
  SET revoked_at = COALESCE(revoked_at, clock_timestamp())
  WHERE token_hash = p_token_hash;

  RETURN true;
END;
$$;

CREATE TABLE IF NOT EXISTS public.learning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL,
  student_id uuid NOT NULL,
  student_session_id uuid NULL,
  module_code text NOT NULL,
  training_session_id uuid NOT NULL,
  client_record_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  record_type text NOT NULL DEFAULT 'module_record' CHECK (record_type = 'module_record'),
  record_origin text NOT NULL DEFAULT 'client_reported',
  verification_status text NOT NULL DEFAULT 'client_reported',
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
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academy_id, client_record_id),
  UNIQUE (id, academy_id, student_id)
);

DROP TRIGGER IF EXISTS learning_records_immutable_rows ON public.learning_records;
DROP TRIGGER IF EXISTS learning_records_immutable_truncate ON public.learning_records;

ALTER TABLE public.learning_records
  ADD COLUMN IF NOT EXISTS student_session_id uuid,
  ADD COLUMN IF NOT EXISTS record_origin text NOT NULL DEFAULT 'client_reported',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'client_reported';

ALTER TABLE public.learning_records
  DROP CONSTRAINT IF EXISTS learning_records_record_origin_check,
  DROP CONSTRAINT IF EXISTS learning_records_verification_status_check,
  DROP CONSTRAINT IF EXISTS learning_records_contract_version_check,
  DROP CONSTRAINT IF EXISTS learning_records_session_binding_check,
  DROP CONSTRAINT IF EXISTS learning_records_skills_check,
  DROP CONSTRAINT IF EXISTS learning_records_duration_check,
  DROP CONSTRAINT IF EXISTS learning_records_academy_id_fkey,
  DROP CONSTRAINT IF EXISTS learning_records_student_id_fkey,
  DROP CONSTRAINT IF EXISTS learning_records_student_session_id_fkey,
  DROP CONSTRAINT IF EXISTS learning_records_module_code_fkey,
  DROP CONSTRAINT IF EXISTS learning_records_training_session_id_fkey;

UPDATE public.learning_records
SET record_origin = 'legacy_client_reported'
WHERE student_session_id IS NULL;

UPDATE public.learning_records AS records
SET student_session_id = (
  SELECT sessions.id
  FROM public.student_sessions AS sessions
  WHERE sessions.academy_id = records.academy_id
    AND sessions.student_id = records.student_id
  ORDER BY
    CASE
      WHEN records.created_at BETWEEN sessions.created_at AND sessions.expires_at THEN 0
      ELSE 1
    END,
    abs(extract(epoch FROM (sessions.created_at - records.created_at))),
    sessions.created_at DESC
  LIMIT 1
)
WHERE records.student_session_id IS NULL;

UPDATE public.learning_records
SET verification_status = 'client_reported'
WHERE verification_status IS DISTINCT FROM 'client_reported';

ALTER TABLE public.learning_records
  ADD CONSTRAINT learning_records_record_origin_check
    CHECK (record_origin IN ('client_reported', 'legacy_client_reported')),
  ADD CONSTRAINT learning_records_verification_status_check
    CHECK (verification_status = 'client_reported'),
  ADD CONSTRAINT learning_records_contract_version_check
    CHECK (contract_version IN ('1.0.0', '1.1.0')),
  ADD CONSTRAINT learning_records_session_binding_check
    CHECK (record_origin = 'legacy_client_reported' OR student_session_id IS NOT NULL),
  ADD CONSTRAINT learning_records_skills_check
    CHECK (jsonb_typeof(skills) = 'array' AND jsonb_array_length(skills) <= 32),
  ADD CONSTRAINT learning_records_duration_check
    CHECK (completed_at >= started_at AND completed_at - started_at <= interval '24 hours'),
  ADD CONSTRAINT learning_records_academy_id_fkey
    FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT,
  ADD CONSTRAINT learning_records_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT,
  ADD CONSTRAINT learning_records_student_session_id_fkey
    FOREIGN KEY (student_session_id) REFERENCES public.student_sessions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT learning_records_module_code_fkey
    FOREIGN KEY (module_code) REFERENCES public.modules(code) ON DELETE RESTRICT,
  ADD CONSTRAINT learning_records_training_session_id_fkey
    FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_learning_records_academy_student_completed_v2
  ON public.learning_records(academy_id, student_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_records_academy_session_created_v2
  ON public.learning_records(academy_id, training_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_records_academy_module_student_v2
  ON public.learning_records(academy_id, module_code, student_id, completed_at DESC);
DROP INDEX IF EXISTS public.idx_learning_records_student_completed;
DROP INDEX IF EXISTS public.idx_learning_records_session;
DROP INDEX IF EXISTS public.idx_learning_records_module_student;

CREATE TABLE IF NOT EXISTS public.learning_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_record_id uuid NOT NULL,
  academy_id uuid NOT NULL,
  student_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('activity_result', 'skill_observation')),
  verification_status text NULL,
  verification_authority text NULL,
  skill_code text NULL,
  support_level text NOT NULL CHECK (
    support_level IN ('independent', 'prompted', 'guided', 'modeled', 'unknown')
  ),
  observed_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS learning_evidence_immutable_rows ON public.learning_evidence;
DROP TRIGGER IF EXISTS learning_evidence_immutable_truncate ON public.learning_evidence;

ALTER TABLE public.learning_evidence
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS verification_authority text,
  DROP CONSTRAINT IF EXISTS learning_evidence_verification_status_check,
  DROP CONSTRAINT IF EXISTS learning_evidence_record_identity_fkey;

UPDATE public.learning_evidence
SET verification_status = 'legacy_client_reported',
    verification_authority = 'legacy_unverified_import'
WHERE verification_status IS NULL;

ALTER TABLE public.learning_evidence
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN verification_authority SET NOT NULL,
  ADD CONSTRAINT learning_evidence_verification_status_check
    CHECK (verification_status IN ('server_verified', 'legacy_client_reported')),
  ADD CONSTRAINT learning_evidence_record_identity_fkey
    FOREIGN KEY (learning_record_id, academy_id, student_id)
    REFERENCES public.learning_records(id, academy_id, student_id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_learning_evidence_academy_student_observed_v2
  ON public.learning_evidence(academy_id, student_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_verified_skill_student_v2
  ON public.learning_evidence(academy_id, skill_code, student_id, observed_at DESC)
  WHERE skill_code IS NOT NULL AND verification_status = 'server_verified';
DROP INDEX IF EXISTS public.idx_learning_evidence_student_observed;
DROP INDEX IF EXISTS public.idx_learning_evidence_skill_student;

DROP FUNCTION IF EXISTS public.cza_student_record_learning(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, text, jsonb, jsonb, jsonb
);
DROP FUNCTION IF EXISTS public.cza_student_record_learning(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, text, jsonb, jsonb, jsonb
);

CREATE FUNCTION public.cza_student_record_learning(
  p_academy_id uuid,
  p_student_id uuid,
  p_student_session_id uuid,
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
  canonical_payload_hash text,
  verification_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.cza_append_verified_evidence(
  p_learning_record_id uuid,
  p_evidence_type text,
  p_skill_code text,
  p_support_level text,
  p_observed_at timestamptz,
  p_verification_authority text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.cza_reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'CZA_IMMUTABLE_LEDGER' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER learning_records_immutable_rows
BEFORE UPDATE OR DELETE ON public.learning_records
FOR EACH ROW EXECUTE FUNCTION public.cza_reject_ledger_mutation();
CREATE TRIGGER learning_records_immutable_truncate
BEFORE TRUNCATE ON public.learning_records
FOR EACH STATEMENT EXECUTE FUNCTION public.cza_reject_ledger_mutation();
CREATE TRIGGER learning_evidence_immutable_rows
BEFORE UPDATE OR DELETE ON public.learning_evidence
FOR EACH ROW EXECUTE FUNCTION public.cza_reject_ledger_mutation();
CREATE TRIGGER learning_evidence_immutable_truncate
BEFORE TRUNCATE ON public.learning_evidence
FOR EACH STATEMENT EXECUTE FUNCTION public.cza_reject_ledger_mutation();

GRANT USAGE ON SCHEMA public TO cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON TABLE public.api_rate_limit_windows FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON TABLE public.trusted_proxy_nonces FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON TABLE public.learning_records FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON TABLE public.learning_evidence FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;

REVOKE ALL ON FUNCTION public.cza_prune_rate_limit_windows(integer) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_consume_rate_limit(text, text, integer, integer) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_consume_trusted_proxy_nonce(text, timestamptz) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_touch_authenticated_student(text) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_revoke_student_session(text) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_student_record_learning(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, text, jsonb, jsonb, jsonb
) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_append_verified_evidence(
  uuid, text, text, text, timestamptz, text, jsonb
) FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;
REVOKE ALL ON FUNCTION public.cza_reject_ledger_mutation() FROM PUBLIC, cza_app_runtime, cza_evidence_verifier, cza_ledger_reader;

GRANT EXECUTE ON FUNCTION public.cza_consume_rate_limit(text, text, integer, integer) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_consume_trusted_proxy_nonce(text, timestamptz) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_touch_authenticated_student(text) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_revoke_student_session(text) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_student_record_learning(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, text, jsonb, jsonb, jsonb
) TO cza_app_runtime;
GRANT EXECUTE ON FUNCTION public.cza_append_verified_evidence(
  uuid, text, text, text, timestamptz, text, jsonb
) TO cza_evidence_verifier;
GRANT SELECT ON public.learning_records, public.learning_evidence TO cza_ledger_reader;

COMMENT ON ROLE cza_app_runtime IS
  'Least-privilege CZA client-facing runtime; may consume limits and append client telemetry only.';
COMMENT ON ROLE cza_evidence_verifier IS
  'Server-authoritative verifier; may append evidence only through cza_append_verified_evidence.';
COMMENT ON ROLE cza_ledger_reader IS
  'Read-only reporting role for canonical telemetry and verified evidence.';
COMMENT ON TABLE public.learning_records IS
  'Immutable canonical client telemetry ledger. Legacy rows may lack a recoverable session binding.';
COMMENT ON TABLE public.learning_evidence IS
  'Immutable server-verified evidence; legacy client-derived rows remain explicitly quarantined.';
COMMENT ON TABLE public.trusted_proxy_nonces IS
  'Short-lived single-use HMAC nonces that prevent replay across application instances.';

COMMIT;
