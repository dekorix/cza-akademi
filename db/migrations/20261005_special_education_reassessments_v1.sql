-- CZA Özel Eğitim · Program sonrası hedefli yeniden ölçüm v1
-- Additive, non-destructive. Her program için tek kapanış karşılaştırması.

BEGIN;

CREATE TABLE IF NOT EXISTS public.special_education_reassessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.special_education_programs(id) ON DELETE CASCADE,
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  baseline_session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE RESTRICT,
  profile_code text NOT NULL CHECK (profile_code ~ '^SP-[A-Z]+$'),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','void')),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'array'),
  comparison jsonb NOT NULL CHECK (jsonb_typeof(comparison) = 'object'),
  completed_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id)
);

CREATE INDEX IF NOT EXISTS idx_special_reassessments_student
  ON public.special_education_reassessments(student_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_special_reassessments_baseline
  ON public.special_education_reassessments(baseline_session_id);

COMMIT;
