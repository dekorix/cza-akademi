// TEST ONLY: real disposable PostgreSQL + Miniflare. No live environment access.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {Miniflare,bundle,sourceGuards} from './worker-harness.mjs';
import {setup,fingerprint,uuid,student,academy,subject} from './local-fixture.mjs';
if(process.env.BROKER_TEST_POSTGRES!=='local'||!process.env.BROKER_TEST_PG_PORT)throw Error('Explicit disposable local database required');
const connect=user=>postgres({host:'127.0.0.1',port:Number(process.env.BROKER_TEST_PG_PORT),database:'broker_test',username:user,max:1,connect_timeout:5});
const admin=connect('postgres');let brokerDb,normalDb,publicDb,mf;
const origin='https://qa.local.invalid';
const providerCookie=fs.readFileSync('lib/educator-neon-ingress.ts','utf8').match(/export const NEON_EDUCATOR_COOKIE = '([^']+)'/)[1];
const checks=[];let providerCalls=0,rateCount=0,outage=false,providerRevoked=false,raceRevoke=false;const trace=[],latencies=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const json=(body,status=200)=>Response.json(body,{status});
try {
 const [target]=await admin`SELECT current_database() AS name,version() AS version`;assert.equal(target.name,'broker_test');assert.match(target.version,/PostgreSQL 17/);
 await setup(admin);brokerDb=connect('mock_broker');normalDb=connect('mock_runtime');publicDb=connect('mock_public');
 await brokerDb.unsafe("SET neon.project_id='mock-project';SET neon.branch_id='mock-branch'");
 const before=await fingerprint(admin);
 const provider=async request=>{
  providerCalls++;let token=request.headers.get('cookie')?.split('=')[1];
  if(token==='slow'){await new Promise(resolve=>setTimeout(resolve,6000));token='valid';}
  if(token==='outage')return new Response(null,{status:503});
  if(!token||['revoked','unknown','missing'].includes(token)||(token==='valid'&&providerRevoked))return json(null);
  return json({user:{id:subject(token)},session:{userId:subject(token),expiresAt:new Date(Date.now()+(token==='expired'?-1000:60000)).toISOString()}});
 };
 const TEST_RATE=async()=>{if(raceRevoke)providerRevoked=true;return json({allowed:++rateCount<=60,retryAfterSeconds:1});};
 const TEST_DATABASE=async request=>{
  try {
   assert.equal(request.headers.has('cookie'),false);assert.equal(request.headers.has('authorization'),false);
   const input=await request.json();assert.equal(input.options.readOnly,true);trace.push({readOnly:true,credentialForwarded:false});
   if(outage)return json({code:'CONNECTION_CLOSED'},503);
   const start=Date.now();const results=await brokerDb.begin('read only',async tx=>{
    const out=[];for(const q of input.queries){assert.match(q.text,/^SELECT qa_broker_private\.educator_history/);assert.equal(q.params.length,5);const text=q.text.replace('$3::jsonb','$3::text::jsonb').replace('$4::jsonb','$4::text::jsonb');out.push(await tx.unsafe(text,q.params));}return out;
   });latencies.push(Date.now()-start);return json({results});
  } catch(error){return json({code:error.code||'CONNECTION_FAILED'},503);}
 };
 const requestMac=randomBytes(32).toString('base64url');
 const protocolDir=fs.mkdtempSync(path.join(os.tmpdir(),'broker-protocol-'));
 const protocolPath=path.join(protocolDir,'protocol.mjs');
 fs.writeFileSync(protocolPath,await bundle('lib/qa-educator-broker-protocol.ts'));
 const protocol=await import(pathToFileURL(protocolPath).href);
 const ingressScript=await bundle('app/api/educator-student-history/route.ts',{mock:true});
 const brokerScript=await bundle('workers/qa-educator-broker/index.ts',{mock:true});
 assert.match(brokerScript,/BrokerNonceLedger/);
 const brokerBindings={BROKER_DATABASE_URL:'LOCAL_TEST_ONLY',QA_BROKER_STUDENT_ID:student,QA_BROKER_ACADEMY_ID:academy,QA_BROKER_PROJECT_ID:'mock-project',QA_BROKER_BRANCH_ID:'mock-branch',QA_BROKER_DATABASE:'broker_test',QA_BROKER_ROLE:'mock_broker',QA_BROKER_REQUEST_HMAC_SECRET:requestMac};
 const ingressBindings={CZA_NEON_AUTH_BASE_URL:'https://provider.local.invalid/auth',QA_BROKER_STUDENT_ID:student,QA_BROKER_ACADEMY_ID:academy,CZA_TIMELINE_CURSOR_SECRET:'LOCAL_MOCK_CURSOR_MATERIAL_32_BYTES_LONG',QA_BROKER_REQUEST_HMAC_SECRET:requestMac};
 const brokerIsolate={modules:true,script:brokerScript,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:brokerBindings,durableObjects:{BROKER_NONCE_LEDGER:'BrokerNonceLedger'},serviceBindings:{TEST_DATABASE}};
 const options={host:'127.0.0.1',port:0,workers:[{name:'mock-ingress',modules:true,script:ingressScript,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:ingressBindings,serviceBindings:{QA_EDUCATOR_HISTORY_BROKER:'mock-private-broker',TEST_RATE},outboundService:provider},{name:'mock-private-broker',...brokerIsolate}]};
 mf=new Miniflare(options);
 const fetchArgs=r=>[r.url,{method:r.method,headers:Object.fromEntries(r.headers)}];
 const request=(token='valid',suffix='',headers={})=>new Request(origin+'/api/educator-student-history?studentId='+student+suffix,{headers:{cookie:providerCookie+'='+token,...headers}});
 const read=async(token='valid',suffix='',headers={})=>{rateCount=0;const r=await mf.dispatchFetch(...fetchArgs(request(token,suffix,headers)));return{status:r.status,body:await r.json()};};
 const filters={from:null,to:null,moduleCode:null,eventType:null,verificationStatus:null};
 const seal=(overrides={})=>protocol.sealBrokerRequest(requestMac,{subject:subject('valid'),studentId:student,academyId:academy,ts:Date.now(),filters,cursor:null,limit:20,...overrides});
 const postBroker=async body=>(await mf.getWorker('mock-private-broker')).fetch('https://broker.invalid/history',{method:'POST',body});
 const assertClosed=async(response,status)=>{const text=await response.text();assert.equal(response.status,status);assert.deepEqual(JSON.parse(text),{error:'broker_read_failed'});for(const word of [student,subject('valid'),'hmac','nonce','signature','replay','expired'])assert.equal(text.toLowerCase().includes(word.toLowerCase()),false);assert.equal(Object.hasOwn(JSON.parse(text),'rows'),false);};
 await check('actual private binding and PostgreSQL authorized20+9=29',async()=>{const a=await read();assert.equal(a.status,200);assert.equal(a.body.timeline.events.length,20);assert.match(a.body.timeline.events.at(-1).occurredAt,/\.616239/);const b=await read('valid','&cursor='+encodeURIComponent(a.body.timeline.nextCursor));assert.equal(b.status,200);assert.equal(b.body.timeline.events.length,9);const events=[...a.body.timeline.events,...b.body.timeline.events];assert.equal(new Set(events.map(e=>e.eventId)).size,29);assert.equal(events.filter(e=>e.eventType==='LEARNING_RESULT').length,7);assert.equal(events.filter(e=>e.eventType==='SKILL_EVIDENCE').length,7);});
 for(const limit of [1,2,20,50])await check('lossless ordered keyset limit '+limit,async()=>{const expected=await read('valid','&limit=50');let cursor=null;const ids=[];do{const r=await read('valid','&limit='+limit+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(r.status,200);ids.push(...r.body.timeline.events.map(e=>e.eventId));cursor=r.body.timeline.nextCursor;}while(cursor);assert.deepEqual(ids,expected.body.timeline.events.map(e=>e.eventId));assert.equal(new Set(ids).size,29);});
 await check('two persisted local10/8/2 results',async()=>{const rows=await admin`SELECT training_session_id,count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct,count(*) FILTER(WHERE NOT is_correct)::int wrong FROM question_attempts GROUP BY training_session_id`;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.total===10&&r.correct===8&&r.wrong===2));});
 for(const token of ['unlinked','foreign','inactive'])await check(token+' denied403',async()=>assert.equal((await read(token)).status,403));
 for(const token of ['revoked','expired','unknown','missing'])await check(token+' mock provider denied401',async()=>assert.equal((await read(token)).status,401));
 await check('mock provider failure remains fail closed',async()=>assert.equal((await read('outage')).status,401));
 await check('forged identity headers and selectors denied',async()=>{assert.equal((await read('valid','&educatorId=forged')).status,403);assert.equal((await read('valid','&academyId=forged')).status,403);assert.equal((await read('valid','',{'x-educator-id':'forged'})).status,401);});
 await check('bad cursor and changed scope400',async()=>{assert.equal((await read('valid','&cursor=bad')).status,400);assert.equal((await read('valid','&limit=0')).status,400);const r=await read();assert.equal((await read('valid','&module=other&cursor='+encodeURIComponent(r.body.timeline.nextCursor))).status,400);});
 await check('can_view and current student state reauthorization',async()=>{await admin`UPDATE teacher_student_links SET can_view=false WHERE teacher_id=${uuid(4)}`;assert.equal((await read()).status,403);await admin`UPDATE teacher_student_links SET can_view=true WHERE teacher_id=${uuid(4)}`;await admin`UPDATE students SET status='inactive' WHERE id=${student}`;assert.equal((await read()).status,403);await admin`UPDATE students SET status='active' WHERE id=${student}`;});
 await check('database failure503 and retry200',async()=>{outage=true;assert.equal((await read()).status,503);outage=false;assert.equal((await read()).status,200);});
 await check('real missing DB function503 and recovery200',async()=>{await admin.unsafe('ALTER FUNCTION qa_broker_private.educator_history(text,uuid,jsonb,jsonb,int) RENAME TO paused_history');assert.equal((await read()).status,503);await admin.unsafe('ALTER FUNCTION qa_broker_private.paused_history(text,uuid,jsonb,jsonb,int) RENAME TO educator_history');assert.equal((await read()).status,200);});
 await check('real closed broker connection503 then recovery200',async()=>{await brokerDb.end({timeout:2});assert.equal((await read()).status,503);brokerDb=connect('mock_broker');await brokerDb.unsafe("SET neon.project_id='mock-project';SET neon.branch_id='mock-branch'");assert.equal((await read()).status,200);});
 await check('RLS default deny despite temporary local SELECT',async()=>{await admin.unsafe('GRANT SELECT ON students TO mock_runtime');assert.equal((await normalDb`SELECT id FROM students`).length,0);await admin.unsafe('REVOKE SELECT ON students FROM mock_runtime');});
 for(const[name,db]of[['runtime',normalDb],['PUBLIC-only',publicDb]])await check(name+' direct schema/function/table denied42501',async()=>{await assert.rejects(db.unsafe('SELECT qa_broker_private.educator_history($1,$2::uuid,$3::text::jsonb,NULL,20)',[subject('valid'),student,'{}']),e=>e.code==='42501');await assert.rejects(db`SELECT * FROM training_sessions`,e=>e.code==='42501');});
 await check('broker no raw SELECT or privilege alteration',async()=>{await assert.rejects(brokerDb`SELECT * FROM users`,e=>e.code==='42501');await assert.rejects(brokerDb.unsafe('DROP FUNCTION qa_broker_private.educator_history(text,uuid,jsonb,jsonb,int)'),e=>e.code==='42501');const[r]=await admin`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='mock_broker'`;assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);});
 await check('function ACL independently excludes PUBLIC and general role',async()=>{const[r]=await admin.unsafe("SELECT has_function_privilege('mock_runtime','qa_broker_private.educator_history(text,uuid,jsonb,jsonb,int)','EXECUTE') AS runtime,has_function_privilege('mock_broker','qa_broker_private.educator_history(text,uuid,jsonb,jsonb,int)','EXECUTE') AS broker,EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl)a WHERE p.oid='qa_broker_private.educator_history(text,uuid,jsonb,jsonb,int)'::regprocedure AND a.grantee=0) AS public");assert.equal(r.runtime,false);assert.equal(r.broker,true);assert.equal(r.public,false);});
 await check('READ ONLY transaction mutation rejected25006',async()=>await assert.rejects(brokerDb.begin('read only',tx=>tx.unsafe('CREATE TABLE rejected_write(id int)')),e=>e.code==='25006'));
 await check('public ingress has no broker HTTP route',async()=>{for(const p of ['/history','/broker']){const r=await mf.dispatchFetch(origin+p,{headers:{cookie:providerCookie+'=valid'}});assert.ok([400,403,404].includes(r.status));}assert.equal((await mf.dispatchFetch(...fetchArgs(request('valid','',{'origin':'https://other.local.invalid'})))).status,401);});
 await check('negative invalid signature401 no rows',async()=>{const before=trace.length;const raw=JSON.parse(await seal());raw.sig=(raw.sig[0]==='A'?'B':'A')+raw.sig.slice(1);await assertClosed(await postBroker(JSON.stringify(raw)),401);assert.equal(trace.length,before);});
 await check('negative stale timestamp401 no rows',async()=>{const before=trace.length;await assertClosed(await postBroker(await seal({ts:Date.now()-6000})),401);assert.equal(trace.length,before);});
 await check('negative future timestamp401 no rows',async()=>{const before=trace.length;await assertClosed(await postBroker(await seal({ts:Date.now()+5000})),401);assert.equal(trace.length,before);});
 await check('negative reused nonce401 no rows',async()=>{const before=trace.length;const body=await seal();const first=await postBroker(body);assert.equal(first.status,200);const ok=await first.json();assert.ok(Array.isArray(ok.rows)&&ok.rows.length>0);await assertClosed(await postBroker(body),401);assert.equal(trace.length,before+1);});
 await check('slow auth beyond 5s still authorized200',async()=>{const started=Date.now();const result=await read('slow');assert.ok(Date.now()-started>5000);assert.equal(result.status,200);assert.equal(result.body.timeline.events.length,20);});
 await check('concurrent same nonce one accepted on real ledger',async()=>{const before=trace.length;const body=await seal();const [left,right]=await Promise.all([postBroker(body),postBroker(body)]);const accepted=[left,right].filter(r=>r.status===200);const rejected=[left,right].filter(r=>r.status!==200);assert.equal(accepted.length,1);assert.equal(rejected.length,1);const ok=await accepted[0].json();assert.ok(Array.isArray(ok.rows)&&ok.rows.length>0);await assertClosed(rejected[0],401);assert.equal(trace.length,before+1);});
 await check('negative different studentId than signed claim403 no rows',async()=>{const before=trace.length;await assertClosed(await postBroker(await seal({readStudentId:uuid(99)})),403);assert.equal(trace.length,before);});
 await check('negative tampered subject401 no rows',async()=>{const before=trace.length;const raw=JSON.parse(await seal());raw.subject=subject('unlinked');await assertClosed(await postBroker(JSON.stringify(raw)),401);assert.equal(trace.length,before);});
 await check('negative tampered body401 no rows',async()=>{const before=trace.length;const raw=JSON.parse(await seal());raw.read.filters.moduleCode='other';await assertClosed(await postBroker(JSON.stringify(raw)),401);assert.equal(trace.length,before);});
 await check('negative signed student outside binding403 no rows',async()=>{const before=trace.length;await assertClosed(await postBroker(await seal({studentId:uuid(99),readStudentId:uuid(99)})),403);assert.equal(trace.length,before);});
 await check('negative missing field and unknown field400',async()=>{const before=trace.length;const missing=JSON.parse(await seal());delete missing.ts;await assertClosed(await postBroker(JSON.stringify(missing)),400);const extra=JSON.parse(await seal());extra.note=true;await assertClosed(await postBroker(JSON.stringify(extra)),400);assert.equal(trace.length,before);});
 await check('missing private binding503 without fallback',async()=>{const single=new Miniflare({host:'127.0.0.1',port:0,modules:true,script:ingressScript,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:ingressBindings,serviceBindings:{TEST_RATE},outboundService:provider});try{rateCount=0;assert.equal((await single.dispatchFetch(...fetchArgs(request()))).status,503);}finally{await single.dispose();}});
 await check('rate429 before broker',async()=>{rateCount=60;const n=trace.length;const r=await mf.dispatchFetch(...fetchArgs(request()));assert.equal(r.status,429);assert.equal(trace.length,n);});
 await check('fresh verification per request and explicit revoke race',async()=>{const n=providerCalls;await read();await read();assert.equal(providerCalls,n+2);raceRevoke=true;assert.equal((await read()).status,200);raceRevoke=false;assert.equal((await read()).status,401);providerRevoked=false;});
 await check('no credential forwarding and unchanged6business fingerprints',async()=>{assert.ok(trace.every(t=>t.readOnly&&!t.credentialForwarded));assert.deepEqual(await fingerprint(admin),before);});
 await check('private broker scope mismatch503, no identity fallback',async()=>{const single=new Miniflare({host:'127.0.0.1',port:0,...brokerIsolate,bindings:{...brokerBindings,QA_BROKER_ROLE:'wrong-role'}});try{assert.equal((await single.dispatchFetch('https://broker.invalid/history',{method:'POST',body:await seal()})).status,503);}finally{await single.dispose();}});
 await check('missing hmac secret or nonce ledger fails closed503',async()=>{const noSecret={...brokerBindings};delete noSecret.QA_BROKER_REQUEST_HMAC_SECRET;const short=new Miniflare({host:'127.0.0.1',port:0,...brokerIsolate,bindings:{...brokerBindings,QA_BROKER_REQUEST_HMAC_SECRET:'REVIEW_PLACEHOLDER'}});const missingSecret=new Miniflare({host:'127.0.0.1',port:0,...brokerIsolate,bindings:noSecret});const noLedger={...brokerIsolate};delete noLedger.durableObjects;const missingLedger=new Miniflare({host:'127.0.0.1',port:0,...noLedger,bindings:brokerBindings});try{const body=await seal();for(const instance of [short,missingSecret,missingLedger])assert.equal((await instance.dispatchFetch('https://broker.invalid/history',{method:'POST',body})).status,503);}finally{await short.dispose();await missingSecret.dispose();await missingLedger.dispose();}});
 await check('nondeployed config denies public endpoints and credential location',async()=>{const{example,worker}=sourceGuards();const client=fs.readFileSync('lib/qa-educator-broker-client.ts','utf8');assert.match(example,/"workers_dev": false/);assert.match(example,/"preview_urls": false/);assert.match(example,/"routes": \[\]/);assert.doesNotMatch(example,/durable_objects/);assert.doesNotMatch(client,/BROKER_DATABASE_URL|postgres\(/);assert.match(client,/sealBrokerRequest/);assert.match(client,/ts: Date\.now\(\)/);assert.doesNotMatch(client,/verifiedAt/);assert.doesNotMatch(fs.readFileSync('app/api/educator-student-history/route.ts','utf8'),/verifiedAt/);assert.match(worker,/readOnly: true/);assert.match(worker,/blockConcurrencyWhile/);assert.match(worker,/BrokerNonceLedger/);assert.doesNotMatch(worker,/REVIEW_PLACEHOLDER/);});
 // Actual production driver bundles successfully, but no real remote transport runs.
 await check('real HTTP broker driver compile only',async()=>assert.ok((await bundle('workers/qa-educator-broker/index.ts')).length>100));
 console.log(JSON.stringify({mode:'REAL_LOCAL_POSTGRESQL_MINIFLARE_MOCK_PROVIDER_TEST_NODE_ADAPTER',passed:true,checks:checks.length,providerCalls,dbSamples:latencies.length,maxDbAdapterMs:Math.max(...latencies),REAL_PROVIDER_TESTED:false,PRODUCTION_TRANSPORT:'UNVERIFIED',LIVE_QA:'NO_GO'}));
}finally{if(mf)await mf.dispose();for(const db of[brokerDb,normalDb,publicDb,admin])if(db)await db.end({timeout:2});}
