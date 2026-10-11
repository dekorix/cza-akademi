-- QA ONLY. Exact project/branch/database lock; no table grants or policy changes.
DO $guard$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_user <> 'cza_t5_test_owner' THEN
    RAISE EXCEPTION 'v03_qa_target_rejected';
  END IF;
END $guard$;

CREATE FUNCTION public.cza_v03_qa_student_read(
  p_token_hash text, p_projection text, p_recipe uuid DEFAULT NULL,
  p_at timestamptz DEFAULT CURRENT_TIMESTAMP
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
DECLARE v_student uuid; v_academy uuid; v_user uuid; v_result jsonb;
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'v03_qa_session_rejected' USING ERRCODE='42501';
  END IF;
  -- Same canonical session validity checks as cza_touch_authenticated_student,
  -- without its last_seen_at UPDATE. Never accept student/academy from caller.
  SELECT ss.student_id,ss.academy_id,ss.student_user_id INTO v_student,v_academy,v_user
  FROM public.student_sessions ss
  JOIN public.students s ON s.id=ss.student_id AND s.user_id=ss.student_user_id AND s.academy_id=ss.academy_id
  JOIN public.users u ON u.id=ss.student_user_id AND u.academy_id=ss.academy_id
  WHERE ss.token_hash=p_token_hash AND ss.revoked_at IS NULL AND ss.expires_at>statement_timestamp()
    AND s.status='active' AND s.is_demo=true AND u.is_active=true AND u.role::text='student'
    AND s.id='20000000-0000-4000-8000-000000000001'::uuid
    AND ss.academy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'v03_qa_session_rejected' USING ERRCODE='42501'; END IF;
  CASE p_projection
    WHEN 'dashboard_1' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

          SELECT s.id, u.username,
                 concat_ws(' ', s.first_name, s.last_name) AS display_name
          FROM public.students s
          JOIN public.users u ON u.id = s.user_id
          WHERE s.id = v_student::uuid
            AND s.academy_id = v_academy::uuid
            AND s.user_id = v_user::uuid
            AND s.status = 'active'
            AND u.is_active = true
            AND u.role = 'student'
          LIMIT 1
        
      ) projected;
    WHEN 'dashboard_2' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

          SELECT tr.id, tr.module_code, tr.name, tr.instructions, tr.settings, tr.starts_at,
                 tr.expires_at, tr.is_active, tr.cancelled_at, m.name AS module_name,
                 (SELECT count(*)::int FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = v_academy::uuid
                    AND ts.student_id = v_student::uuid) AS session_count,
                 (SELECT count(*)::int FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = v_academy::uuid
                    AND ts.student_id = v_student::uuid
                    AND ts.status = 'completed') AS completed_count,
                 (SELECT id FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = v_academy::uuid
                    AND ts.student_id = v_student::uuid
                    AND ts.status = 'active'
                  ORDER BY ts.last_activity_at DESC, ts.id DESC LIMIT 1) AS active_session_id,
                 (SELECT id FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = v_academy::uuid
                    AND ts.student_id = v_student::uuid
                    AND ts.status = 'completed'
                  ORDER BY ts.completed_at DESC, ts.id DESC LIMIT 1) AS completed_session_id,
                 (SELECT max(ts.last_activity_at) FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = v_academy::uuid
                    AND ts.student_id = v_student::uuid) AS last_activity_at,
                 (SELECT count(*)::int
                  FROM public.question_attempts qa
                  JOIN public.training_sessions ts ON ts.id = qa.training_session_id
                  WHERE ts.recipe_id = tr.id
                    AND qa.academy_id = v_academy::uuid
                    AND qa.student_id = v_student::uuid
                    AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS attempt_count,
                 (SELECT count(*)::int
                  FROM public.question_attempts qa
                  JOIN public.training_sessions ts ON ts.id = qa.training_session_id
                  WHERE ts.recipe_id = tr.id
                    AND qa.academy_id = v_academy::uuid
                    AND qa.student_id = v_student::uuid
                    AND qa.is_correct
                    AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS correct_count
          FROM public.training_recipes tr
          JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
          WHERE tr.student_id = v_student::uuid
            AND tr.academy_id = v_academy::uuid
            AND tr.source = 'teacher_assignment'
          ORDER BY tr.created_at DESC, tr.id DESC
          LIMIT 50
        
      ) projected;
    WHEN 'dashboard_3' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

          SELECT
            (SELECT count(*)::int
             FROM public.training_sessions ts
             WHERE ts.student_id = v_student::uuid
               AND ts.academy_id = v_academy::uuid
               AND ts.status = 'completed') AS completed_sessions,
            count(*)::int AS total_attempts,
            count(*) FILTER (WHERE qa.is_correct)::int AS correct_attempts,
            COALESCE(round(
              100.0 * count(*) FILTER (WHERE qa.is_correct) / NULLIF(count(*), 0)
            ), 0)::int AS accuracy
          FROM public.question_attempts qa
          WHERE qa.student_id = v_student::uuid
            AND qa.academy_id = v_academy::uuid
        
      ) projected;
    WHEN 'dashboard_4' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

          SELECT ts.id, ts.module_code, m.name AS module_name, ts.status,
                 ts.started_at, ts.completed_at, ts.recipe_id,
                 tr.name AS assignment_name,
                 count(qa.id) FILTER (
                   WHERE COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
                 )::int AS attempt_count,
                 count(qa.id) FILTER (
                   WHERE qa.is_correct
                     AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
                 )::int AS correct_count
          FROM public.training_sessions ts
          JOIN public.modules m ON m.code = ts.module_code
          LEFT JOIN public.training_recipes tr
            ON tr.id = ts.recipe_id
           AND tr.academy_id = v_academy::uuid
           AND tr.student_id = v_student::uuid
          LEFT JOIN public.question_attempts qa
            ON qa.training_session_id = ts.id
           AND qa.academy_id = v_academy::uuid
           AND qa.student_id = v_student::uuid
          WHERE ts.student_id = v_student::uuid
            AND ts.academy_id = v_academy::uuid
          GROUP BY ts.id, m.name, tr.name
          ORDER BY COALESCE(ts.completed_at, ts.started_at) DESC, ts.id DESC
          LIMIT 12
        
      ) projected;
    WHEN 'dashboard_5' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

          SELECT qa.module_code, m.name AS module_name,
                 count(*)::int AS total,
                 count(*) FILTER (WHERE qa.is_correct)::int AS correct,
                 COALESCE(round(
                   100.0 * count(*) FILTER (WHERE qa.is_correct) / NULLIF(count(*), 0)
                 ), 0)::int AS accuracy
          FROM public.question_attempts qa
          JOIN public.modules m ON m.code = qa.module_code
          WHERE qa.student_id = v_student::uuid
            AND qa.academy_id = v_academy::uuid
          GROUP BY qa.module_code, m.name
          ORDER BY max(qa.created_at) DESC, qa.module_code ASC
          LIMIT 12
        
      ) projected;
    WHEN 'assignments_1' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

      SELECT tr.id, tr.module_code, tr.name, tr.instructions, tr.settings, tr.starts_at, tr.expires_at, tr.is_active, tr.cancelled_at,
             m.name AS module_name,
             active_session.id AS active_session_id,
             active_session.last_activity_at,
             completed_session.id AS completed_session_id,
             COALESCE(active_session.attempt_count, completed_session.attempt_count, 0)::int AS attempt_count
           , (SELECT lr.id FROM public.learning_records lr
              JOIN public.training_sessions ts ON ts.id = lr.training_session_id
              WHERE ts.recipe_id = tr.id
                AND lr.academy_id = v_academy::uuid
                AND lr.student_id = v_student::uuid
              ORDER BY lr.completed_at DESC, lr.created_at DESC LIMIT 1) AS latest_learning_record_id
      FROM public.training_recipes tr
      JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
      LEFT JOIN LATERAL (
        SELECT sessions.id, sessions.last_activity_at,
               count(attempts.id) FILTER (
                 WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
               )::int AS attempt_count
        FROM public.training_sessions sessions
        LEFT JOIN public.question_attempts attempts
          ON attempts.training_session_id = sessions.id
         AND attempts.academy_id = v_academy::uuid
         AND attempts.student_id = v_student::uuid
        WHERE sessions.recipe_id = tr.id
          AND sessions.academy_id = v_academy::uuid
          AND sessions.student_id = v_student::uuid
          AND sessions.status = 'active'
        GROUP BY sessions.id
        ORDER BY sessions.last_activity_at DESC, sessions.id DESC
        LIMIT 1
      ) active_session ON true
      LEFT JOIN LATERAL (
        SELECT sessions.id,
               count(attempts.id) FILTER (
                 WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
               )::int AS attempt_count
        FROM public.training_sessions sessions
        LEFT JOIN public.question_attempts attempts
          ON attempts.training_session_id = sessions.id
         AND attempts.academy_id = v_academy::uuid
         AND attempts.student_id = v_student::uuid
        WHERE sessions.recipe_id = tr.id
          AND sessions.academy_id = v_academy::uuid
          AND sessions.student_id = v_student::uuid
          AND sessions.status = 'completed'
        GROUP BY sessions.id
        ORDER BY sessions.completed_at DESC, sessions.id DESC
        LIMIT 1
      ) completed_session ON true
      WHERE tr.id = p_recipe::uuid
        AND tr.student_id = v_student::uuid
        AND tr.academy_id = v_academy::uuid
        AND tr.source = 'teacher_assignment'
        AND tr.is_active = true
        AND (tr.starts_at IS NULL OR tr.starts_at <= now())
        AND (tr.expires_at IS NULL OR tr.expires_at > now())
      LIMIT 1
    
      ) projected;
    WHEN 'assignments_2' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

    SELECT tr.id, tr.module_code, tr.name, tr.instructions, tr.settings, tr.starts_at, tr.expires_at,
           tr.is_active, tr.cancelled_at, m.name AS module_name,
           (SELECT count(*)::int FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = v_academy::uuid
              AND ts.student_id = v_student::uuid) AS session_count,
           (SELECT id FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = v_academy::uuid
              AND ts.student_id = v_student::uuid
              AND ts.status = 'active'
            ORDER BY ts.last_activity_at DESC, ts.id DESC LIMIT 1) AS active_session_id,
           (SELECT id FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = v_academy::uuid
              AND ts.student_id = v_student::uuid
              AND ts.status = 'completed'
            ORDER BY ts.completed_at DESC, ts.id DESC LIMIT 1) AS completed_session_id,
           (SELECT count(*)::int
            FROM public.question_attempts qa
            JOIN public.training_sessions ts ON ts.id = qa.training_session_id
            WHERE ts.recipe_id = tr.id
              AND qa.academy_id = v_academy::uuid
              AND qa.student_id = v_student::uuid
              AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS attempt_count,
           (SELECT max(ts.completed_at) FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = v_academy::uuid
              AND ts.student_id = v_student::uuid
              AND ts.status = 'completed') AS last_completed_at
           , (SELECT lr.id FROM public.learning_records lr
              JOIN public.training_sessions ts ON ts.id = lr.training_session_id
              WHERE ts.recipe_id = tr.id
                AND lr.academy_id = v_academy::uuid
                AND lr.student_id = v_student::uuid
              ORDER BY lr.completed_at DESC, lr.created_at DESC LIMIT 1) AS latest_learning_record_id
    FROM public.training_recipes tr
    JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
    WHERE tr.student_id = v_student::uuid
      AND tr.academy_id = v_academy::uuid
      AND tr.source = 'teacher_assignment'
    ORDER BY tr.created_at DESC
    LIMIT 50
  
      ) projected;
    WHEN 'assignments_3' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (

    SELECT tr.id, tr.module_code, tr.settings,
           EXISTS (
             SELECT 1 FROM public.training_sessions ts
             WHERE ts.recipe_id = tr.id
               AND ts.academy_id = v_academy::uuid
               AND ts.student_id = v_student::uuid
               AND ts.status = 'completed'
           ) AS completed
    FROM public.training_recipes tr
    WHERE tr.id = p_recipe::uuid
      AND tr.student_id = v_student::uuid
      AND tr.academy_id = v_academy::uuid
      AND tr.source = 'teacher_assignment'
      AND tr.is_active = true
      AND (tr.starts_at IS NULL OR tr.starts_at <= now())
      AND (tr.expires_at IS NULL OR tr.expires_at > now())
    LIMIT 1
  
      ) projected;
    WHEN 'profile_1' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
