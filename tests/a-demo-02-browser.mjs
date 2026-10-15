// LOCAL MOCK TRANSPORT ONLY. Not live Neon/Worker or real-login acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
const out=process.env.CZA_DEMO_02_EVIDENCE_DIR||'/tmp/a-demo-02-local';fs.mkdirSync(out,{recursive:true});
const studentId='20000000-0000-4000-8000-000000000001',recipeId='361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';
const ids=['bdb87fbc-0938-4eb1-82e5-0a2cb362d30f','40000004-0000-4000-8000-000000000091'];
const results=ids.map((sessionId,i)=>({sessionId,assignmentId:recipeId,assignmentTitle:'V03 QA · Parmak Okuma',moduleCode:'finger_read',moduleName:'Parmak Okuma',startedAt:'2026-10-12T18:30:00Z',completedAt:`2026-10-12T18:3${8+i}:00Z`,total:10,correct:8,wrong:2,sourceReference:'training_sessions, question_attempts, learning_records, learning_evidence',records:[{recordId:`70000000-0000-4000-8000-00000000000${i}`,recordOrigin:'client_reported',verificationStatus:'client_reported',evidenceId:`80000000-0000-4000-8000-00000000000${i}`,evidenceVerificationStatus:'server_verified',verificationAuthority:'v04_qa_server_answer_evaluator:v1'}]}));
const events=Array.from({length:7},(_,i)=>({eventId:`record:70000000-0000-4000-8000-00000000000${i}`,studentId,occurredAt:'2026-10-12T18:39:00Z',eventType:'LEARNING_RESULT',moduleCode:'finger_read',title:'Parmak Okuma',status:'completed',resultSummary:{total:10,correct:8,wrong:2},provenance:'client_reported',verificationStatus:'client_reported',sourceReference:'learning_records'}));
const dashboard={profile:{id:studentId,name:'Synthetic Student',username:'local-qa'},summary:{activeAssignments:0,availableAssignments:0,inProgressAssignments:0,completedAssignments:1,completedSessions:10,totalAttempts:20,correctAttempts:16,accuracy:80},assignments:[{id:recipeId,moduleCode:'finger_read',moduleName:'Parmak Okuma',title:'V03 QA · Parmak Okuma',status:'completed',sessionCount:2,completedCount:2,attemptCount:20,correctCount:16,expectedCount:10,progressPercent:100}],recentActivity:[],skillProfile:[]};
const profile={student:{id:studentId,name:'Synthetic Student',recordedFrom:null},calculatedAt:'2026-10-12T18:39:00Z',dataThrough:null,coverage:{attempts:20},studyPattern:{assignments:{active:0,completed:1,cancelled:0},sessions:{total:10,activeDaysLast30:4}},modules:[],skills:[],process:{insufficiencyReason:'Yeterli beceri kanıtı yok.'},recentRecords:[],errors:[],periods:[]};
const proof={mode:'LOCAL_MOCK_TRANSPORT_ONLY',liveAcceptance:'UNVERIFIED',checks:[],errors:[],requests:[]};
const check=(name,ok)=>{proof.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const server=await createServer({root:process.cwd(),configFile:false,logLevel:'error',css:{postcss:{plugins:[tailwindcss()]}},plugins:[vinext()],server:{host:'127.0.0.1',port:4198,strictPort:true}});let browser;
try{
 await server.listen();browser=await puppeteer.launch({executablePath:process.env.CZA_BROWSER_PATH||await chromium.executablePath(),headless:true,args:['--no-sandbox']});proof.chrome=await browser.version();
 for(const[width,height]of[[1440,900],[390,844]]){
 const p=await browser.newPage();await p.setViewport({width,height});p.on('pageerror',e=>proof.errors.push(e.message));let auth=true,historyMode='records',resultMode='records';
 await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return void r.continue();proof.requests.push({width,method:r.method(),path:u.pathname});const send=(body,status=200)=>r.respond({status,contentType:'application/json',body:JSON.stringify(body)});
 if(!auth)return void send({ok:false,error:'session_required'},401);
 if(u.pathname==='/api/core/dashboard')return void send({ok:true,dashboard});
 if(u.pathname==='/api/core/learning-profile')return void send({ok:true,profile});
 if(u.pathname==='/api/core/history')return void(historyMode==='blocked'?send({ok:false,error:'timeline_unavailable'},503):send({ok:true,timeline:{events:historyMode==='empty'?[]:events,hasMore:false,nextCursor:null}}));
 if(u.pathname==='/api/student-history')return void send({ok:true,records:[],summary:{totalRecords:0,moduleCount:0,totalDurationMs:0,latestCompletedAt:null}});
 if(u.pathname==='/api/core/work-results'){if(resultMode==='blocked')return void send({ok:false,error:'work_results_unavailable'},503);const sid=u.searchParams.get('sessionId');if(sid&&!ids.includes(sid))return void send({ok:false,error:'work_result_not_found'},404);return void send({ok:true,results:resultMode==='empty'?[]:sid?results.filter(x=>x.sessionId===sid):results});}
 return void send({ok:true,program:null,coaching:null,history:[]});});
 await p.goto('http://127.0.0.1:4198/',{waitUntil:'networkidle0'});await p.waitForSelector('#route');
 check(width+': seven canonical history rows',await p.$$eval('#history details',nodes=>nodes.length===7));
 check(width+': history not false empty',!await p.$eval('#history',e=>e.innerText.includes('Henüz çalışma geçmişi oluşmadı.')));
 await p.evaluate(()=>document.querySelector('a[href="/work"]').click());await p.waitForSelector('[data-session-id]');
 check(width+': two separate sessions',await p.$$eval('[data-session-id]',nodes=>nodes.length===2));
 check(width+': aggregate preserved',await p.$eval('#results',e=>/20\s+Yanıt[\s\S]*16\s+Doğru[\s\S]*%80/.test(e.innerText)));
 for(const sid of ids){await p.goto('http://127.0.0.1:4198/work');await p.waitForSelector(`[data-session-id="${sid}"]`);await p.evaluate(sid=>document.querySelector(`[data-session-id="${sid}"] a`).click(),sid);await p.waitForSelector('[data-session-id]');
 const inspect=()=>p.$eval('[data-session-id]',e=>({sid:e.getAttribute('data-session-id'),text:e.innerText}));
 const first=await inspect();check(width+': 10/8/2 '+sid,first.sid===sid&&/10\s+Soru[\s\S]*8\s+Doğru[\s\S]*2\s+Yanlış/.test(first.text));
 await p.reload({waitUntil:'networkidle0'});check(width+': hard reload '+sid,JSON.stringify(await inspect())===JSON.stringify(first));
 auth=false;await p.reload({waitUntil:'networkidle0'});check(width+': 401 hides data',await p.$$eval('[data-session-id]',e=>e.length===0));
 auth=true;await p.reload({waitUntil:'networkidle0'});check(width+': mock reentry '+sid,JSON.stringify(await inspect())===JSON.stringify(first));
 check(width+': no overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:out+'/'+width+'-'+sid+'.png'});
 }
 await p.goto('http://127.0.0.1:4198/work/result?sessionId=invalid',{waitUntil:'networkidle0'});check(width+': 404 missing state',await p.$eval('body',e=>e.innerText.includes('bulunamadı')));
 resultMode='blocked';await p.goto('http://127.0.0.1:4198/work/result?sessionId='+ids[0],{waitUntil:'networkidle0'});check(width+': result read error',await p.$eval('[role="alert"]',e=>e.innerText.includes('yüklenemedi')));
 resultMode='records';await p.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='Tekrar dene').click());await p.waitForSelector('[data-session-id]');check(width+': result retry succeeds',true);
 historyMode='blocked';await p.goto('http://127.0.0.1:4198/#history',{waitUntil:'networkidle0'});check(width+': RLS/error no fake empty',await p.$eval('#history',e=>e.innerText.includes('yüklenemedi')&&!e.innerText.includes('Henüz çalışma geçmişi')));
 historyMode='records';await p.evaluate(()=>[...document.querySelectorAll('#history button')].find(e=>e.textContent==='Tekrar dene').click());await p.waitForFunction(()=>document.querySelectorAll('#history details').length===7);check(width+': history retry succeeds',true);
 historyMode='empty';await p.reload({waitUntil:'networkidle0'});check(width+': genuine empty message',await p.$eval('#history',e=>e.innerText.includes('Henüz çalışma geçmişi oluşmadı.')));
 await p.close();
 }
 check('no work mutation requests',proof.requests.every(r=>r.method==='GET'));check('no page errors',proof.errors.length===0);proof.passed=true;
}finally{if(browser)await browser.close();await server.close();fs.writeFileSync(out+'/browser.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({mode:proof.mode,passed:proof.passed,checks:proof.checks,errors:proof.errors}));}
