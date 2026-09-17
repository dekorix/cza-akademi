/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const migrations = [
  read('../db/migrations/20260912_staging_core_prerequisites_v1.sql'),
  read('../db/migrations/20260913_canonical_learning_ledger_v1.sql'),
  read('../db/migrations/20260916_u1_student_panel_core_v1.sql'),
  read('../db/migrations/20260917_u2_work_center_core_v1.sql'),
  read('../db/migrations/20260917_u2_client_reported_completion_remediation_v1.sql'),
];

function loadTimelineModule() {
  const source = read('../lib/persistence/learning-timeline.ts');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const commonJsModule = { exports: {} };
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require', 'module', 'exports', 'process', 'Buffer', js)(
    (id) => { if (id === 'node:crypto') return crypto; throw new Error(id); },
    commonJsModule, commonJsModule.exports, process, Buffer,
  );
  return commonJsModule.exports;
}

const id = {
  academy: '44000000-0000-4000-8000-000000000001', userA: '44000000-0000-4000-8000-000000000002',
  userB: '44000000-0000-4000-8000-000000000003', studentA: '44000000-0000-4000-8000-000000000004',
  studentB: '44000000-0000-4000-8000-000000000005', recipeA: '44000000-0000-4000-8000-000000000006',
  recipeB: '44000000-0000-4000-8000-000000000007', sessionA: '44000000-0000-4000-8000-000000000008',
  sessionB: '44000000-0000-4000-8000-000000000009', attemptA: '44000000-0000-4000-8000-000000000010',
  attemptA2: '44000000-0000-4000-8000-000000000015',
  recordA: '44000000-0000-4000-8000-000000000011', evidenceA: '44000000-0000-4000-8000-000000000012',
};