SELECT s.id,concat_ws(' ',s.first_name,s.last_name) name,
      LEAST(minimum.recipe_at,minimum.session_at,minimum.record_at) recorded_from
      FROM public.students s
      LEFT JOIN LATERAL (SELECT
        (SELECT min(created_at) FROM public.training_recipes WHERE academy_id=s.academy_id AND student_id=s.id) recipe_at,
        (SELECT min(started_at) FROM public.training_sessions WHERE academy_id=s.academy_id AND student_id=s.id) session_at,
        (SELECT min(completed_at) FROM public.learning_records WHERE academy_id=s.academy_id AND student_id=s.id) record_at
      ) minimum ON true
      WHERE s.academy_id=v_academy::uuid AND s.id=v_student::uuid AND s.status='active' GROUP BY s.id,minimum.recipe_at,minimum.session_at,minimum.record_at
      ) projected;
    WHEN 'profile_2' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
SELECT
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) assignments,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) sessions,
      (SELECT count(*)::int FROM public.question_attempts WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) attempts,
      (SELECT count(*)::int FROM public.learning_records WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) records,
      (SELECT count(*)::int FROM public.learning_evidence WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) evidence,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND is_active AND cancelled_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.recipe_id=training_recipes.id AND s.status='completed')) active_assignments,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND cancelled_at IS NULL AND EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.recipe_id=training_recipes.id AND s.status='completed')) completed_assignments,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND cancelled_at IS NOT NULL) cancelled_assignments,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND status='completed') completed_sessions,
      (SELECT count(DISTINCT started_at::date)::int FROM public.training_sessions WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND started_at >= p_at::timestamptz - interval '30 days') active_days_30,
      (SELECT max(COALESCE(completed_at,last_activity_at,started_at)) FROM public.training_sessions WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) last_study_at,
      GREATEST(
        (SELECT max(created_at) FROM public.training_recipes WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid),
        (SELECT max(COALESCE(completed_at,last_activity_at,started_at)) FROM public.training_sessions WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid),
        (SELECT max(created_at) FROM public.question_attempts WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid),
        (SELECT max(completed_at) FROM public.learning_records WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid),
        (SELECT max(observed_at) FROM public.learning_evidence WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid)
      ) data_through
      ) projected;
    WHEN 'profile_3' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
