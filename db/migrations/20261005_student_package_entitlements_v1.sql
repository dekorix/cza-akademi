-- CZA · Veli kararı → paket → öğrenci erişim yetkileri v1
-- Additive, non-destructive. Veli kararı, paket aktivasyonu ve çalışma ataması ayrı kayıtlardır.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_package_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  package_code text NOT NULL CHECK (package_code IN ('ANZAN','ZIHIN_GELISIM','BUTUNLESIK')),
  package_label text NOT NULL,
  price_snapshot_try integer NOT NULL CHECK (price_snapshot_try >= 0),
  currency text NOT NULL DEFAULT 'TRY' CHECK (currency = 'TRY'),
  decision text NOT NULL CHECK (decision IN ('APPROVED','DECLINED')),
  decided_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  note text NULL CHECK (note IS NULL OR length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_package_decisions_student
  ON public.student_package_decisions(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_package_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL UNIQUE REFERENCES public.student_package_decisions(id) ON DELETE RESTRICT,
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  package_code text NOT NULL CHECK (package_code IN ('ANZAN','ZIHIN_GELISIM','BUTUNLESIK')),
  package_label text NOT NULL,
  price_snapshot_try integer NOT NULL CHECK (price_snapshot_try >= 0),
  currency text NOT NULL DEFAULT 'TRY' CHECK (currency = 'TRY'),
  activation_basis text NOT NULL CHECK (activation_basis IN ('PAYMENT_CONFIRMED','PILOT_COMPLIMENTARY')),
  access_snapshot jsonb NOT NULL CHECK (jsonb_typeof(access_snapshot) = 'array'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),
  activated_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_package_enrollments_one_active
  ON public.student_package_enrollments(student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_student_package_enrollments_student
  ON public.student_package_enrollments(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_access_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.student_package_enrollments(id) ON DELETE CASCADE,
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  access_code text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, access_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_access_entitlements_active
  ON public.student_access_entitlements(student_id, access_code)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_student_access_entitlements_student
  ON public.student_access_entitlements(student_id, status, access_code);

CREATE OR REPLACE FUNCTION public.cza_record_student_package_decision(
  p_academy_id uuid,
  p_student_id uuid,
  p_package_code text,
  p_package_label text,
  p_price_snapshot_try integer,
  p_decision text,
  p_decided_at timestamptz,
  p_recorded_by uuid,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision_id uuid;
BEGIN
  IF p_package_code NOT IN ('ANZAN','ZIHIN_GELISIM','BUTUNLESIK') THEN
    RAISE EXCEPTION 'CZA_PACKAGE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision NOT IN ('APPROVED','DECLINED') THEN
    RAISE EXCEPTION 'CZA_PARENT_DECISION_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.academy_id = p_academy_id
    AND s.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CZA_STUDENT_PACKAGE_IDENTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.student_package_decisions (
    academy_id, student_id, package_code, package_label, price_snapshot_try,
    currency, decision, decided_at, recorded_by, note
  ) VALUES (
    p_academy_id, p_student_id, p_package_code, p_package_label, p_price_snapshot_try,
    'TRY', p_decision, p_decided_at, p_recorded_by, NULLIF(trim(p_note), '')
  )
  RETURNING id INTO v_decision_id;

  RETURN v_decision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_activate_student_package(
  p_decision_id uuid,
  p_academy_id uuid,
  p_student_id uuid,
  p_activation_basis text,
  p_access_snapshot jsonb,
  p_ready_access_codes jsonb,
  p_activated_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision public.student_package_decisions%ROWTYPE;
  v_enrollment_id uuid;
BEGIN
  IF p_activation_basis NOT IN ('PAYMENT_CONFIRMED','PILOT_COMPLIMENTARY') THEN
    RAISE EXCEPTION 'CZA_ACTIVATION_BASIS_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_access_snapshot) <> 'array' OR jsonb_typeof(p_ready_access_codes) <> 'array' THEN
    RAISE EXCEPTION 'CZA_PACKAGE_ACCESS_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_decision
  FROM public.student_package_decisions
  WHERE id = p_decision_id
    AND academy_id = p_academy_id
    AND student_id = p_student_id
    AND decision = 'APPROVED'
  LIMIT 1;

  IF v_decision.id IS NULL THEN
    RAISE EXCEPTION 'CZA_APPROVED_PARENT_DECISION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.student_package_enrollments
    WHERE student_id = p_student_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'CZA_ACTIVE_PACKAGE_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.student_package_enrollments (
    decision_id, academy_id, student_id, package_code, package_label,
    price_snapshot_try, currency, activation_basis, access_snapshot,
    status, activated_by, starts_at
  ) VALUES (
    p_decision_id, p_academy_id, p_student_id, v_decision.package_code,
    v_decision.package_label, v_decision.price_snapshot_try, 'TRY',
    p_activation_basis, p_access_snapshot, 'active', p_activated_by, now()
  )
  RETURNING id INTO v_enrollment_id;

  INSERT INTO public.student_access_entitlements (
    enrollment_id, academy_id, student_id, access_code, status, granted_at
  )
  SELECT
    v_enrollment_id, p_academy_id, p_student_id, value, 'active', now()
  FROM (
    SELECT DISTINCT value
    FROM jsonb_array_elements_text(p_ready_access_codes)
    WHERE length(value) BETWEEN 1 AND 80
  ) codes;

  RETURN v_enrollment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cza_cancel_student_package(
  p_enrollment_id uuid,
  p_academy_id uuid,
  p_student_id uuid,
  p_cancelled_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.student_package_enrollments
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = p_enrollment_id
    AND academy_id = p_academy_id
    AND student_id = p_student_id
    AND activated_by = p_cancelled_by
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN false; END IF;

  UPDATE public.student_access_entitlements
  SET status = 'revoked', revoked_at = now()
  WHERE enrollment_id = p_enrollment_id
    AND student_id = p_student_id
    AND status = 'active';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cza_record_student_package_decision(
  uuid,uuid,text,text,integer,text,timestamptz,uuid,text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_activate_student_package(
  uuid,uuid,uuid,text,jsonb,jsonb,uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cza_cancel_student_package(uuid,uuid,uuid,uuid) FROM PUBLIC;

COMMIT;
