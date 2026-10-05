-- CZA Özel Eğitim · Eğitimci onaylı bireysel çalışma programı v1
-- Additive, non-destructive. Same central student/academy identity.

BEGIN;

CREATE TABLE IF NOT EXISTS public.special_education_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assessment_session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE RESTRICT,
  profile_code text NOT NULL CHECK (profile_code ~ '^SP-[A-Z]+$'),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  duration_weeks integer NOT NULL DEFAULT 4 CHECK (duration_weeks BETWEEN 1 AND 12),
  sessions_per_week integer NOT NULL CHECK (sessions_per_week BETWEEN 1 AND 7),
  session_minutes integer NOT NULL CHECK (session_minutes BETWEEN 10 AND 90),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
  approved_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL) OR status <> 'completed'),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL) OR status <> 'cancelled')
);

CREATE INDEX IF NOT EXISTS idx_special_education_programs_student
  ON public.special_education_programs(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_special_education_programs_assessment
  ON public.special_education_programs(assessment_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_special_education_programs_active_profile
  ON public.special_education_programs(student_id, profile_code)
  WHERE status = 'active';

COMMIT;
