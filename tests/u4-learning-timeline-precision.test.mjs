/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const source=fs.readFileSync(new URL('../lib/persistence/learning-timeline.ts',import.meta.url),'utf8');
const commonJsModule={exports:{}};
// oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript harness.
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>crypto,commonJsModule,commonJsModule.exports);
const timeline=commonJsModule.exports;
const student='20000000-0000-4000-8000-000000000001';
const academy='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const filters={from:null,to:null,moduleCode:null,eventType:null,verificationStatus:null};
const secret='local-only-precision-regression-secret-32bytes';
const uuid=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function signed(payload){const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${encoded}.${crypto.createHmac('sha256',secret).update(encoded).digest('base64url')}`;}
test('Postgres Date and QA JSON keysets: old 20+7, exact 20+9, ties and >50 events',async()=>{
 const previous=process.env.CZA_TIMELINE_CURSOR_SECRET;process.env.CZA_TIMELINE_CURSOR_SECRET=secret;
 const db=new PGlite();
 try{
  assert.equal((await db.query("SELECT '2026-10-05T17:22:49.616239+03:00'::timestamptz = '2026-10-05T14:22:49.616239Z'::timestamptz AS same")).rows[0].same,true);
  await db.exec('CREATE TABLE timeline(event_id text,student_id uuid,academy_id uuid,occurred_at timestamptz,event_type text,source_reference text,result_summary jsonb);');
  for(let i=0;i<29;i++){
   const prefix=i===19?'session':i===20?'record':i===21?'evidence':i<6?'record':'session';
   const time=i<19?'2026-10-06T00:00:00.999999Z':i<22?'2026-10-05T14:22:49.616239Z':'2026-10-04T00:00:00.000001Z';
   await db.query('INSERT INTO timeline VALUES($1,$2,$3,$4,$5,$6,$7)',[`${prefix}:${uuid(i)}`,student,academy,time,prefix==='record'?'LEARNING_RESULT':prefix==='evidence'?'SKILL_EVIDENCE':'WORK_COMPLETED',prefix==='record'?'learning_records':prefix==='evidence'?'learning_evidence':'training_sessions',prefix==='record'?JSON.stringify({questionCount:10,correctCount:8,wrongCount:2}):null]);
  }
  // The complete canonical UNION is covered by u4-learning-timeline-postgres.test.mjs.
  // Execute this module's exact final projection, bind parameters, ORDER BY and keyset against real Postgres.
  const sql={query:async(text,params)=>{
   const suffix=text.slice(text.indexOf('SELECT *, to_char')).replace('FROM timeline','FROM timeline WHERE academy_id=$1::uuid AND student_id=$2::uuid').replace('WHERE (occurred_at','AND (occurred_at');
   const rows=(await db.query(suffix,params)).rows;
   if(rows.length)assert.ok(rows[0].occurred_at instanceof Date);
   return rows;
  }};
  const readRows=async({cursor,limit})=>{
   const params=[academy,student];if(cursor)params.push(cursor.occurredAt,cursor.eventId);params.push(limit+1);
   const result=await db.query(`SELECT jsonb_agg(to_jsonb(projected)) AS events FROM (SELECT * FROM timeline WHERE academy_id=$1::uuid AND student_id=$2::uuid ${cursor?'AND (occurred_at,event_id)<($3::timestamptz,$4::text)':''} ORDER BY occurred_at DESC,event_id DESC LIMIT $${params.length}) projected`,params);
   return result.rows[0].events||[];
  };
  const input={sql,academyId:academy,studentId:student,filters,limit:20,cursor:null};
  const first=await timeline.readLearningTimeline(input);
  assert.equal(first.events.at(-1).occurredAt,'2026-10-05T14:22:49.616239Z');
  assert.equal((await readRows({cursor:{occurredAt:'2026-10-05T14:22:49.616Z',eventId:first.events.at(-1).eventId},limit:20})).length,7);
  for(const path of [undefined,readRows]){
   const p1=await timeline.readLearningTimeline({...input,readRows:path});const p2=await timeline.readLearningTimeline({...input,readRows:path,cursor:p1.nextCursor});
   assert.equal(p1.events.length,20);assert.equal(p2.events.length,9);
   const events=[...p1.events,...p2.events];assert.equal(new Set(events.map(e=>e.eventId)).size,29);
   assert.equal(events.filter(e=>e.eventType==='LEARNING_RESULT').length,7);
   assert.ok(p2.events.some(e=>e.eventType==='LEARNING_RESULT'));assert.ok(p2.events.some(e=>e.eventType==='SKILL_EVIDENCE'));
   assert.deepEqual(events.filter(e=>e.eventType==='LEARNING_RESULT').slice(0,2).map(e=>e.resultSummary),Array(2).fill({questionCount:10,correctCount:8,wrongCount:2}));
   for(const limit of [1,2,20,50]){let cursor=null;const ids=[];do{const p=await timeline.readLearningTimeline({...input,readRows:path,limit,cursor});ids.push(...p.events.map(e=>e.eventId));cursor=p.nextCursor;}while(cursor);assert.deepEqual(ids,events.map(e=>e.eventId));}
  }
  await db.exec(`INSERT INTO timeline SELECT 'session:50000000-0000-4000-8000-'||lpad(i::text,12,'0'),'${student}','${academy}','2026-10-07Z'::timestamptz+(i%3)*interval '1 microsecond','WORK_COMPLETED','training_sessions',NULL FROM generate_series(1,55)i;`);
  for(const path of [undefined,readRows]){const all=await timeline.readLearningTimeline({...input,readRows:path,limit:100});let cursor=null;const ids=[];do{const p=await timeline.readLearningTimeline({...input,readRows:path,limit:20,cursor});ids.push(...p.events.map(e=>e.eventId));cursor=p.nextCursor;}while(cursor);assert.equal(ids.length,84);assert.equal(new Set(ids).size,84);assert.deepEqual(ids,all.events.map(e=>e.eventId));}
  assert.deepEqual((await timeline.readLearningTimeline({...input,academyId:uuid(99)})).events,[]);
  assert.deepEqual((await timeline.readLearningTimeline({...input,studentId:uuid(99)})).events,[]);
  await assert.rejects(timeline.readLearningTimeline({...input,sql:{query:async()=>{throw new Error('read_failed');}}}),/read_failed/);
  await assert.rejects(timeline.readLearningTimeline({...input,readRows:async()=>[{occurred_at:new Date()}]}),/timeline_corrupt_timestamp/);
 }finally{await db.close();if(previous===undefined)delete process.env.CZA_TIMELINE_CURSOR_SECRET;else process.env.CZA_TIMELINE_CURSOR_SECRET=previous;}
});
test('offset/JSON/HMAC precision, identity/filter scopes and old signed cursors',()=>{
 const previous=process.env.CZA_TIMELINE_CURSOR_SECRET;process.env.CZA_TIMELINE_CURSOR_SECRET=secret;
 try{
  for(const occurredAt of ['2026-10-05T14:22:49.000001Z','2026-10-05T17:22:49.616239+03:00','2026-10-05T09:22:49.999999-05:00']){
   const event={eventId:`record:${uuid(1)}`,occurredAt};const cursor=timeline.encodeTimelineCursor(JSON.parse(JSON.stringify(event)),student,filters);
   assert.equal(timeline.decodeTimelineCursor(cursor,student,filters).occurredAt,occurredAt);
   assert.throws(()=>timeline.decodeTimelineCursor(cursor,uuid(99),filters),/invalid_cursor/);
   for(const changed of [{from:'2026-10-01T00:00:00.000Z'},{to:'2026-10-09T00:00:00.000Z'},{moduleCode:'other'},{eventType:'LEARNING_RESULT'},{verificationStatus:'client_reported'}])assert.throws(()=>timeline.decodeTimelineCursor(cursor,student,{...filters,...changed}),/invalid_cursor/);
   assert.throws(()=>timeline.decodeTimelineCursor(cursor+'.extra',student,filters),/invalid_cursor/);
   assert.throws(()=>timeline.decodeTimelineCursor('x.'+cursor.split('.')[1],student,filters),/invalid_cursor/);
  }
  const scope=JSON.stringify([student,null,null,null,null,null]);
  assert.throws(()=>timeline.decodeTimelineCursor(signed({v:1,occurredAt:'2026-10-05T14:22:49.616Z',eventId:`session:${uuid(1)}`,scope}),student,filters),/invalid_cursor/);
  for(const payload of [[],{v:2},{v:1,occurredAt:'infinity',scope}])assert.throws(()=>timeline.decodeTimelineCursor(signed(payload),student,filters),/invalid_cursor/);
 }finally{if(previous===undefined)delete process.env.CZA_TIMELINE_CURSOR_SECRET;else process.env.CZA_TIMELINE_CURSOR_SECRET=previous;}
});
