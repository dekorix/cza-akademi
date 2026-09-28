-- T1 P2 assessment observation provenance.
-- Additive and legacy-safe. Existing observations remain unattributed.
BEGIN;

ALTER TABLE public.assessment_observations
  ADD COLUMN IF NOT EXISTS observer_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS observer_academy_id uuid NULL,
  ADD COLUMN IF NOT EXISTS observation_origin text NULL DEFAULT 'legacy_unknown';

UPDATE public.assessment_observations
SET observation_origin = 'legacy_unknown'
WHERE observation_origin IS NULL
  AND observer_user_id IS NULL
  AND observer_academy_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessment_observations_observer_user_t1_fk'
      AND conrelid = 'public.assessment_observations'::regclass
  ) THEN
    ALTER TABLE public.assessment_observations
      ADD CONSTRAINT assessment_observations_observer_user_t1_fk
      FOREIGN KEY (observer_user_id)
      REFERENCES public.users(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessment_observations_observer_academy_t1_fk'
      AND conrelid = 'public.assessment_observations'::regclass
  ) THEN
    ALTER TABLE public.assessment_observations
      ADD CONSTRAINT assessment_observations_observer_academy_t1_fk
      FOREIGN KEY (observer_academy_id)
      REFERENCES public.academies(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessment_observations_observer_scope_t1_fk'
      AND conrelid = 'public.assessment_observations'::regclass
  ) THEN
    ALTER TABLE public.assessment_observations
      ADD CONSTRAINT assessment_observations_observer_scope_t1_fk
      FOREIGN KEY (observer_user_id, observer_academy_id)
      REFERENCES public.users(id, academy_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessment_observations_origin_t1_check'
      AND conrelid = 'public.assessment_observations'::regclass
  ) THEN
    ALTER TABLE public.assessment_observations
      ADD CONSTRAINT assessment_observations_origin_t1_check
      CHECK (
        COALESCE(
          (
            observation_origin = 'legacy_unknown'
            AND observer_user_id IS NULL
            AND observer_academy_id IS NULL
          )
          OR
          (
            observation_origin = 'educator_observed'
            AND observer_user_id IS NOT NULL
            AND observer_academy_id IS NOT NULL
          ),
          false
        )
      );
  END IF;
END
$$;

COMMIT;