WITH module_keys AS (
      SELECT module_code FROM public.training_recipes WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid
      UNION SELECT module_code FROM public.training_sessions WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid
      UNION SELECT module_code FROM public.question_attempts WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid
      UNION SELECT module_code FROM public.learning_records WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid
    ) SELECT k.module_code,COALESCE(m.name,k.module_code) module_name,
      (SELECT count(*)::int FROM public.training_recipes r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.module_code=k.module_code) assignments,
      (SELECT count(*)::int FROM public.training_sessions s WHERE s.academy_id=v_academy::uuid AND s.student_id=v_student::uuid AND s.module_code=k.module_code) sessions,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.module_code=k.module_code) records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.module_code=k.module_code AND (r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified')) client_records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.module_code=k.module_code AND r.record_origin='server_authoritative' AND r.verification_status='server_verified') trusted_records,
      (SELECT count(*)::int FROM public.question_attempts a WHERE a.academy_id=v_academy::uuid AND a.student_id=v_student::uuid AND a.module_code=k.module_code) attempts,
      (SELECT count(*) FILTER(WHERE a.is_correct)::int FROM public.question_attempts a WHERE a.academy_id=v_academy::uuid AND a.student_id=v_student::uuid AND a.module_code=k.module_code) correct,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN EXISTS(SELECT 1 FROM public.training_recipes r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.module_code=k.module_code) THEN 'training_recipes' END,
        CASE WHEN EXISTS(SELECT 1 FROM public.training_sessions s WHERE s.academy_id=v_academy::uuid AND s.student_id=v_student::uuid AND s.module_code=k.module_code) THEN 'training_sessions' END,
        CASE WHEN EXISTS(SELECT 1 FROM public.question_attempts a WHERE a.academy_id=v_academy::uuid AND a.student_id=v_student::uuid AND a.module_code=k.module_code) THEN 'question_attempts' END,
        CASE WHEN EXISTS(SELECT 1 FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.module_code=k.module_code) THEN 'learning_records' END
      ],NULL) source_references
      FROM module_keys k LEFT JOIN public.modules m ON m.code=k.module_code ORDER BY k.module_code LIMIT 24
      ) projected;
    WHEN 'profile_4' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
