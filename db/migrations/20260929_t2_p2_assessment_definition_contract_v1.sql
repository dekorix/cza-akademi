-- T2: pin P2 definition identity on the existing assessment session.
BEGIN;

ALTER TABLE public.assessment_sessions
  ADD COLUMN IF NOT EXISTS definition_contract jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assessment_sessions'::regclass
      AND conname = 'assessment_sessions_definition_contract_t2'
  ) THEN
    ALTER TABLE public.assessment_sessions
      ADD CONSTRAINT assessment_sessions_definition_contract_t2
      CHECK (
        definition_contract IS NULL OR (
          jsonb_typeof(definition_contract) = 'object'
          AND definition_contract ?& ARRAY[
            'definitionId', 'assessmentVersion', 'blueprintId',
            'blueprintVersion', 'itemBankSha256', 'routingSha256', 'taskMappingVersion',
            'serverEvaluatorId', 'serverEvaluatorVersion',
            'rubricVersion', 'answerKeyVersion'
          ]
          AND jsonb_typeof(definition_contract->'assessmentVersion') = 'number'
          AND (definition_contract->>'assessmentVersion')::integer > 0
          AND jsonb_typeof(definition_contract->'itemBankSha256') = 'string'
          AND length(definition_contract->>'itemBankSha256') = 64
          AND jsonb_typeof(definition_contract->'routingSha256') = 'string'
          AND length(definition_contract->>'routingSha256') = 64
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cza_t2_keep_assessment_definition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.definition_contract IS DISTINCT FROM NEW.definition_contract THEN
    RAISE EXCEPTION 'ASSESSMENT_DEFINITION_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS assessment_definition_immutable_t2
  ON public.assessment_sessions;
CREATE TRIGGER assessment_definition_immutable_t2
BEFORE UPDATE OF definition_contract ON public.assessment_sessions
FOR EACH ROW EXECUTE FUNCTION public.cza_t2_keep_assessment_definition();

COMMIT;
