import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
// oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript route harness, never user input
function load(path,mocks){const m={exports:{}};new Function('require','module','exports','process','Buffer',transpile(fs.readFileSync(path,'utf8')))(id=>{if(id in mocks)return mocks[id];throw Error(id);},m,m.exports,{env:{DATABASE_URL:'local-test-only',CZA_TIMELINE_CURSOR_SECRET:'local-only-long-cursor-secret-32-bytes'}},Buffer);return m.exports;}
const result=load('lib/student-work-result.ts',{}),timeline=load('lib/persistence/learning-timeline.ts',{'node:crypto':crypto});
const student={student_id:'20000000-0000-4000-8000-000000000001',academy_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
const sid='40000004-0000-4000-8000-000000000091';
const row={session_id:sid,assignment_id:'361ee0f6-26e2-4484-b9f9-7a88d14fb9f4',assignment_title:'QA',module_code:'finger_read',module_name:'Parmak Okuma',started_at:'2026-10-12T18:30:00Z',completed_at:'2026-10-12T18:39:00Z',attempt_count:10,correct_count:8,records:[{recordId:'f43257d1-6609-4f6f-99a6-bc5025879240',recordOrigin:'client_reported',verificationStatus:'client_reported',evidenceId:'b95c3b27-9e10-4a64-9bf2-6e4174fbedc1',evidenceVerificationStatus:'server_verified',verificationAuthority:'v04_qa_server_answer_evaluator:v1'}],target_number:'PRIVATE',instructions:'TEACHER ONLY'};
function route({auth=student,rows=[row],qa=true,fail=null}={}){
 const calls=[];const read=async(...args)=>{calls.push(args);if(fail)throw new Error(fail);return rows;};
 const mod=load('app/api/core/work-results/route.ts',{'@neondatabase/serverless':{neon:()=>({query:read})},'@/lib/student-session':{authenticatedStudent:async()=>auth},'@/lib/isolated-qa-auth':{isolatedQaEnabled:()=>qa},'@/lib/qa-demo-read':{qaDemoRead:read,demoReadDenied:e=>e.message==='demo_read_session_rejected'},'@/lib/request-guard':{allowRequest:async()=>({allowed:true})},'@/lib/student-work-result':result});return{get:mod.GET,calls};
}
const req=suffix=>new Request('https://qa.test/api/core/work-results'+suffix);
void test('results API enforces auth/identity, malformed/foreign ids and never returns answer keys',async()=>{
 let r=route({auth:null});assert.equal((await r.get(req(''))).status,401);assert.equal(r.calls.length,0);
 for(const q of ['?studentId=foreign','?academyId=foreign']){r=route();assert.equal((await r.get(req(q))).status,403);assert.equal(r.calls.length,0);}
 r=route();assert.equal((await r.get(req('?sessionId=invalid'))).status,404);
 r=route({rows:[]});assert.equal((await r.get(req('?sessionId='+sid))).status,404);
 r=route();const response=await r.get(req('?sessionId='+sid)),data=await response.json();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual([data.results[0].total,data.results[0].correct,data.results[0].wrong],[10,8,2]);assert.doesNotMatch(JSON.stringify(data),/PRIVATE|TEACHER ONLY|target_number|instructions/);
 assert.equal(r.calls[0][1],'completed_results');assert.deepEqual(r.calls[0][2],{sessionId:sid});
 r=route({qa:false});assert.equal((await r.get(req('?sessionId='+sid))).status,200);assert.deepEqual(r.calls[0][1],[student.academy_id,student.student_id,sid]);
});
void test('read errors fail closed, do not return fake empty success; genuinely empty results remain empty',async()=>{
 for(const[fail,status]of[['missing function',503],['demo_read_session_rejected',403]]){const r=route({fail});assert.equal((await r.get(req(''))).status,status);}
 const r=route({rows:[]});assert.deepEqual(await(await r.get(req(''))).json(),{ok:true,results:[]});
 assert.throws(()=>result.mapWorkResult({...row,correct_count:11}),/invalid/);
});
void test('timeline injected readonly projection keeps canonical mapping/pagination; blocked read is an error',async()=>{
 const input=timeline.parseTimelineRequest(new URL('https://qa.test/api/core/history?module=finger_read&eventType=LEARNING_RESULT'));
 const base={sql:{query:()=>{throw Error('direct RLS query must not run');}},academyId:student.academy_id,studentId:student.student_id,...input};
 let received;
 const out=await timeline.readLearningTimeline({...base,readRows:async x=>{received=x;return[{event_id:'record:'+sid,student_id:student.student_id,occurred_at:'2026-10-12T18:39:00Z',event_type:'LEARNING_RESULT',module_code:'finger_read',learning_record_id:sid,title:'Parmak Okuma',status:'completed',result_summary:{total:10,correct:8,wrong:2},provenance:'client_reported',verification_status:'client_reported',source_reference:'learning_records'}];}});
 assert.equal(out.events[0].verificationStatus,'client_reported');assert.equal(out.events[0].sourceReference,'learning_records');assert.equal(received.filters.moduleCode,'finger_read');assert.equal(received.cursor,null);
 await assert.rejects(timeline.readLearningTimeline({...base,readRows:async()=>{throw Error('read_forbidden');}}),/read_forbidden/);
 assert.deepEqual((await timeline.readLearningTimeline({...base,readRows:async()=>[]})).events,[]);
});
