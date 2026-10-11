-- Proposed additive V02 audit schema. Apply only to approved isolated QA.
BEGIN;
CREATE TABLE IF NOT EXISTS public.assessment_student_link_audit (
 session_id uuid PRIMARY KEY REFERENCES public.assessment_sessions(id) ON DELETE RESTRICT,
 academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
 educator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
 candidate_id text NOT NULL,
 cycle_id text NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION public.cza_v02_audit_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'V02 link audit is immutable' USING ERRCODE='55000'; END $$;
CREATE OR REPLACE TRIGGER cza_v02_audit_immutable
 BEFORE UPDATE OR DELETE OR TRUNCATE ON public.assessment_student_link_audit
 FOR EACH STATEMENT EXECUTE FUNCTION public.cza_v02_audit_immutable();
GRANT SELECT, INSERT ON public.assessment_student_link_audit TO cza_v01_app_runtime_min;

-- Runtime cannot lock users/students without UPDATE privileges. A fixed SQL
-- definer function supplies only this operation; it does not grant DDL/admin.
CREATE OR REPLACE FUNCTION public.cza_v02_bind_assessment(
  actor_auth_id text, source_session uuid, target_student uuid, qa_only boolean
) RETURNS TABLE(outcome text, session_id uuid, student_id uuid, linked_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
#variable_conflict use_column
BEGIN
 IF qa_only IS DISTINCT FROM true
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR current_database() <> 'cza_t5_synthetic' THEN
   RAISE EXCEPTION 'V02 isolated QA target required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY

WITH authority AS MATERIALIZED (
  SELECT u.id AS educator_id,u.academy_id,s.id AS student_id
  FROM public.users u
  JOIN public.teacher_student_links l ON l.teacher_id=u.id AND l.academy_id=u.academy_id
  JOIN public.students s ON s.id=l.student_id AND s.academy_id=u.academy_id
  WHERE u.auth_user_id=$1 AND u.is_active=true AND u.role::text='educator'
    AND l.can_view=true AND l.can_link_assessment=true AND s.status='active'
    AND s.id=$3::uuid AND ($4::boolean=false OR s.is_demo=true)
  FOR SHARE OF u,l,s
), locked AS MATERIALIZED (
  SELECT a.*,authority.educator_id,authority.academy_id
  FROM public.assessment_sessions a JOIN authority
    ON a.metadata->>'academyId'=authority.academy_id::text
  WHERE a.id=$2::uuid AND a.template_code LIKE 'CZA_SPECIAL_V1_%'
    AND a.metadata->>'createdByEducatorId'=$1
    AND a.metadata->>'source'='EDUCATOR_PRE_ENROLLMENT'
    AND a.metadata->>'candidateId' IS NOT NULL AND a.metadata->>'cycleId' IS NOT NULL
    AND a.status IN ('active','completed')
  FOR UPDATE OF a
), changed AS (
  UPDATE public.assessment_sessions a SET student_id=$3::uuid
  FROM locked WHERE a.id=locked.id AND a.student_id IS NULL
  RETURNING a.id,a.student_id,a.metadata
), audited AS (
  INSERT INTO public.assessment_student_link_audit
    (session_id,academy_id,educator_id,student_id,candidate_id,cycle_id)
  SELECT changed.id,locked.academy_id,locked.educator_id,changed.student_id,
         changed.metadata->>'candidateId',changed.metadata->>'cycleId'
  FROM changed JOIN locked ON locked.id=changed.id
  RETURNING session_id,student_id,linked_at
)
SELECT 'linked' AS outcome,session_id,student_id,linked_at FROM audited
UNION ALL
SELECT CASE WHEN locked.student_id=$3::uuid THEN 'already_linked' ELSE 'conflict' END,
       locked.id,locked.student_id,audit.linked_at
FROM locked LEFT JOIN public.assessment_student_link_audit audit ON audit.session_id=locked.id
WHERE locked.student_id IS NOT NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.cza_v02_bind_assessment(text,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cza_v02_bind_assessment(text,uuid,uuid,boolean) TO cza_v01_app_runtime_min;

COMMIT;
