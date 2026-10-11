-- QA ONLY. NOT APPLIED: separate architect approval required.
DO $guard$
BEGIN
  IF current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user<>'cza_t5_test_owner' THEN RAISE EXCEPTION 'v04_qa_target_rejected'; END IF;
END $guard$;

REVOKE EXECUTE ON FUNCTION public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb) FROM cza_v01_app_runtime_min;
-- Restore Worker fixture flag OFF / source f1b6ad4 before revocation.
-- No DELETE, reset, old recipe update, generic grant, or old function alteration.
-- Retain this labelled new fixture and its evidence for audit even on partial failure.
