-- T4: additive, versioned server evaluation for new P2 attempts only.
BEGIN;
ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS client_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS server_evaluation jsonb,
  ADD COLUMN IF NOT EXISTS server_next_task_code text,
  ADD COLUMN IF NOT EXISTS educator_review jsonb,
  ADD COLUMN IF NOT EXISTS educator_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS educator_reviewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS assessment_attempts_t4_client_identity
  ON public.assessment_attempts(session_id, client_attempt_id)
  WHERE client_attempt_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS assessment_attempts_t4_one_task
  ON public.assessment_attempts(session_id, task_code)
  WHERE client_attempt_id IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='public.assessment_attempts'::regclass
        AND conname='assessment_attempts_t4_evaluation_shape') THEN
    ALTER TABLE public.assessment_attempts
      ADD CONSTRAINT assessment_attempts_t4_evaluation_shape CHECK (
        (client_attempt_id IS NULL AND request_hash IS NULL AND server_evaluation IS NULL
          AND server_next_task_code IS NULL)
        OR (client_attempt_id IS NOT NULL AND request_hash ~ '^[0-9a-f]{64}$'
          AND jsonb_typeof(server_evaluation)='object')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cza_t4_record_assessment_attempt(
  p_session_id uuid, p_student_id uuid, p_academy_id uuid,
  p_task_code text, p_client_attempt_id uuid, p_request_hash text,
  p_answer_text text, p_answer_payload jsonb, p_evaluation jsonb,
  p_next_task_code text
) RETURNS TABLE(attempt_id uuid, next_task_code text, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_session public.assessment_sessions%ROWTYPE;
  v_attempt public.assessment_attempts%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR p_student_id IS NULL OR p_academy_id IS NULL
     OR p_task_code IS NULL OR p_client_attempt_id IS NULL
     OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(p_evaluation) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'T4_INVALID_ATTEMPT' USING ERRCODE='22023';
  END IF;
  SELECT session.* INTO v_session
  FROM public.assessment_sessions session
  JOIN public.students student ON student.id=session.student_id
  WHERE session.id=p_session_id AND session.student_id=p_student_id
    AND student.academy_id=p_academy_id
  FOR UPDATE OF session;
  IF NOT FOUND OR v_session.status <> 'active' THEN RETURN; END IF;
  SELECT * INTO v_attempt FROM public.assessment_attempts attempt
  WHERE attempt.session_id=p_session_id AND attempt.task_code=p_task_code
    AND attempt.client_attempt_id IS NOT NULL;
  IF FOUND THEN
    IF v_attempt.request_hash <> p_request_hash
       OR v_attempt.server_evaluation IS DISTINCT FROM p_evaluation THEN
      RAISE EXCEPTION 'T4_ATTEMPT_IDENTITY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_attempt.id,
      COALESCE(v_attempt.server_next_task_code, v_attempt.educator_review->>'nextTaskCode'), true;
    RETURN;
  END IF;
  IF v_session.definition_contract->>'serverEvaluatorId' <> 'P2_DETERMINISTIC_TEXT'
     OR v_session.definition_contract->>'serverEvaluatorVersion' <> '1'
     OR v_session.current_task_code IS DISTINCT FROM p_task_code THEN
    RETURN;
  END IF;
  INSERT INTO public.assessment_attempts (
    session_id, task_code, answer_text, answer_payload,
    client_attempt_id, request_hash, server_evaluation, server_next_task_code
  ) VALUES (
    p_session_id, p_task_code, p_answer_text, p_answer_payload,
    p_client_attempt_id, p_request_hash, p_evaluation, p_next_task_code
  ) RETURNING * INTO v_attempt;
  IF p_next_task_code IS NOT NULL THEN
    UPDATE public.assessment_sessions
    SET current_task_code=p_next_task_code
    WHERE id=p_session_id;
  END IF;
  RETURN QUERY SELECT v_attempt.id, v_attempt.server_next_task_code, false;
END $$;
REVOKE ALL ON FUNCTION public.cza_t4_record_assessment_attempt(
  uuid,uuid,uuid,text,uuid,text,text,jsonb,jsonb,text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cza_owner') THEN
    GRANT EXECUTE ON FUNCTION public.cza_t4_record_assessment_attempt(
      uuid,uuid,uuid,text,uuid,text,text,jsonb,jsonb,text) TO cza_owner;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cza_t4_keep_assessment_evaluation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.client_attempt_id IS NOT NULL AND (
    OLD.client_attempt_id IS DISTINCT FROM NEW.client_attempt_id OR
    OLD.request_hash IS DISTINCT FROM NEW.request_hash OR
    OLD.server_evaluation IS DISTINCT FROM NEW.server_evaluation OR
    OLD.server_next_task_code IS DISTINCT FROM NEW.server_next_task_code OR
    (OLD.educator_review IS NOT NULL AND (
      OLD.educator_review IS DISTINCT FROM NEW.educator_review OR
      OLD.educator_reviewed_by IS DISTINCT FROM NEW.educator_reviewed_by OR
      OLD.educator_reviewed_at IS DISTINCT FROM NEW.educator_reviewed_at))
  ) THEN
    RAISE EXCEPTION 'T4_EVALUATION_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assessment_evaluation_immutable_t4 ON public.assessment_attempts;
CREATE TRIGGER assessment_evaluation_immutable_t4
BEFORE UPDATE OF client_attempt_id,request_hash,server_evaluation,server_next_task_code,educator_review,educator_reviewed_by,educator_reviewed_at
ON public.assessment_attempts FOR EACH ROW
EXECUTE FUNCTION public.cza_t4_keep_assessment_evaluation();

CREATE OR REPLACE FUNCTION public.cza_t4_review_assessment_attempt(
  p_session_id uuid, p_attempt_id uuid, p_auth_user_id text,
  p_task_code text, p_decision text, p_next_task_code text
) RETURNS TABLE(attempt_id uuid, next_task_code text, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_access record;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_review jsonb;
BEGIN
  IF p_session_id IS NULL OR p_attempt_id IS NULL OR NULLIF(p_auth_user_id,'') IS NULL
     OR NULLIF(p_task_code,'') IS NULL
     OR p_decision IS NULL OR p_decision NOT IN ('correct','incorrect')
     OR NULLIF(p_next_task_code,'') IS NULL THEN
    RAISE EXCEPTION 'T4_INVALID_REVIEW' USING ERRCODE='22023';
  END IF;
  SELECT session.status, session.definition_contract, session.current_task_code,
    educator.id AS educator_id INTO v_access
  FROM public.assessment_sessions session
  JOIN public.students student ON student.id=session.student_id
  JOIN public.users educator
    ON educator.auth_user_id::text=p_auth_user_id AND educator.is_active=true
   AND educator.role::text='educator' AND educator.academy_id=student.academy_id
  JOIN public.teacher_student_links link
    ON link.teacher_id=educator.id AND link.student_id=student.id
   AND link.academy_id=educator.academy_id AND link.can_view=true
  WHERE session.id=p_session_id
  FOR UPDATE OF session;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_attempt FROM public.assessment_attempts attempt
  WHERE attempt.id=p_attempt_id AND attempt.session_id=p_session_id
    AND attempt.client_attempt_id IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_attempt.task_code IS DISTINCT FROM p_task_code THEN
    RAISE EXCEPTION 'T4_REVIEW_TASK_MISMATCH' USING ERRCODE='23505';
  END IF;
  IF v_attempt.educator_review IS NOT NULL THEN
    IF v_attempt.educator_review->>'decision' <> p_decision
       OR v_attempt.educator_review->>'nextTaskCode' <> p_next_task_code THEN
      RAISE EXCEPTION 'T4_REVIEW_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_attempt.id, v_attempt.educator_review->>'nextTaskCode', true;
    RETURN;
  END IF;
  IF v_access.status <> 'active'
     OR v_access.definition_contract->>'serverEvaluatorId' <> 'P2_DETERMINISTIC_TEXT'
     OR v_access.definition_contract->>'serverEvaluatorVersion' <> '1'
     OR v_access.current_task_code IS DISTINCT FROM v_attempt.task_code
     OR v_attempt.server_evaluation->>'verdict' <> 'unassessable'
     OR v_attempt.server_evaluation->>'needsEducatorReview' <> 'true'
     OR v_attempt.server_next_task_code IS NOT NULL THEN
    RETURN;
  END IF;
  v_review=jsonb_build_object('origin','educator_observed',
    'decision',p_decision,'nextTaskCode',p_next_task_code);
  UPDATE public.assessment_attempts
  SET educator_review=v_review, educator_reviewed_by=v_access.educator_id,
      educator_reviewed_at=now()
  WHERE id=p_attempt_id;
  UPDATE public.assessment_sessions
  SET current_task_code=p_next_task_code
  WHERE id=p_session_id;
  RETURN QUERY SELECT p_attempt_id, p_next_task_code, false;
END $$;
REVOKE ALL ON FUNCTION public.cza_t4_review_assessment_attempt(
  uuid,uuid,text,text,text,text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cza_owner') THEN
    GRANT EXECUTE ON FUNCTION public.cza_t4_review_assessment_attempt(
      uuid,uuid,text,text,text,text) TO cza_owner;
  END IF;
END $$;
COMMIT;
