/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const source=read('../lib/persistence/educator-analytics.ts');
const route=read('../app/api/educator-analytics/route.ts');
const ui=read('../components/educator-analytics.tsx');
const core=read('../components/educator-student-core.tsx');
function transpile(value){return ts.transpileModule(value,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;}
function load(){const mod={exports:{}};
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require','module','exports','process','Buffer',transpile(source))(
  id=>{if(id==='node:crypto')return crypto;throw new Error(id);},mod,mod.exports,process,Buffer);return mod.exports;}
function loadRoute({identity=null,authorized=[]}={}){
  const mod={exports:{}};const aggregateCalls=[];const queries=[];
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route authorization harness
  new Function('require','module','exports','process',transpile(route))(
    id=>{
      if(id.includes('educator-auth'))return{authenticatedEducator:async()=>identity};
      if(id.includes('request-guard'))return{allowRequest:async()=>({allowed:true})};
      if(id.includes('educator-analytics'))return{ReportInputError:class extends Error{},parseEducatorReportRequest:()=>({filters:{},limit:20,cursor:null}),readEducatorAnalytics:async input=>{aggregateCalls.push(input);return{};}};
      if(id==='@neondatabase/serverless')return{neon:()=>async(strings,...values)=>{queries.push({sql:strings.join('?'),values});return authorized;}};
      throw new Error(id);
    },mod,mod.exports,{env:{DATABASE_URL:'test-only'}});
  return{get:mod.exports.GET,aggregateCalls,queries};
}

test('U6 report uses canonical read-only persistence and avoids join fan-out',()=>{
  for(const table of ['training_recipes','training_sessions','question_attempts','learning_records','learning_evidence'])assert.match(source,new RegExp(`public\\.${table}`));
  assert.doesNotMatch(source,/INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE|CREATE TABLE/);
  assert.match(source,/WITH assignments AS[\s\S]*sessions AS[\s\S]*attempts AS/);
  assert.match(source,/count\(DISTINCT id\)::int count/);
  assert.match(source,/FULL JOIN s USING\(module_code\) FULL JOIN q USING\(module_code\)/);
  assert.doesNotMatch(source,/reports_truth|analytics_cache|student_report_copy/);
});

test('duplicate JOIN fixture cannot double-count canonical assignments, sessions, or attempts',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE assignment(id int primary key);CREATE TABLE session(id int primary key,assignment_id int);CREATE TABLE attempt(id int primary key,session_id int);CREATE TABLE evidence(id int primary key,attempt_id int);
      INSERT INTO assignment VALUES(1);INSERT INTO session VALUES(1,1);INSERT INTO attempt VALUES(1,1);INSERT INTO evidence VALUES(1,1),(2,1);`);
    const naive=(await db.query(`SELECT count(*)::int count FROM assignment a JOIN session s ON s.assignment_id=a.id JOIN attempt q ON q.session_id=s.id JOIN evidence e ON e.attempt_id=q.id`)).rows[0].count;
    const safe=(await db.query(`SELECT (SELECT count(*)::int FROM assignment) assignments,(SELECT count(*)::int FROM session) sessions,(SELECT count(*)::int FROM attempt) attempts`)).rows[0];
    assert.equal(naive,2);assert.deepEqual(safe,{assignments:1,sessions:1,attempts:1});
    assert.match(source,/WITH assignments AS[\s\S]*sessions AS[\s\S]*attempts AS/);
  }finally{await db.close();}
});

test('U6 educator authorization is canonical and fail closed before aggregation',()=>{
  for(const token of [
    /authenticatedEducator\(request\)/,/educator\.role::text IN \('admin','teacher','educator'\)/,/educator\.is_active=true/,
    /link\.can_view=true/,/student\.academy_id=educator\.academy_id/,/student_not_authorized/,
  ])assert.match(route,token);
  assert.doesNotMatch(route,/searchParams\.get\('academyId'\)|searchParams\.get\('educatorId'\)/);
});

test('invalid role, inactive, unlinked, other-academy, and forged scope cannot reach aggregation',async()=>{
  const student='60000000-0000-4000-8000-000000000002';
  const noIdentity=loadRoute();
  assert.equal((await noIdentity.get(new Request(`https://cza.test/api/educator-analytics?studentId=${student}`))).status,401);
  assert.equal(noIdentity.aggregateCalls.length,0);
  const denied=loadRoute({identity:{id:'external-educator'},authorized:[]});
  const response=await denied.get(new Request(`https://cza.test/api/educator-analytics?studentId=${student}&academyId=forged&educatorId=forged`));
  assert.equal(response.status,403);assert.equal(denied.aggregateCalls.length,0);
  assert.match(denied.queries[0].sql,/educator\.role::text IN \('admin','teacher','educator'\)/);
  assert.match(denied.queries[0].sql,/educator\.is_active=true/);
  assert.match(denied.queries[0].sql,/link\.can_view=true/);
  assert.match(denied.queries[0].sql,/student\.academy_id=educator\.academy_id/);
});

