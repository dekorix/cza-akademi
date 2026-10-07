-- U9 Guardian Panel identity/session/access bridge.
-- Canonical users/students are reused; no duplicate learning profile or assignment store.
BEGIN;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('student','educator','guardian'));

CREATE TABLE IF NOT EXISTS public.guardian_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  guardian_user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (guardian_user_id, academy_id)
    REFERENCES public.users(id, academy_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id, academy_id)
    REFERENCES public.students(id, academy_id) ON DELETE RESTRICT,
  UNIQUE (academy_id, guardian_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_student_links_visible_u9
  ON public.guardian_student_links(academy_id, guardian_user_id, student_id)
  WHERE can_view = true;

CREATE TABLE IF NOT EXISTS public.guardian_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  guardian_user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (guardian_user_id, academy_id)
    REFERENCES public.users(id, academy_id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_guardian_sessions_active_u9
  ON public.guardian_sessions(guardian_user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

COMMIT;
