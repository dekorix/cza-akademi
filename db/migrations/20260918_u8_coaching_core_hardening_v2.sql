-- U8 coaching hardening: ownership, revision history and cross-record identity.
-- Additive, idempotent and non-destructive. Production execution is not authorized.

ALTER TABLE public.coaching_programs
  ADD COLUMN IF NOT EXISTS period_label text NULL;

ALTER TABLE public.coaching_exam_results
  ADD COLUMN IF NOT EXISTS duration_minutes integer NULL;

ALTER TABLE public.coaching_meetings
  ADD COLUMN IF NOT EXISTS follow_up_recipe_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_goal_identity_u8
  ON public.coaching_goals(id, academy_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_study_identity_u8
  ON public.coaching_study_logs(id, academy_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_exam_identity_u8
  ON public.coaching_exam_results(id, academy_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_goal_single_successor_u8
  ON public.coaching_goals(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_exam_single_successor_u8
  ON public.coaching_exam_results(supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.coaching_plan_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL,
  student_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  period_start date NOT NULL,
  period_end date NOT NULL,
  monthly_focus text NULL CHECK (monthly_focus IS NULL OR length(monthly_focus) <= 1000),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'cancelled')),
  client_request_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  FOREIGN KEY (plan_id, academy_id, student_id)
    REFERENCES public.coaching_plans(id, academy_id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (coach_id, academy_id)
    REFERENCES public.users(id, academy_id) ON DELETE RESTRICT,
  UNIQUE (plan_id, revision),
  UNIQUE (academy_id, coach_id, client_request_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_programs_period_u8_check'
      AND conrelid = 'public.coaching_programs'::regclass
  ) THEN
    ALTER TABLE public.coaching_programs
      ADD CONSTRAINT coaching_programs_period_u8_check
      CHECK (period_label IS NULL OR length(btrim(period_label)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_exam_duration_u8_check'
      AND conrelid = 'public.coaching_exam_results'::regclass
  ) THEN
    ALTER TABLE public.coaching_exam_results
      ADD CONSTRAINT coaching_exam_duration_u8_check
      CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_goals_coach_u8_fkey'
      AND conrelid = 'public.coaching_goals'::regclass
  ) THEN
    ALTER TABLE public.coaching_goals
      ADD CONSTRAINT coaching_goals_coach_u8_fkey
      FOREIGN KEY (coach_id, academy_id) REFERENCES public.users(id, academy_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_goals_supersedes_scope_u8_fkey'
      AND conrelid = 'public.coaching_goals'::regclass
  ) THEN
    ALTER TABLE public.coaching_goals
      ADD CONSTRAINT coaching_goals_supersedes_scope_u8_fkey
      FOREIGN KEY (supersedes_id, academy_id, student_id)
      REFERENCES public.coaching_goals(id, academy_id, student_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_plans_coach_u8_fkey'
      AND conrelid = 'public.coaching_plans'::regclass
  ) THEN
    ALTER TABLE public.coaching_plans
      ADD CONSTRAINT coaching_plans_coach_u8_fkey
      FOREIGN KEY (coach_id, academy_id) REFERENCES public.users(id, academy_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_study_reporter_u8_fkey'
      AND conrelid = 'public.coaching_study_logs'::regclass
  ) THEN
    ALTER TABLE public.coaching_study_logs
      ADD CONSTRAINT coaching_study_reporter_u8_fkey
      FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_exam_reporter_u8_fkey'
      AND conrelid = 'public.coaching_exam_results'::regclass
  ) THEN
    ALTER TABLE public.coaching_exam_results
      ADD CONSTRAINT coaching_exam_reporter_u8_fkey
      FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_exam_supersedes_scope_u8_fkey'
      AND conrelid = 'public.coaching_exam_results'::regclass
  ) THEN
    ALTER TABLE public.coaching_exam_results
      ADD CONSTRAINT coaching_exam_supersedes_scope_u8_fkey
      FOREIGN KEY (supersedes_id, academy_id, student_id)
      REFERENCES public.coaching_exam_results(id, academy_id, student_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_mistake_exam_scope_u8_fkey'
      AND conrelid = 'public.coaching_mistakes'::regclass
  ) THEN
    ALTER TABLE public.coaching_mistakes
      ADD CONSTRAINT coaching_mistake_exam_scope_u8_fkey
      FOREIGN KEY (exam_result_id, academy_id, student_id)
      REFERENCES public.coaching_exam_results(id, academy_id, student_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_mistake_study_scope_u8_fkey'
      AND conrelid = 'public.coaching_mistakes'::regclass
  ) THEN
    ALTER TABLE public.coaching_mistakes
      ADD CONSTRAINT coaching_mistake_study_scope_u8_fkey
      FOREIGN KEY (study_log_id, academy_id, student_id)
      REFERENCES public.coaching_study_logs(id, academy_id, student_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_mistake_creator_u8_fkey'
      AND conrelid = 'public.coaching_mistakes'::regclass
  ) THEN
    ALTER TABLE public.coaching_mistakes
      ADD CONSTRAINT coaching_mistake_creator_u8_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_meeting_coach_u8_fkey'
      AND conrelid = 'public.coaching_meetings'::regclass
  ) THEN
    ALTER TABLE public.coaching_meetings
      ADD CONSTRAINT coaching_meeting_coach_u8_fkey
      FOREIGN KEY (coach_id, academy_id) REFERENCES public.users(id, academy_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_meeting_follow_up_u8_fkey'
      AND conrelid = 'public.coaching_meetings'::regclass
  ) THEN
    ALTER TABLE public.coaching_meetings
      ADD CONSTRAINT coaching_meeting_follow_up_u8_fkey
      FOREIGN KEY (follow_up_recipe_id, academy_id, student_id)
      REFERENCES public.training_recipes(id, academy_id, student_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_topic_updater_u8_fkey'
      AND conrelid = 'public.coaching_topic_status'::regclass
  ) THEN
    ALTER TABLE public.coaching_topic_status
      ADD CONSTRAINT coaching_topic_updater_u8_fkey
      FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_coaching_plan_revision_history_u8
  ON public.coaching_plan_revisions(academy_id, student_id, plan_id, revision DESC);
