-- REVIEW ONLY. Revoke new function only; preserve all data and existing functions.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user <> 'cza_t5_test_owner' THEN
    RAISE EXCEPTION 'demo_read_target_rejected';
  END IF;
END $guard$;
REVOKE EXECUTE ON FUNCTION public.cza_a_demo_02_read(text,text,jsonb) FROM cza_v01_app_runtime_min;
COMMIT;
