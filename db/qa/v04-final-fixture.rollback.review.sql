-- QA ONLY. NOT APPLIED: separate architect approval required.
DO $guard$
BEGIN
  IF current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user<>'cza_t5_test_owner' THEN RAISE EXCEPTION 'v04_qa_target_rejected'; END IF;
END $guard$;

-- Freeze only the new partial fixture so the OLD approved wrapper also rejects new answers.
UPDATE public.training_sessions SET status='cancelled',
 settings_snapshot=settings_snapshot||jsonb_build_object('v04QaFixtureDisabled',true)
WHERE id='40000004-0000-4000-8000-000000000091'::uuid
 AND academy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
 AND student_id='20000000-0000-4000-8000-000000000001'::uuid
 AND recipe_id='361ee0f6-26e2-4484-b9f9-7a88d14fb9f4'::uuid
 AND settings_snapshot->>'v04QaFixture'='final-acceptance-pr91'
 AND status='active';
REVOKE EXECUTE ON FUNCTION public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb) FROM cza_v01_app_runtime_min;
-- Restore Worker fixture flag OFF / source f1b6ad4 before revocation.
-- No DELETE, reset, old recipe update, generic grant, or old function alteration.
-- Retain this labelled new fixture and its evidence for audit even on partial failure.