WITH raw_skill_sources AS (
      SELECT e.skill_code,r.module_code,r.id::text source_key,'evidence:'||e.id::text source_reference,e.observed_at,
        e.verification_authority='work_center_completion:v1' OR r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified' is_client,
        e.verification_status='server_verified' AND e.verification_authority='canonical_server_evaluator:v1'
          AND r.record_origin='server_authoritative' AND r.verification_status='server_verified' is_trusted
      FROM public.learning_evidence e JOIN public.learning_records r
        ON r.id=e.learning_record_id AND r.academy_id=e.academy_id AND r.student_id=e.student_id
      WHERE e.academy_id=v_academy::uuid AND e.student_id=v_student::uuid AND e.skill_code IS NOT NULL
      UNION ALL
      SELECT skill.value,r.module_code,r.id::text,'record:'||r.id::text,r.completed_at,true,false
      FROM public.learning_records r
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(r.skills)='array' THEN r.skills ELSE '[]'::jsonb END
      ) skill(value)
      WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid
    ), skill_sources AS (
      SELECT DISTINCT ON (skill_code,module_code,source_key)
        skill_code,module_code,source_key,source_reference,observed_at,is_client,is_trusted
      FROM raw_skill_sources
      ORDER BY skill_code,module_code,source_key,is_trusted DESC,source_reference
    ) SELECT skill_code,module_code,count(*)::int record_count,
      (array_agg(DISTINCT source_reference ORDER BY source_reference))[1:5] source_references,
      bool_or(is_client) has_client,bool_and(is_trusted) all_trusted,max(observed_at) last_observed_at
      FROM skill_sources GROUP BY skill_code,module_code
      ORDER BY last_observed_at DESC,skill_code LIMIT 24
      ) projected;
    WHEN 'profile_5' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
