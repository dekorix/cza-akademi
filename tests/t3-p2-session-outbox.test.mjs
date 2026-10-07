import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(import.meta.dirname, '..');
const migration = fs.readFileSync(
  path.join(
    root,
    'db/migrations/20260929_t3_p2_assessment_session_outbox_v1.sql',
  ),
  'utf8',
);
const studentId = 'c8612ac1-6d04-4990-8385-e7c60234efbc';
const educatorId = 'f3a00000-0000-4000-8000-000000000001';
const academyId = '25b9fbf5-e819-4b71-882a-aba91e1524ba';
const cycleKey = 'ad0d1e38-4f19-4ea3-91f5-7c2f82f98061';
let currentHash = 'a';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.students (id uuid PRIMARY KEY, academy_id uuid NOT NULL,
      first_name text, last_name text, user_id uuid);
    CREATE TABLE public.users (id uuid PRIMARY KEY, academy_id uuid NOT NULL,
      auth_user_id text, is_active boolean NOT NULL, role text NOT NULL, username text);
    CREATE TABLE public.teacher_student_links (teacher_id uuid, student_id uuid,
      academy_id uuid, can_view boolean);
    CREATE TABLE public.student_external_identifiers (student_id uuid,
      identifier_type text, identifier_value text);
    CREATE TABLE public.assessment_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid REFERENCES public.students(id),
      template_code text NOT NULL, student_label text, status text NOT NULL DEFAULT 'active',
      current_task_code text, started_at timestamptz NOT NULL DEFAULT now(),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb, definition_contract jsonb);
    INSERT INTO public.students (id, academy_id, first_name) VALUES
      ('${studentId}', '${academyId}', 'Synthetic');
    INSERT INTO public.users (id, academy_id, auth_user_id, is_active, role) VALUES
      ('${educatorId}', '${academyId}', 'signed-educator', true, 'educator');
    INSERT INTO public.teacher_student_links VALUES
      ('${educatorId}', '${studentId}', '${academyId}', true);
  `);
  await db.exec(migration);
  return db;
}
function loadRoute(db, auth = { id: 'signed-educator' }) {
  process.env.DATABASE_URL = 'postgresql://test.invalid/isolated';
  const source = fs.readFileSync(
    path.join(root, 'app/api/assessment-linked/route.ts'),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const routeModule = { exports: {} };
  const sql = (strings, ...values) => {
    const query = strings.reduce(
      (part, s, i) => part + s + (i < values.length ? '$' + (i + 1) : ''),
      '',
    );
    return db.query(query, values).then((result) => result.rows);
  };
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route with in-memory SQL
  new Function('require', 'module', 'exports', js)(
    (id) => {
      if (id === '@neondatabase/serverless') return { neon: () => sql };
      if (id.includes('assessment-routing'))
        return { assessmentTasks: [{ id: 'WARM-01' }] };
      if (id.includes('assessment-definition'))
        return {
          t4P2Definition: () => ({
            definitionId: 'CZA_1_TO_2',
            assessmentVersion: 2,
            itemBankSha256: currentHash,
          }),
          p2DefinitionStatus: (contract) =>
            contract?.itemBankSha256 !== currentHash ? 'mismatch'
              : contract?.assessmentVersion === 2 ? 'current_t4' : 'current',
        };
      if (id.includes('educator-auth'))
        return { authenticatedEducator: async () => auth };
      if (id.includes('request-guard'))
        return {
          allowRequest: async () => ({ allowed: true }),
          rateLimited: () => new Response(null, { status: 429 }),
        };
      throw new Error('unexpected import: ' + id);
    },
    routeModule,
    routeModule.exports,
  );
  return routeModule.exports.POST;
}

async function post(route, key = cycleKey, id = studentId) {
  const response = await route(
    new Request('https://staging.example/api/assessment-linked', {
      method: 'POST',
      body: JSON.stringify({ studentId: id, assessmentCycleKey: key }),
    }),
  );
  return { status: response.status, body: await response.json() };
}
test('one canonical session and outbox event survive replay, status changes and migration reapply', async () => {
  currentHash = 'a';
  const db = await setup();
  try {
    const legacyId = '9a19c798-7edb-45c5-94d2-978b16f44811';
    const route = loadRoute(db);
    const first = await post(route);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.replayed, false);
    assert.equal(first.body.session.student_id, studentId);
    assert.equal(first.body.session.definition_contract.assessmentVersion, 2);
    await db.query(
      "INSERT INTO assessment_sessions(id,student_id,template_code,status) VALUES ($1,$2,'CZA_1_TO_2_V1','completed')",
      [legacyId, studentId],
    );
    const replay = await post(route);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(replay.body.session.id, first.body.session.id);
    const secondTab = await post(route, 'fcfb0681-33c5-411d-b571-5d98e0f7837a');
    assert.equal(secondTab.status, 200);
    assert.equal(secondTab.body.session.id, first.body.session.id);
    assert.equal(secondTab.body.replayed, true);
    await db.query(
      "UPDATE assessment_sessions SET status='completed' WHERE id=$1",
      [first.body.session.id],
    );
    const completedReplay = await post(route);
    assert.equal(completedReplay.body.session.status, 'completed');
    assert.equal(completedReplay.body.session.id, first.body.session.id);
    const rows = await db.query(
      'SELECT session_id, event_type FROM assessment_session_outbox',
    );
    assert.deepEqual(rows.rows, [
      {
        session_id: first.body.session.id,
        event_type: 'P2_ASSESSMENT_SESSION_CREATED',
      },
    ]);
    const sessions = await db.query(
      'SELECT id, assessment_cycle_key, status FROM assessment_sessions ORDER BY id',
    );
    assert.equal(sessions.rows.length, 2);
    assert.equal(
      sessions.rows.find((row) => row.id === legacyId).assessment_cycle_key,
      null,
    );
    assert.equal(
      sessions.rows.find((row) => row.id === legacyId).status,
      'completed',
    );
    await db.exec(migration);
    assert.equal((await post(route)).body.session.id, first.body.session.id);
    currentHash = 'changed';
    const mismatch = await post(route);
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.body.error, 'assessment_definition_mismatch');
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM assessment_session_outbox',
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test('linked scope and atomic outbox failure do not leave partial sessions', async () => {
  currentHash = 'a';
  const db = await setup();
  try {
    const denied = await post(loadRoute(db, null));
    assert.equal(denied.status, 401);
    const unrelated = await post(
      loadRoute(db),
      cycleKey,
      'aa96e1a1-4154-473d-b5a5-e5931107082f',
    );
    assert.equal(unrelated.status, 403, JSON.stringify(unrelated.body));
    await db.exec(`
      CREATE FUNCTION public.reject_t3_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'event unavailable'; END $$;
      CREATE TRIGGER reject_t3_event BEFORE INSERT ON public.assessment_session_outbox
        FOR EACH ROW EXECUTE FUNCTION public.reject_t3_event();
    `);
    const failed = await post(loadRoute(db));
    assert.equal(failed.status, 503);
    assert.equal(failed.body.error, 'assessment_link_unavailable');
    assert.equal(
      (await db.query('SELECT count(*)::int AS n FROM assessment_sessions'))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM assessment_session_outbox',
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test('legacy unkeyed P2 session blocks a second automatic INITIAL',async()=>{
  currentHash='a';
  const db=await setup();
  try {
    const legacyId='9a19c798-7edb-45c5-94d2-978b16f44811';
    await db.query(
      "INSERT INTO assessment_sessions(id,student_id,template_code,status) VALUES ($1,$2,'CZA_1_TO_2_V1','completed')",
      [legacyId,studentId],
    );
    const denied=await post(loadRoute(db));
    assert.equal(denied.status,409,JSON.stringify(denied.body));
    assert.equal(denied.body.error,'legacy_initial_requires_explicit_cycle');
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_sessions')).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_session_outbox')).rows[0].n,0);
  } finally { await db.close(); }
});
test('existing T3 INITIAL replays its old pinned definition without upgrading',async()=>{
  currentHash='a';
  const db=await setup();
  try {
    const id='1c07bea4-11e5-4f7b-a79f-513f168e695b';
    const old={definitionId:'CZA_1_TO_2',assessmentVersion:1,itemBankSha256:'a'};
    await db.query(`INSERT INTO assessment_sessions
      (id,student_id,template_code,status,definition_contract,assessment_cycle_key,assessment_cycle_type)
      VALUES ($1,$2,'CZA_1_TO_2_V1','active',$3::jsonb,$4::uuid,'INITIAL')`,
      [id,studentId,JSON.stringify(old),cycleKey]);
    const replay=await post(loadRoute(db),'fcfb0681-33c5-411d-b571-5d98e0f7837a');
    assert.equal(replay.status,200,JSON.stringify(replay.body));
    assert.equal(replay.body.session.id,id);
    assert.deepEqual(replay.body.session.definition_contract,old);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_sessions')).rows[0].n,1);
  } finally { await db.close(); }
});
