/* oxlint-disable typescript/no-floating-promises -- node:test registration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const source = fs.readFileSync(
  new URL('../lib/persistence/educator-analytics.ts', import.meta.url),
  'utf8',
);
const mod = { exports: {} };
// oxlint-disable-next-line typescript/no-implied-eval -- execute the actual persistence module against PGlite.
new Function(
  'require',
  'module',
  'exports',
  'process',
  'Buffer',
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(
  (id) => {
    if (id === 'node:crypto') return crypto;
    throw new Error(id);
  },
  mod,
  mod.exports,
  process,
  Buffer,
);
const uuid = (n) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const filters = {
  from: null,
  to: null,
  moduleCode: null,
  assignmentStatus: null,
  sessionStatus: null,
  provenance: null,
};

test('F3C1 real enum analytics retains filters, tenant boundaries and provenance', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE public.session_status AS ENUM ('in_progress','completed','abandoned','active','cancelled');
      CREATE TABLE public.training_recipes (
        id uuid PRIMARY KEY, academy_id uuid, student_id uuid, module_code text,
        created_at timestamptz DEFAULT '2026-09-27T10:00:00Z', cancelled_at timestamptz, starts_at timestamptz
      );
      CREATE TABLE public.training_sessions (
        id uuid PRIMARY KEY, academy_id uuid, student_id uuid, recipe_id uuid, module_code text,
        status public.session_status NOT NULL, started_at timestamptz DEFAULT '2026-09-27T10:00:00Z',
        last_activity_at timestamptz DEFAULT '2026-09-27T10:01:00Z', completed_at timestamptz
      );
      CREATE TABLE public.question_attempts (
        id uuid PRIMARY KEY, academy_id uuid, student_id uuid, module_code text, is_correct boolean,
        error_type text, created_at timestamptz DEFAULT '2026-09-27T10:00:00Z'
      );
      CREATE TABLE public.learning_records (
        id uuid PRIMARY KEY, academy_id uuid, student_id uuid, module_code text,
        record_origin text, verification_status text
      );
      CREATE TABLE public.learning_evidence (
        id uuid PRIMARY KEY, academy_id uuid, student_id uuid, learning_record_id uuid,
        evidence_type text, verification_status text, verification_authority text, skill_code text,
        observed_at timestamptz DEFAULT '2026-09-27T10:00:00Z'
      );
    `);
    // Two target sessions plus same-academy/other-student and other-academy decoys.
    for (const [n, academy, student, status] of [
      [1, 100, 200, 'completed'],
      [2, 100, 200, 'active'],
      [3, 100, 201, 'completed'],
      [4, 101, 200, 'completed'],
    ]) {
      const scope = [uuid(n), uuid(academy), uuid(student), 'flash_anzan'];
      await db.query(
        'INSERT INTO training_recipes(id,academy_id,student_id,module_code) VALUES($1,$2,$3,$4)',
        scope,
      );
      await db.query(
        `INSERT INTO training_sessions(id,academy_id,student_id,module_code,recipe_id,status,completed_at)
        VALUES($1,$2,$3,$4,$1,$5::text::session_status,CASE WHEN $5::text='completed' THEN '2026-09-27T10:01:00Z'::timestamptz END)`,
        [...scope, status],
      );
      await db.query(
        `INSERT INTO question_attempts(id,academy_id,student_id,module_code,is_correct,error_type)
        VALUES($1,$2,$3,$4,false,'RESPONSE_ERROR')`,
        scope,
      );
      const trusted = n === 2;
      await db.query(`INSERT INTO learning_records VALUES($1,$2,$3,$4,$5,$6)`, [
        ...scope,
        trusted ? 'server_authoritative' : 'client_reported',
        trusted ? 'server_verified' : 'client_reported',
      ]);
      await db.query(
        `INSERT INTO learning_evidence(id,academy_id,student_id,learning_record_id,evidence_type,
        verification_status,verification_authority) VALUES($1,$2,$3,$1,'activity_result','server_verified',$4)`,
        [
          uuid(n),
          uuid(academy),
          uuid(student),
          trusted
            ? 'canonical_server_evaluator:v1'
            : 'work_center_completion:v1',
        ],
      );
    }
    const read = (
      overrides = {},
      academyId = uuid(100),
      studentId = uuid(200),
    ) =>
      mod.exports.readEducatorAnalytics({
        sql: {
          query: async (text, params) => (await db.query(text, params)).rows,
        },
        educatorId: 'synthetic-educator',
        academyId,
        studentId,
        filters: { ...filters, ...overrides },
        limit: 20,
        cursor: null,
      });
    await t.test(
      'unfiltered enum queries return only the selected academy/student',
      async () => {
        const result = await read();
        assert.equal(result.summary.sessions.total, 2);
        assert.equal(result.summary.sessions.completed, 1);
        assert.equal(result.summary.assignments.total, 2);
        assert.equal(result.summary.clientPerformance.attempts, 2);
        assert.deepEqual(result.sessions.map((s) => s.id).sort(), [
          uuid(1),
          uuid(2),
        ]);
        assert.equal(result.modules[0].sessionCount, 2);
        assert.equal(result.modules[0].attemptCount, 2);
        assert.equal(result.errors[0].count, 2);
        assert.equal(result.trend[0].sessions, 2);
        assert.deepEqual(result.evidence.map((e) => e.id).sort(), [
          uuid(1),
          uuid(2),
        ]);
      },
    );
    await t.test(
      'completed filter constrains summary, modules and session page',
      async () => {
        const result = await read({ sessionStatus: 'completed' });
        assert.equal(result.summary.sessions.total, 1);
        assert.equal(result.summary.sessions.completed, 1);
        assert.equal(result.modules[0].sessionCount, 1);
        assert.equal(result.modules[0].completedSessions, 1);
        assert.deepEqual(
          result.sessions.map((s) => [s.id, s.status]),
          [[uuid(1), 'completed']],
        );
        // Existing contract: session filter does not filter client attempts or assignments.
        assert.equal(result.summary.clientPerformance.attempts, 2);
        assert.equal(result.summary.assignments.total, 2);
      },
    );
    await t.test(
      'nonmatching scope yields no rows or aggregated data',
      async () => {
        for (const [academy, student] of [
          [102, 200],
          [100, 202],
        ]) {
          const result = await read({}, uuid(academy), uuid(student));
          assert.equal(result.summary.sessions.total, 0);
          assert.equal(result.summary.assignments.total, 0);
          assert.equal(result.summary.clientPerformance.attempts, 0);
          for (const key of [
            'sessions',
            'modules',
            'errors',
            'trend',
            'evidence',
          ])
            assert.deepEqual(result[key], []);
        }
      },
    );
    await t.test(
      'real evidence queries preserve client/server provenance and filters',
      async () => {
        const mixed = await read();
        assert.equal(
          mixed.evidence.find((e) => e.id === uuid(1)).provenance,
          'CLIENT_REPORTED',
        );
        assert.equal(
          mixed.evidence.find((e) => e.id === uuid(2)).provenance,
          'SERVER_AUTHORITATIVE',
        );
        const server = await read({ provenance: 'SERVER_AUTHORITATIVE' });
        assert.equal(server.summary.clientPerformance, null);
        assert.deepEqual(
          server.evidence.map((e) => e.id),
          [uuid(2)],
        );
        const client = await read({ provenance: 'CLIENT_REPORTED' });
        assert.equal(client.summary.sessions, null);
        assert.deepEqual(
          client.evidence.map((e) => e.id),
          [uuid(1)],
        );
      },
    );
  } finally {
    await db.close();
  }
});
