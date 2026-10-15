// LOCAL ONLY: isolated in-memory PostgreSQL; no live Neon writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration=fs.readFileSync('db/qa/a-demo-02-read.review.sql','utf8');
const hash='a'.repeat(64),academy='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',student='20000000-0000-4000-8000-000000000001',user='10000000-0000-4000-8000-000000000001',recipe='361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';
const sessionIds=['bdb87fbc-0938-4eb1-82e5-0a2cb362d30f','40000004-0000-4000-8000-000000000091'];
const filters={from:null,to:null,moduleCode:null,eventType:null,verificationStatus:null};
const ddlSource=fs.readFileSync('tests/v03-qa-read-postgres.test.mjs','utf8').split('const ddl=`')[1].split('`;')[0];
const ddl=ddlSource.replace(/\$\{(hash|academy|student|user|recipe)\}/g,(_,key)=>({hash,academy,student,user,recipe})[key]);
const fingerprint=async db=>(await db.query(`SELECT 'sessions' name,md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) hash FROM training_sessions t UNION ALL SELECT 'attempts',md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM question_attempts t UNION ALL SELECT 'records',md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM learning_records t UNION ALL SELECT 'evidence',md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM learning_evidence t UNION ALL SELECT 'students',md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM students t UNION ALL SELECT 'recipes',md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM training_recipes t`)).rows;

void test('review-only SQL has atomic ACL, exact scope, no old function/table/role/policy mutation',()=>{
 assert.match(migration,/BEGIN;[\s\S]*REVOKE ALL[\s\S]*GRANT EXECUTE[\s\S]*COMMIT;/);
 assert.match(migration,/STABLE SECURITY DEFINER/);
 assert.doesNotMatch(migration,/CREATE OR REPLACE|CREATE POLICY|ALTER POLICY|DROP POLICY|BYPASSRLS|GRANT SELECT|ALTER TABLE|GRANT authenticated/);
 const body=migration.split('AS $body$')[1].split('END $body$')[0];
 assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|EXECUTE|TRUNCATE|COPY)\b/);
 assert.match(body,/cza_v03_qa_authenticated_student\(p_token_hash\)/);
 for(const id of sessionIds)assert.ok(body.includes(id));
});

