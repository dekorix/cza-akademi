-- REVIEW DESIGN ONLY. Never run without a concrete authorized rollback decision.
-- Preserve every old/new session, answer, learning record and evidence row.
DO $guard$
BEGIN
 IF current_database()<>'cza_t5_synthetic'
 OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
 OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
 OR current_user<>'cza_t5_test_owner' THEN RAISE EXCEPTION 'v04_qa_target_rejected';END IF;
END $guard$;
REVOKE EXECUTE ON FUNCTION public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb) FROM cza_v01_app_runtime_min;
-- Optional removal of this new QA wrapper after callers have been stopped:
-- DROP FUNCTION public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb);