SELECT error_type,count(DISTINCT id)::int count FROM public.question_attempts
      WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND NOT is_correct
      GROUP BY error_type ORDER BY count DESC,error_type LIMIT 12
      ) projected;
    WHEN 'profile_6' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
SELECT support_level,record_origin,verification_status,count(*)::int count
      FROM public.learning_records WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid
      GROUP BY support_level,record_origin,verification_status ORDER BY support_level,record_origin,verification_status
      ) projected;
    WHEN 'profile_7' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
WITH periods(label,from_at,to_at) AS (VALUES
      ('LAST_30_DAYS'::text,p_at::timestamptz-interval '30 days',p_at::timestamptz),
      ('PREVIOUS_30_DAYS'::text,p_at::timestamptz-interval '60 days',p_at::timestamptz-interval '30 days')
    ) SELECT p.label,p.from_at,p.to_at,
      (SELECT count(*)::int FROM public.training_sessions s WHERE s.academy_id=v_academy::uuid AND s.student_id=v_student::uuid AND s.started_at>=p.from_at AND s.started_at<p.to_at) sessions,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.completed_at>=p.from_at AND r.completed_at<p.to_at) records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.completed_at>=p.from_at AND r.completed_at<p.to_at AND (r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified')) client_records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid AND r.completed_at>=p.from_at AND r.completed_at<p.to_at AND r.record_origin='server_authoritative' AND r.verification_status='server_verified') trusted_records,
      (SELECT count(*)::int FROM public.question_attempts a WHERE a.academy_id=v_academy::uuid AND a.student_id=v_student::uuid AND a.created_at>=p.from_at AND a.created_at<p.to_at) attempts,
      (SELECT count(*) FILTER(WHERE a.is_correct)::int FROM public.question_attempts a WHERE a.academy_id=v_academy::uuid AND a.student_id=v_student::uuid AND a.created_at>=p.from_at AND a.created_at<p.to_at) correct
      FROM periods p ORDER BY p.from_at DESC
      ) projected;
    WHEN 'profile_8' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
