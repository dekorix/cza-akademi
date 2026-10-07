-- U8 atomicity guard for multi-step coaching mutations.
-- Additive and idempotent. Raises a DB exception so the whole statement rolls back.
CREATE OR REPLACE FUNCTION public.cza_u8_require_atomic(ok boolean, failure_code text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  IF NOT COALESCE(ok, false) THEN
    RAISE EXCEPTION '%', failure_code USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$$;