void test('RLS root cause reproduced; narrow read preserves provenance/filter/cursor/ACL/hash and rejects foreign access',async()=>{
 const db=new PGlite();
 try{
  await db.exec(ddl);
  await db.exec(`ALTER TABLE learning_records ADD COLUMN performance jsonb; ALTER TABLE learning_evidence ADD COLUMN payload jsonb,ADD COLUMN support_level text,ADD COLUMN evidence_type text; ALTER TABLE question_attempts ADD COLUMN total_response_time_ms int,ADD COLUMN error_detail text;
  RESET ROLE; CREATE ROLE authenticated; SET ROLE cza_t5_test_owner; GRANT SELECT ON ALL TABLES IN SCHEMA public TO cza_v01_app_runtime_min;
  ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY qa_only_authenticated ON training_sessions FOR SELECT TO authenticated USING(true);
  CREATE POLICY qa_only_authenticated ON question_attempts FOR SELECT TO authenticated USING(true);`);
  await db.exec(fs.readFileSync('db/qa/v03-student-read.sql','utf8').replaceAll("'cza_t5_synthetic'","'postgres'"));
  await db.exec(fs.readFileSync('db/qa/v03-session-lifecycle.sql','utf8').split('CREATE FUNCTION public.cza_v03_qa_revoke_student_session')[0].replaceAll("'cza_t5_synthetic'","'postgres'"));
  for(let i=0;i<10;i++){
   const sid=i<2?sessionIds[i]:`50000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
   await db.query(`INSERT INTO training_sessions VALUES($1,$2,$3,'finger_read',$4,'completed',now()-interval '2 hours',now()-($5::int*interval '1 minute'),now())`,[sid,student,academy,recipe,i]);
   if(i<7){const rid=`70000000-0000-4000-8000-${String(i).padStart(12,'0')}`,eid=`80000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
    await db.query(`INSERT INTO learning_records(id,student_id,academy_id,module_code,training_session_id,completed_at,created_at,record_origin,verification_status,skills,support_level,performance) VALUES($1,$2,$3,'finger_read',$4,now(),now(),'client_reported','client_reported','[]','unknown','{"total":10,"correct":8,"wrong":2}')`,[rid,student,academy,sid]);
    await db.query(`INSERT INTO learning_evidence(id,student_id,academy_id,learning_record_id,observed_at,verification_status,verification_authority,payload,support_level) VALUES($1,$2,$3,$4,now(),'server_verified','v04_qa_server_answer_evaluator:v1','{"total":10,"correct":8,"wrong":2}','unknown')`,[eid,student,academy,rid]);
   }
   if(i<2)for(let j=0;j<10;j++)await db.query(`INSERT INTO question_attempts(id,student_id,academy_id,module_code,training_session_id,metadata,is_correct,error_type,created_at,total_response_time_ms,error_detail) VALUES($1,$2,$3,'finger_read',$4,'{"attemptType":"PRIMARY"}',$5,$6,now(),300,'safe result')`,[`90000000-0000-4000-8000-${String(i*10+j).padStart(12,'0')}`,student,academy,sid,j<8,j<8?'OK':'RESPONSE_ERROR']);
  }
  const before=await fingerprint(db);
  const aclBefore=(await db.query(`SELECT p.oid,pg_get_functiondef(p.oid) def,p.proacl::text acl,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'cza_%' ORDER BY p.oid`)).rows;
  await db.exec('SET ROLE cza_v01_app_runtime_min');
  assert.equal((await db.query('SELECT count(*) n FROM training_sessions')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*) n FROM question_attempts')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*) n FROM learning_records')).rows[0].n,7);
  assert.equal((await db.query('SELECT count(*) n FROM learning_records r JOIN training_sessions s ON s.id=r.training_session_id')).rows[0].n,0);
  await db.exec('SET ROLE cza_t5_test_owner');
  await db.exec(migration.replaceAll("'cza_t5_synthetic'","'postgres'"));
  const aclAfter=(await db.query(`SELECT p.oid,pg_get_functiondef(p.oid) def,p.proacl::text acl,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'cza_%' AND p.proname<>'cza_a_demo_02_read' ORDER BY p.oid`)).rows;
  assert.deepEqual(aclAfter,aclBefore);
  await db.exec('SET ROLE cza_v01_app_runtime_min');
  const read=async(op,input,token=hash)=>(await db.query('SELECT public.cza_a_demo_02_read($1,$2,$3::jsonb) rows',[token,op,JSON.stringify(input)])).rows[0].rows;
  const timeline=await read('timeline',{filters,cursor:null,limit:50});
  assert.equal(timeline.filter(e=>e.event_type==='LEARNING_RESULT').length,7);
  assert.equal(timeline.filter(e=>e.event_type==='SKILL_EVIDENCE').length,7);
  assert.ok(timeline.every(e=>e.student_id===student));
  assert.equal(timeline.find(e=>e.event_type==='LEARNING_RESULT').verification_status,'client_reported');
  assert.equal(timeline.find(e=>e.event_type==='SKILL_EVIDENCE').verification_status,'server_verified');
  assert.ok(timeline.every(e=>e.source_reference));
  const page1=await read('timeline',{filters,cursor:null,limit:2});assert.equal(page1.length,3);
  const cursor={occurredAt:page1[1].occurred_at,eventId:page1[1].event_id};
  const page2=await read('timeline',{filters,cursor,limit:2});assert.ok(page2.every(e=>!page1.slice(0,2).some(x=>x.event_id===e.event_id)));
  const records=await read('timeline',{filters:{...filters,eventType:'LEARNING_RESULT'},cursor:null,limit:50});assert.equal(records.length,7);
  assert.deepEqual(await read('timeline',{filters:{...filters,moduleCode:'nonexistent'},cursor:null,limit:20}),[]);
  const completed=await read('completed_results',{sessionId:null});assert.equal(completed.length,2);
  assert.ok(completed.every(r=>r.attempt_count===10&&r.correct_count===8&&r.records.length===1));
  assert.equal(completed.reduce((n,r)=>n+r.attempt_count,0),20);
  assert.equal(completed.reduce((n,r)=>n+r.correct_count,0),16);
  for(const sid of sessionIds)assert.equal((await read('completed_results',{sessionId:sid}))[0].session_id,sid);
  assert.deepEqual(await read('completed_results',{sessionId:'50000000-0000-4000-8000-000000000002'}),[]);
  assert.deepEqual(await read('completed_results',{sessionId:'00000000-0000-4000-8000-000000000000'}),[]);
  for(const input of [{studentId:student},{academyId:academy},{sessionId:null,sql:'SELECT * FROM users'}])await assert.rejects(read('completed_results',input),/scope_rejected/);
  await assert.rejects(read('timeline',{filters,cursor:null,limit:51}),/scope_rejected/);
  await assert.rejects(read('timeline',{filters,cursor:{occurredAt:'2026-10-12T00:00:00Z',eventId:'forged'},limit:20}),/scope_rejected/);
  await assert.rejects(read('completed_results',{},'0'.repeat(64)),/session_rejected/);
  await assert.rejects(read('arbitrary_sql',{}),/scope_rejected/);
  assert.doesNotMatch(JSON.stringify(completed),/FOREIGN SECRET|target_number|response_payload|settings|instructions/);
  assert.equal((await db.query('SELECT count(*) n FROM training_sessions')).rows[0].n,0);
  await db.exec('SET ROLE cza_t5_test_owner');assert.deepEqual(await fingerprint(db),before);
  const newAcl=(await db.query(`SELECT p.proacl::text acl,has_function_privilege('cza_v01_app_runtime_min',p.oid,'EXECUTE') execute FROM pg_proc p WHERE p.proname='cza_a_demo_02_read'`)).rows[0];assert.equal(newAcl.execute,true);assert.doesNotMatch(newAcl.acl,/(?:\{|,)=X/);
  for(const [table,col,value]of [['student_sessions','revoked_at','now()'],['student_sessions','expires_at',"now()-interval '1 hour'"],['students','status',"'inactive'"],['students','is_demo','false'],['users','is_active','false'],['users','role',"'teacher'"],['student_sessions','academy_id',"'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"]]){
   await db.exec(`BEGIN;UPDATE ${table} SET ${col}=${value};SET LOCAL ROLE cza_v01_app_runtime_min`);
   await assert.rejects(read('completed_results',{}),/session_rejected/);await db.exec('ROLLBACK');
  }
  // A genuine empty student fixture is local only; no live QA identity is created or reset.
  await db.exec('BEGIN;DELETE FROM learning_evidence;DELETE FROM learning_records;DELETE FROM question_attempts;DELETE FROM training_sessions;DELETE FROM training_recipes;SET LOCAL ROLE cza_v01_app_runtime_min');
  assert.deepEqual(await read('timeline',{filters,cursor:null,limit:20}),[]);assert.deepEqual(await read('completed_results',{}),[]);await db.exec('ROLLBACK');
  await db.exec(fs.readFileSync('db/qa/a-demo-02-read.rollback.review.sql','utf8').replaceAll("'cza_t5_synthetic'","'postgres'"));
  assert.deepEqual(await fingerprint(db),before);await db.exec('SET ROLE cza_v01_app_runtime_min');await assert.rejects(read('completed_results',{}),/permission denied/);
 }finally{await db.close();}
});
