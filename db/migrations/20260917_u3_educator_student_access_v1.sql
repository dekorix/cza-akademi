-- U3 educator-to-student read authorization bridge.
-- Additive and idempotent; extends the canonical users/students identity only.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS academy_id uuid NULL,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS email text NULL,
  ADD COLUMN IF NOT EXISTS display_name text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id_academy_u3
  ON public.users(id, academy_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_identity_u3
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.teacher_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (teacher_id, academy_id)
    REFERENCES public.users(id, academy_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id, academy_id)
    REFERENCES public.students(id, academy_id) ON DELETE RESTRICT,
  UNIQUE (academy_id, teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_student_links_authorized_u3
  ON public.teacher_student_links(academy_id, teacher_id, student_id)
  WHERE can_view = true;

COMMIT;
