-- CZA Özel Eğitim · Günlük çalışma oturumları v1
-- Additive, non-destructive. Merkezi öğrenci ve program kimliğine bağlıdır.

BEGIN;

CREATE TABLE IF NOT EXISTS public.special_education_program_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.special_education_programs(id) ON DELETE CASCADE,
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_index integer NOT NULL CHECK (session_index BETWEEN 1 AND 60),
  week_no integer NOT NULL CHECK (week_no BETWEEN 1 AND 12),
  session_in_week integer NOT NULL CHECK (session_in_week BETWEEN 1 AND 7),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','skipped')),
  plan_snapshot jsonb NOT NULL CHECK (jsonb_typeof(plan_snapshot) = 'object'),
  student_reflection jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(student_reflection) = 'object'),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, session_index)
);

CREATE INDEX IF NOT EXISTS idx_special_program_sessions_student
  ON public.special_education_program_sessions(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_special_program_sessions_program
  ON public.special_education_program_sessions(program_id, session_index);

COMMIT;
