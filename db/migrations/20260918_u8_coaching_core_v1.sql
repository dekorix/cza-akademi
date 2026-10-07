-- U8 LGS/YKS common coaching core. Additive, idempotent and non-destructive.
BEGIN;

ALTER TABLE public.teacher_student_links
  ADD COLUMN IF NOT EXISTS can_coach boolean NOT NULL DEFAULT false;

ALTER TABLE public.training_recipes
  ADD COLUMN IF NOT EXISTS task_kind text NOT NULL DEFAULT 'cza_module',
  ADD COLUMN IF NOT EXISTS academic_subject text NULL,
  ADD COLUMN IF NOT EXISTS academic_topic text NULL,
  ADD COLUMN IF NOT EXISTS resource_description text NULL,
  ADD COLUMN IF NOT EXISTS target_questions integer NULL,
  ADD COLUMN IF NOT EXISTS target_minutes integer NULL,
  ADD COLUMN IF NOT EXISTS task_purpose text NOT NULL DEFAULT 'practice';

ALTER TABLE public.training_recipes ALTER COLUMN module_code DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='training_recipes_u8_kind_check' AND conrelid='public.training_recipes'::regclass) THEN
    ALTER TABLE public.training_recipes ADD CONSTRAINT training_recipes_u8_kind_check CHECK (
      (task_kind='cza_module' AND module_code IS NOT NULL AND academic_subject IS NULL AND academic_topic IS NULL)
      OR
      (task_kind='academic' AND module_code IS NULL AND length(btrim(academic_subject)) BETWEEN 1 AND 80
       AND (academic_topic IS NULL OR length(academic_topic)<=180)
       AND (target_questions IS NULL OR target_questions BETWEEN 1 AND 10000)
       AND (target_minutes IS NULL OR target_minutes BETWEEN 1 AND 1440))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='training_recipes_u8_purpose_check' AND conrelid='public.training_recipes'::regclass) THEN
    ALTER TABLE public.training_recipes ADD CONSTRAINT training_recipes_u8_purpose_check
      CHECK (task_purpose IN ('practice','revision','exam_followup'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_student_links_coach_u8
  ON public.teacher_student_links(academy_id,teacher_id,student_id) WHERE can_view=true AND can_coach=true;

CREATE TABLE IF NOT EXISTS public.coaching_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid NOT NULL, student_id uuid NOT NULL,
  coach_id uuid NOT NULL, program_type text NOT NULL CHECK(program_type IN ('LGS','YKS')),
  exam_year integer NOT NULL CHECK(exam_year BETWEEN 2020 AND 2100), field_code text NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), client_request_id uuid NOT NULL, request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(student_id,academy_id) REFERENCES public.students(id,academy_id) ON DELETE RESTRICT,
  FOREIGN KEY(coach_id,academy_id) REFERENCES public.users(id,academy_id) ON DELETE RESTRICT,
  UNIQUE(academy_id,coach_id,client_request_id), UNIQUE(id,academy_id,student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_program_active_u8 ON public.coaching_programs(student_id,program_type,exam_year) WHERE status='active';

CREATE TABLE IF NOT EXISTS public.coaching_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid NOT NULL,student_id uuid NOT NULL,program_id uuid NOT NULL,
  coach_id uuid NOT NULL, revision integer NOT NULL DEFAULT 1, target jsonb NOT NULL CHECK(jsonb_typeof(target)='object'),
  provenance text NOT NULL DEFAULT 'CLIENT_REPORTED' CHECK(provenance='CLIENT_REPORTED'), supersedes_id uuid NULL,
  client_request_id uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(program_id,academy_id,student_id) REFERENCES public.coaching_programs(id,academy_id,student_id) ON DELETE RESTRICT,
  FOREIGN KEY(supersedes_id) REFERENCES public.coaching_goals(id) ON DELETE RESTRICT,
  UNIQUE(academy_id,coach_id,client_request_id),UNIQUE(program_id,revision)
);

CREATE TABLE IF NOT EXISTS public.coaching_topic_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,program_id uuid NOT NULL,
  subject_code text NOT NULL,topic_code text NOT NULL,achievement_code text NOT NULL DEFAULT '',status text NOT NULL CHECK(status IN ('not_started','in_progress','review','completed')),
  source text NOT NULL,updated_by uuid NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(program_id,academy_id,student_id) REFERENCES public.coaching_programs(id,academy_id,student_id) ON DELETE RESTRICT,
  UNIQUE(program_id,subject_code,topic_code,achievement_code)
);

CREATE TABLE IF NOT EXISTS public.coaching_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,program_id uuid NOT NULL,coach_id uuid NOT NULL,
  title text NOT NULL,period_start date NOT NULL,period_end date NOT NULL,monthly_focus text NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled')),
  version integer NOT NULL DEFAULT 1,client_request_id uuid NOT NULL,request_hash text NOT NULL,
  published_at timestamptz NULL,cancelled_at timestamptz NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(program_id,academy_id,student_id) REFERENCES public.coaching_programs(id,academy_id,student_id) ON DELETE RESTRICT,
  CHECK(period_end>=period_start),UNIQUE(academy_id,coach_id,client_request_id),UNIQUE(id,academy_id,student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_plan_no_overlap_u8 ON public.coaching_plans(student_id,period_start,period_end) WHERE status='published';

CREATE TABLE IF NOT EXISTS public.coaching_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,plan_id uuid NOT NULL,
  recipe_id uuid NOT NULL,scheduled_for date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(plan_id,academy_id,student_id) REFERENCES public.coaching_plans(id,academy_id,student_id) ON DELETE RESTRICT,
  FOREIGN KEY(recipe_id,academy_id,student_id) REFERENCES public.training_recipes(id,academy_id,student_id) ON DELETE RESTRICT,
  UNIQUE(plan_id,recipe_id)
);

