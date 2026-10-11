// LOCAL PostgreSQL security proof. Does not claim a live Worker/login acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';

const migration=fs.readFileSync('db/qa/v03-student-read.sql','utf8');
const hash='a'.repeat(64);
const academy='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const student='20000000-0000-4000-8000-000000000001';
const user='10000000-0000-4000-8000-000000000001';
const recipe='30000000-0000-4000-8000-000000000001';
const ddl=`
CREATE ROLE cza_t5_test_owner; CREATE ROLE cza_v01_app_runtime_min;
GRANT USAGE,CREATE ON SCHEMA public TO cza_t5_test_owner;
GRANT USAGE ON SCHEMA public TO cza_v01_app_runtime_min;
SET ROLE cza_t5_test_owner;
CREATE TABLE users(id uuid PRIMARY KEY,academy_id uuid,username text,role text,is_active boolean);
CREATE TABLE students(id uuid PRIMARY KEY,user_id uuid,academy_id uuid,status text,is_demo boolean,first_name text,last_name text);
CREATE TABLE student_sessions(id uuid,student_id uuid,academy_id uuid,student_user_id uuid,token_hash text,revoked_at timestamptz,expires_at timestamptz);
CREATE TABLE modules(code text,name text,is_active boolean);
CREATE TABLE training_recipes(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,module_code text,name text,instructions text,settings jsonb,starts_at timestamptz,expires_at timestamptz,is_active boolean,cancelled_at timestamptz,source text,created_at timestamptz);
CREATE TABLE training_sessions(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,module_code text,recipe_id uuid,status text,started_at timestamptz,completed_at timestamptz,last_activity_at timestamptz);
CREATE TABLE question_attempts(id uuid,student_id uuid,academy_id uuid,module_code text,training_session_id uuid,metadata jsonb,is_correct boolean,error_type text,created_at timestamptz);
CREATE TABLE learning_records(id uuid,student_id uuid,academy_id uuid,module_code text,training_session_id uuid,completed_at timestamptz,created_at timestamptz,record_origin text,verification_status text,skills jsonb,support_level text);
CREATE TABLE learning_evidence(id uuid,student_id uuid,academy_id uuid,learning_record_id uuid,skill_code text,observed_at timestamptz,verification_status text,verification_authority text);
CREATE TABLE coaching_programs(id uuid,academy_id uuid,student_id uuid,status text);
CREATE TABLE coaching_plans(id uuid,academy_id uuid,student_id uuid,program_id uuid,title text,period_start date,period_end date,version int,status text);
CREATE TABLE coaching_study_logs(academy_id uuid,student_id uuid);
CREATE TABLE coaching_exam_results(id uuid,academy_id uuid,student_id uuid,program_id uuid,template_id uuid,exam_date date,total_net numeric,provenance text);
CREATE TABLE coaching_meetings(academy_id uuid,student_id uuid);
CREATE TABLE coaching_goals(id uuid,academy_id uuid,student_id uuid,program_id uuid,revision int,target jsonb,provenance text,created_at timestamptz);
CREATE TABLE coaching_plan_items(id uuid,academy_id uuid,student_id uuid,recipe_id uuid,plan_id uuid,scheduled_for date);
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_recipes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON students,training_recipes TO cza_v01_app_runtime_min;
SELECT set_config('neon.project_id','patient-firefly-51111834',false),set_config('neon.branch_id','br-withered-queen-b15ltb40',false);
INSERT INTO users VALUES('${user}','${academy}','qa','student',true);
INSERT INTO students VALUES('${student}','${user}','${academy}','active',true,'QA','Synthetic');
INSERT INTO student_sessions VALUES('60000000-0000-4000-8000-000000000001','${student}','${academy}','${user}','${hash}',NULL,now()+interval '1 hour');
INSERT INTO modules VALUES('finger_read','Parmak Okuma',true);
INSERT INTO training_recipes VALUES('${recipe}','${student}','${academy}','finger_read','QA assignment','QA instructions','{"rounds":10}',now()-interval '1 minute',NULL,true,NULL,'teacher_assignment',now());
INSERT INTO training_recipes VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','finger_read','FOREIGN SECRET',NULL,'{}',now(),NULL,true,NULL,'teacher_assignment',now());
`;

test('generated projections match existing source and privilege surface is narrow',()=>{
 execFileSync(process.execPath,['scripts/qa/build-v03-read-contract.mjs','--check']);
 const read=migration.slice(migration.indexOf('CREATE FUNCTION public.cza_v03_qa_student_read'),migration.indexOf('ALTER FUNCTION public.cza_v03_qa_student_read'));
 assert.match(read,/STABLE SECURITY DEFINER/);
 assert.doesNotMatch(read.replace(/--[^\n]*/g,''),/\b(?:INSERT|UPDATE|DELETE|EXECUTE|TRUNCATE|COPY)\b/);
 assert.doesNotMatch(migration,/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)|BYPASSRLS|row_security\s*=|CREATE POLICY|ALTER POLICY|DROP POLICY/i);
 assert.equal((migration.match(/GRANT EXECUTE/g)||[]).length,2);
});

