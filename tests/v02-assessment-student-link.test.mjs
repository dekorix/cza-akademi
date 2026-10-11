import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const source=fs.readFileSync(new URL('../lib/assessment-student-link.ts',import.meta.url),'utf8');
const {bindAssessmentSql,eligibleStudentsSql}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let db;
const bind=(session,student,actor='auth')=>db.query(bindAssessmentSql,[actor,id(session),id(student),true]);
test.before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE cza_v01_app_runtime_min;
 CREATE TABLE academies(id uuid PRIMARY KEY,name text);
 CREATE TABLE users(id uuid PRIMARY KEY,academy_id uuid,auth_user_id text,role text,is_active boolean);
 CREATE TABLE students(id uuid PRIMARY KEY,academy_id uuid,first_name text,last_name text,status text,is_demo boolean);
 CREATE TABLE teacher_student_links(id uuid PRIMARY KEY,academy_id uuid,teacher_id uuid,student_id uuid,can_view boolean,can_coach boolean);
 CREATE TABLE student_external_identifiers(student_id uuid,identifier_type text,identifier_value text);
 CREATE TABLE assessment_sessions(id uuid PRIMARY KEY,student_id uuid,template_code text,status text,metadata jsonb);
 CREATE TABLE assessment_attempts(id uuid PRIMARY KEY,session_id uuid,answer_text text);
 CREATE TABLE assessment_observations(id uuid PRIMARY KEY,session_id uuid,educator_note text);
 INSERT INTO academies VALUES('${id(1)}','Synthetic QA'),('${id(2)}','Other QA');
 INSERT INTO users VALUES('${id(3)}','${id(1)}','auth','educator',true),('${id(4)}','${id(1)}','peer','educator',true);
 INSERT INTO students VALUES('${id(10)}','${id(1)}','QA','One','active',true),('${id(11)}','${id(1)}','QA','Two','active',true),('${id(12)}','${id(2)}','QA','Foreign','active',true);
 INSERT INTO teacher_student_links VALUES('${id(20)}','${id(1)}','${id(3)}','${id(10)}',true,false),('${id(21)}','${id(1)}','${id(3)}','${id(11)}',true,false),('${id(22)}','${id(1)}','${id(3)}','${id(12)}',true,true);`);
 await db.exec(fs.readFileSync(new URL('../db/migrations/20261011_v02_assessment_link_permission.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../db/migrations/20261011_v02_assessment_link_audit.sql',import.meta.url),'utf8'));
 for(let n=30;n<40;n++)await db.query(`INSERT INTO assessment_sessions VALUES($1,NULL,'CZA_SPECIAL_V1_DYS','active',$2::jsonb)`,[id(n),JSON.stringify({academyId:id(1),createdByEducatorId:'auth',source:'EDUCATOR_PRE_ENROLLMENT',candidateId:id(n+100),cycleId:id(200)})]);
 await db.exec(`INSERT INTO assessment_attempts VALUES('${id(50)}','${id(30)}','al');INSERT INTO assessment_observations VALUES('${id(51)}','${id(30)}','Synthetic observation');`);
});
test.after(()=>db.close());
test('permission is default-deny; coaching never grants binding',async()=>{
 assert.equal((await bind(30,10)).rows.length,0);
 assert.equal((await bind(30,12)).rows.length,0);
 await db.exec(`UPDATE teacher_student_links SET can_link_assessment=true WHERE id IN ('${id(20)}','${id(21)}','${id(22)}')`);
 assert.equal((await db.query(eligibleStudentsSql,['auth',true])).rows.length,2);
});
test('first link, repeat and conflict preserve original evidence and identity',async()=>{
 const before=await db.query('SELECT * FROM assessment_sessions WHERE id=$1',[id(30)]);
 const first=await bind(30,10);assert.equal(first.rows[0].outcome,'linked');
 assert.equal((await bind(30,10)).rows[0].outcome,'already_linked');
 assert.equal((await bind(30,11)).rows[0].outcome,'conflict');
 const after=await db.query('SELECT * FROM assessment_sessions WHERE id=$1',[id(30)]);
 assert.deepEqual(after.rows[0].metadata,before.rows[0].metadata);assert.equal(after.rows[0].student_id,id(10));
 assert.equal((await db.query('SELECT count(*)::int n FROM assessment_sessions')).rows[0].n,10);
 assert.deepEqual((await db.query('SELECT answer_text FROM assessment_attempts')).rows,[{answer_text:'al'}]);
 assert.deepEqual((await db.query('SELECT educator_note FROM assessment_observations')).rows,[{educator_note:'Synthetic observation'}]);
 assert.equal((await db.query('SELECT count(*)::int n FROM assessment_student_link_audit')).rows[0].n,1);
});
test('peer creator and cross-academy target denied',async()=>{
 assert.equal((await bind(31,10,'peer')).rows.length,0);assert.equal((await bind(31,12)).rows.length,0);
});
test('revocation, inactive student, inactive educator and can_view denial',async()=>{
 for(const change of ["UPDATE teacher_student_links SET can_link_assessment=false WHERE student_id='"+id(10)+"'", "UPDATE teacher_student_links SET can_view=false WHERE student_id='"+id(10)+"'", "UPDATE students SET status='inactive' WHERE id='"+id(10)+"'", "UPDATE users SET is_active=false WHERE auth_user_id='auth'"]){
  await db.exec('BEGIN');await db.exec(change);assert.equal((await bind(32,10)).rows.length,0);await db.exec('ROLLBACK');
 }
});
test('cancelled candidate and wrong source denied; completed candidate permitted',async()=>{
 await db.exec(`UPDATE assessment_sessions SET status='cancelled' WHERE id='${id(33)}'`);assert.equal((await bind(33,10)).rows.length,0);
 await db.exec(`UPDATE assessment_sessions SET metadata=metadata||'{"source":"OTHER"}' WHERE id='${id(34)}'`);assert.equal((await bind(34,10)).rows.length,0);
 await db.exec(`UPDATE assessment_sessions SET status='completed' WHERE id='${id(35)}'`);assert.equal((await bind(35,10)).rows[0].outcome,'linked');
});
test('audit failure rolls back student_id without half-link',async()=>{
 await db.exec(`CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated audit failure'; END $$;
 CREATE TRIGGER test_reject_audit BEFORE INSERT ON assessment_student_link_audit FOR EACH ROW EXECUTE FUNCTION test_reject_audit();`);
 await assert.rejects(bind(36,10));
 assert.equal((await db.query('SELECT student_id FROM assessment_sessions WHERE id=$1',[id(36)])).rows[0].student_id,null);
 await db.exec('DROP TRIGGER test_reject_audit ON assessment_student_link_audit');
});
test('audit is immutable against update, delete and truncate',async()=>{
 for(const sql of ['UPDATE assessment_student_link_audit SET linked_at=now()','DELETE FROM assessment_student_link_audit','TRUNCATE assessment_student_link_audit'])await assert.rejects(db.exec(sql),/immutable/);
});
test('two competing requests produce one target and one audit',async()=>{
 const results=await Promise.all([bind(37,10),bind(37,11)]);
 assert.deepEqual(results.map(r=>r.rows[0].outcome).sort(),['conflict','linked']);
 assert.equal((await db.query('SELECT count(*)::int n FROM assessment_student_link_audit WHERE session_id=$1',[id(37)])).rows[0].n,1);
});
test('deployed fixed function uses the tested atomic SQL and denies PUBLIC execute',()=>{
 const migration=fs.readFileSync(new URL('../db/migrations/20261011_v02_assessment_link_audit.sql',import.meta.url),'utf8');
 assert.ok(migration.includes(bindAssessmentSql));assert.match(migration,/SECURITY DEFINER SET search_path=pg_catalog,public/);assert.match(migration,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);assert.doesNotMatch(migration,/GRANT.*(?:UPDATE|DDL|ALL).*TO cza_v01_app_runtime_min/i);
});
