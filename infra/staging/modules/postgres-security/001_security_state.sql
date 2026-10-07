BEGIN;

CREATE TABLE IF NOT EXISTS public.cza_faz3_edge_nonces (
  nonce_hash text PRIMARY KEY CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid NOT NULL,
  principal_subject_hash text NOT NULL CHECK (principal_subject_hash ~ '^[0-9a-f]{64}$'),
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > consumed_at)
);

CREATE INDEX IF NOT EXISTS cza_faz3_edge_nonces_expiry_idx
  ON public.cza_faz3_edge_nonces (expires_at);

CREATE TABLE IF NOT EXISTS public.cza_faz3_access_revocations (
  jwt_id_hash text PRIMARY KEY CHECK (jwt_id_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS public.cza_faz3_staging_principals (
  access_subject_hash text PRIMARY KEY CHECK (access_subject_hash ~ '^[0-9a-f]{64}$'),
  academy_id uuid NOT NULL,
  educator_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('educator', 'reviewer', 'publisher')),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (academy_id, educator_id)
);

CREATE OR REPLACE FUNCTION public.cza_faz3_consume_nonce(
  p_nonce_hash text,
  p_request_id uuid,
  p_subject_hash text,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF p_nonce_hash !~ '^[0-9a-f]{64}$'
     OR p_subject_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at <= clock_timestamp() THEN
    RETURN false;
  END IF;

  DELETE FROM public.cza_faz3_edge_nonces
  WHERE expires_at < clock_timestamp() - interval '15 seconds';

  INSERT INTO public.cza_faz3_edge_nonces (
    nonce_hash, request_id, principal_subject_hash, expires_at
  ) VALUES (
    p_nonce_hash, p_request_id, p_subject_hash, p_expires_at
  ) ON CONFLICT (nonce_hash) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_faz3_resolve_principal(
  p_subject_hash text,
  p_jwt_id_hash text
) RETURNS TABLE (
  academy_id uuid,
  educator_id uuid,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.academy_id, p.educator_id, p.role
  FROM public.cza_faz3_staging_principals p
  WHERE p.access_subject_hash = p_subject_hash
    AND p.active = true
    AND (
      p_jwt_id_hash IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.cza_faz3_access_revocations r
        WHERE r.jwt_id_hash = p_jwt_id_hash
          AND r.expires_at > clock_timestamp()
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON public.cza_faz3_edge_nonces FROM PUBLIC;
REVOKE ALL ON public.cza_faz3_access_revocations FROM PUBLIC;
REVOKE ALL ON public.cza_faz3_staging_principals FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_faz3_consume_nonce(text, uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_faz3_resolve_principal(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_faz3_consume_nonce(text, uuid, text, timestamptz) TO cza_faz3_origin_runtime;
GRANT EXECUTE ON FUNCTION public.cza_faz3_resolve_principal(text, text) TO cza_faz3_origin_runtime;

COMMIT;
