import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const fixture=JSON.parse(fs.readFileSync(process.env.CZA_QA_FIXTURE_FILE));
const out=process.env.CZA_QA_EVIDENCE_DIR||'docs/evidence/v02';fs.mkdirSync(out,{recursive:true});
const sessionId='c0ab8deb-52f4-4b36-b95d-72c392d0c2b0',studentId='20000000-0000-4000-8000-000000000001';
let cookie='';const proof={tests:[],passed:false,sessionId,studentId};
async function post(path,body,headers={}){const r=await fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json',...(cookie?{cookie}:{}),...headers},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};}
function check(name,ok,evidence={}){proof.tests.push({name,passed:!!ok,evidence});assert.ok(ok,name);}
const link=(body,headers)=>post('/api/assessment-student-link',{sessionId,...body},headers);
const fingerprint=b=>createHash('sha256').update(JSON.stringify({sessionId:b.session.id,metadata:b.session.metadata,attempts:b.attempts,observations:b.observations})).digest('hex');
try{
 if(process.env.CZA_QA_REVOCATION_PHASE){
  cookie=JSON.parse(fs.readFileSync(process.env.CZA_QA_COOKIE_FILE)).cookie;
  const denied=await link({action:'bind',studentId,confirmStudentId:studentId});
  check('revoked explicit permission denies repeat',denied.status===403,{status:denied.status});
  const students=await link({action:'students'});check('revoked relation removed from picker',students.status===200&&students.body.students.length===0);
 }else{
  const noAuth=await link({action:'students'});check('unauthenticated 401',noAuth.status===401,{status:noAuth.status});
  const login=await post('/api/educator-auth',{action:'login',email:fixture.email,password:fixture.password});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
  if(process.env.CZA_QA_COOKIE_FILE)fs.writeFileSync(process.env.CZA_QA_COOKIE_FILE,JSON.stringify({cookie}),{mode:0o600});
  const before=await post('/api/assessment-special-linked',{action:'get',sessionId});assert.equal(before.status,200);
  proof.before={fingerprint:fingerprint(before.body),candidateId:before.body.session.metadata.candidateId,cycleId:before.body.session.metadata.cycleId,studentId:before.body.session.student_id,attempts:before.body.attempts.length,observations:before.body.observations.length};
  check('existing V01 answer and observation present',proof.before.attempts===1&&proof.before.observations===1);
  const students=await link({action:'students'});check('explicitly eligible existing student',students.status===200&&students.body.students.length===1&&students.body.students[0].id===studentId);
  for(const [name,payload,headers,status] of [
   ['missing confirmation',{action:'bind',studentId},{},400],
   ['cross tenant',{action:'bind',studentId:'a810b746-7c15-4acd-824d-932bd37acc39',confirmStudentId:'a810b746-7c15-4acd-824d-932bd37acc39'},{},403],
   ['foreign origin',{action:'bind',studentId,confirmStudentId:studentId},{origin:'https://foreign.invalid'},403],
   ['forged educator',{action:'bind',studentId,confirmStudentId:studentId},{'x-educator-id':fixture.authId},401],
   ['other creator session',{action:'students',sessionId:'30000000-0000-4000-8000-000000000001'},{},403]]){
    const result=await link(payload,headers);check(name,result.status===status,{status:result.status});
  }
  const results=await Promise.all([link({action:'bind',studentId,confirmStudentId:studentId}),link({action:'bind',studentId,confirmStudentId:studentId})]);
  proof.concurrent=results.map(r=>({status:r.status,resumed:r.body.resumed,link:r.body.link,error:r.body.error}));
  check('concurrent same target idempotent',results.every(r=>r.status===200&&r.body.link.session_id===sessionId&&r.body.link.student_id===studentId));
  const again=await link({action:'bind',studentId,confirmStudentId:studentId});check('repeat retains original audit',again.status===200&&again.body.resumed&&again.body.link.linked_at===results[0].body.link.linked_at);
  const after=await post('/api/assessment-special-linked',{action:'get',sessionId});check('same metadata and all evidence fingerprints',after.status===200&&fingerprint(after.body)===proof.before.fingerprint&&after.body.session.student_id===studentId);
  proof.after={fingerprint:fingerprint(after.body),studentId:after.body.session.student_id};
  const resumed=await post('/api/assessment-special-linked',{action:'create',profileCode:'SP-DYS',candidateId:proof.before.candidateId,cycleId:proof.before.cycleId,studentLabel:'QA Synthetic V02 Existing Candidate'});
  check('old candidate identity resumes linked session',resumed.status===200&&resumed.body.resumed&&resumed.body.session.id===sessionId);
  const history=await link({action:'history',studentId});check('same Student ID history',history.status===200&&history.body.sessions.some(s=>s.id===sessionId&&s.attempt_count===1&&s.observation_count===1));
 }
 proof.passed=true;
}catch(e){proof.failure=e.message;process.exitCode=1;}
fs.writeFileSync(out+(process.env.CZA_QA_REVOCATION_PHASE?'/api-revocation.json':'/api.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:proof.passed,tests:proof.tests.length,failure:proof.failure}));
