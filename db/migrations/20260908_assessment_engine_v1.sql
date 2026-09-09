-- CZA Değerlendirme Motoru v1.0
-- Parametrik görev, 14 beceri kanıtı, canlı oturum ve süreç verisi.

CREATE TABLE IF NOT EXISTS public.assessment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  grade_band text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, code)
);

CREATE TABLE IF NOT EXISTS public.assessment_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.assessment_stations(id) ON DELETE CASCADE,
  task_code text NOT NULL UNIQUE,
  task_group_code text NOT NULL,
  task_role text NOT NULL CHECK (task_role IN ('WARMUP','ACADEMIC_ANCHOR','CZA_PROBE','TRANSFER','SUPPORT_PROBE')),
  title text NOT NULL,
  child_instruction text NOT NULL,
  educator_instruction text NOT NULL,
  response_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  skill_weights jsonb NOT NULL DEFAULT '[]'::jsonb,
  branch_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_seconds integer NOT NULL DEFAULT 60,
  order_index integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text NOT NULL,
  student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  student_label text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  current_task_code text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  task_code text NOT NULL,
  shown_at timestamptz NOT NULL DEFAULT now(),
  first_action_at timestamptz NULL,
  completed_at timestamptz NULL,
  answer_text text NULL,
  answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_changes integer NOT NULL DEFAULT 0,
  support_level integer NOT NULL DEFAULT 0 CHECK (support_level BETWEEN 0 AND 5),
  self_corrected boolean NOT NULL DEFAULT false,
  rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_latency_ms integer NULL,
  total_response_time_ms integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_session
  ON public.assessment_attempts(session_id, created_at);

CREATE TABLE IF NOT EXISTS public.assessment_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  task_code text NOT NULL,
  observation_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  educator_note text NULL,
  confidence integer NULL CHECK (confidence BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_observations_session
  ON public.assessment_observations(session_id, created_at);