CREATE TABLE IF NOT EXISTS public.coaching_study_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,recipe_id uuid NOT NULL,
  reported_by uuid NOT NULL,question_count integer NULL,correct_count integer NULL,wrong_count integer NULL,blank_count integer NULL,
  duration_minutes integer NULL,student_feedback text NULL,provenance text NOT NULL DEFAULT 'CLIENT_REPORTED' CHECK(provenance='CLIENT_REPORTED'),
  client_request_id uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(recipe_id,academy_id,student_id) REFERENCES public.training_recipes(id,academy_id,student_id) ON DELETE RESTRICT,
  CHECK(question_count IS NULL OR question_count>=0),CHECK(correct_count IS NULL OR correct_count>=0),
  CHECK(wrong_count IS NULL OR wrong_count>=0),CHECK(blank_count IS NULL OR blank_count>=0),
  CHECK(duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440),
  CHECK(question_count IS NULL OR COALESCE(correct_count,0)+COALESCE(wrong_count,0)+COALESCE(blank_count,0)<=question_count),
  UNIQUE(academy_id,student_id,client_request_id)
);

CREATE TABLE IF NOT EXISTS public.coaching_exam_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL,version integer NOT NULL,program_type text NOT NULL CHECK(program_type IN ('LGS','YKS')),
  stage text NOT NULL CHECK(stage IN ('LGS_GENERAL','LGS_BRANCH','TYT_GENERAL','TYT_BRANCH','AYT_GENERAL','AYT_BRANCH')),
  rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object'),source_label text NOT NULL,is_demo boolean NOT NULL DEFAULT true,is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(code,version)
);

INSERT INTO public.coaching_exam_templates(code,version,program_type,stage,rules,source_label,is_demo)
VALUES
 ('CZA_DEMO_LGS_GENERAL',1,'LGS','LGS_GENERAL','{"netPenaltyDivisor":3,"sections":[{"code":"TR","questions":20},{"code":"MAT","questions":20},{"code":"FEN","questions":20}]}','CZA demo acceptance template — resmî değildir',true),
 ('CZA_DEMO_TYT_GENERAL',1,'YKS','TYT_GENERAL','{"netPenaltyDivisor":4,"sections":[{"code":"TYT_TR","questions":40},{"code":"TYT_MAT","questions":40}]}','CZA demo acceptance template — resmî değildir',true),
 ('CZA_DEMO_AYT_BRANCH',1,'YKS','AYT_BRANCH','{"netPenaltyDivisor":4,"sections":[{"code":"AYT_MAT","questions":40}]}','CZA demo acceptance template — resmî değildir',true)
ON CONFLICT(code,version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.coaching_exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,program_id uuid NOT NULL,template_id uuid NOT NULL,
  reported_by uuid NOT NULL,exam_date date NOT NULL,sections jsonb NOT NULL CHECK(jsonb_typeof(sections)='array'),total_net numeric(8,2) NULL,
  is_partial boolean NOT NULL,provenance text NOT NULL DEFAULT 'CLIENT_REPORTED' CHECK(provenance='CLIENT_REPORTED'),
  revision integer NOT NULL DEFAULT 1,supersedes_id uuid NULL,client_request_id uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(program_id,academy_id,student_id) REFERENCES public.coaching_programs(id,academy_id,student_id) ON DELETE RESTRICT,
  FOREIGN KEY(template_id) REFERENCES public.coaching_exam_templates(id) ON DELETE RESTRICT,
  FOREIGN KEY(supersedes_id) REFERENCES public.coaching_exam_results(id) ON DELETE RESTRICT,
  UNIQUE(academy_id,reported_by,client_request_id),UNIQUE(program_id,id)
);

CREATE TABLE IF NOT EXISTS public.coaching_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,program_id uuid NOT NULL,
  exam_result_id uuid NULL,study_log_id uuid NULL,subject_code text NOT NULL,topic_code text NULL,reason_code text NOT NULL,
  explanation text NULL,provenance text NOT NULL DEFAULT 'CLIENT_REPORTED' CHECK(provenance='CLIENT_REPORTED'),created_by uuid NOT NULL,
  client_request_id uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((exam_result_id IS NOT NULL)::int+(study_log_id IS NOT NULL)::int=1),
  FOREIGN KEY(program_id,academy_id,student_id) REFERENCES public.coaching_programs(id,academy_id,student_id) ON DELETE RESTRICT,
  FOREIGN KEY(exam_result_id) REFERENCES public.coaching_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY(study_log_id) REFERENCES public.coaching_study_logs(id) ON DELETE RESTRICT,
  UNIQUE(academy_id,created_by,client_request_id)
);

CREATE TABLE IF NOT EXISTS public.coaching_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid NOT NULL,student_id uuid NOT NULL,program_id uuid NOT NULL,coach_id uuid NOT NULL,
  meeting_at timestamptz NOT NULL,private_note text NULL,shared_summary text NULL,next_week_focus text NULL,student_feedback text NULL,
  version integer NOT NULL DEFAULT 1,client_request_id uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(program_id,academy_id,student_id) REFERENCES public.coaching_programs(id,academy_id,student_id) ON DELETE RESTRICT,
  UNIQUE(academy_id,coach_id,client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_program_student_u8 ON public.coaching_programs(academy_id,student_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_plan_student_u8 ON public.coaching_plans(academy_id,student_id,period_start DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_study_student_u8 ON public.coaching_study_logs(academy_id,student_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_exam_student_u8 ON public.coaching_exam_results(academy_id,student_id,exam_date DESC,id DESC);

COMMIT;
