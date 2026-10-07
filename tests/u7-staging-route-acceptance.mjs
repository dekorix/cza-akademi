import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const transpile=(value)=>ts.transpileModule(value,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let databaseUrl='';
for await(const chunk of process.stdin)databaseUrl+=chunk;
databaseUrl=databaseUrl.trim();
assert.match(databaseUrl,/^postgres(?:ql)?:\/\//,'staging DATABASE_URL must be supplied on stdin');
process.env.DATABASE_URL=databaseUrl;

const analytics={exports:{}};
// oxlint-disable-next-line typescript/no-implied-eval -- isolated production-module acceptance harness.
new Function('require','module','exports','process',transpile(read('../lib/persistence/educator-analytics.ts')))(nativeRequire,analytics,analytics.exports,process);
const profile={exports:{}};
// oxlint-disable-next-line typescript/no-implied-eval -- isolated production-module acceptance harness.
new Function('require','module','exports',transpile(read('../lib/persistence/student-learning-profile.ts')))(
  (id)=>id.includes('educator-analytics')?analytics.exports:nativeRequire(id),profile,profile.exports,
);

function loadRoute(path){
  const mod={exports:{}};
  // oxlint-disable-next-line typescript/no-implied-eval -- route runs unchanged with only authenticated demo identity injected.
  new Function('require','module','exports','process',transpile(read(path)))(id=>{
    if(id.includes('student-learning-profile'))return profile.exports;
    if(id.includes('student-session'))return{authenticatedStudent:async()=>({
      student_id:'c2000000-0000-4000-8000-000000000003',academy_id:'c2000000-0000-4000-8000-000000000001',
      student_user_id:'c2000000-0000-4000-8000-000000000002',session_id:'u7-staging-demo',
    })};
    if(id.includes('educator-auth'))return{authenticatedEducator:async()=>({id:'d3000000-0000-4000-8000-000000000011'})};
    if(id.includes('request-guard'))return{allowRequest:async()=>({allowed:true}),rateLimited:()=>Response.json({ok:false},{status:429})};
    return nativeRequire(id);
  },mod,mod.exports,process);
  return mod.exports.GET;
}

try{
  const studentGet=loadRoute('../app/api/core/learning-profile/route.ts','student');
  const educatorGet=loadRoute('../app/api/educator-learning-profile/route.ts','educator');
  const studentResponse=await studentGet(new Request('http://127.0.0.1/api/core/learning-profile?studentId=forged'));
  const educatorResponse=await educatorGet(new Request('http://127.0.0.1/api/educator-learning-profile?studentId=c2000000-0000-4000-8000-000000000003'));
  assert.equal(studentResponse.status,200);
  assert.equal(educatorResponse.status,200);
  const studentBody=await studentResponse.json();
  const educatorBody=await educatorResponse.json();
  assert.equal(studentBody.profile.student.id,'c2000000-0000-4000-8000-000000000003');
  assert.equal(educatorBody.profile.student.id,studentBody.profile.student.id);
  assert.deepEqual(educatorBody.profile.coverage,studentBody.profile.coverage);
  assert.deepEqual(educatorBody.profile.studyPattern,studentBody.profile.studyPattern);
  assert.deepEqual(educatorBody.profile.skills,studentBody.profile.skills);
  assert.ok(studentBody.profile.skills.every((skill)=>skill.provenance==='CLIENT_REPORTED'||skill.provenance==='SERVER_AUTHORITATIVE'));
  process.stdout.write(`U7_STAGING_ROUTE_ACCEPTANCE=PASS STUDENT_ROUTE=PASS EDUCATOR_ROUTE=PASS STUDENT_ID=${studentBody.profile.student.id} SKILLS=${studentBody.profile.skills.length}\n`);
}finally{
  delete process.env.DATABASE_URL;
  databaseUrl='';
}
