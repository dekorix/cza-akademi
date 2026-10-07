/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const migrations = [
  '20260912_staging_core_prerequisites_v1.sql',
  '20260913_canonical_learning_ledger_v1.sql',
  '20260916_u1_student_panel_core_v1.sql',
  '20260917_u2_work_center_core_v1.sql',
  '20260917_u2_client_reported_completion_remediation_v1.sql',
  '20260917_u3_educator_student_access_v1.sql',
  '20260917_u5_assignment_management_v1.sql',
  '20260917_u5_cancelled_assignment_write_barrier_v1.sql',
].map((name) => read(`../db/migrations/${name}`));

const id = {
  academy: '56000000-0000-4000-8000-000000000001', userA: '56000000-0000-4000-8000-000000000002',
  userB: '56000000-0000-4000-8000-000000000003', studentA: '56000000-0000-4000-8000-000000000004',
  studentB: '56000000-0000-4000-8000-000000000005', loginA: '56000000-0000-4000-8000-000000000006',
  loginB: '56000000-0000-4000-8000-000000000007', recipeA: '56000000-0000-4000-8000-000000000008',
  recipeB: '56000000-0000-4000-8000-000000000009', sessionA: '56000000-0000-4000-8000-000000000010',
  sessionB: '56000000-0000-4000-8000-000000000011', clientSessionA: '56000000-0000-4000-8000-000000000012',
  clientSessionB: '56000000-0000-4000-8000-000000000013', attemptA: '56000000-0000-4000-8000-000000000014',
  attemptAfterCancel: '56000000-0000-4000-8000-000000000015', attemptB: '56000000-0000-4000-8000-000000000016',
};

function attempt(clientAttemptId, questionIndex = 1) {
  return JSON.stringify({ clientAttemptId, questionIndex, questionId: `u5-barrier-${questionIndex}`, targetNumber: 4,
    studentNumericAnswer: 4, patternValid: true, isCorrect: true, errorType: 'FORGED_CLIENT_TRUE',
    errorDetail: 'Demo only', totalResponseTimeMs: 700, learningMode: 'guided_practice', difficultyLevel: 1,
    attemptNumber: 1, metadata: { attemptType: 'PRIMARY', skills: ['client-reported-only'], demo: true } });
}

async function mutationState(db, sessionId) {
  return (await db.query(`SELECT
    (SELECT count(*)::int FROM public.question_attempts WHERE training_session_id=$1) attempts,
    (SELECT count(*)::int FROM public.learning_records WHERE training_session_id=$1) results,
    (SELECT count(*)::int FROM public.learning_evidence e JOIN public.learning_records r ON r.id=e.learning_record_id WHERE r.training_session_id=$1) evidence,
    (SELECT status FROM public.training_sessions WHERE id=$1) status,
    (SELECT completed_at FROM public.training_sessions WHERE id=$1) completed_at,
    (SELECT progress FROM public.training_sessions WHERE id=$1) progress`, [sessionId])).rows[0];
}

