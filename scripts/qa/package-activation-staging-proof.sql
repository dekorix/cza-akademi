\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_academy_id uuid;
  v_educator_id uuid;
  v_student_id uuid := gen_random_uuid();
  v_decision_id uuid;
  v_enrollment_id uuid;
  v_count integer;
  v_cancelled boolean;
  v_access jsonb := '["memory","speed_reading","attention_focus","mind_maps","intelligence_games","effective_notes","full_learning_37"]'::jsonb;
BEGIN
  SELECT u.academy_id,u.id
    INTO v_academy_id,v_educator_id
  FROM public.users u
  WHERE u.is_active=true
    AND u.role::text IN ('educator','admin')
  ORDER BY CASE WHEN u.role::text='educator' THEN 0 ELSE 1 END,u.created_at
  LIMIT 1;

  IF v_academy_id IS NULL OR v_educator_id IS NULL THEN
    RAISE EXCEPTION 'CZA_SYNTH_EDUCATOR_MISSING';
  END IF;

  INSERT INTO public.students (
    id,academy_id,first_name,last_name,status,is_demo,created_by,notes
  ) VALUES (
    v_student_id,v_academy_id,'CZA_SYNTH_PACKAGE','ROLLBACK_QA','active',true,v_educator_id,
    'Transaction-only package activation proof; rolled back at end.'
  );

  SELECT public.cza_record_student_package_decision(
    v_academy_id,
    v_student_id,
    'ZIHIN_GELISIM',
    'Zihin Gelişim Programı',
    15000,
    'APPROVED',
    now(),
    v_educator_id,
    'Synthetic rollback-only QA approval'
  ) INTO v_decision_id;

  IF v_decision_id IS NULL THEN
    RAISE EXCEPTION 'CZA_SYNTH_DECISION_MISSING';
  END IF;

  SELECT public.cza_activate_student_package(
    v_decision_id,
    v_academy_id,
    v_student_id,
    'PILOT_COMPLIMENTARY',
    v_access,
    v_access,
    v_educator_id
  ) INTO v_enrollment_id;

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'CZA_SYNTH_ENROLLMENT_MISSING';
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.student_access_entitlements
  WHERE enrollment_id=v_enrollment_id
    AND student_id=v_student_id
    AND status='active';

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'CZA_SYNTH_ACTIVE_ENTITLEMENT_COUNT=%',v_count;
  END IF;

  SELECT public.cza_cancel_student_package(
    v_enrollment_id,
    v_academy_id,
    v_student_id,
    v_educator_id
  ) INTO v_cancelled;

  IF v_cancelled IS NOT TRUE THEN
    RAISE EXCEPTION 'CZA_SYNTH_CANCEL_FAILED';
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.student_access_entitlements
  WHERE enrollment_id=v_enrollment_id
    AND student_id=v_student_id
    AND status='revoked';

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'CZA_SYNTH_REVOKED_ENTITLEMENT_COUNT=%',v_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.student_package_enrollments
    WHERE id=v_enrollment_id AND status<>'cancelled'
  ) THEN
    RAISE EXCEPTION 'CZA_SYNTH_ENROLLMENT_NOT_CANCELLED';
  END IF;

  RAISE NOTICE 'PACKAGE_ACTIVATION_TRANSACTION=PASS';
  RAISE NOTICE 'ACTIVE_ENTITLEMENTS_BEFORE_CANCEL=7';
  RAISE NOTICE 'REVOKED_ENTITLEMENTS_AFTER_CANCEL=7';
END $$;

ROLLBACK;
