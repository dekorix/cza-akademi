-- Approved for isolated synthetic QA only: issue #81 comment 6105245576.
-- Permission is separate from viewing and coaching; no existing relation is enabled.
BEGIN;
ALTER TABLE public.teacher_student_links
  ADD COLUMN IF NOT EXISTS can_link_assessment boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.teacher_student_links.can_link_assessment IS
  'Explicit permission to bind an educator-owned pre-enrollment assessment to this existing active same-academy student. Requires can_view as well; can_coach does not imply this permission.';
COMMIT;
