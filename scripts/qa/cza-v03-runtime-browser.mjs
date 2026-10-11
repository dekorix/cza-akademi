// REAL isolated QA login. No mocked requests, cookies injected or training attempts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { neon } from '@neondatabase/serverless';
const base='https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const studentId='20000000-0000-4000-8000-000000000001';
const fixture=JSON.parse(fs.readFileSync(process.env.CZA_QA_STUDENT_FIXTURE_FILE,'utf8'));
assert.equal(fixture.studentId,studentId);
assert.equal(fixture.moduleCode,'finger_read');
const out=process.env.CZA_QA_EVIDENCE_DIR||'docs/evidence/v03-runtime';
fs.mkdirSync(out,{recursive:true});
const proof={mode:'REAL_ISOLATED_QA',mocks:false,cookieInjection:false,studentId,recipeId:fixture.recipeId,moduleCode:fixture.moduleCode,checks:[],http:[],loginOutcomes:[],errors:[],passed:false};
const browser=await puppeteer.launch({executablePath:process.env.CZA_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const check=(name,ok)=>{proof.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const runtimeUrl=process.env.CZA_V03_QA_RUNTIME_URL;
const connection=new URL(runtimeUrl);
assert.equal(connection.username,'cza_v01_app_runtime_min');assert.equal(connection.pathname,'/cza_t5_synthetic');
const sql=neon(runtimeUrl);
try{
 proof.chromeVersion=await browser.version();
 proof.database=(await sql.query("SELECT current_user AS role,current_database() AS database,current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch"))[0];
 check('actual minimum QA role',proof.database.role==='cza_v01_app_runtime_min'&&proof.database.project==='patient-firefly-51111834'&&proof.database.branch==='br-withered-queen-b15ltb40');
 for(const [name,width,height]of [['desktop',1440,900],['mobile',390,844]]){
  const context=await browser.createBrowserContext();const page=await context.newPage();page.setDefaultTimeout(45000);await page.setViewport({width,height});page.on('pageerror',e=>proof.errors.push({name,error:e.message}));
  const get=path=>page.evaluate(async path=>{const r=await fetch(path,{cache:'no-store'});return{status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};},path);
  const login=async()=>{
   await page.waitForSelector('#home-username');await page.type('#home-username',fixture.username);await page.type('#home-pin',fixture.pin);
   const pending=page.waitForResponse(r=>r.url()===base+'/api/core'&&r.request().method()==='POST');await page.click('form button[type=submit]');const r=await pending;const body=await r.json();proof.loginOutcomes.push({name,status:r.status(),error:body.error||null,studentId:body.student?.id||null});check(name+' normal UI login',r.status()===200&&body.ok===true&&body.student.id===studentId&&!('sessionToken' in body));
   await page.waitForSelector('#route');
  };
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});check(name+' unauthenticated dashboard',(await get('/api/core/dashboard')).status===401);await login();
  const cookie=(await context.cookies()).find(c=>c.name==='cza_student_session');check(name+' secure server cookie',cookie?.httpOnly===true&&cookie.secure===true&&cookie.sameSite==='Lax');
  const dashboard=await get('/api/core/dashboard');proof.http.push({name,path:'/api/core/dashboard',status:dashboard.status,cache:dashboard.cache,error:dashboard.body.error||null,studentId:dashboard.body.dashboard?.profile?.id||null});
  check(name+' dashboard',dashboard.status===200&&dashboard.body.dashboard?.profile.id===studentId&&dashboard.cache?.split(',').map(x=>x.trim()).includes('no-store'));
  const assignment=dashboard.body.dashboard.assignments.find(a=>a.id===fixture.recipeId);check(name+' canonical assignment',assignment?.moduleCode===fixture.moduleCode&&assignment.status==='available'&&assignment.title==='V03 QA · Parmak Okuma');
  const profile=await get('/api/core/learning-profile');check(name+' single learning profile',profile.status===200&&profile.body.profile.student.id===studentId&&profile.body.profile.coverage.assignments===1&&profile.body.profile.coverage.sessions===8);
  const list=await get('/api/core/assignments');check(name+' assignment list',list.status===200&&list.body.assignments.length===1&&list.body.assignments[0].id===fixture.recipeId);
  const details=await get('/api/core/assignments?recipeId='+fixture.recipeId);check(name+' assignment details',details.status===200&&details.body.assignment.module_code===fixture.moduleCode&&details.body.assignment.launchPath.includes(fixture.recipeId));
  const launch=await page.evaluate(async recipeId=>{const r=await fetch('/api/core/assignments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipeId})});return{status:r.status,body:await r.json()};},fixture.recipeId);
  check(name+' real assigned launch contract',launch.status===200&&launch.body.assignment.module_code===fixture.moduleCode&&launch.body.launchPath.includes(fixture.recipeId));
  const foreignLaunch=await page.evaluate(async()=>{const r=await fetch('/api/core/assignments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipeId:'30000000-0000-4000-8000-000000000002'})});return r.status;});check(name+' foreign assigned launch denied',foreignLaunch===404);
  check(name+' foreign recipe denied',(await get('/api/core/assignments?recipeId=30000000-0000-4000-8000-000000000002')).status===404);
  const spoof=await page.evaluate(async()=>{const r=await fetch('/api/core/dashboard?studentId=20000000-0000-4000-8000-000000000002&academyId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{headers:{'x-student-id':'20000000-0000-4000-8000-000000000002','x-academy-id':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','x-role':'admin'}});return{status:r.status,body:await r.json()};});
  check(name+' spoof cannot select another identity',spoof.status===200&&spoof.body.dashboard.profile.id===studentId&&spoof.body.dashboard.assignments.every(a=>a.id===fixture.recipeId));
  const educatorDenied=await page.evaluate(async()=>{const r=await fetch('/api/educator-assignments',{method:'POST',headers:{'content-type':'application/json','x-educator-id':'synthetic-t5-educator','x-role':'educator'},body:JSON.stringify({action:'list',studentId:'20000000-0000-4000-8000-000000000002'})});return r.status;});check(name+' student cannot become educator',educatorDenied===401||educatorDenied===403);
  check(name+' real route text',await page.$eval('#route',e=>e.textContent.includes('V03 QA · Parmak Okuma')&&e.textContent.includes('Benim Öğrenme Rotam')));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#route');check(name+' canonical assignment after refresh',(await get('/api/core/dashboard')).body.dashboard.assignments[0].id===fixture.recipeId);
  check(name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:out+'/'+name+'.png',fullPage:true});
  proof[name]={viewport:{width,height},dashboard:dashboard.body.dashboard,profile:profile.body.profile,assignment:details.body.assignment};
  const logout=await page.evaluate(async()=>{const r=await fetch('/api/core',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});return{status:r.status,body:await r.json()};});check(name+' durable logout',logout.status===200&&logout.body.revoked===true);
  check(name+' after logout denied',(await get('/api/core/dashboard')).status===401);
  await page.reload({waitUntil:'domcontentloaded'});await login();check(name+' same identity after fresh login',(await get('/api/core/dashboard')).body.dashboard.profile.id===studentId);
  const logoutAgain=await page.evaluate(async()=>{const r=await fetch('/api/core',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});return r.status;});check(name+' cleanup logout',logoutAgain===200);await context.close();
 }
 check('zero page errors',proof.errors.length===0);proof.passed=true;
}catch(e){proof.failure=e.message;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(out+'/browser.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:proof.passed,checks:proof.checks.length,errors:proof.errors,failure:proof.failure}));}
