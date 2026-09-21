/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';

const migration = fs.readFileSync(
  new URL(
    '../db/migrations/20260921_k3c_engine_provenance_v1.sql',
    import.meta.url,
  ),
  'utf8',
);

async function load(path) {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    return await vite.ssrLoadModule(path);
  } finally {
    await vite.close();
  }
}

test('registry is the single source for ANZAN provenance and numeric responses remain compatible', async () => {
  const records = await load('/lib/core-records.ts');
  const responses = await load('/lib/response-contract.ts');
  const config = {
    mode: 'flash',
    digits: 1,
    minDigits: 1,
    maxDigits: 1,
    terms: 2,
    rounds: 1,
    interval: 0.5,
    stimulusVisibleMs: 500,
    interStimulusGapMs: 100,
    pool: [1],
    additionPool: [1],
    subtractionPool: [1],
    operation: 'add',
    practiceMode: 'free_practice',
  };
  const settings = records.trainingSettings(config);
  assert.equal(settings.engineId, 'ANZAN');
  assert.equal(settings.engineVersion, '1');
  assert.equal(settings.engine, 'cza-exercise-engine-v14');

  const payload = records.attemptPayload(
    {
      sequence: [2, 3],
      expected: 5,
      given: 5,
      correct: true,
      timeout: false,
      elapsedMs: 400,
    },
    config,
    1,
    { attemptId: 'a', questionId: 'q' },
  );
  assert.deepEqual(payload.metadata.responsePayload, { value: 5 });
  assert.equal(payload.metadata.responseType, 'numeric');
  assert.equal(payload.studentNumericAnswer, 5);
  assert.deepEqual(
    responses.validateCanonicalResponse({
      type: 'numeric',
      payload: { value: 5 },
    }),
    {
      type: 'numeric',
      payload: { value: 5 },
    },
  );
  assert.throws(
    () => responses.validateCanonicalResponse({ type: 'pairing', payload: {} }),
    /unsupported_response_type/,
  );
  assert.throws(
    () =>
      responses.validateCanonicalResponse({
        type: 'numeric',
        payload: { value: 1.5 },
      }),
    /malformed_generic_response/,
  );
});

test('migration preserves legacy rows and stamps session to evidence provenance fail-closed', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE cza_app_runtime;
      CREATE TABLE public.training_recipes(id uuid PRIMARY KEY, settings jsonb NOT NULL);
      CREATE TABLE public.training_sessions(id uuid PRIMARY KEY, recipe_id uuid NULL, academy_id uuid NULL, student_id uuid NULL);
      CREATE TABLE public.question_attempts(id uuid PRIMARY KEY, training_session_id uuid NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, student_numeric_answer bigint NULL);
      CREATE TABLE public.learning_records(id uuid PRIMARY KEY, training_session_id uuid NOT NULL);
      CREATE TABLE public.learning_evidence(id uuid PRIMARY KEY, learning_record_id uuid NOT NULL);
      CREATE FUNCTION public.cza_bind_assigned_work_session(p_academy uuid,p_student uuid,p_recipe uuid,p_client uuid,p_training uuid,p_started timestamptz)
      RETURNS TABLE(training_session_id uuid,work_status text,resumed boolean,started_at timestamptz,attempt_count integer,correct_count integer,last_activity_at timestamptz)
      LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO public.training_sessions(id,recipe_id,academy_id,student_id) VALUES (p_training,p_recipe,p_academy,p_student) ON CONFLICT DO NOTHING;
        RETURN QUERY SELECT p_training,'in_progress'::text,false,p_started,0,0,p_started;
      END $$;
      INSERT INTO public.training_sessions(id,recipe_id) VALUES ('10000000-0000-4000-8000-000000000001', NULL);
    `);
    await db.exec(migration);
    await db.exec(migration);

    const legacy = await db.query(
      `SELECT engine_id,engine_version FROM public.training_sessions WHERE id='10000000-0000-4000-8000-000000000001'`,
    );
    assert.deepEqual(legacy.rows[0], { engine_id: null, engine_version: null });

    await db.exec(`
      INSERT INTO public.training_recipes VALUES ('10000000-0000-4000-8000-000000000002','{"engineId":"ANZAN","engineVersion":"1"}');
      SELECT * FROM public.cza_bind_assigned_work_session_k3c(
        '10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000012',
        '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000013',
        '10000000-0000-4000-8000-000000000003',now(),'ANZAN','1'
      );
      INSERT INTO public.question_attempts VALUES (
        '10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003',
        '{"responseType":"numeric","responsePayload":{"value":7}}',7
      );
      INSERT INTO public.learning_records VALUES ('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003');
      INSERT INTO public.learning_evidence VALUES ('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000005');
    `);
    const chain = await db.query(`
      SELECT s.engine_id session_engine,a.engine_id attempt_engine,r.engine_id record_engine,e.engine_id evidence_engine,
             a.response_type,a.response_payload
      FROM public.training_sessions s
      JOIN public.question_attempts a ON a.training_session_id=s.id
      JOIN public.learning_records r ON r.training_session_id=s.id
      JOIN public.learning_evidence e ON e.learning_record_id=r.id
      WHERE s.id='10000000-0000-4000-8000-000000000003'
    `);
    assert.deepEqual(chain.rows[0], {
      session_engine: 'ANZAN',
      attempt_engine: 'ANZAN',
      record_engine: 'ANZAN',
      evidence_engine: 'ANZAN',
      response_type: 'numeric',
      response_payload: { value: 7 },
    });

    await db.exec(`INSERT INTO public.question_attempts VALUES (
      '10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000003','{}',9
    )`);
    const numericLegacy = await db.query(
      `SELECT response_type,response_payload FROM public.question_attempts WHERE id='10000000-0000-4000-8000-000000000007'`,
    );
    assert.deepEqual(numericLegacy.rows[0], {
      response_type: 'numeric',
      response_payload: { value: 9 },
    });

    await assert.rejects(
      db.query(
        `SELECT * FROM public.cza_bind_assigned_work_session_k3c(
        $1,$2,$3,$4,$5,now(),'UNKNOWN','9'
      )`,
        [
          '10000000-0000-4000-8000-000000000011',
          '10000000-0000-4000-8000-000000000012',
          '10000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000013',
          '10000000-0000-4000-8000-000000000009',
        ],
      ),
      /CZA_ENGINE_PROVENANCE_INVALID/,
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO public.question_attempts VALUES ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000003','{"responseType":"numeric"}',NULL)`,
      ),
      /CZA_GENERIC_RESPONSE_INVALID/,
    );
  } finally {
    await db.close();
  }
});