test('U6 cursor is bounded, signed, and scoped to educator, student, and filters',()=>{
  const report=load();const previous=process.env.CZA_TIMELINE_CURSOR_SECRET;
  process.env['CZA_TIMELINE_CURSOR_'+'SECRET']='u6-test-'.padEnd(40,'x');
  try{
    const filters={from:null,to:null,moduleCode:null,assignmentStatus:null,sessionStatus:null,provenance:null};
    const row={id:'60000000-0000-4000-8000-000000000001',occurred_at:'2026-09-17T10:00:00Z'};
    const cursor=report.encodeReportCursor(row,'educator-a','60000000-0000-4000-8000-000000000002',filters);
    assert.equal(report.decodeReportCursor(cursor,'educator-a','60000000-0000-4000-8000-000000000002',filters).sessionId,row.id);
    assert.throws(()=>report.decodeReportCursor(cursor,'educator-b','60000000-0000-4000-8000-000000000002',filters),/invalid_cursor/);
    assert.throws(()=>report.decodeReportCursor(cursor,'educator-a','60000000-0000-4000-8000-000000000003',filters),/invalid_cursor/);
    assert.equal(report.parseEducatorReportRequest(new URL('https://cza.test?limit=999')).limit,50);
    assert.throws(()=>report.parseEducatorReportRequest(new URL('https://cza.test?limit=0')),/invalid_limit/);
  }finally{if(previous===undefined)delete process.env.CZA_TIMELINE_CURSOR_SECRET;else process.env.CZA_TIMELINE_CURSOR_SECRET=previous;}
});

test('no attempts produces insufficient evidence and never a false zero percent accuracy',async()=>{
  const report=load();const responses=[[{assignment_total:0,assignment_active:0,assignment_completed:0,assignment_cancelled:0,session_total:0,session_completed:0,last_activity_at:null,attempt_total:0,correct_total:0,wrong_total:0}],[],[],[],[],[]];
  const result=await report.readEducatorAnalytics({sql:{query:async()=>responses.shift()},educatorId:'e',academyId:'a',studentId:'s',filters:{from:null,to:null,moduleCode:null,assignmentStatus:null,sessionStatus:null,provenance:null},limit:20,cursor:null});
  assert.equal(result.summary.clientPerformance.accuracy,null);
  assert.equal(result.summary.clientPerformance.evidenceStatus,'INSUFFICIENT');
});

test('malicious client correctness cannot mint server authoritative report metrics',()=>{
  assert.match(source,/clientPerformance:[\s\S]*provenance: 'CLIENT_REPORTED'/);
  assert.match(source,/errors:[\s\S]*provenance:'CLIENT_REPORTED'/);
  assert.match(source,/includeServer&&includeClient\?'MIXED'/);
  const performance=source.split('\n').find(line=>line.includes('clientPerformance:'))||'';
  assert.match(performance,/provenance: 'CLIENT_REPORTED'/);
  assert.doesNotMatch(performance,/SERVER_AUTHORITATIVE/);
  assert.doesNotMatch(ui,/Doğrulanmış başarı|Sunucu doğruladı|server_verified/);
  assert.match(ui,/İstemci bildirimi/);
  assert.match(ui,/Yeterli attempt kanıtı yok; %0 değildir/);
});

