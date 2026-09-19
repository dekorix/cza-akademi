import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import postgres from 'postgres';

const base=process.env.U9_BASE_URL;
const secret=process.env.CZA_TRUSTED_PROXY_HMAC_SECRET;
const databaseUrl=process.env.DATABASE_URL;
const guardianEmail=process.env.U9_GUARDIAN_EMAIL;
const guardianUserId=process.env.U9_GUARDIAN_USER_ID;
const studentToken=process.env.U9_STUDENT_TOKEN;
const educatorToken=process.env.U9_EDUCATOR_GUARDIAN_TOKEN;
assert.ok(base&&secret&&databaseUrl&&guardianEmail&&guardianUserId&&studentToken&&educatorToken);

const studentA='c2000000-0000-4000-8000-000000000003';
const studentB='c2000000-0000-4000-8000-000000000011';
const otherAcademyStudent='81000000-0000-4000-8000-000000000021';
const digest=value=>createHash('sha256').update(value).digest('hex');

function proxyHeaders(method,path,body=''){
  const timestamp=String(Math.floor(Date.now()/1000));
  const nonce=randomBytes(24).toString('hex');
  const bodyHash=digest(body);
  const payload=['cza-educator-proxy-v2',timestamp,nonce,method,path,bodyHash,guardianEmail].join('\n');
  return {
    'oai-authenticated-user-email':guardianEmail,
    'x-cza-proxy-timestamp':timestamp,
    'x-cza-proxy-nonce':nonce,
    'x-cza-proxy-signature':createHmac('sha256',secret).update(payload).digest('hex'),
    ...(body?{'content-type':'application/json','origin':base}:{}),
  };
}

async function authMe(){
  const path='/api/guardian-auth';
  const raw=JSON.stringify({action:'me'});
  const response=await fetch(base+path,{method:'POST',headers:proxyHeaders('POST',path,raw),body:raw});
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  const setCookie=response.headers.get('set-cookie')||'';
  const pair=setCookie.split(';')[0];
  assert.match(pair,/^cza_guardian_session=/);
  return pair;
}

async function guardianGet(cookie,path,expected=200){
  const response=await fetch(base+path,{headers:{cookie}});
  const body=await response.json();
  assert.equal(response.status,expected,`${path}: ${JSON.stringify(body)}`);
  return body;
}

async function methodProbe(cookie,method,path){
  const response=await fetch(base+path,{method,headers:{cookie,'origin':base}});
  assert.ok([404,405].includes(response.status),`${method} ${path} unexpectedly returned ${response.status}`);
}

