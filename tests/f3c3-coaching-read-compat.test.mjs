/* oxlint-disable typescript/no-floating-promises -- node:test registrations are top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root = fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
// Load actual repository functions and their actual local dependencies; no SQL mocks.
function loadRepository() {
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
      if (!id.startsWith('@/') && !id.startsWith('.')) return nativeRequire(id);
      const base = id.startsWith('@/')
        ? path.join(root, id.slice(2))
        : path.resolve(path.dirname(file), id);
      return load(
        [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(
          (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
        ),
      );
    };
    // oxlint-disable-next-line typescript/no-implied-eval -- isolated production TypeScript harness
    new Function('require', 'module', 'exports', compiled)(
      resolve,
      mod,
      mod.exports,
    );
    return mod.exports;
  }
  return load(
    process.env.F3C3_REPOSITORY_SOURCE ||
      path.join(root, 'lib/persistence/coaching-center.ts'),
  );
}
const id = (n) => `83000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const academy = id(1),
  otherAcademy = id(2),
  educator = id(3),
  peer = id(4),
  studentRole = id(5);
const student = id(6),
  unlinked = id(7),
  foreign = id(8),
  recipe = id(9),
  auth = id(10);
const actor = {
  userId: educator,
  academyId: academy,
  studentId: student,
  canCoach: false,
};
const migrationNames = [
  '20260927_f3c3_coaching_read_prerequisites_v1.sql',
  '20260918_u8_coaching_core_v1.sql',
  '20260918_u8_coaching_core_hardening_v2.sql',
];
const migrations = migrationNames.map((name) =>
  fs.readFileSync(path.join(root, 'db/migrations', name), 'utf8'),
);
let db, repo, sql, originalRecipe, originalIndexes;
const statements = [];
const previousSecret = process.env.CZA_TIMELINE_CURSOR_SECRET;
async function apply() {
  await db.exec(migrations[0]); // Own BEGIN/COMMIT.
  await db.exec(migrations[1]); // Own BEGIN/COMMIT.
  await db.transaction(async (tx) => {
    await tx.exec(migrations[2]);
  }); // v2 has no wrapper.
}
async function insert(table, row) {
  const keys = Object.keys(row);
  await db.query(
    `INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
    Object.values(row),
  );
}
const deny = (error) =>
  error.status === 403 && error.code === 'student_not_authorized';

test.before(async () => {
  process.env.CZA_TIMELINE_CURSOR_SECRET =
    'isolated-f3c3-cursor-key-not-a-live-secret';
  db = new PGlite();
  repo = loadRepository();
  sql = {
    query: async (text, params) => {
      statements.push(text);
      return (await db.query(text, params)).rows;
    },
  };
  // Relevant pre-U8 staging structure: text external identity, UUID internal IDs,
  // no composite user/student unique keys, existing canonical recipe identity index.
  await db.exec(`
    CREATE TYPE app_role AS ENUM ('admin','teacher','student','parent','educator');
    CREATE TABLE users(id uuid PRIMARY KEY, academy_id uuid NOT NULL, auth_user_id text, role app_role NOT NULL, is_active boolean NOT NULL);
    CREATE TABLE students(id uuid PRIMARY KEY, academy_id uuid NOT NULL, status text NOT NULL);
    CREATE TABLE teacher_student_links(academy_id uuid NOT NULL, teacher_id uuid REFERENCES users(id), student_id uuid REFERENCES students(id), can_view boolean NOT NULL DEFAULT false, PRIMARY KEY(teacher_id,student_id));
    CREATE TABLE training_recipes(id uuid PRIMARY KEY, academy_id uuid NOT NULL, student_id uuid REFERENCES students(id), module_code text NOT NULL, assigned_by uuid REFERENCES users(id), source text NOT NULL, name text NOT NULL, settings jsonb NOT NULL, instructions text, is_active boolean NOT NULL, cancelled_at timestamptz);
    CREATE UNIQUE INDEX idx_k3e_training_recipes_identity ON training_recipes(id,academy_id,student_id);
  `);
  for (const [uid, aid, external, role] of [
    [educator, academy, auth, 'educator'],
    [peer, academy, 'external-peer-text', 'educator'],
    [studentRole, academy, 'external-student-text', 'student'],
  ])
    await insert('users', {
      id: uid,
      academy_id: aid,
      auth_user_id: external,
      role,
      is_active: true,
    });
  for (const [sid, aid] of [
    [student, academy],
    [unlinked, academy],
    [foreign, otherAcademy],
  ])
    await insert('students', { id: sid, academy_id: aid, status: 'active' });
  // Deliberate mismatched academy link tests the guard, not merely link absence.
  for (const [uid, sid, aid] of [
    [educator, student, academy],
    [peer, student, academy],
    [studentRole, student, academy],
    [educator, foreign, otherAcademy],
  ])
    await insert('teacher_student_links', {
      teacher_id: uid,
      student_id: sid,
      academy_id: aid,
      can_view: true,
    });
  await insert('training_recipes', {
    id: recipe,
    academy_id: academy,
    student_id: student,
    module_code: 'flash_anzan',
    assigned_by: educator,
    source: 'teacher_assignment',
    name: 'Existing synthetic recipe',
    settings: JSON.stringify({ rounds: 1 }),
    instructions: 'Preserve',
    is_active: true,
  });
  originalRecipe = (await db.query('SELECT * FROM training_recipes')).rows[0];
  originalIndexes = (
    await db.query(
      "SELECT oid FROM pg_class WHERE relname='idx_k3e_training_recipes_identity'",
    )
  ).rows;
  await apply();
});
test.after(async () => {
  await db?.close();
  if (previousSecret === undefined)
    delete process.env.CZA_TIMELINE_CURSOR_SECRET;
  else process.env.CZA_TIMELINE_CURSOR_SECRET = previousSecret;
});

test('prepared schema: text auth identity resolves without text = uuid error', async () => {
  assert.equal(
    (
      await db.query(
        "SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='auth_user_id'",
      )
    ).rows[0].data_type,
    'text',
  );
  assert.deepEqual(
    await repo.resolveEducatorCoachingActor(sql, auth, student, false),
    actor,
  );
  assert.equal(
    (
      await repo.resolveEducatorCoachingActor(
        sql,
        'external-peer-text',
        student,
        false,
      )
    ).userId,
    peer,
  );
});

test('prerequisite -> canonical v1 -> v2 reapply preserves recipe and grants no coaching access', async () => {
  await apply();
  const current = (await db.query('SELECT * FROM training_recipes')).rows[0];
  for (const key of Object.keys(originalRecipe))
    assert.deepEqual(current[key], originalRecipe[key], key);
  assert.equal(current.task_kind, 'cza_module');
  assert.equal(current.task_purpose, 'practice');
  assert.deepEqual(
    (
      await db.query(
        "SELECT oid FROM pg_class WHERE relname='idx_k3e_training_recipes_identity'",
      )
    ).rows,
    originalIndexes,
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM teacher_student_links WHERE can_coach',
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM coaching_exam_templates WHERE is_demo',
      )
    ).rows[0].n,
    3,
  );
  assert.equal(
    (await db.query("SELECT to_regclass('public.coaching_plan_revisions') r"))
      .rows[0].r,
    'coaching_plan_revisions',
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM pg_proc WHERE proname='cza_u8_require_atomic'",
      )
    ).rows[0].n,
    0,
  );
});

test('all nine real GET queries succeed with no student coaching records', async () => {
  statements.length = 0;
  const result = await repo.readCoachingCenter(sql, actor, {
    includePrivate: true,
  });
  assert.equal(statements.length, 9);
  for (const key of [
    'programs',
    'goals',
    'topics',
    'plans',
    'studyLogs',
    'exams',
    'mistakes',
    'meetings',
  ])
    assert.deepEqual(result[key], []);
  assert.equal(result.templates.length, 3);
  assert.ok(
    result.templates.every((t) => t.is_demo && t.source_label.includes('demo')),
  );
  assert.equal(result.provenance, 'CLIENT_REPORTED');
});

test('can_view permits GET; can_coach=false denies write; role and academy scopes deny', async () => {
  assert.equal(
    (await repo.resolveEducatorCoachingActor(sql, auth, student, false))
      .canCoach,
    false,
  );
  await assert.rejects(
    repo.resolveEducatorCoachingActor(sql, auth, student, true),
    (e) => e.status === 403 && e.code === 'coaching_write_not_authorized',
  );
  for (const [external, sid] of [
    [auth, unlinked],
    [auth, foreign],
    ['external-student-text', student],
    ['unknown', student],
  ])
    await assert.rejects(
      repo.resolveEducatorCoachingActor(sql, external, sid, false),
      deny,
    );
  await db.query(
    'UPDATE teacher_student_links SET can_view=false WHERE teacher_id=$1 AND student_id=$2',
    [peer, student],
  );
  await assert.rejects(
    repo.resolveEducatorCoachingActor(
      sql,
      'external-peer-text',
      student,
      false,
    ),
    deny,
  );
  await db.query(
    'UPDATE teacher_student_links SET can_view=true WHERE teacher_id=$1 AND student_id=$2',
    [peer, student],
  );
});

test('nine real GET queries return scoped synthetic data, private notes and provenance', async () => {
  // Local-only seed data; no coaching mutation API and no can_coach=true grants.
  for (const [sid, aid, coach, offset] of [
    [student, academy, educator, 100],
    [foreign, otherAcademy, id(400), 400],
  ]) {
    if (offset === 400)
      await insert('users', {
        id: coach,
        academy_id: aid,
        auth_user_id: 'foreign-coach',
        role: 'educator',
        is_active: true,
      });
    await insert('coaching_programs', {
      id: id(offset + 1),
      academy_id: aid,
      student_id: sid,
      coach_id: coach,
      program_type: 'LGS',
      exam_year: 2027,
      period_label: '2026-2027',
      client_request_id: id(offset + 2),
      request_hash: 'a'.repeat(64),
    });
  }
  const base = {
    academy_id: academy,
    student_id: student,
    program_id: id(101),
  };
  await insert('coaching_goals', {
    ...base,
    id: id(110),
    coach_id: educator,
    target: JSON.stringify({ school: 'Synthetic' }),
    client_request_id: id(111),
    request_hash: 'a'.repeat(64),
  });
  await insert('coaching_topic_status', {
    ...base,
    subject_code: 'MAT',
    topic_code: 'Numbers',
    status: 'in_progress',
    source: 'coach_observation',
    updated_by: educator,
  });
  for (let n = 0; n < 2; n++)
    await insert('coaching_plans', {
      ...base,
      id: id(120 + n),
      coach_id: educator,
      title: 'Synthetic ' + n,
      period_start: `2026-09-${27 + n}`,
      period_end: `2026-09-${27 + n}`,
      status: 'published',
      client_request_id: id(122 + n),
      request_hash: 'a'.repeat(64),
    });
  await insert('coaching_plan_items', {
    academy_id: academy,
    student_id: student,
    plan_id: id(120),
    recipe_id: recipe,
    scheduled_for: '2026-09-27',
  });
  await insert('coaching_study_logs', {
    id: id(130),
    academy_id: academy,
    student_id: student,
    recipe_id: recipe,
    reported_by: studentRole,
    question_count: 1,
    correct_count: 1,
    client_request_id: id(131),
    request_hash: 'a'.repeat(64),
  });
  const template = (
    await db.query(
      "SELECT id FROM coaching_exam_templates WHERE code='CZA_DEMO_LGS_GENERAL'",
    )
  ).rows[0].id;
  await insert('coaching_exam_results', {
    ...base,
    id: id(140),
    template_id: template,
    reported_by: studentRole,
    exam_date: '2026-09-27',
    sections: '[]',
    total_net: 1,
    is_partial: true,
    duration_minutes: 10,
    client_request_id: id(141),
    request_hash: 'a'.repeat(64),
  });
  await insert('coaching_mistakes', {
    ...base,
    study_log_id: id(130),
    subject_code: 'MAT',
    reason_code: 'synthetic',
    created_by: educator,
    client_request_id: id(150),
    request_hash: 'a'.repeat(64),
  });
  for (const [coach, num] of [
    [educator, 160],
    [peer, 170],
  ])
    await insert('coaching_meetings', {
      ...base,
      id: id(num),
      coach_id: coach,
      meeting_at: '2026-09-27T12:00:00Z',
      private_note: 'PRIVATE-' + num,
      shared_summary: 'Shared',
      follow_up_recipe_id: recipe,
      client_request_id: id(num + 1),
      request_hash: 'a'.repeat(64),
    });
  statements.length = 0;
  const result = await repo.readCoachingCenter(sql, actor, {
    includePrivate: true,
  });
  assert.equal(statements.length, 9);
  for (const [key, count] of Object.entries({
    programs: 1,
    goals: 1,
    topics: 1,
    plans: 2,
    studyLogs: 1,
    exams: 1,
    mistakes: 1,
    meetings: 2,
    templates: 3,
  }))
    assert.equal(result[key].length, count, key);
  assert.equal(result.programs[0].id, id(101));
  assert.equal(result.programs[0].period_label, '2026-2027');
  assert.equal(result.exams[0].duration_minutes, 10);
  assert.equal(
    result.plans.find((p) => p.id === id(120)).items[0].recipeId,
    recipe,
  );
  assert.equal(
    result.meetings.find((m) => m.coach_id === educator).private_note,
    'PRIVATE-160',
  );
  assert.equal(
    result.meetings.find((m) => m.coach_id === peer).private_note,
    null,
  );
  assert.ok(result.meetings.every((m) => m.follow_up_recipe_id === recipe));
  assert.equal(result.provenance, 'CLIENT_REPORTED');
  for (const key of ['goals', 'studyLogs', 'exams', 'mistakes'])
    assert.ok(result[key].every((r) => r.provenance === 'CLIENT_REPORTED'));
  const studentRead = await repo.readCoachingCenter(
    sql,
    { ...actor, userId: studentRole },
    { studentView: true },
  );
  assert.ok(studentRead.meetings.every((m) => m.private_note === null));
});

test('cursor binds academy, student and view; reapply preserves seeded data', async () => {
  const first = await repo.readCoachingCenter(sql, actor, { limit: 1 });
  assert.equal(first.page.hasMore, true);
  const second = await repo.readCoachingCenter(sql, actor, {
    limit: 1,
    cursor: first.page.nextCursor,
  });
  assert.equal(second.plans.length, 1);
  assert.notEqual(first.plans[0].id, second.plans[0].id);
  for (const [other, options] of [
    [{ ...actor, academyId: otherAcademy }, {}],
    [{ ...actor, studentId: unlinked }, {}],
    [actor, { studentView: true }],
    [actor, { cursor: first.page.nextCursor + 'x' }],
  ])
    await assert.rejects(
      repo.readCoachingCenter(sql, other, {
        limit: 1,
        cursor: first.page.nextCursor,
        ...options,
      }),
      (e) => e.code === 'invalid_cursor',
    );
  const before = await repo.readCoachingCenter(sql, actor, {
    includePrivate: true,
  });
  await apply();
  assert.deepEqual(
    await repo.readCoachingCenter(sql, actor, { includePrivate: true }),
    before,
  );
  const current = (
    await db.query('SELECT * FROM training_recipes WHERE id=$1', [recipe])
  ).rows[0];
  for (const key of Object.keys(originalRecipe))
    assert.deepEqual(current[key], originalRecipe[key], key);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM teacher_student_links WHERE can_coach',
      )
    ).rows[0].n,
    0,
  );
});
