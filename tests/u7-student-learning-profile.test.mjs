/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const profileSource=read('../lib/persistence/student-learning-profile.ts');
const studentRoute=read('../app/api/core/learning-profile/route.ts');
const educatorRoute=read('../app/api/educator-learning-profile/route.ts');
const ui=read('../components/student-learning-profile.tsx');
const studentUi=read('../components/student-dashboard.tsx');
const educatorUi=read('../components/educator-student-core.tsx');
function transpile(value){return ts.transpileModule(value,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;}

function loadProfile(){const mod={exports:{}};
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require','module','exports',transpile(profileSource))(
    id=>{if(id.includes('educator-analytics'))return{resolveEvidenceProvenance:({authority,parentRecordOrigin,parentVerificationStatus,evidenceVerificationStatus})=>authority==='canonical_server_evaluator:v1'&&parentRecordOrigin==='server_authoritative'&&parentVerificationStatus==='server_verified'&&evidenceVerificationStatus==='server_verified'?'SERVER_AUTHORITATIVE':'CLIENT_REPORTED'};throw new Error(id);},mod,mod.exports);return mod.exports;}

function loadRoute(source,{student=null,educator=null,authorized=[],profile={student:{id:'s'}}}={}){const mod={exports:{}};const calls=[];const queries=[];
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route authorization harness
  new Function('require','module','exports','process',transpile(source))(
    id=>{
      if(id.includes('student-session'))return{authenticatedStudent:async()=>student};
      if(id.includes('educator-auth'))return{authenticatedEducator:async()=>educator};
      if(id.includes('request-guard'))return{allowRequest:async()=>({allowed:true})};
      if(id.includes('student-learning-profile'))return{readStudentLearningProfile:async input=>{calls.push(input);return profile;}};
      if(id.includes('coaching-center'))return{readCoachingProfileBridge:async()=>({activePrograms:0,publishedPlans:0,studyLogs:0,examResults:0,performanceProvenance:'CLIENT_REPORTED'})};
      if(id==='@neondatabase/serverless')return{neon:()=>{const sql=async(strings,...values)=>{queries.push({sql:strings.join('?'),values});return authorized;};sql.query=async()=>[];return sql;}};
      throw new Error(id);
    },mod,mod.exports,{env:{DATABASE_URL:'test-only'}});return{get:mod.exports.GET,calls,queries};}