SELECT r.id::text record_id,r.training_session_id::text session_id,r.module_code,
      r.record_origin,r.verification_status record_verification,
      e.id::text evidence_id,e.verification_status evidence_verification,
      e.verification_authority evidence_authority
      FROM public.learning_records r LEFT JOIN public.learning_evidence e
        ON e.learning_record_id=r.id AND e.academy_id=r.academy_id AND e.student_id=r.student_id
      WHERE r.academy_id=v_academy::uuid AND r.student_id=v_student::uuid
      ORDER BY r.completed_at DESC,r.id,e.id LIMIT 24
      ) projected;
    WHEN 'coaching_1' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(projected)), '[]'::jsonb) INTO v_result FROM (
SELECT
    (SELECT count(*)::int FROM public.coaching_programs WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND status='active') active_programs,
    (SELECT count(*)::int FROM public.coaching_plans WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND status='published') published_plans,
    (SELECT count(*)::int FROM public.coaching_study_logs WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) study_logs,
    (SELECT count(*)::int FROM public.coaching_exam_results WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) exam_results,
    (SELECT count(*)::int FROM public.coaching_meetings WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid) meetings,
    (SELECT jsonb_build_object('id',id,'programId',program_id,'revision',revision,'target',target,'provenance',provenance,'createdAt',created_at) FROM public.coaching_goals WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid ORDER BY created_at DESC,id DESC LIMIT 1) latest_goal,
    (SELECT jsonb_build_object('id',id,'programId',program_id,'title',title,'periodStart',period_start::text,'periodEnd',period_end::text,'version',version) FROM public.coaching_plans WHERE academy_id=v_academy::uuid AND student_id=v_student::uuid AND status='published' ORDER BY period_start DESC,id DESC LIMIT 1) latest_plan,
    (SELECT jsonb_build_object('id',result.id,'programId',result.program_id,'templateId',result.template_id,'examDate',result.exam_date::text,'totalNet',result.total_net,'provenance',result.provenance) FROM public.coaching_exam_results result WHERE result.academy_id=v_academy::uuid AND result.student_id=v_student::uuid ORDER BY result.exam_date DESC,result.id DESC LIMIT 1) latest_exam,
    (SELECT jsonb_build_object('itemId',item.id,'recipeId',item.recipe_id,'planId',item.plan_id) FROM public.coaching_plan_items item JOIN public.coaching_plans plan ON plan.id=item.plan_id AND plan.academy_id=item.academy_id AND plan.student_id=item.student_id WHERE item.academy_id=v_academy::uuid AND item.student_id=v_student::uuid AND plan.status='published' ORDER BY item.scheduled_for DESC,item.id DESC LIMIT 1) latest_task
      ) projected;
    ELSE RAISE EXCEPTION 'v03_qa_projection_rejected' USING ERRCODE='42501';
  END CASE;
  RETURN v_result;
END $body$;
ALTER FUNCTION public.cza_v03_qa_student_read(text,text,uuid,timestamptz) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v03_qa_student_read(text,text,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v03_qa_student_read(text,text,uuid,timestamptz) TO cza_v01_app_runtime_min;

-- Credential validation and session INSERT remain in the existing login function.
-- This wrapper is an authentication permission, separate from the read projection.
CREATE FUNCTION public.cza_v03_qa_student_login(p_username text,p_pin text,p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
  IF current_database() <> 'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40' THEN
    RAISE EXCEPTION 'v03_qa_target_rejected' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.students s ON s.user_id=u.id AND s.academy_id=u.academy_id
    WHERE u.id='10000000-0000-4000-8000-000000000001'::uuid
      AND s.id='20000000-0000-4000-8000-000000000001'::uuid
      AND s.academy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      AND s.is_demo=true AND s.status='active' AND u.is_active=true AND u.role::text='student'
      AND lower(u.username)=lower(trim(p_username))
  ) THEN RETURN jsonb_build_object('ok',false,'error','invalid_credentials'); END IF;
  RETURN public.cza_student_login(p_username,p_pin,left(p_user_agent,500));
END $body$;
ALTER FUNCTION public.cza_v03_qa_student_login(text,text,text) OWNER TO cza_t5_test_owner;
REVOKE ALL ON FUNCTION public.cza_v03_qa_student_login(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v03_qa_student_login(text,text,text) TO cza_v01_app_runtime_min;
