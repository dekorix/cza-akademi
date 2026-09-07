-- CZA merkezi kimlik temeli
-- Bu geçiş, kampüs kodu ve eski sistem referanslarını tek öğrenci kaydına bağlar.
-- Eğitmen oturumları da öğrenci oturumları gibi yalnız token özetiyle saklanır.

CREATE TABLE IF NOT EXISTS public.student_external_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  identifier_type text NOT NULL CHECK (identifier_type IN ('campus_student_code', 'legacy_reference')),
  identifier_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier_type, identifier_value),
  UNIQUE (student_id, identifier_type)
);

CREATE INDEX IF NOT EXISTS idx_student_external_identifiers_student
  ON public.student_external_identifiers(student_id);

CREATE TABLE IF NOT EXISTS public.educator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  educator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_educator_sessions_active
  ON public.educator_sessions(educator_user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

-- Bilinen geçiş kaydını yalnız zeynep7'nin mevcut öğrenci kimliği üzerinden bağlar.
INSERT INTO public.student_external_identifiers (student_id, identifier_type, identifier_value)
SELECT s.id, 'campus_student_code', '582946'
FROM public.students s
JOIN public.users u ON u.id = s.user_id
WHERE u.username = 'zeynep7'
ON CONFLICT (identifier_type, identifier_value) DO NOTHING;

INSERT INTO public.student_external_identifiers (student_id, identifier_type, identifier_value)
SELECT s.id, 'legacy_reference', 'ZC-007'
FROM public.students s
JOIN public.users u ON u.id = s.user_id
WHERE u.username = 'zeynep7'
ON CONFLICT (identifier_type, identifier_value) DO NOTHING;