test('cancelled assignment blocks attempt and completion before every learning mutation', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    for (const migration of migrations) await db.exec(migration);
    await db.exec(migrations.at(-1));
    await db.exec(`
      INSERT INTO public.academies(id,name,environment) VALUES ('${id.academy}','U5 Barrier Demo','staging');
      INSERT INTO public.users(id,username,role) VALUES ('${id.userA}','u5-barrier-a','student'),('${id.userB}','u5-barrier-b','student');
      INSERT INTO public.students(id,academy_id,user_id,first_name,is_demo) VALUES
        ('${id.studentA}','${id.academy}','${id.userA}','Demo A',true),('${id.studentB}','${id.academy}','${id.userB}','Demo B',true);
      INSERT INTO public.student_sessions(id,academy_id,student_id,student_user_id,token_hash,expires_at) VALUES
        ('${id.loginA}','${id.academy}','${id.studentA}','${id.userA}',repeat('a',64),now()+interval '1 day'),
        ('${id.loginB}','${id.academy}','${id.studentB}','${id.userB}',repeat('b',64),now()+interval '1 day');
      INSERT INTO public.training_recipes(id,academy_id,student_id,module_code,source,name,settings) VALUES
        ('${id.recipeA}','${id.academy}','${id.studentA}','finger_read','teacher_assignment','Barrier A','{"rounds":2}'),
        ('${id.recipeB}','${id.academy}','${id.studentB}','flash_anzan','teacher_assignment','Normal B','{"rounds":1}');
    `);
    await db.query(`SELECT * FROM public.cza_bind_assigned_work_session($1,$2,$3,$4,$5,now())`, [id.academy,id.studentA,id.recipeA,id.clientSessionA,id.sessionA]);
    await db.query(`SELECT * FROM public.cza_bind_assigned_work_session($1,$2,$3,$4,$5,now())`, [id.academy,id.studentB,id.recipeB,id.clientSessionB,id.sessionB]);

    const allowed = await db.query(`SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`, [id.academy,id.studentA,id.sessionA,attempt(id.attemptA)]);
    assert.equal(allowed.rows[0].attempt_count, 1);

    await db.exec(`UPDATE public.training_recipes SET is_active=false,cancelled_at=now(),cancelled_by='${id.userA}' WHERE id='${id.recipeA}'`);
    const before = await mutationState(db, id.sessionA);
    await assert.rejects(db.query(`SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`, [id.academy,id.studentA,id.sessionA,attempt(id.attemptAfterCancel,2)]), /CZA_WORK_ASSIGNMENT_CLOSED/);
    await assert.rejects(db.query(`SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`, [id.academy,id.studentA,id.loginA,id.sessionA]), /CZA_WORK_ASSIGNMENT_CLOSED/);
    assert.deepEqual(await mutationState(db, id.sessionA), before);

    await db.query(`SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`, [id.academy,id.studentB,id.sessionB,attempt(id.attemptB)]);
    const completed = await db.query(`SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`, [id.academy,id.studentB,id.loginB,id.sessionB]);
    assert.equal(completed.rows[0].work_status, 'completed');
    assert.equal(completed.rows[0].evidence_id, null);
    assert.equal((await mutationState(db,id.sessionB)).status, 'completed');

    await assert.rejects(db.query(`SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`, [id.academy,id.studentB,id.sessionA,attempt('56000000-0000-4000-8000-000000000017')]), /CZA_WORK_SESSION_NOT_FOUND/);
    await assert.rejects(db.query(`SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`, [id.academy,id.studentB,id.loginB,id.sessionA]), /CZA_WORK_SESSION_NOT_FOUND/);

    await db.exec(`UPDATE public.training_recipes SET is_active=true,cancelled_at=NULL,cancelled_by=NULL WHERE id='${id.recipeA}'; UPDATE public.training_recipes SET is_active=false WHERE id='${id.recipeA}'`);
    await assert.rejects(db.query(`SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`, [id.academy,id.studentA,id.sessionA,attempt('56000000-0000-4000-8000-000000000018',2)]), /CZA_WORK_ASSIGNMENT_CLOSED/);

    await db.exec(`ALTER TABLE public.training_recipes DROP CONSTRAINT training_recipes_cancel_state_u5_check; UPDATE public.training_recipes SET is_active=true,cancelled_at=now(),cancelled_by='${id.userA}' WHERE id='${id.recipeA}'`);
    await assert.rejects(db.query(`SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`, [id.academy,id.studentA,id.loginA,id.sessionA]), /CZA_WORK_ASSIGNMENT_CLOSED/);

    await db.exec(`UPDATE public.training_recipes SET is_active=true,cancelled_at=NULL,cancelled_by=NULL,starts_at=NULL,expires_at=now()-interval '1 minute' WHERE id='${id.recipeA}'`);
    await assert.rejects(db.query(`SELECT * FROM public.cza_record_assigned_work_attempt($1,$2,$3,$4::jsonb)`, [id.academy,id.studentA,id.sessionA,attempt('56000000-0000-4000-8000-000000000019',2)]), /CZA_WORK_ASSIGNMENT_CLOSED/);

    await db.exec(`UPDATE public.training_recipes SET starts_at=now()+interval '1 hour',expires_at=now()+interval '2 hours' WHERE id='${id.recipeA}'`);
    await assert.rejects(db.query(`SELECT * FROM public.cza_complete_assigned_work($1,$2,$3,$4,false)`, [id.academy,id.studentA,id.loginA,id.sessionA]), /CZA_WORK_ASSIGNMENT_CLOSED/);
  } finally { await db.close(); }
});

test('U5 barrier migration locks canonical assignment and hides legacy mutation functions', () => {
  const migration = migrations.at(-1);
  assert.doesNotMatch(migration, /\b(?:drop|truncate|delete\s+from)\b/i);
  assert.equal((migration.match(/SELECT recipes\.\* INTO v_recipe[\s\S]*?FOR UPDATE;/g) || []).length, 2);
  assert.match(migration, /NOT v_recipe\.is_active OR v_recipe\.cancelled_at IS NOT NULL/g);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.cza_record_assigned_work_attempt_u5_legacy/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.cza_complete_assigned_work_u5_legacy/);
});