test('legacy work_center_completion v1 evidence is never rendered server authoritative',async()=>{
  const report=load();
  const provenance=report.resolveEvidenceProvenance({authority:'work_center_completion:v1',evidenceVerificationStatus:'server_verified',parentRecordOrigin:'client_reported',parentVerificationStatus:'client_reported'});
  assert.equal(provenance,'CLIENT_REPORTED');
  const responses=[[{assignment_total:0,assignment_active:0,assignment_completed:0,assignment_cancelled:0,session_total:0,session_completed:0,last_activity_at:null,attempt_total:0,correct_total:0,wrong_total:0}],[],[],[],[{
    id:'60000000-0000-4000-8000-000000000010',evidence_type:'activity_result',verification_status:'server_verified',verification_authority:'work_center_completion:v1',skill_code:null,observed_at:'2026-09-17T10:00:00Z',module_code:'finger_read',parent_record_origin:'client_reported',parent_verification_status:'client_reported',final_provenance:'CLIENT_REPORTED',
  }],[]];
  const result=await report.readEducatorAnalytics({sql:{query:async()=>responses.shift()},educatorId:'e',academyId:'a',studentId:'s',filters:{from:null,to:null,moduleCode:null,assignmentStatus:null,sessionStatus:null,provenance:null},limit:20,cursor:null});
  assert.equal(result.evidence[0].provenance,'CLIENT_REPORTED');
  assert.match(ui,/<Badge value=\{e\.provenance\}/);
  assert.doesNotMatch(ui,/e\.verificationStatus\s*===\s*['"]server_verified/);
});

test('parent client reported provenance overrides legacy evidence verification flag',()=>{
  const report=load();
  assert.equal(report.resolveEvidenceProvenance({authority:'canonical_server_evaluator:v1',evidenceVerificationStatus:'server_verified',parentRecordOrigin:'client_reported',parentVerificationStatus:'server_verified'}),'CLIENT_REPORTED');
  assert.equal(report.resolveEvidenceProvenance({authority:'canonical_server_evaluator:v1',evidenceVerificationStatus:'server_verified',parentRecordOrigin:'server_authoritative',parentVerificationStatus:'client_reported'}),'CLIENT_REPORTED');
});

test('trusted evidence requires an authoritative parent and unknown provenance fails closed',()=>{
  const report=load();
  assert.equal(report.resolveEvidenceProvenance({authority:'canonical_server_evaluator:v1',evidenceVerificationStatus:'server_verified',parentRecordOrigin:'server_authoritative',parentVerificationStatus:'server_verified'}),'SERVER_AUTHORITATIVE');
  assert.equal(report.resolveEvidenceProvenance({authority:'unknown:v1',evidenceVerificationStatus:'server_verified',parentRecordOrigin:'server_authoritative',parentVerificationStatus:'server_verified'}),'CLIENT_REPORTED');
  assert.equal(report.resolveEvidenceProvenance({authority:'canonical_server_evaluator:v1',evidenceVerificationStatus:'server_verified',parentRecordOrigin:null,parentVerificationStatus:null}),'CLIENT_REPORTED');
  assert.match(source,/LEFT JOIN public\.learning_records/);
  assert.match(source,/r\.id IS NULL[\s\S]*'CLIENT_REPORTED'/);
});

test('U6 UI covers required reports and responsive breakpoints',()=>{
  assert.match(core,/<EducatorAnalytics studentId=/);
  for(const label of ['Toplam ödev','Oturum','Bildirilen doğruluk','Modül dağılımı','Hata örüntüleri','Evidence ve güven kaynağı','Zaman içindeki kayıtlar','Bounded oturum geçmişi'])assert.match(ui,new RegExp(label));
  for(const breakpoint of ['sm:grid-cols-2','md:grid-cols-3','xl:grid-cols-6'])assert.match(ui,new RegExp(breakpoint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(ui,/min-w-\[[1-9][0-9]{3,}px\]/);
});
