import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const js = ts.transpileModule(read('lib/assessment-learning-outcome.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
// oxlint-disable-next-line typescript/no-implied-eval -- isolated source module
new Function('require', 'module', 'exports', js)(() => ({}), mod, mod.exports);
const { deriveP2LearningOutcome } = mod.exports;
const tasks = [
  { id: 'A', groupId: 'G1', skillWeights: [{ skillId: 'number_sense', weight: 1 }] },
  { id: 'B', groupId: 'G2', skillWeights: [{ skillId: 'number_sense', weight: 1 }] },
  { id: 'C', groupId: 'G3', skillWeights: [{ skillId: 'math_reasoning', weight: 1 }] },
  { id: 'D', groupId: 'G4', skillWeights: [{ skillId: 'math_reasoning', weight: 1 }] },
  { id: 'E', groupId: 'G5', skillWeights: [{ skillId: 'number_sense', weight: 1 }] },
];
const contract = (version) => ({
  definitionId: 'CZA_1_TO_2', assessmentVersion: version, blueprintId: 'P2_1_TO_2',
  blueprintVersion: 1, itemBankSha256: 'a'.repeat(64), routingSha256: 'b'.repeat(64),
  taskMappingVersion: 'LEGACY_ROUTING_V1',
  serverEvaluatorId: version === 2 ? 'P2_DETERMINISTIC_TEXT' : 'NONE_CLIENT_REPORTED',
  serverEvaluatorVersion: version === 2 ? '1' : '0',
  rubricVersion: 'LEGACY_P2_RUBRIC_V1', answerKeyVersion: 'LEGACY_P2_ANSWER_KEY_V1',
});
const evaluation = (verdict) => ({
  evaluatorId: 'P2_DETERMINISTIC_TEXT', evaluatorVersion: '1', verdict,
  responseOrigin: verdict === 'unassessable' ? 'client_reported' : 'server_evaluated',
  needsEducatorReview: verdict === 'unassessable',
});
async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.students (id uuid PRIMARY KEY);
    CREATE TABLE public.assessment_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid REFERENCES students(id),
      template_code text NOT NULL, status text NOT NULL DEFAULT 'active',
      current_task_code text, definition_contract jsonb);
    CREATE TABLE public.assessment_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES assessment_sessions(id),
      task_code text NOT NULL, answer_text text, answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      client_attempt_id uuid, request_hash text, server_evaluation jsonb,
      server_next_task_code text, educator_review jsonb,
      educator_reviewed_by uuid, educator_reviewed_at timestamptz);
    CREATE TABLE public.users (
      id uuid PRIMARY KEY, auth_user_id text, academy_id uuid, role text, is_active boolean);
    CREATE TABLE public.teacher_student_links (
      teacher_id uuid, student_id uuid, academy_id uuid, can_view boolean);
  `);
  // Apply the real T2/T4 migrations against persisted attempt rows.
  await db.exec(read('db/migrations/20260929_t2_p2_assessment_definition_contract_v1.sql'));
  await db.exec(read('db/migrations/20260929_t4_p2_server_evaluator_v1.sql'));
  const student = 'c8612ac1-6d04-4990-8385-e7c60234efbc';
  await db.query('INSERT INTO students VALUES ($1)', [student]);
  const ids = ['b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003'];
  for (const [i, definition] of [contract(1), null, contract(2)].entries()) {
    await db.query('INSERT INTO assessment_sessions (id,student_id,template_code,definition_contract) VALUES ($1,$2,$3,$4::jsonb)',
      [ids[i], student, 'CZA_1_TO_2_V1', definition == null ? null : JSON.stringify(definition)]);
  }
  return { db, ids };
}
async function insert(db, sessionId, task, value, review = null) {
  const keyed = value !== null;
  const uuid = crypto.randomUUID();
  return db.query(`INSERT INTO assessment_attempts
    (session_id,task_code,answer_payload,client_attempt_id,request_hash,server_evaluation,
     educator_review,educator_reviewed_by,educator_reviewed_at)
    VALUES ($1,$2,'{"routeCorrectness":"correct","supportTriggered":false}'::jsonb,
      $3::uuid,$4,$5::jsonb,$6::jsonb,$7::uuid,$8::timestamptz)`,
    [sessionId, task, keyed ? uuid : null, keyed ? 'a'.repeat(64) : null,
      keyed ? JSON.stringify(evaluation(value)) : null,
      review ? JSON.stringify(review) : null,
      review ? uuid : null, review ? new Date().toISOString() : null]);
}
async function rows(db, id) {
  return (await db.query('SELECT * FROM assessment_attempts WHERE session_id=$1 ORDER BY id', [id])).rows;
}
function skill(outcome, id) { return outcome.skills.find((entry) => entry.skillId === id); }

test('T2/T3 rows keep client provenance, no retroactive score or mutation', async () => {
  const { db, ids } = await setup();
  try {
    await insert(db, ids[0], 'A', null);
    await insert(db, ids[1], 'B', null);
    const before = JSON.stringify((await db.query('SELECT * FROM assessment_attempts ORDER BY id')).rows);
    for (const [id, status] of [[ids[0], 'current'], [ids[1], 'legacy_unversioned']]) {
      const result = deriveP2LearningOutcome(await rows(db, id), tasks, status);
      assert.equal(result.status, 'insufficient_evidence');
      assert.equal(result.score, null);
      assert.equal(result.counts.client_reported, 1);
      assert.equal(result.counts.server_evaluated, 0);
    }
    assert.equal(JSON.stringify((await db.query('SELECT * FROM assessment_attempts ORDER BY id')).rows), before);
  } finally { await db.close(); }
});

test('T4 mixed sources remain separate; insufficient evidence never becomes zero', async () => {
  const { db, ids } = await setup();
  try {
    const id = ids[2];
    await insert(db, id, 'A', 'correct');
    await insert(db, id, 'B', 'unassessable', { origin: 'educator_observed', decision: 'incorrect' });
    const first = deriveP2LearningOutcome(await rows(db, id), tasks, 'current_t4');
    assert.equal(first.score, null);
    assert.equal(first.status, 'insufficient_evidence');
    assert.deepEqual(first.counts, { server_evaluated: 1, educator_observed: 1,
      client_reported: 1, unclassified: 0 });
    assert.deepEqual(first.evidence.map(({ source, score }) => [source, score]).sort(),
      [['client_reported', null], ['educator_observed', null], ['server_evaluated', 100]].sort());
    assert.equal(skill(first, 'number_sense').score, null);
    await insert(db, id, 'C', 'incorrect');
    const crossSkill = deriveP2LearningOutcome(await rows(db, id), tasks, 'current_t4');
    assert.equal(crossSkill.score, null);
    await insert(db, id, 'E', 'incorrect');
    await insert(db, id, 'D', 'correct');
    const done = deriveP2LearningOutcome(await rows(db, id), tasks, 'current_t4');
    assert.equal(done.score, 50);
    assert.equal(skill(done, 'math_reasoning').score, 50);
    assert.equal(skill(done, 'number_sense').score, 50);
    const replay = deriveP2LearningOutcome(await rows(db, id), tasks, 'current_t4');
    assert.deepEqual(replay, done);
  } finally { await db.close(); }
});

test('two distinct server tasks per skill yield scored outcome; malformed evidence fails closed', async () => {
  const { db, ids } = await setup();
  try {
    const id = ids[2];
    for (const [task, verdict] of [['A','correct'],['B','incorrect'],['C','incorrect'],['D','correct']]) {
      await insert(db, id, task, verdict);
    }
    const persisted = await rows(db, id);
    const result = deriveP2LearningOutcome(persisted, tasks, 'current_t4');
    assert.equal(result.status, 'scored');
    assert.equal(result.score, 50);
    assert.equal(skill(result, 'number_sense').score, 50);
    assert.equal(skill(result, 'math_reasoning').score, 50);
    assert.deepEqual(deriveP2LearningOutcome(persisted, tasks, 'current_t4'), result);
    const tampered = persisted.map((row) => ({ ...row }));
    tampered[0].server_evaluation = { ...tampered[0].server_evaluation,
      evaluatorVersion: 'unknown' };
    assert.equal(deriveP2LearningOutcome(tampered, tasks, 'current_t4').score, null);
    tampered[0].server_evaluation = { ...persisted[0].server_evaluation,
      needsEducatorReview: true };
    assert.equal(deriveP2LearningOutcome(tampered, tasks, 'current_t4').score, null);
    assert.equal(deriveP2LearningOutcome(persisted, tasks, 'mismatch').score, null);
  } finally { await db.close(); }
});
