/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const migrations = [
  '20260912_staging_core_prerequisites_v1.sql', '20260913_canonical_learning_ledger_v1.sql',
  '20260916_u1_student_panel_core_v1.sql', '20260917_u2_work_center_core_v1.sql',
  '20260917_u2_client_reported_completion_remediation_v1.sql', '20260917_u3_educator_student_access_v1.sql',
  '20260917_u5_assignment_management_v1.sql',
].map((name) => read(`../db/migrations/${name}`));

const id = {
  academy: '55000000-0000-4000-8000-000000000001', otherAcademy: '55000000-0000-4000-8000-000000000002',
  educator: '55000000-0000-4000-8000-000000000003', educatorB: '55000000-0000-4000-8000-000000000004',
  inactive: '55000000-0000-4000-8000-000000000005', studentRole: '55000000-0000-4000-8000-000000000006',
  userA: '55000000-0000-4000-8000-000000000007', userB: '55000000-0000-4000-8000-000000000008',
  studentA: '55000000-0000-4000-8000-000000000009', studentB: '55000000-0000-4000-8000-000000000010',
  request: '55000000-0000-4000-8000-000000000011', assignment: '55000000-0000-4000-8000-000000000012',
};

async function authorized(db, actor, student) {
  return (await db.query(`SELECT s.id FROM public.users t
    JOIN public.teacher_student_links l ON l.teacher_id=t.id AND l.academy_id=t.academy_id AND l.can_view=true
    JOIN public.students s ON s.id=l.student_id AND s.academy_id=t.academy_id
    WHERE t.id=$1 AND t.is_active=true AND t.role::text='educator' AND s.status='active' AND s.id=$2`, [actor, student])).rows;
}

test('U5 canonical authorization, idempotency, soft cancellation, and rollback are fail closed', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    for (const migration of migrations) await db.exec(migration);
    const before = (await db.query(`SELECT string_agg(column_name,',' ORDER BY column_name) value FROM information_schema.columns WHERE table_schema='public' AND table_name='training_recipes'`)).rows[0].value;
    await db.exec(migrations.at(-1));
    const after = (await db.query(`SELECT string_agg(column_name,',' ORDER BY column_name) value FROM information_schema.columns WHERE table_schema='public' AND table_name='training_recipes'`)).rows[0].value;
    assert.equal(after, before);
    await db.exec(`
      INSERT INTO public.academies(id,name,environment) VALUES ('${id.academy}','U5 Demo','staging'),('${id.otherAcademy}','U5 Other','staging');
      INSERT INTO public.users(id,username,role,academy_id,is_active) VALUES
        ('${id.educator}','u5-educator','educator','${id.academy}',true),
        ('${id.educatorB}','u5-educator-b','educator','${id.academy}',true),
        ('${id.inactive}','u5-inactive','educator','${id.academy}',false),
        ('${id.studentRole}','u5-student-role','student','${id.academy}',true),
        ('${id.userA}','u5-student-a','student',NULL,true),('${id.userB}','u5-student-b','student',NULL,true);
      INSERT INTO public.students(id,academy_id,user_id,first_name,is_demo) VALUES
        ('${id.studentA}','${id.academy}','${id.userA}','Demo A',true),
        ('${id.studentB}','${id.otherAcademy}','${id.userB}','Demo B',true);
      INSERT INTO public.teacher_student_links(academy_id,teacher_id,student_id,can_view) VALUES
        ('${id.academy}','${id.educator}','${id.studentA}',true),
        ('${id.academy}','${id.educatorB}','${id.studentA}',false),
        ('${id.academy}','${id.inactive}','${id.studentA}',true),
        ('${id.academy}','${id.studentRole}','${id.studentA}',true);
    `);
    assert.equal((await authorized(db, id.educator, id.studentA)).length, 1);
    assert.equal((await authorized(db, id.educatorB, id.studentA)).length, 0);
    assert.equal((await authorized(db, id.inactive, id.studentA)).length, 0);
    assert.equal((await authorized(db, id.studentRole, id.studentA)).length, 0);
    assert.equal((await authorized(db, id.educator, id.studentB)).length, 0);

    const insert = `INSERT INTO public.training_recipes(id,academy_id,student_id,module_code,assigned_by,source,name,settings,client_request_id,request_hash)
      VALUES ($1,$2,$3,'finger_read',$4,'teacher_assignment','U5 Demo','{"rounds":2}',$5,repeat('a',64))
      ON CONFLICT (academy_id,assigned_by,client_request_id) WHERE client_request_id IS NOT NULL
      DO UPDATE SET updated_at=public.training_recipes.updated_at WHERE public.training_recipes.request_hash=EXCLUDED.request_hash RETURNING id`;
    assert.equal((await db.query(insert, [id.assignment,id.academy,id.studentA,id.educator,id.request])).rows[0].id, id.assignment);
    await db.query(insert, ['55000000-0000-4000-8000-000000000013',id.academy,id.studentA,id.educator,id.request]);
    assert.equal((await db.query(`SELECT count(*)::int count FROM public.training_recipes WHERE client_request_id=$1`, [id.request])).rows[0].count, 1);
    assert.equal((await db.query(`UPDATE public.training_recipes SET name='forged' WHERE id=$1 AND assigned_by=$2 RETURNING id`, [id.assignment,id.educatorB])).rows.length, 0);

    await db.exec('BEGIN');
    await assert.rejects(db.query(`INSERT INTO public.training_recipes(academy_id,student_id,module_code,assigned_by,source,name,settings) VALUES ($1,$2,'unsupported',$3,'teacher_assignment','Bad','{}')`, [id.academy,id.studentA,id.educator]));
    await db.exec('ROLLBACK');
    assert.equal((await db.query(`SELECT count(*)::int count FROM public.training_recipes WHERE name='Bad'`)).rows[0].count, 0);

    const cancelled = await db.query(`UPDATE public.training_recipes SET is_active=false,cancelled_at=now(),cancelled_by=$2 WHERE id=$1 AND assigned_by=$2 RETURNING id,cancelled_at`, [id.assignment,id.educator]);
    assert.equal(cancelled.rows.length, 1);
    assert.equal((await db.query(`SELECT count(*)::int count FROM public.training_recipes WHERE id=$1`, [id.assignment])).rows[0].count, 1);
  } finally { await db.close(); }
});