test('malicious client correctness cannot mint server_verified timeline evidence', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const timeline = loadTimelineModule();
  const previous = process.env.CZA_TIMELINE_CURSOR_SECRET;
  process.env.CZA_TIMELINE_CURSOR_SECRET = 'u4-postgres-cursor-secret-at-least-32-bytes';
  try {
    for (const migration of migrations) await db.exec(migration);
    await db.exec(`
      INSERT INTO public.academies (id,name,environment) VALUES ('${id.academy}','U4 Demo','staging');
      INSERT INTO public.users (id,username,role) VALUES
        ('${id.userA}','u4-demo-a','student'),('${id.userB}','u4-demo-b','student');
      INSERT INTO public.students (id,academy_id,user_id,first_name,is_demo) VALUES
        ('${id.studentA}','${id.academy}','${id.userA}','Demo A',true),
        ('${id.studentB}','${id.academy}','${id.userB}','Demo B',true);
      INSERT INTO public.training_recipes (id,academy_id,student_id,module_code,source,name,created_at) VALUES
        ('${id.recipeA}','${id.academy}','${id.studentA}','finger_read','teacher_assignment','A Timeline','2026-09-17T12:00:00Z'),
        ('${id.recipeB}','${id.academy}','${id.studentB}','flash_anzan','teacher_assignment','B Private','2026-09-17T12:00:00Z');
      INSERT INTO public.training_sessions (id,academy_id,student_id,module_code,recipe_id,status,started_at,last_activity_at,completed_at) VALUES
        ('${id.sessionA}','${id.academy}','${id.studentA}','finger_read','${id.recipeA}','completed','2026-09-17T12:00:00Z','2026-09-17T12:00:00Z','2026-09-17T12:00:00Z'),
        ('${id.sessionB}','${id.academy}','${id.studentB}','flash_anzan','${id.recipeB}','completed','2026-09-17T12:00:00Z','2026-09-17T12:00:00Z','2026-09-17T12:00:00Z');
      INSERT INTO public.question_attempts (id,academy_id,student_id,training_session_id,module_code,client_attempt_id,question_index,question_id,is_correct,error_type,error_detail,created_at) VALUES
        ('${id.attemptA}','${id.academy}','${id.studentA}','${id.sessionA}','finger_read','44000000-0000-4000-8000-000000000013',1,'q1',false,'DEMO_ERROR','Demo only','2026-09-17T12:00:00Z'),
        ('${id.attemptA2}','${id.academy}','${id.studentA}','${id.sessionA}','finger_read','44000000-0000-4000-8000-000000000016',2,'q2',true,'NONE',NULL,'2026-09-17T12:00:00Z');
      INSERT INTO public.learning_records (id,academy_id,student_id,module_code,training_session_id,client_record_id,payload_hash,record_origin,verification_status,contract_version,schema_version,module_version,activity_type,started_at,completed_at,support_level,performance,skills) VALUES
        ('${id.recordA}','${id.academy}','${id.studentA}','finger_read','${id.sessionA}','44000000-0000-4000-8000-000000000014',repeat('a',64),'legacy_client_reported','client_reported','1.1.0','CZA_MODULE_RECORD_V1','u4','practice','2026-09-17T11:59:00Z','2026-09-17T12:00:00Z','guided','{"accuracy":0}','["number-recognition"]');
      INSERT INTO public.learning_evidence (id,learning_record_id,academy_id,student_id,evidence_type,verification_status,verification_authority,skill_code,support_level,observed_at,payload) VALUES
        ('${id.evidenceA}','${id.recordA}','${id.academy}','${id.studentA}','skill_observation','server_verified','u4-test-verifier','number-recognition','guided','2026-09-17T12:00:00Z','{"observed":true}');
    `);
    const before = (await db.query(`SELECT
      (SELECT count(*) FROM public.training_sessions) AS sessions,
      (SELECT count(*) FROM public.question_attempts) AS attempts,
      (SELECT count(*) FROM public.learning_records) AS records,
      (SELECT count(*) FROM public.learning_evidence) AS evidence`)).rows[0];
    const sql = { query: async (text, params) => (await db.query(text, params)).rows };
    const filters = { from: null, to: null, moduleCode: null, eventType: null, verificationStatus: null };
    const all = await timeline.readLearningTimeline({ sql, academyId: id.academy, studentId: id.studentA, limit: 50, cursor: null, filters });
    assert.equal(all.events.length, 5);
    assert.deepEqual(
      all.events.map((event) => event.eventId),
      all.events.map((event) => event.eventId).toSorted((a, b) => b.localeCompare(a)),
    );
    assert.equal(all.events.find((event) => event.eventType === 'LEARNING_RESULT').verificationStatus, 'client_reported');
    assert.equal(all.events.find((event) => event.eventType === 'SKILL_EVIDENCE').verificationStatus, 'server_verified');
    assert.equal(all.events.find((event) => event.eventType === 'ERROR_OBSERVED').provenance, 'client_reported');
    const mixedCompletion = all.events.find((event) => event.eventType === 'WORK_COMPLETED');
    assert.equal(mixedCompletion.verificationStatus, 'server_verified');
    assert.equal(mixedCompletion.resultSummary, null);

    for (const forgedValue of [true, false]) {
      await db.query('UPDATE public.question_attempts SET is_correct=$1 WHERE training_session_id=$2', [forgedValue, id.sessionA]);
      const forged = await timeline.readLearningTimeline({ sql, academyId: id.academy, studentId: id.studentA, limit: 50, cursor: null, filters });
      const completion = forged.events.find((event) => event.eventType === 'WORK_COMPLETED');
      assert.equal(completion.resultSummary, null, `forged ${forgedValue ? '100' : '0'}% correctness leaked`);
      assert.doesNotMatch(JSON.stringify(completion), /correctCount|accuracy|score|isCorrect/);
    }
    await db.query('UPDATE public.question_attempts SET is_correct=(question_index % 2 = 0) WHERE training_session_id=$1', [id.sessionA]);
    const mixedForged = await timeline.readLearningTimeline({ sql, academyId: id.academy, studentId: id.studentA, limit: 50, cursor: null, filters });
    assert.equal(mixedForged.events.find((event) => event.eventType === 'WORK_COMPLETED').resultSummary, null);

    const paged = [];
    let cursor = null;
    do {
      const page = await timeline.readLearningTimeline({ sql, academyId: id.academy, studentId: id.studentA, limit: 2, cursor, filters });
      paged.push(...page.events.map((event) => event.eventId)); cursor = page.nextCursor;
      if (!page.hasMore) break;
    } while (cursor);
    assert.deepEqual(paged, all.events.map((event) => event.eventId));
    assert.equal(new Set(paged).size, paged.length);

    const privateHistory = await timeline.readLearningTimeline({ sql, academyId: id.academy, studentId: id.studentB, limit: 50, cursor: null, filters });
    assert.ok(privateHistory.events.every((event) => event.studentId === id.studentB));
    assert.ok(all.events.every((event) => event.studentId === id.studentA));
    const empty = await timeline.readLearningTimeline({ sql, academyId: id.academy, studentId: '44000000-0000-4000-8000-000000000099', limit: 20, cursor: null, filters });
    assert.deepEqual(empty, { events: [], hasMore: false, nextCursor: null });
    const after = (await db.query(`SELECT
      (SELECT count(*) FROM public.training_sessions) AS sessions,
      (SELECT count(*) FROM public.question_attempts) AS attempts,
      (SELECT count(*) FROM public.learning_records) AS records,
      (SELECT count(*) FROM public.learning_evidence) AS evidence`)).rows[0];
    assert.deepEqual(after, before);
  } finally {
    if (previous === undefined) delete process.env.CZA_TIMELINE_CURSOR_SECRET;
    else process.env.CZA_TIMELINE_CURSOR_SECRET = previous;
    await db.close();
  }
});
