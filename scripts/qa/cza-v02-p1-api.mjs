import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base='https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const fixture=JSON.parse(fs.readFileSync(process.env.CZA_QA_FIXTURE_FILE));const out=process.env.CZA_QA_EVIDENCE_DIR||'docs/evidence/v02-p1';
let cookie='';const proof={phase:process.env.CZA_QA_PHASE||'revoked',tests:[],passed:false};
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};}
function check(name,ok){proof.tests.push({name,passed:!!ok});assert.ok(ok,name);}
const studentId='20000000-0000-4000-8000-000000000001';
try{
 const login=await post('/api/educator-auth',{action:'login',email:fixture.email,password:fixture.password});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
 proof.sessions=[];
 for(const sessionId of ['3db6ac62-aa10-44e5-b4fa-4f99fa599e0d','c0ab8deb-52f4-4b36-b95d-72c392d0c2b0','f825e4d0-c702-4a58-bb7a-7ec991940a89']){
  const get=await post('/api/assessment-special-linked',{action:'get',sessionId});check('get '+sessionId,get.status===200&&get.body.attempts.length===1&&get.body.observations.length===1);
  const report=await post('/api/assessment-special-linked',{action:'report',sessionId});check('report '+sessionId,report.status===200);
  const history=await post('/api/assessment-student-link',{action:'history',sessionId,studentId});check('history '+sessionId,history.status===200&&history.body.sessions.length===3);
  const m=get.body.session.metadata;const resume=await post('/api/assessment-special-linked',{action:'create',profileCode:'SP-DYS',candidateId:m.candidateId,cycleId:m.cycleId,studentLabel:'QA Synthetic V02 Existing Candidate'});check('V01 resume '+sessionId,resume.status===200&&resume.body.resumed&&resume.body.session.id===sessionId);
  const bind=await post('/api/assessment-student-link',{action:'bind',sessionId,studentId,confirmStudentId:studentId});check('binding phase '+sessionId,bind.status===(proof.phase==='revoked'?403:200));
  proof.sessions.push({sessionId,fingerprint:createHash('sha256').update(JSON.stringify({metadata:get.body.session.metadata,attempts:get.body.attempts,observations:get.body.observations})).digest('hex')});
 }
 const foreign=await post('/api/assessment-student-link',{action:'history',sessionId:proof.sessions[0].sessionId,studentId:'a810b746-7c15-4acd-824d-932bd37acc39'});check('foreign student history denied',foreign.status===403);
 proof.passed=true;
}catch(e){proof.failure=e.message;process.exitCode=1;}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/api-'+proof.phase+'.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:proof.passed,tests:proof.tests.length,failure:proof.failure}));
