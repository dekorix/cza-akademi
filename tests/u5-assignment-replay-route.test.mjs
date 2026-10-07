/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(
  new URL('../app/api/educator-assignments/route.ts', import.meta.url),
  'utf8',
);
const ids = {
  academy: '55000000-0000-4000-8000-000000000001',
  educator: '55000000-0000-4000-8000-000000000003',
  student: '55000000-0000-4000-8000-000000000009',
  request: '55000000-0000-4000-8000-000000000011',
};

async function routeWithDatabase(db) {
  const sql = (parts, ...values) =>
    db
      .query(
        parts.reduce(
          (query, part, index) => query + (index ? '$' + index + part : part),
          '',
        ),
        values,
      )
      .then((result) => result.rows);
  const modules = { finger_read: { label: 'Finger Read' } };
  const requireMock = (name) => {
    if (name === '@neondatabase/serverless') return { neon: () => sql };
    if (name === 'node:crypto') return require('node:crypto');
    if (name === '@/lib/educator-auth')
      return { authenticatedEducator: async () => ({ id: 'auth-educator' }) };
    if (name === '@/lib/request-guard')
      return { allowRequest: async () => ({ allowed: true }) };
    if (name === '@/lib/training-recipes')
      return {
        assignableModules: modules,
        isAssignableModule: (code) => code in modules,
        defaultRecipeSettings: () => ({ rounds: 1 }),
        recipeSettingsFromRecommendation: (_code, settings) => settings,
      };
    return new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('Unexpected route dependency: ' + name);
        },
      },
    );
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(compiled, {
    require: requireMock,
    module: loaded,
    exports: loaded.exports,
    process: { env: { DATABASE_URL: 'isolated-pglite' } },
    Response,
    Request,
    URL,
  });
  return loaded.exports.POST;
}
test('same omitted startsAt and request key replays one assignment; changed body conflicts', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE public.users(id uuid PRIMARY KEY, auth_user_id text, academy_id uuid, role text, is_active boolean);
      CREATE TABLE public.students(id uuid PRIMARY KEY, academy_id uuid, first_name text, last_name text, status text);
      CREATE TABLE public.teacher_student_links(teacher_id uuid, student_id uuid, academy_id uuid, can_view boolean);
      CREATE TABLE public.training_recipes(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid, student_id uuid,
        module_code text, assigned_by uuid, source text, name text, instructions text,
        settings jsonb, is_active boolean, starts_at timestamptz, expires_at timestamptz,
        client_request_id uuid, request_hash text, cancelled_at timestamptz,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE public.training_sessions(id uuid PRIMARY KEY,recipe_id uuid,academy_id uuid,student_id uuid,status text,started_at timestamptz,completed_at timestamptz,last_activity_at timestamptz);
      CREATE TABLE public.learning_records(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,training_session_id uuid,completed_at timestamptz);
      CREATE UNIQUE INDEX training_recipes_request_key ON public.training_recipes
        (academy_id, assigned_by, client_request_id) WHERE client_request_id IS NOT NULL;
    `);
    await db.query('INSERT INTO public.users VALUES ($1,$2,$3,$4,$5)', [
      ids.educator,
      'auth-educator',
      ids.academy,
      'educator',
      true,
    ]);
    await db.query('INSERT INTO public.students VALUES ($1,$2,$3,$4,$5)', [
      ids.student,
      ids.academy,
      'Synthetic',
      'Student',
      'active',
    ]);
    await db.query(
      'INSERT INTO public.teacher_student_links VALUES ($1,$2,$3,$4)',
      [ids.educator, ids.student, ids.academy, true],
    );
    const POST = await routeWithDatabase(db);
    const body = {
      action: 'create',
      studentId: ids.student,
      clientRequestId: ids.request,
      moduleCode: 'finger_read',
      title: 'Replay acceptance',
      settings: { rounds: 1 },
      startsAt: null,
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
    const send = async (payload) => {
      const response = await POST(
        new Request('https://staging.example/api/educator-assignments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      );
      return { status: response.status, data: await response.json() };
    };
    const first = await send(body);
    assert.equal(first.status, 201);
    const replay = await send(body);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.replayed, true);
    assert.equal(replay.data.assignment.id, first.data.assignment.id);
    const conflict = await send({ ...body, title: 'Changed assignment' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.error, 'idempotency_conflict');
    const count = await db.query(
      'SELECT count(*)::int AS count FROM public.training_recipes WHERE client_request_id=$1',
      [ids.request],
    );
    assert.equal(count.rows[0].count, 1);
  } finally {
    await db.close();
  }
});
