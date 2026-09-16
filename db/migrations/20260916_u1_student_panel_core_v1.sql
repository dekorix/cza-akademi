-- CZA U1 student panel core v1
--
-- Additive completion of the existing canonical student/work model for a fresh
-- P3 staging database. This migration creates no student or parent data and is
-- safe to apply repeatedly.

BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS first_name text NULL,
  ADD COLUMN IF NOT EXISTS last_name text NULL,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

INSERT INTO public.modules (code, name, is_active)
VALUES
  ('finger_read', 'Parmak Okuma', true),
  ('finger_press', 'Parmak Basma', true),
  ('soroban_read', 'Soroban Okuma', true),
  ('soroban_write', 'Soroban Yazma', true),
  ('arithmetic', 'Toplama / Çıkarma', true),
  ('flash_anzan', 'Flash Anzan', true),
  ('audio_anzan', 'Sesli Anzan', true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.training_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL,
  module_code text NOT NULL REFERENCES public.modules(code) ON DELETE RESTRICT,
  assigned_by uuid NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('teacher_assignment')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 180),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, academy_id)
    REFERENCES public.students(id, academy_id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
  UNIQUE (id, academy_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_training_recipes_student_active_u1
  ON public.training_recipes(academy_id, student_id, created_at DESC)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_recipes_one_active_module_u1
  ON public.training_recipes(student_id, module_code)
  WHERE source = 'teacher_assignment' AND is_active = true;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS recipe_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_identity_u1
  ON public.training_sessions(id, academy_id, student_id);

CREATE INDEX IF NOT EXISTS idx_training_sessions_recipe_u1
  ON public.training_sessions(recipe_id, started_at DESC)
  WHERE recipe_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_sessions_recipe_identity_u1_fkey'
      AND conrelid = 'public.training_sessions'::regclass
  ) THEN
    ALTER TABLE public.training_sessions
      ADD CONSTRAINT training_sessions_recipe_identity_u1_fkey
      FOREIGN KEY (recipe_id, academy_id, student_id)
      REFERENCES public.training_recipes(id, academy_id, student_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL,
  student_id uuid NOT NULL,
  training_session_id uuid NOT NULL,
  module_code text NOT NULL REFERENCES public.modules(code) ON DELETE RESTRICT,
  client_attempt_id uuid NOT NULL,
  question_index integer NOT NULL CHECK (question_index BETWEEN 0 AND 10000),
  question_id text NOT NULL CHECK (length(question_id) BETWEEN 1 AND 180),
  target_number bigint NULL,
  student_numeric_answer bigint NULL,
  pattern_valid boolean NOT NULL DEFAULT true,
  is_correct boolean NOT NULL,
  error_type text NOT NULL CHECK (length(error_type) BETWEEN 1 AND 80),
  error_detail text NULL CHECK (error_detail IS NULL OR length(error_detail) <= 500),
  stimulus_duration_ms integer NULL CHECK (stimulus_duration_ms IS NULL OR stimulus_duration_ms BETWEEN 0 AND 86400000),
  response_latency_ms integer NULL CHECK (response_latency_ms IS NULL OR response_latency_ms BETWEEN 0 AND 86400000),
  total_response_time_ms integer NULL CHECK (total_response_time_ms IS NULL OR total_response_time_ms BETWEEN 0 AND 86400000),
  learning_mode text NULL CHECK (learning_mode IS NULL OR length(learning_mode) <= 80),
  difficulty_level integer NULL CHECK (difficulty_level IS NULL OR difficulty_level BETWEEN 0 AND 10000),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, academy_id)
    REFERENCES public.students(id, academy_id) ON DELETE RESTRICT,
  FOREIGN KEY (training_session_id, academy_id, student_id)
    REFERENCES public.training_sessions(id, academy_id, student_id) ON DELETE RESTRICT,
  UNIQUE (academy_id, client_attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_question_attempts_student_created_u1
  ON public.question_attempts(academy_id, student_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_question_attempts_module_student_u1
  ON public.question_attempts(student_id, module_code, created_at DESC);

CREATE OR REPLACE FUNCTION public.cza_reject_demo_student_outside_nonproduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_environment text;
BEGIN
  IF NEW.is_demo IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT academies.environment
  INTO v_environment
  FROM public.academies AS academies
  WHERE academies.id = NEW.academy_id;

  IF v_environment IS NULL OR v_environment NOT IN ('development', 'test', 'staging') THEN
    RAISE EXCEPTION 'CZA_DEMO_STUDENT_ENVIRONMENT_REJECTED' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_demo_environment_guard_u1 ON public.students;
CREATE TRIGGER students_demo_environment_guard_u1
BEFORE INSERT OR UPDATE OF is_demo, academy_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.cza_reject_demo_student_outside_nonproduction();

COMMIT;
