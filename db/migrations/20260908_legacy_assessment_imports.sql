-- CZA geçmiş değerlendirme geçiş kaydı
-- Google Form sonuçları yalnız denetlenebilir, tek seferlik kayıtlarla içeri alınır.

CREATE TABLE IF NOT EXISTS public.legacy_assessment_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  source_system text NOT NULL CHECK (source_system IN ('google_student_form', 'google_educator_form')),
  source_record_id text NOT NULL,
  assessment_status text NOT NULL CHECK (assessment_status IN ('submitted', 'awaiting_educator_assessment')),
  assessed_at timestamptz NULL,
  raw_payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by text NOT NULL DEFAULT 'cza_legacy_import',
  UNIQUE (source_system, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_assessment_imports_student
  ON public.legacy_assessment_imports(student_id, assessed_at DESC);
