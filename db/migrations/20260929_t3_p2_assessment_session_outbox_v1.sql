-- T3 P2: one linked assessment session and its durable event per logical cycle.
-- Existing sessions remain unkeyed; no historical row is reinterpreted.
BEGIN;

ALTER TABLE public.assessment_sessions
  ADD COLUMN IF NOT EXISTS assessment_cycle_key uuid,
  ADD COLUMN IF NOT EXISTS assessment_cycle_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assessment_sessions'::regclass
      AND conname = 'assessment_sessions_p2_cycle_shape'
  ) THEN
    ALTER TABLE public.assessment_sessions
      ADD CONSTRAINT assessment_sessions_p2_cycle_shape
      CHECK (
        (assessment_cycle_key IS NULL AND assessment_cycle_type IS NULL)
        OR (assessment_cycle_key IS NOT NULL AND assessment_cycle_type = 'INITIAL' AND student_id IS NOT NULL)
      );
  END IF;
END $$;

-- One initial P2 obligation per student and version, even from two browser tabs.
CREATE UNIQUE INDEX IF NOT EXISTS assessment_sessions_p2_cycle_identity
  ON public.assessment_sessions(student_id, template_code, assessment_cycle_type)
  WHERE assessment_cycle_type IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.assessment_session_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type = 'P2_ASSESSMENT_SESSION_CREATED'),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  UNIQUE (session_id, event_type)
);

COMMIT;