test('U7 reuses one canonical read-only profile projection without a parallel store',()=>{
  for(const table of ['students','training_recipes','training_sessions','question_attempts','learning_records','learning_evidence'])assert.match(profileSource,new RegExp(`public\\.${table}`));
  assert.match(profileSource,/resolveEvidenceProvenance/);
  assert.doesNotMatch(profileSource,/function resolveEvidenceProvenance|INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE|CREATE TABLE/);
  assert.doesNotMatch(profileSource,/learning_profile_cache|student_profile_history|profile_snapshot/);
  assert.match(studentUi,/<StudentLearningProfile endpoint="\/api\/core\/learning-profile" audience="student"/);
  assert.match(educatorUi,/<StudentLearningProfile endpoint=\{`\/api\/educator-learning-profile/);
});

test('student identity is session-owned and forged student id is ignored',async()=>{
  const denied=loadRoute(studentRoute);assert.equal((await denied.get(new Request('https://cza.test/api/core/learning-profile?studentId=forged'))).status,401);assert.equal(denied.calls.length,0);
  const own=loadRoute(studentRoute,{student:{student_id:'10000000-0000-4000-8000-000000000001',academy_id:'10000000-0000-4000-8000-000000000002',student_user_id:'u',session_id:'x'}});
  assert.equal((await own.get(new Request('https://cza.test/api/core/learning-profile?studentId=20000000-0000-4000-8000-000000000001'))).status,200);
  assert.equal(own.calls[0].studentId,'10000000-0000-4000-8000-000000000001');
});

test('educator learning profile requires canonical educator role, academy and can_view link',async()=>{
  const studentId='10000000-0000-4000-8000-000000000001';
  const studentRole=loadRoute(educatorRoute);assert.equal((await studentRole.get(new Request(`https://cza.test/api/educator-learning-profile?studentId=${studentId}`))).status,401);
  const denied=loadRoute(educatorRoute,{educator:{id:'external'},authorized:[]});assert.equal((await denied.get(new Request(`https://cza.test/api/educator-learning-profile?studentId=${studentId}`))).status,403);assert.equal(denied.calls.length,0);
  for(const rule of [/educator\.role::text IN \('admin','teacher','educator'\)/,/educator\.is_active=true/,/link\.can_view=true/,/student\.academy_id=educator\.academy_id/])assert.match(denied.queries[0].sql,rule);
  const allowed=loadRoute(educatorRoute,{educator:{id:'external'},authorized:[{academy_id:'10000000-0000-4000-8000-000000000002'}]});assert.equal((await allowed.get(new Request(`https://cza.test/api/educator-learning-profile?studentId=${studentId}`))).status,200);assert.equal(allowed.calls.length,1);
});

test('legacy and parent client provenance stay client reported while trusted fixture survives',async()=>{
  const profile=loadProfile();const base=[{id:'s',name:'Demo Student',recorded_from:'2026-09-01T00:00:00Z'}];
  const coverage=[{assignments:1,sessions:1,attempts:1,records:1,evidence:1,active_assignments:0,completed_assignments:1,cancelled_assignments:0,completed_sessions:1,active_days_30:1,last_study_at:'2026-09-17T10:00:00Z',data_through:'2026-09-17T10:00:00Z'}];
  const moduleRows=[];const errors=[];const support=[];const periods=[];
  for(const fixture of [
    {skill_code:'legacy',module_code:'finger_read',record_count:1,source_references:['e1'],has_client:true,all_trusted:false,expected:'CLIENT_REPORTED'},
    {skill_code:'parent-client',module_code:'finger_read',record_count:1,source_references:['e2'],has_client:true,all_trusted:false,expected:'CLIENT_REPORTED'},
    {skill_code:'trusted',module_code:'finger_read',record_count:1,source_references:['e3'],has_client:false,all_trusted:true,expected:'SERVER_AUTHORITATIVE'},
    {skill_code:'unknown',module_code:'finger_read',record_count:1,source_references:['e4'],has_client:false,all_trusted:false,expected:'CLIENT_REPORTED'},
  ]){
    const responses=[base,coverage,moduleRows,[fixture],errors,support,periods,[]];
    const result=await profile.readStudentLearningProfile({sql:{query:async()=>responses.shift()},academyId:'a',studentId:'s',calculatedAt:new Date('2026-09-17T12:00:00Z')});
    assert.equal(result.skills[0].provenance,fixture.expected);
  }
});

test('forged correctness remains client reported and empty history is never false zero',async()=>{
  const profile=loadProfile();const responses=[[{id:'s',name:'Empty',recorded_from:null}],[{assignments:0,sessions:0,attempts:0,records:0,evidence:0,active_assignments:0,completed_assignments:0,cancelled_assignments:0,completed_sessions:0,active_days_30:0,last_study_at:null,data_through:null}],
    [{module_code:'finger_read',module_name:'Parmak',assignments:0,sessions:0,records:1,client_records:1,trusted_records:0,attempts:0,correct:0,source_references:['learning_records']}],[],[],[],[{label:'LAST_30_DAYS',from_at:'2026-08-18T00:00:00Z',to_at:'2026-09-17T00:00:00Z',sessions:0,records:1,client_records:1,trusted_records:0,attempts:0,correct:0}],[]];
  const result=await profile.readStudentLearningProfile({sql:{query:async()=>responses.shift()},academyId:'a',studentId:'s',calculatedAt:new Date('2026-09-17T00:00:00Z')});
  assert.equal(result.modules[0].clientReportedAccuracy,null);assert.equal(result.periods[0].clientReportedAccuracy,null);
  assert.equal(result.modules[0].provenance,'CLIENT_REPORTED');assert.equal(result.periods[0].provenance,'CLIENT_REPORTED');
  assert.match(ui,/Yeterli kayıt yok/);assert.match(ui,/başarı %0 değildir/);assert.match(ui,/İstemci bildirimi/);
  assert.doesNotMatch(ui,/Doğrulanmış başarı|verifiedAccuracy|serverVerifiedAccuracy/);
});

test('independent scalar aggregates prevent join multiplication',async()=>{const db=new PGlite();try{
  await db.exec('CREATE TABLE assignment(id int primary key);CREATE TABLE session(id int primary key);CREATE TABLE attempt(id int primary key);CREATE TABLE evidence(id int primary key);INSERT INTO assignment VALUES(1);INSERT INTO session VALUES(1);INSERT INTO attempt VALUES(1);INSERT INTO evidence VALUES(1),(2);');
  const safe=(await db.query('SELECT (SELECT count(*)::int FROM assignment) assignments,(SELECT count(*)::int FROM session) sessions,(SELECT count(*)::int FROM attempt) attempts,(SELECT count(*)::int FROM evidence) evidence')).rows[0];
  assert.deepEqual(safe,{assignments:1,sessions:1,attempts:1,evidence:2});assert.match(profileSource,/\(SELECT count\(\*\)::int FROM public\.training_recipes/);
}finally{await db.close();}});

test('profile rendering is responsive, bounded, traceable and does not reinterpret raw verification flags',()=>{
  for(const breakpoint of ['sm:grid-cols-2','lg:grid-cols-5','xl:grid-cols-2'])assert.match(ui,new RegExp(breakpoint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(profileSource,/\[1:5\] source_references/);assert.match(profileSource,/LIMIT 24/);assert.match(profileSource,/LIMIT 12/);
  assert.match(ui,/<Badge value=\{skill\.provenance\}/);assert.doesNotMatch(ui,/verificationStatus\s*===\s*['"]server_verified/);
  assert.match(ui,/profile\.recentRecords\.map/);assert.match(ui,/record\.sessionId/);assert.match(ui,/record\.recordId/);assert.match(ui,/record\.evidenceId/);
  assert.match(ui,/record\.recordVerification/);assert.match(ui,/record\.evidenceVerification/);assert.match(ui,/record\.provenance/);
  assert.doesNotMatch(ui,/min-w-\[[1-9][0-9]{3,}px\]/);
});
