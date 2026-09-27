-- F3C3: composite identity keys required by canonical U8 v1/v2 foreign keys.
-- Apply before U8 v1, then U8 v2. No role grants or recipe index changes.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_f3c3_users_academy_identity
  ON public.users(id, academy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_f3c3_students_academy_identity
  ON public.students(id, academy_id);

COMMIT;
