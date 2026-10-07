/* oxlint-disable typescript/no-floating-promises -- node:test registrations are top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root = fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const academy = '10000000-0000-4000-8000-000000000001';
const student = '10000000-0000-4000-8000-000000000002';
const educator = '70000000-0000-4000-8000-000000000001';
const authId = '70000000-0000-4000-8000-000000000002';

// Only transport/authentication boundaries are injected. Route authorization,
// canonical projection, provenance and (on parent) coaching SQL are production code.
function loadRoute(sql, identity) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const source = fs.readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const resolve = (id) => {
      if (id === '@neondatabase/serverless') return { neon: () => sql };
      if (id === '@/lib/educator-auth')
        return { authenticatedEducator: async () => identity };
      if (id === '@/lib/request-guard')
        return { allowRequest: async () => ({ allowed: true }) };
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/')
          ? path.join(root, id.slice(2))
          : path.resolve(path.dirname(file), id);
        return load(
          [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(
            (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
          ),
        );
      }
      return nativeRequire(id);
    };
    // oxlint-disable-next-line typescript/no-implied-eval -- execute unchanged production TypeScript in an isolated harness.
    new Function('require', 'module', 'exports', 'process', compiled)(
      resolve,
      mod,
      mod.exports,
      { env: { DATABASE_URL: 'synthetic-local-only' } },
    );
    return mod.exports;
  }
  return load(path.join(root, 'app/api/educator-learning-profile/route.ts'))
    .GET;
}

test('educator canonical profile works without coaching schema and remains fail-closed', async (t) => {
  const db = new PGlite();
  const errors = [];
  let queries = 0;
  const query = async (text, params) => {
    queries++;
    try {
      return (await db.query(text, params)).rows;
    } catch (error) {
      errors.push({ code: error.code, message: error.message });
      throw error;
    }
  };
  const sql = (strings, ...values) =>
    query(
      strings.reduce((text, part, i) => text + (i ? '$' + i : '') + part, ''),
      values,
    );
  sql.query = query;
  const request = () =>
    new Request(
      'https://cza.test/api/educator-learning-profile?studentId=' + student,
    );
  const invoke = (identity) => loadRoute(sql, identity)(request());
  try {
    await db.exec(`CREATE TYPE session_status AS ENUM ('in_progress','active','completed','abandoned','cancelled');

      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE public.students(id uuid PRIMARY KEY,academy_id uuid NOT NULL,first_name text,last_name text,status text);
      CREATE TABLE public.modules(code text PRIMARY KEY,name text);
      CREATE TABLE public.training_recipes(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,is_active boolean DEFAULT true,cancelled_at timestamptz,created_at timestamptz,starts_at timestamptz);
      CREATE TABLE public.training_sessions(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,recipe_id uuid,status session_status,started_at timestamptz,last_activity_at timestamptz,completed_at timestamptz);
      CREATE TABLE public.question_attempts(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,training_session_id uuid,is_correct boolean,error_type text,created_at timestamptz);
      CREATE TABLE public.learning_records(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,record_origin text,verification_status text,support_level text,skills jsonb,completed_at timestamptz,created_at timestamptz,training_session_id uuid);
      CREATE TABLE public.learning_evidence(id uuid PRIMARY KEY,learning_record_id uuid,academy_id uuid,student_id uuid,skill_code text,verification_status text,verification_authority text,observed_at timestamptz);
      INSERT INTO public.students VALUES ('${student}','${academy}','Demo','Öğrenci','active');
      INSERT INTO public.modules VALUES ('finger_read','Parmak Okuma');
      INSERT INTO public.training_recipes VALUES
        ('20000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read',true,NULL,'2026-09-16T10:00:00Z',NULL),
        ('20000000-0000-4000-8000-000000000002','${academy}','${student}','finger_read',true,NULL,'2026-09-15T10:00:00Z',NULL),
        ('20000000-0000-4000-8000-000000000003','${academy}','${student}','finger_read',false,'2026-09-17T11:00:00Z','2026-09-14T10:00:00Z',NULL);
      INSERT INTO public.training_sessions VALUES
        ('30000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read','20000000-0000-4000-8000-000000000002','completed','2026-09-16T10:00:00Z','2026-09-16T10:05:00Z','2026-09-16T10:05:00Z'),
        ('30000000-0000-4000-8000-000000000002','${academy}','${student}','finger_read','20000000-0000-4000-8000-000000000003','completed','2026-09-15T10:00:00Z','2026-09-15T10:05:00Z','2026-09-15T10:05:00Z');
      INSERT INTO public.question_attempts VALUES
        ('40000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read','30000000-0000-4000-8000-000000000001',true,'NONE','2026-09-16T10:02:00Z');
      INSERT INTO public.learning_records (id,academy_id,student_id,module_code,record_origin,verification_status,support_level,skills,completed_at,created_at) VALUES
        ('50000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read','client_reported','client_reported','guided','["record-only"]','2026-09-16T10:05:00Z','2026-09-16T10:05:00Z'),
        ('50000000-0000-4000-8000-000000000002','${academy}','${student}','finger_read','client_reported','client_reported','independent','["legacy-skill"]','2026-09-15T10:05:00Z','2026-09-15T10:05:00Z'),
        ('50000000-0000-4000-8000-000000000003','${academy}','${student}','finger_read','server_authoritative','server_verified','independent','["trusted-skill"]','2026-09-14T10:05:00Z','2026-09-14T10:05:00Z');
      INSERT INTO public.learning_evidence VALUES
        ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','${academy}','${student}','legacy-skill','server_verified','work_center_completion:v1','2026-09-15T10:05:00Z'),
        ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','${academy}','${student}','trusted-skill','server_verified','canonical_server_evaluator:v1','2026-09-14T10:05:00Z');

      CREATE TABLE public.users(id uuid PRIMARY KEY, auth_user_id uuid, academy_id uuid, role text, is_active boolean);
      CREATE TABLE public.teacher_student_links(teacher_id uuid, student_id uuid, can_view boolean);
      INSERT INTO public.users VALUES ('${educator}','${authId}','${academy}','educator',true);
      INSERT INTO public.teacher_student_links VALUES ('${educator}','${student}',true);
    `);
    await t.test(
      'authorized full profile 200 without coaching tables or can_coach',
      async () => {
        assert.equal(
          (
            await db.query(
              "SELECT to_regclass('public.coaching_programs') relation",
            )
          ).rows[0].relation,
          null,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='teacher_student_links' AND column_name='can_coach'",
            )
          ).rows[0].n,
          0,
        );
        errors.length = 0;
        const response = await invoke({ id: authId });
        assert.equal(response.status, 200, JSON.stringify(errors));
        const { profile, ok } = await response.json();
        assert.equal(ok, true);
        assert.equal(profile.student.id, student);
        assert.deepEqual(profile.coverage, {
          assignments: 3,
          sessions: 2,
          attempts: 1,
          records: 3,
          evidence: 2,
        });
        assert.equal(profile.studyPattern.sessions.completed, 2);
        assert.equal(
          profile.skills.find((s) => s.skillCode === 'legacy-skill').provenance,
          'CLIENT_REPORTED',
        );
        assert.equal(
          profile.skills.find((s) => s.skillCode === 'trusted-skill')
            .provenance,
          'SERVER_AUTHORITATIVE',
        );
        assert.equal(Object.hasOwn(profile, 'coaching'), false);
        assert.deepEqual(errors, []);
      },
    );
    await t.test('no educator identity denied before SQL', async () => {
      const before = queries;
      assert.equal((await invoke(null)).status, 401);
      assert.equal(queries, before);
    });
    for (const [name, change, restore] of [
      [
        'can_view false',
        'UPDATE teacher_student_links SET can_view=false',
        'UPDATE teacher_student_links SET can_view=true',
      ],
      [
        'unlinked student',
        "UPDATE teacher_student_links SET student_id='80000000-0000-4000-8000-000000000001'",
        `UPDATE teacher_student_links SET student_id='${student}'`,
      ],
      [
        'cross academy',
        "UPDATE users SET academy_id='80000000-0000-4000-8000-000000000002'",
        `UPDATE users SET academy_id='${academy}'`,
      ],
      [
        'canonical student role',
        "UPDATE users SET role='student'",
        "UPDATE users SET role='educator'",
      ],
      [
        'inactive educator',
        'UPDATE users SET is_active=false',
        'UPDATE users SET is_active=true',
      ],
    ]) {
      await t.test(name + ' denied by real authorization SQL', async () => {
        await db.exec(change);
        try {
          const before = queries;
          const response = await invoke({ id: authId });
          assert.equal(response.status, 403);
          assert.equal((await response.json()).error, 'student_not_authorized');
          assert.equal(queries - before, 1, 'denial must not read profile');
        } finally {
          await db.exec(restore);
        }
      });
    }
    await t.test('real canonical read failure remains 503', async () => {
      await db.exec(
        'ALTER TABLE learning_records RENAME TO unavailable_learning_records',
      );
      errors.length = 0;
      const response = await invoke({ id: authId });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        ok: false,
        error: 'learning_profile_unavailable',
      });
      assert.ok(
        errors.some(
          (e) => e.code === '42P01' && e.message.includes('learning_records'),
        ),
      );
    });
  } finally {
    await db.close();
  }
});
