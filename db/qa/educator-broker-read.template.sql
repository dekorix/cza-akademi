-- REVIEW_ONLY_DO_NOT_EXECUTE_LIVE. Local tests replace ROLE placeholders.
-- No live identifiers, role provisioning or scope data are included.
BEGIN;
CREATE SCHEMA qa_broker_private AUTHORIZATION __OWNER_ROLE__;
REVOKE ALL ON SCHEMA qa_broker_private FROM PUBLIC;
SET LOCAL ROLE __OWNER_ROLE__;
CREATE TABLE qa_broker_private.scope (
 singleton boolean PRIMARY KEY CHECK(singleton), project_id text NOT NULL,
 branch_id text NOT NULL, database_name text NOT NULL, broker_role text NOT NULL,
 student_id uuid NOT NULL, academy_id uuid NOT NULL
);
REVOKE ALL ON qa_broker_private.scope FROM PUBLIC;
CREATE FUNCTION qa_broker_private.educator_history(p_subject text,p_student uuid,p_filters jsonb,p_cursor jsonb,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $body$
DECLARE v_scope qa_broker_private.scope%ROWTYPE; v_count integer;v_rows jsonb;
BEGIN
 SELECT * INTO v_scope FROM qa_broker_private.scope WHERE singleton=true;
 IF NOT FOUND OR current_database() IS DISTINCT FROM v_scope.database_name
 OR current_setting('neon.project_id',true) IS DISTINCT FROM v_scope.project_id
 OR current_setting('neon.branch_id',true) IS DISTINCT FROM v_scope.branch_id
 OR session_user::text IS DISTINCT FROM v_scope.broker_role
 OR p_student IS DISTINCT FROM v_scope.student_id OR p_limit IS NULL OR p_limit<1 OR p_limit>50
 OR p_subject IS NULL OR length(p_subject)<1 OR length(p_subject)>256 THEN
 RAISE EXCEPTION 'broker_scope_rejected' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO v_count FROM public.users e
 WHERE e.auth_user_id::text=p_subject AND e.is_active AND e.role::text IN('admin','teacher','educator');
 IF v_count<>1 OR NOT EXISTS (
 SELECT 1 FROM public.users e JOIN public.teacher_student_links l ON l.teacher_id=e.id AND l.can_view=true
 JOIN public.students s ON s.id=l.student_id AND s.academy_id=e.academy_id
 WHERE e.auth_user_id::text=p_subject AND e.is_active AND e.role::text IN('admin','teacher','educator')
 AND e.academy_id=v_scope.academy_id AND s.id=v_scope.student_id AND s.status::text='active'
 ) THEN RAISE EXCEPTION 'broker_access_rejected' USING ERRCODE='42501'; END IF;
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
      WHERE recipe.academy_id=v_scope.academy_id AND recipe.student_id=p_student

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
      WHERE session.academy_id=v_scope.academy_id AND session.student_id=p_student

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
      WHERE record.academy_id=v_scope.academy_id AND record.student_id=p_student

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
      WHERE attempt.academy_id=v_scope.academy_id AND attempt.student_id=p_student AND NOT attempt.is_correct

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
      WHERE evidence.academy_id=v_scope.academy_id AND evidence.student_id=p_student
    )

SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.occurred_at DESC,page.event_id DESC),'[]'::jsonb) INTO v_rows FROM (
 SELECT * FROM timeline WHERE
 (p_filters->>'from' IS NULL OR occurred_at>=(p_filters->>'from')::timestamptz)
 AND(p_filters->>'to' IS NULL OR occurred_at<=(p_filters->>'to')::timestamptz)
 AND(p_filters->>'moduleCode' IS NULL OR module_code=p_filters->>'moduleCode')
 AND(p_filters->>'eventType' IS NULL OR event_type=p_filters->>'eventType')
 AND(p_filters->>'verificationStatus' IS NULL OR verification_status=p_filters->>'verificationStatus')
 AND(p_cursor IS NULL OR(occurred_at,event_id)<((p_cursor->>'occurredAt')::timestamptz,p_cursor->>'eventId'))
 ORDER BY occurred_at DESC,event_id DESC LIMIT p_limit+1
)page;
RETURN jsonb_build_object('scope',jsonb_build_object('project',v_scope.project_id,'branch',v_scope.branch_id,
 'database',current_database(),'role',session_user,'studentId',v_scope.student_id,'academyId',v_scope.academy_id),'rows',v_rows);
END $body$;
REVOKE ALL ON FUNCTION qa_broker_private.educator_history(text,uuid,jsonb,jsonb,integer) FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_broker_private TO __BROKER_ROLE__;
GRANT EXECUTE ON FUNCTION qa_broker_private.educator_history(text,uuid,jsonb,jsonb,integer) TO __BROKER_ROLE__;
COMMIT;
