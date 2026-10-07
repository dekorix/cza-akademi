/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const prerequisites = read('../db/migrations/20260912_staging_core_prerequisites_v1.sql');
const migration = read('../db/migrations/20260917_u3_educator_student_access_v1.sql');

test('U3 educator links are idempotent and isolate educators by canonical student', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(prerequisites);
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`
      INSERT INTO public.academies (id,name,environment) VALUES
        ('d3000000-0000-4000-8000-000000000001','U3 Demo','staging'),
        ('d3000000-0000-4000-8000-000000000009','U3 Other Academy','staging');
      INSERT INTO public.users (id,username,role,academy_id,auth_user_id,display_name) VALUES
        ('d3000000-0000-4000-8000-000000000002','u3-educator-a','educator','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000012','Demo Eğitmen A'),
        ('d3000000-0000-4000-8000-000000000003','u3-educator-b','educator','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000013','Demo Eğitmen B'),
        ('d3000000-0000-4000-8000-000000000004','u3-student-a','student',NULL,NULL,NULL),
        ('d3000000-0000-4000-8000-000000000005','u3-student-b','student',NULL,NULL,NULL),
        ('d3000000-0000-4000-8000-000000000008','u3-linked-student','student','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000018','Linked Student Role'),
        ('d3000000-0000-4000-8000-000000000010','u3-other-student','student',NULL,NULL,NULL);
      INSERT INTO public.students (id,academy_id,user_id) VALUES
        ('d3000000-0000-4000-8000-000000000006','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000004'),
        ('d3000000-0000-4000-8000-000000000007','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000005'),
        ('d3000000-0000-4000-8000-000000000011','d3000000-0000-4000-8000-000000000009','d3000000-0000-4000-8000-000000000010');
      INSERT INTO public.teacher_student_links (academy_id,teacher_id,student_id) VALUES
        ('d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000006'),
        ('d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000007'),
        ('d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000008','d3000000-0000-4000-8000-000000000006');
    `);
    const allowed = await db.query(`
      SELECT s.id FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students s
        ON s.id=link.student_id AND s.academy_id=educator.academy_id
      WHERE educator.auth_user_id='d3000000-0000-4000-8000-000000000012'
        AND educator.is_active=true
        AND educator.role::text='educator'
    `);
    assert.deepEqual(allowed.rows, [{ id: 'd3000000-0000-4000-8000-000000000006' }]);
    const cross = await db.query(`
      SELECT s.id FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students s
        ON s.id=link.student_id AND s.academy_id=educator.academy_id
      WHERE educator.auth_user_id='d3000000-0000-4000-8000-000000000012'
        AND educator.is_active=true
        AND educator.role::text='educator'
        AND s.id='d3000000-0000-4000-8000-000000000007'
    `);
    assert.deepEqual(cross.rows, []);
    const linkedStudentRole = await db.query(`
      SELECT s.id FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students s
        ON s.id=link.student_id AND s.academy_id=educator.academy_id
      WHERE educator.auth_user_id='d3000000-0000-4000-8000-000000000018'
        AND educator.is_active=true
        AND educator.role::text='educator'
    `);
    assert.deepEqual(linkedStudentRole.rows, []);

    const inactiveAuthorization = () => db.query(`
      SELECT s.id FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students s
        ON s.id=link.student_id AND s.academy_id=educator.academy_id
      WHERE educator.auth_user_id='d3000000-0000-4000-8000-000000000013'
        AND educator.is_active=true
        AND educator.role::text='educator'
        AND s.id='d3000000-0000-4000-8000-000000000007'
    `);
    await db.exec(`
      UPDATE public.teacher_student_links
      SET can_view=false
      WHERE teacher_id='d3000000-0000-4000-8000-000000000002'
        AND student_id='d3000000-0000-4000-8000-000000000006';
    `);
    const canViewFalse = await db.query(`
      SELECT s.id FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students s
        ON s.id=link.student_id AND s.academy_id=educator.academy_id
      WHERE educator.auth_user_id='d3000000-0000-4000-8000-000000000012'
        AND educator.is_active=true
        AND educator.role::text='educator'
        AND s.id='d3000000-0000-4000-8000-000000000006'
    `);
    assert.deepEqual(canViewFalse.rows, []);
    await db.exec(`
      UPDATE public.teacher_student_links
      SET can_view=true
      WHERE teacher_id='d3000000-0000-4000-8000-000000000002'
        AND student_id='d3000000-0000-4000-8000-000000000006';
    `);

    await db.exec(`UPDATE public.users SET is_active=false WHERE id='d3000000-0000-4000-8000-000000000003';`);
    assert.deepEqual((await inactiveAuthorization()).rows, []);

    const crossAcademy = await db.query(`
      SELECT s.id FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students s
        ON s.id=link.student_id AND s.academy_id=educator.academy_id
      WHERE educator.auth_user_id='d3000000-0000-4000-8000-000000000012'
        AND educator.is_active=true
        AND educator.role::text='educator'
        AND s.id='d3000000-0000-4000-8000-000000000011'
    `);
    assert.deepEqual(crossAcademy.rows, []);
  } finally {
    await db.close();
  }
});
