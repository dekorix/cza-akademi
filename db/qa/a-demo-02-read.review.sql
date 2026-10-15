-- REVIEW ONLY: DO NOT APPLY WITHOUT ISSUE98 ARCHITECT APPROVAL.
-- Entire package MUST run atomically; PUBLIC never sees a committed function.
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
CREATE FUNCTION public.cza_a_demo_02_read(p_token_hash text,p_projection text,p_input jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
DECLARE
  v_student uuid; v_academy uuid; v_session uuid; v_limit integer;
  v_filters jsonb; v_cursor jsonb; v_from timestamptz; v_to timestamptz;
  v_cursor_at timestamptz; v_cursor_event text; v_module text; v_event text; v_verification text;
  v_result jsonb;
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'demo_read_session_rejected' USING ERRCODE='42501';
  END IF;
  SELECT a.student_id,a.academy_id INTO v_student,v_academy
    FROM public.cza_v03_qa_authenticated_student(p_token_hash) a;
  IF NOT FOUND OR v_student IS DISTINCT FROM '20000000-0000-4000-8000-000000000001'::uuid
    OR v_academy IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid THEN
    RAISE EXCEPTION 'demo_read_session_rejected' USING ERRCODE='42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
  END IF;
  CASE p_projection
    WHEN 'timeline' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('filters','cursor','limit'))
        OR jsonb_typeof(p_input->'filters') IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_input->'limit') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
      END IF;
      v_filters=p_input->'filters'; v_cursor=p_input->'cursor'; v_limit=(p_input->>'limit')::integer;
      IF v_limit < 1 OR v_limit > 50 OR (p_input->>'limit')::numeric <> v_limit
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_filters) k WHERE k NOT IN ('from','to','moduleCode','eventType','verificationStatus')) THEN
        RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
      END IF;
      v_from=(v_filters->>'from')::timestamptz; v_to=(v_filters->>'to')::timestamptz;
      v_module=v_filters->>'moduleCode'; v_event=v_filters->>'eventType'; v_verification=v_filters->>'verificationStatus';
      IF (v_from IS NOT NULL AND v_to IS NOT NULL AND v_from>v_to)
        OR (v_module IS NOT NULL AND v_module !~ '^[a-z0-9][a-z0-9_-]{0,63}$')
        OR (v_event IS NOT NULL AND v_event NOT IN ('ASSIGNMENT_AVAILABLE','WORK_STARTED','WORK_RESUMED','WORK_COMPLETED','LEARNING_RESULT','ERROR_OBSERVED','SKILL_EVIDENCE'))
        OR (v_verification IS NOT NULL AND v_verification NOT IN ('client_reported','legacy_client_reported','server_verified')) THEN
        RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
      END IF;
      IF v_cursor IS NOT NULL AND v_cursor <> 'null'::jsonb THEN
        IF jsonb_typeof(v_cursor) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_cursor) k WHERE k NOT IN ('occurredAt','eventId')) THEN
          RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
        END IF;
        v_cursor_at=(v_cursor->>'occurredAt')::timestamptz; v_cursor_event=v_cursor->>'eventId';
        IF v_cursor_at IS NULL OR v_cursor_event IS NULL OR v_cursor_event !~ '^(assignment|session|record|error|evidence):[0-9a-f-]{36}$' THEN
          RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
        END IF;
      END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(projected) ORDER BY projected.occurred_at DESC,projected.event_id DESC),'[]'::jsonb)
      INTO v_result FROM (
    WITH timeline AS (
      SELECT 'assignment:' || recipe.id::text AS event_id, recipe.student_id,
             COALESCE(recipe.cancelled_at, recipe.created_at) AS occurred_at, 'ASSIGNMENT_AVAILABLE'::text AS event_type,
             CASE WHEN recipe.cancelled_at IS NOT NULL THEN 'ASSIGNMENT_CANCELLED' ELSE 'ASSIGNMENT_CREATED' END::text AS assignment_lifecycle,
             recipe.module_code, recipe.id AS assignment_id, NULL::uuid AS training_session_id,
             NULL::uuid AS learning_record_id, recipe.name AS title,
             CASE WHEN recipe.cancelled_at IS NOT NULL THEN 'cancelled' WHEN recipe.is_active THEN 'available' ELSE 'closed' END AS status,
             NULL::jsonb AS result_summary, NULL::jsonb AS error_summary,
             NULL::jsonb AS skill_summary, NULL::text AS support_level,
             'server_authoritative'::text AS provenance, 'server_verified'::text AS verification_status,
             'training_recipes'::text AS source_reference
      FROM public.training_recipes recipe
      WHERE recipe.academy_id=v_academy::uuid AND recipe.student_id=v_student::uuid

      UNION ALL
      SELECT 'session:' || session.id::text, session.student_id,
             COALESCE(session.completed_at, session.last_activity_at, session.started_at),
             CASE WHEN session.status='completed' THEN 'WORK_COMPLETED'
                  WHEN session.last_activity_at > session.started_at THEN 'WORK_RESUMED'
                  ELSE 'WORK_STARTED' END,
             CASE WHEN session.recipe_id IS NULL THEN NULL
                  WHEN session.status='completed' THEN 'ASSIGNMENT_COMPLETED'
                  ELSE 'ASSIGNMENT_STARTED' END::text,
             session.module_code, session.recipe_id, session.id, NULL::uuid,
             COALESCE(recipe.name, module.name), session.status::text,
             NULL::jsonb,
             NULL::jsonb, NULL::jsonb, NULL::text,
             'server_authoritative', 'server_verified', 'training_sessions'
      FROM public.training_sessions session
      JOIN public.modules module ON module.code=session.module_code
      LEFT JOIN public.training_recipes recipe
        ON recipe.id=session.recipe_id AND recipe.academy_id=session.academy_id AND recipe.student_id=session.student_id
      WHERE session.academy_id=v_academy::uuid AND session.student_id=v_student::uuid

      UNION ALL
      SELECT 'record:' || record.id::text, record.student_id, record.completed_at,
             'LEARNING_RESULT', NULL::text, record.module_code, session.recipe_id, record.training_session_id, record.id,
             module.name, 'completed', record.performance, NULL::jsonb,
             jsonb_build_object('skills',record.skills), record.support_level,
             record.record_origin, record.verification_status, 'learning_records'
      FROM public.learning_records record
      JOIN public.modules module ON module.code=record.module_code
      JOIN public.training_sessions session
        ON session.id=record.training_session_id AND session.academy_id=record.academy_id AND session.student_id=record.student_id
      WHERE record.academy_id=v_academy::uuid AND record.student_id=v_student::uuid

      UNION ALL
      SELECT 'error:' || attempt.id::text, attempt.student_id, attempt.created_at,
             'ERROR_OBSERVED', NULL::text, attempt.module_code, session.recipe_id, attempt.training_session_id, NULL::uuid,
             module.name, 'observed',
             jsonb_build_object('isCorrect',attempt.is_correct,'responseTimeMs',attempt.total_response_time_ms),
             jsonb_build_object('errorType',attempt.error_type,'detail',attempt.error_detail),
             NULL::jsonb, NULL::text, 'client_reported', 'client_reported', 'question_attempts'
      FROM public.question_attempts attempt
      JOIN public.modules module ON module.code=attempt.module_code
      JOIN public.training_sessions session
        ON session.id=attempt.training_session_id AND session.academy_id=attempt.academy_id AND session.student_id=attempt.student_id
      WHERE attempt.academy_id=v_academy::uuid AND attempt.student_id=v_student::uuid AND NOT attempt.is_correct

      UNION ALL
      SELECT 'evidence:' || evidence.id::text, evidence.student_id, evidence.observed_at,
             'SKILL_EVIDENCE', NULL::text, record.module_code, session.recipe_id, record.training_session_id, record.id,
             module.name, 'observed', evidence.payload, NULL::jsonb,
             jsonb_build_object('skillCode',evidence.skill_code,'evidenceType',evidence.evidence_type),
             evidence.support_level,
             CASE WHEN evidence.verification_status='server_verified' THEN 'server_authoritative' ELSE 'legacy_client_reported' END,
             evidence.verification_status, 'learning_evidence'
      FROM public.learning_evidence evidence
      JOIN public.learning_records record
        ON record.id=evidence.learning_record_id AND record.academy_id=evidence.academy_id AND record.student_id=evidence.student_id
      JOIN public.training_sessions session
        ON session.id=record.training_session_id AND session.academy_id=record.academy_id AND session.student_id=record.student_id
      JOIN public.modules module ON module.code=record.module_code
      WHERE evidence.academy_id=v_academy::uuid AND evidence.student_id=v_student::uuid
    )
    SELECT * FROM timeline
    WHERE (v_from IS NULL OR occurred_at>=v_from) AND (v_to IS NULL OR occurred_at<=v_to)
      AND (v_module IS NULL OR module_code=v_module) AND (v_event IS NULL OR event_type=v_event)
      AND (v_verification IS NULL OR verification_status=v_verification)
      AND (v_cursor_at IS NULL OR (occurred_at,event_id)<(v_cursor_at,v_cursor_event))
    ORDER BY occurred_at DESC,event_id DESC LIMIT v_limit+1
      ) projected;
    WHEN 'completed_results' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k <> 'sessionId') THEN
        RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
      END IF;
      v_session=(p_input->>'sessionId')::uuid;
      SELECT COALESCE(jsonb_agg(to_jsonb(projected) ORDER BY projected.completed_at DESC,projected.session_id DESC),'[]'::jsonb)
        INTO v_result FROM (

SELECT s.id AS session_id,s.recipe_id AS assignment_id,r.name AS assignment_title,
       s.module_code,m.name AS module_name,s.started_at,s.completed_at,
       (SELECT count(*)::int FROM public.question_attempts q
        WHERE q.training_session_id=s.id AND q.student_id=s.student_id AND q.academy_id=s.academy_id
          AND COALESCE(q.metadata->>'attemptType','PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS attempt_count,
       (SELECT count(*)::int FROM public.question_attempts q
        WHERE q.training_session_id=s.id AND q.student_id=s.student_id AND q.academy_id=s.academy_id AND q.is_correct
          AND COALESCE(q.metadata->>'attemptType','PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS correct_count,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'recordId',lr.id,'recordOrigin',lr.record_origin,'verificationStatus',lr.verification_status,
          'evidenceId',e.id,'evidenceVerificationStatus',e.verification_status,'verificationAuthority',e.verification_authority)
          ORDER BY lr.completed_at DESC,lr.id,e.id),'[]'::jsonb)
        FROM public.learning_records lr LEFT JOIN public.learning_evidence e
          ON e.learning_record_id=lr.id AND e.student_id=lr.student_id AND e.academy_id=lr.academy_id
        WHERE lr.training_session_id=s.id AND lr.student_id=s.student_id AND lr.academy_id=s.academy_id) AS records
FROM public.training_sessions s
JOIN public.training_recipes r ON r.id=s.recipe_id AND r.student_id=s.student_id AND r.academy_id=s.academy_id
JOIN public.modules m ON m.code=s.module_code
WHERE s.academy_id=v_academy::uuid AND s.student_id=v_student::uuid AND s.status='completed'
  AND r.id='361ee0f6-26e2-4484-b9f9-7a88d14fb9f4'::uuid AND s.module_code='finger_read'
  AND s.id IN ('bdb87fbc-0938-4eb1-82e5-0a2cb362d30f'::uuid,'40000004-0000-4000-8000-000000000091'::uuid)
  AND r.source='teacher_assignment' AND (v_session::uuid IS NULL OR s.id=v_session::uuid)
ORDER BY s.completed_at DESC,s.id DESC
LIMIT 50
      ) projected;
    ELSE RAISE EXCEPTION 'demo_read_scope_rejected' USING ERRCODE='42501';
  END CASE;
  RETURN v_result;
END $body$;
ALTER FUNCTION public.cza_a_demo_02_read(text,text,jsonb) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_a_demo_02_read(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_a_demo_02_read(text,text,jsonb) TO cza_v01_app_runtime_min;
DO $acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
    WHERE p.oid='public.cza_a_demo_02_read(text,text,jsonb)'::regprocedure AND a.grantee=0)
    OR NOT has_function_privilege('cza_v01_app_runtime_min','public.cza_a_demo_02_read(text,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'demo_read_acl_rejected';
  END IF;
END $acl$;
COMMIT;
