-- U5 educator assignment management on the canonical training_recipes model.
-- Additive, idempotent, and safe to apply repeatedly.
BEGIN;

ALTER TABLE public.training_recipes
  ADD COLUMN IF NOT EXISTS instructions text NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid NULL,
  ADD COLUMN IF NOT EXISTS client_request_id uuid NULL,
  ADD COLUMN IF NOT EXISTS request_hash text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_recipes_cancelled_by_u5_fkey'
      AND conrelid = 'public.training_recipes'::regclass
  ) THEN
    ALTER TABLE public.training_recipes
      ADD CONSTRAINT training_recipes_cancelled_by_u5_fkey
      FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_recipes_instructions_u5_check'
      AND conrelid = 'public.training_recipes'::regclass
  ) THEN
    ALTER TABLE public.training_recipes
      ADD CONSTRAINT training_recipes_instructions_u5_check
      CHECK (instructions IS NULL OR length(instructions) <= 1000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_recipes_request_hash_u5_check'
      AND conrelid = 'public.training_recipes'::regclass
  ) THEN
    ALTER TABLE public.training_recipes
      ADD CONSTRAINT training_recipes_request_hash_u5_check
      CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_recipes_cancel_state_u5_check'
      AND conrelid = 'public.training_recipes'::regclass
  ) THEN
    ALTER TABLE public.training_recipes
      ADD CONSTRAINT training_recipes_cancel_state_u5_check
      CHECK (
        (cancelled_at IS NULL AND cancelled_by IS NULL)
        OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND is_active = false)
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_recipes_idempotency_u5
  ON public.training_recipes(academy_id, assigned_by, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_recipes_educator_status_u5
  ON public.training_recipes(academy_id, assigned_by, created_at DESC, id DESC);

COMMIT;
