import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const fixture=JSON.parse(fs.readFileSync(process.env.CZA_QA_FIXTURE_FILE));
const base='https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const mobile=process.env.CZA_QA_MOBILE==='1',name=mobile?'mobile':'desktop';
const identity=mobile?{sessionId:'f825e4d0-c702-4a58-bb7a-7ec991940a89',candidateId:'753e2d0a-213c-4ab7-81f1-691fa4c999ba',cycleId:'424a3f4d-57ee-42f1-acc3-7d99188501b5'}:{sessionId:'3db6ac62-aa10-44e5-b4fa-4f99fa599e0d',candidateId:'8b38bfe7-60d3-4d42-a96c-501c489be547',cycleId:'e81d8275-9a03-4ad6-8caf-ab9cfd901fb0'};
const studentId='20000000-0000-4000-8000-000000000001';
const out=process.env.CZA_QA_EVIDENCE_DIR||'docs/evidence/v02';fs.mkdirSync(out,{recursive:true});
const proof={identity,studentId,mobile,mocks:false,cookieInjection:false,errors:[],passed:false};
const browser=await puppeteer.launch({executablePath:process.env.CZA_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--proxy-server='+process.env.HTTPS_PROXY],headless:true});
let page;
try{
 page=await browser.newPage();page.setDefaultTimeout(30000);await page.setViewport({width:mobile?390:1440,height:mobile?844:1000});page.on('pageerror',e=>proof.errors.push(e.message));
 await page.goto(base+'/cza-degerlendirme/?profile=SP-DYS',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('#centralEducatorLogin');await page.type('#centralEducatorLogin [name=email]',fixture.email);await page.type('#centralEducatorLogin [name=password]',fixture.password);await page.click('#centralEducatorLogin button');await page.waitForSelector('.central-link-panel.connected');
 await page.evaluate(i=>{state.centralCandidateId=i.candidateId;state.centralCycleId=i.cycleId;saveState();},identity);
 await page.type('#name','QA Synthetic V02 Existing Candidate');await page.select('#grade','2. sınıf');await page.select('#readingStage','Harf-ses öğreniyor');await page.click('#startDys');await page.waitForSelector('#v02Open');
 const read=()=>page.evaluate(async sid=>{const r=await fetch('/api/assessment-special-linked',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'get',sessionId:sid})});return {status:r.status,body:await r.json()};},identity.sessionId);
 const before=await read();assert.equal(before.status,200);assert.equal(before.body.attempts.length,1);assert.equal(before.body.observations.length,1);
 proof.before={sessionId:before.body.session.id,metadata:before.body.session.metadata,attempts:before.body.attempts,observations:before.body.observations};
 await page.click('#v02Open');await page.waitForSelector('#v02StudentSelect');await page.select('#v02StudentSelect',studentId);
 assert.equal(await page.$eval('#v02Bind',e=>e.disabled),true);proof.explicitConfirmationRequired=true;
 await page.click('#v02Confirm');await page.screenshot({path:out+'/'+name+'-confirmation.png',fullPage:true});await page.click('#v02Bind');
 await page.waitForFunction(()=>document.querySelector('#v02LinkStatus')?.textContent.includes('Bağlantı başarılı'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#v02LinkStatus')?.textContent.includes('Bağlı öğrenci dosyası'));
 const after=await read();assert.equal(after.status,200);assert.equal(after.body.session.student_id,studentId);assert.deepEqual(after.body.session.metadata,proof.before.metadata);assert.deepEqual(after.body.attempts,proof.before.attempts);assert.deepEqual(after.body.observations,proof.before.observations);
 proof.after={sessionId:after.body.session.id,studentId:after.body.session.student_id,metadata:after.body.session.metadata,attempts:after.body.attempts,observations:after.body.observations};
 const stored=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cza-e3-preview'));return{candidateId:s.centralCandidateId,cycleId:s.centralCycleId,sessionId:s.centralSessionId,taskIndex:s.dysTaskIndex};});for(const k of ['candidateId','cycleId','sessionId'])assert.equal(stored[k],identity[k]);assert.equal(stored.taskIndex,1);proof.restored=stored;
 await page.screenshot({path:out+'/'+name+'-restored.png',fullPage:true});proof.chromeVersion=await browser.version();
 proof.negativeChecks=await page.evaluate(async ({sessionId,studentId})=>{
   const post=async(body,headers={})=>{const r=await fetch('/api/assessment-student-link',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({sessionId,...body})});return r.status;};
   return {missingConfirmation:await post({action:'bind',studentId}),crossTenant:await post({action:'bind',studentId:'a810b746-7c15-4acd-824d-932bd37acc39',confirmStudentId:'a810b746-7c15-4acd-824d-932bd37acc39'}),forgedHeader:await post({action:'bind',studentId,confirmStudentId:studentId},{'x-educator-id':'forged'})};
 },{sessionId:identity.sessionId,studentId});
 assert.deepEqual(proof.negativeChecks,{missingConfirmation:400,crossTenant:403,forgedHeader:401});

 const logout=await page.evaluate(async()=>{const r=await fetch('/api/educator-auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});return {status:r.status,body:await r.json()};});assert.equal(logout.status,200);assert.equal(logout.body.revoked,true);proof.logout={status:200,revoked:true};
 const noAuth=await page.evaluate(async sid=>{const r=await fetch('/api/assessment-student-link',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'students',sessionId:sid})});return r.status;},identity.sessionId);assert.equal(noAuth,401);proof.afterLogout=noAuth;
 assert.equal(proof.errors.length,0);proof.passed=true;
}catch(e){proof.failure=e.message;if(page){proof.dom=await page.evaluate(()=>({ids:[...document.querySelectorAll('[id]')].map(e=>e.id),text:document.body.innerText.slice(-5000)})).catch(()=>null);await page.screenshot({path:out+'/'+name+'-failed.png',fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({name,passed:proof.passed,failure:proof.failure}));}