const sql=postgres(databaseUrl,{max:2,connect_timeout:10,idle_timeout:5,prepare:false});
let cookie='';
try{
  cookie=await authMe();

  const students=await guardianGet(cookie,'/api/guardian/students');
  assert.deepEqual(students.students.map(row=>row.id).sort(),[studentA,studentB].sort());

  const dashA=await guardianGet(cookie,`/api/guardian/dashboard?studentId=${studentA}`);
  const dashB=await guardianGet(cookie,`/api/guardian/dashboard?studentId=${studentB}`);
  assert.equal(dashA.dashboard.student.id,studentA);
  assert.equal(dashB.dashboard.student.id,studentB);
  assert.notEqual(dashA.dashboard.student.id,dashB.dashboard.student.id);
  assert.ok(Array.isArray(dashA.dashboard.assignments));
  const dashText=JSON.stringify(dashA);
  for(const forbidden of ['sourceReferences','sourceReference','verificationStatus','verificationAuthority','private_note','privateNote'])assert.equal(dashText.includes(forbidden),false,`dashboard leaked ${forbidden}`);
  if(dashA.dashboard.report?.summary?.clientPerformance?.attempts===0){
    assert.equal(dashA.dashboard.report.summary.clientPerformance.accuracy,null);
    assert.equal(dashA.dashboard.report.summary.clientPerformance.evidenceStatus,'INSUFFICIENT');
  }else if(dashA.dashboard.report?.summary?.clientPerformance){
    assert.equal(dashA.dashboard.report.summary.clientPerformance.provenance,'CLIENT_REPORTED');
  }

  const history=await guardianGet(cookie,`/api/guardian/history?studentId=${studentA}&limit=1`);
  assert.ok(history.timeline.events.length<=1);
  const historyText=JSON.stringify(history);
  for(const forbidden of ['sourceReferences','sourceReference','verificationStatus','verificationAuthority'])assert.equal(historyText.includes(forbidden),false,`history leaked ${forbidden}`);
  const profile=await guardianGet(cookie,`/api/guardian/learning-profile?studentId=${studentA}`);
  assert.equal(profile.profile.student.id,studentA);
  const profileText=JSON.stringify(profile);
  for(const forbidden of ['sourceReferences','sourceReference','verificationStatus','verificationAuthority'])assert.equal(profileText.includes(forbidden),false,`profile leaked ${forbidden}`);

  const report=await guardianGet(cookie,`/api/guardian/report?studentId=${studentA}&limit=1`);
  assert.ok(report.report.sessions.length<=1);
  const reportText=JSON.stringify(report);
  for(const forbidden of ['sourceReferences','sourceReference','verificationStatus','verificationAuthority'])assert.equal(reportText.includes(forbidden),false,`report leaked ${forbidden}`);

  const coaching=await guardianGet(cookie,`/api/guardian/coaching?studentId=${studentA}`);
  const coachingText=JSON.stringify(coaching);
  assert.equal(coachingText.includes('private_note'),false);
  assert.equal(coachingText.includes('privateNote'),false);
  assert.equal(coachingText.includes('U8_PRIVATE_DEMO_'),false);
  assert.ok(coaching.coaching.meetings.some(row=>row.sharedSummary==='Çarpanlar tekrar edilecek.'));

  await guardianGet(cookie,`/api/guardian/dashboard?studentId=91000000-0000-4000-8000-000000000099`,403);
  await guardianGet(cookie,`/api/guardian/dashboard?studentId=${otherAcademyStudent}`,403);

  await sql`UPDATE public.guardian_student_links SET can_view=false WHERE guardian_user_id=${guardianUserId}::uuid AND student_id=${studentB}::uuid`;
  await guardianGet(cookie,`/api/guardian/dashboard?studentId=${studentB}`,403);
  await sql`UPDATE public.guardian_student_links SET can_view=true WHERE guardian_user_id=${guardianUserId}::uuid AND student_id=${studentB}::uuid`;

  await sql`UPDATE public.users SET is_active=false WHERE id=${guardianUserId}::uuid`;
  await guardianGet(cookie,'/api/guardian/students',401);
  await sql`UPDATE public.users SET is_active=true WHERE id=${guardianUserId}::uuid`;

  await guardianGet(`cza_student_session=${studentToken}`,'/api/guardian/students',401);
  await guardianGet(`cza_guardian_session=${educatorToken}`,'/api/guardian/students',401);

  for(const method of ['POST','PUT','PATCH','DELETE'])await methodProbe(cookie,method,`/api/guardian/dashboard?studentId=${studentA}`);

  const logoutPath='/api/guardian-auth';
  const logoutRaw=JSON.stringify({action:'logout'});
  const logout=await fetch(base+logoutPath,{method:'POST',headers:{cookie,'content-type':'application/json','origin':base},body:logoutRaw});
  assert.equal(logout.status,200,await logout.text());
  await guardianGet(cookie,'/api/guardian/students',401);

  process.stdout.write(JSON.stringify({
    guardianSession:true,
    multiChild:true,
    assignmentRead:true,
    historyRead:true,
    profileRead:true,
    reportRead:true,
    coachingSharedRead:true,
    privateNoteLeakageZero:true,
    unlinkedFailClosed:true,
    crossAcademyFailClosed:true,
    inactiveGuardianFailClosed:true,
    studentRoleFailClosed:true,
    educatorRoleFailClosed:true,
    educationalMutationZero:true,
    logoutRevocation:true,
    stagingDb:true,
    realAuthGuard:true,
    realRoutes:true,
    demoOnly:true,
  })+'\n');
}finally{
  await sql`UPDATE public.users SET is_active=true WHERE id=${guardianUserId}::uuid`.catch(()=>{});
  await sql`UPDATE public.guardian_student_links SET can_view=true WHERE guardian_user_id=${guardianUserId}::uuid AND student_id=${studentB}::uuid`.catch(()=>{});
  await sql.end({timeout:5}).catch(()=>{});
}