test('actual SQL validates canonical session, denies foreign access and does not expand runtime role',async()=>{
 const db=new PGlite();
 try{
  await db.exec(ddl);
  // PGlite's database is postgres; only that fixture name is substituted.
  await db.exec(migration.replaceAll("'cza_t5_synthetic'","'postgres'"));
  await db.exec(`CREATE FUNCTION public.cza_revoke_student_session(p_hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ UPDATE public.student_sessions SET revoked_at=now() WHERE token_hash=p_hash $$; REVOKE ALL ON FUNCTION public.cza_revoke_student_session(text) FROM PUBLIC;`);
  await db.exec(fs.readFileSync('db/qa/v03-session-lifecycle.sql','utf8').replaceAll("'cza_t5_synthetic'","'postgres'"));
  await db.exec('SET ROLE cza_v01_app_runtime_min');
  assert.equal((await db.query('SELECT * FROM public.cza_v03_qa_authenticated_student($1)',[hash])).rows[0].student_id,student);
  assert.deepEqual((await db.query('SELECT * FROM public.cza_v03_qa_authenticated_student($1)',['0'.repeat(64)])).rows,[]);
  await assert.rejects(db.query('SELECT public.cza_revoke_student_session($1)',[hash]),/permission denied/);
  assert.deepEqual((await db.query('SELECT id FROM public.students')).rows,[]);
  assert.deepEqual((await db.query('SELECT id FROM public.training_recipes')).rows,[]);
  const read=async(id,selectedRecipe=null)=>(await db.query('SELECT public.cza_v03_qa_student_read($1,$2,$3,now()) AS rows',[hash,id,selectedRecipe])).rows[0].rows;
  for(const id of ['dashboard_1','dashboard_2','dashboard_3','dashboard_4','dashboard_5','assignments_1','assignments_2','assignments_3','profile_1','profile_2','profile_3','profile_4','profile_5','profile_6','profile_7','profile_8','coaching_1']){
   const rows=await read(id,recipe);assert.ok(Array.isArray(rows),id);assert.doesNotMatch(JSON.stringify(rows),/FOREIGN SECRET|bbbbbbbb|20000000-0000-4000-8000-000000000002/);
  }
  assert.equal((await read('dashboard_2'))[0].id,recipe);
  assert.deepEqual(await read('assignments_1','30000000-0000-4000-8000-000000000002'),[]);
  await assert.rejects(read('dashboard_1; SELECT * FROM users'),/projection_rejected/);
  await assert.rejects(db.query('SELECT public.cza_v03_qa_student_read($1,$2)', ['0'.repeat(64),'dashboard_1']),/session_rejected/);
  await assert.rejects(db.exec("UPDATE public.students SET status='inactive'"),/permission denied/);
  for(const [table,column,value]of [['student_sessions','revoked_at',"now()"],['student_sessions','expires_at',"now()-interval '1 second'"],['students','status',"'inactive'"],['students','is_demo','false'],['users','is_active','false'],['users','role',"'educator'"],['student_sessions','academy_id',"'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"],['student_sessions','student_id',"'20000000-0000-4000-8000-000000000002'"]]){
   await db.exec('RESET ROLE; BEGIN; SET ROLE cza_t5_test_owner');
   await db.exec(`UPDATE public.${table} SET ${column}=${value}`);
   await db.exec('SET ROLE cza_v01_app_runtime_min');
   await assert.rejects(read('dashboard_1'),/session_rejected/,`${table}.${column}`);
   await db.exec('ROLLBACK; SET ROLE cza_v01_app_runtime_min');
  }
  await db.query("SELECT set_config('neon.branch_id','wrong-branch',false)");
  await assert.rejects(read('dashboard_1'),/session_rejected/);
  assert.deepEqual((await db.query('SELECT * FROM public.cza_v03_qa_authenticated_student($1)',[hash])).rows,[]);
  await assert.rejects(db.query('SELECT public.cza_v03_qa_revoke_student_session($1)',[hash]),/target_rejected/);
  await db.query("SELECT set_config('neon.branch_id','br-withered-queen-b15ltb40',false)");
  await db.query('SELECT public.cza_v03_qa_revoke_student_session($1)',['0'.repeat(64)]);
  assert.equal((await db.query('SELECT * FROM public.cza_v03_qa_authenticated_student($1)',[hash])).rows.length,1);
  await db.query('SELECT public.cza_v03_qa_revoke_student_session($1)',[hash]);
  assert.deepEqual((await db.query('SELECT * FROM public.cza_v03_qa_authenticated_student($1)',[hash])).rows,[]);
  await db.query('SELECT public.cza_v03_qa_revoke_student_session($1)',[hash]);
  await db.exec('RESET ROLE');
  const roles=(await db.query("SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname='cza_v01_app_runtime_min'")).rows[0];
  assert.deepEqual(roles,{rolbypassrls:false,rolsuper:false});
 }finally{await db.close();}
});
