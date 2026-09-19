/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const transpile=v=>ts.transpileModule(v,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function loadAccess(){const mod={exports:{}};
// oxlint-disable-next-line typescript/no-implied-eval -- isolated production TypeScript module harness
new Function('require','module','exports',transpile(read('../lib/guardian-access.ts')))(()=>{throw new Error('unexpected runtime import');},mod,mod.exports);return mod.exports;}

const migrations=[
  '20260912_staging_core_prerequisites_v1.sql',
  '20260907_central_identity.sql',
  '20260917_u3_educator_student_access_v1.sql',
  '20260918_u9_guardian_panel_v1.sql',
].map(name=>read(`../db/migrations/${name}`));

const ids={
  academy:'91000000-0000-4000-8000-000000000001',
  otherAcademy:'91000000-0000-4000-8000-000000000002',
  guardian:'91000000-0000-4000-8000-000000000003',
  guardianAuth:'91000000-0000-4000-8000-000000000004',
  studentUserA:'91000000-0000-4000-8000-000000000005',
  studentA:'91000000-0000-4000-8000-000000000006',
  studentUserB:'91000000-0000-4000-8000-000000000007',
  studentB:'91000000-0000-4000-8000-000000000008',
  studentUserOther:'91000000-0000-4000-8000-000000000009',
  studentOther:'91000000-0000-4000-8000-000000000010',
};
let db,repo,sql,guardian;

test.before(async()=>{
  db=new PGlite({extensions:{pgcrypto}});
  for(const migration of migrations)await db.exec(migration);
  await db.exec(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS first_name text NULL;ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_name text NULL;ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;`);
  await db.exec(`
    INSERT INTO public.academies(id,name,environment) VALUES
      ('${ids.academy}','Guardian Demo','staging'),
      ('${ids.otherAcademy}','Other Demo','staging');
    INSERT INTO public.users(id,username,role,academy_id,auth_user_id,email,display_name,is_active) VALUES
      ('${ids.guardian}','guardian-demo','guardian','${ids.academy}','${ids.guardianAuth}','veli@demo.invalid','Demo Veli',true),
      ('${ids.studentUserA}','child-a','student','${ids.academy}',NULL,NULL,'Çocuk A',true),
      ('${ids.studentUserB}','child-b','student','${ids.academy}',NULL,NULL,'Çocuk B',true),
      ('${ids.studentUserOther}','child-x','student','${ids.otherAcademy}',NULL,NULL,'Çocuk X',true);
    INSERT INTO public.students(id,academy_id,user_id,first_name,last_name,is_demo) VALUES
      ('${ids.studentA}','${ids.academy}','${ids.studentUserA}','Ada','Demo',true),
      ('${ids.studentB}','${ids.academy}','${ids.studentUserB}','Bora','Demo',true),
      ('${ids.studentOther}','${ids.otherAcademy}','${ids.studentUserOther}','X','Demo',true);
    INSERT INTO public.guardian_student_links(academy_id,guardian_user_id,student_id,can_view) VALUES
      ('${ids.academy}','${ids.guardian}','${ids.studentA}',true),
      ('${ids.academy}','${ids.guardian}','${ids.studentB}',true);
  `);
  repo=loadAccess();
  sql={query:async(text,params)=>(await db.query(text,params)).rows};
  guardian={guardianUserId:ids.guardian,authUserId:ids.guardianAuth,academyId:ids.academy,email:'veli@demo.invalid',name:'Demo Veli'};
});
test.after(async()=>{await db.close();});

test('U9 widens canonical role and creates hashed guardian session/link stores idempotently',async()=>{
  await db.exec(migrations.at(-1));
  const role=(await db.query(`SELECT role FROM public.users WHERE id=$1`,[ids.guardian])).rows[0].role;
  assert.equal(role,'guardian');
  const tables=(await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('guardian_sessions','guardian_student_links') ORDER BY table_name`)).rows.map(row=>row.table_name);
  assert.deepEqual(tables,['guardian_sessions','guardian_student_links']);
  await assert.rejects(db.exec(`INSERT INTO public.guardian_sessions(academy_id,guardian_user_id,token_hash,expires_at) VALUES('${ids.academy}','${ids.guardian}','raw-token',now()+interval '1 hour')`));
});

test('guardian sees exactly linked active children and supports multi-child selection',async()=>{
  const rows=await repo.listGuardianStudents(sql,guardian);
  assert.deepEqual(rows.map(row=>row.id).sort(),[ids.studentA,ids.studentB].sort());
  assert.equal(rows.some(row=>row.id===ids.studentOther),false);
});

test('guardian authorization fails closed for unlinked, cross-academy and inactive guardian',async()=>{
  assert.equal((await repo.resolveGuardianStudent(sql,guardian,ids.studentA)).studentId,ids.studentA);
  await assert.rejects(repo.resolveGuardianStudent(sql,guardian,ids.studentOther),error=>error.code==='student_not_authorized');
  await db.exec(`UPDATE public.users SET is_active=false WHERE id='${ids.guardian}'`);
  await assert.rejects(repo.resolveGuardianStudent(sql,guardian,ids.studentA),error=>error.code==='student_not_authorized');
  await db.exec(`UPDATE public.users SET is_active=true WHERE id='${ids.guardian}'`);
});

test('can_view false immediately removes the child from guardian scope',async()=>{
  await db.exec(`UPDATE public.guardian_student_links SET can_view=false WHERE guardian_user_id='${ids.guardian}' AND student_id='${ids.studentB}'`);
  const rows=await repo.listGuardianStudents(sql,guardian);
  assert.deepEqual(rows.map(row=>row.id),[ids.studentA]);
  await assert.rejects(repo.resolveGuardianStudent(sql,guardian,ids.studentB),error=>error.code==='student_not_authorized');
  await db.exec(`UPDATE public.guardian_student_links SET can_view=true WHERE guardian_user_id='${ids.guardian}' AND student_id='${ids.studentB}'`);
});
