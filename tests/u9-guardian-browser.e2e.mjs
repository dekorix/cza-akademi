import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflate} from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const origin='http://127.0.0.1:4187';
let browser;let server;let browserTemp;
const students=[{id:'c2000000-0000-4000-8000-000000000003',name:'Ada Demo',campusCode:'U9-A'},{id:'c2000000-0000-4000-8000-000000000011',name:'Bora Demo',campusCode:'U9-B'}];
const dashboard={ok:true,dashboard:{
  student:{id:students[0].id,name:students[0].name},
  summary:{activeAssignments:1,completedAssignments:2,completedSessions:4,lastStudyAt:'2026-09-18T10:00:00Z',evidenceStatus:'AVAILABLE'},
  assignments:[{id:'99000000-0000-4000-8000-000000000001',title:'Matematik Planı',instructions:'20 soru çöz.',taskKind:'academic',subject:'MAT',topic:'Çarpanlar',status:'available',startsAt:'2026-09-18T00:00:00Z',expiresAt:null}],
  recentActivity:[{id:'99000000-0000-4000-8000-000000000002',title:'Soroban Okuma',status:'completed',startedAt:'2026-09-17T10:00:00Z',completedAt:'2026-09-17T10:20:00Z'}],
  report:{summary:{clientPerformance:{attempts:20,accuracy:75,evidenceStatus:'AVAILABLE',provenance:'CLIENT_REPORTED'}},modules:[],errors:[]},
  profile:{coverage:{assignments:3,sessions:4,attempts:20,records:4,evidence:2},studyPattern:{sessions:{activeDaysLast30:4,lastStudyAt:'2026-09-18T10:00:00Z'}},skills:[{skillCode:'MAT-ÇARPANLAR',recordCount:2,provenance:'CLIENT_REPORTED'}],process:{insufficiencyReason:null}},
  coaching:{programs:[{id:'99000000-0000-4000-8000-000000000003',programType:'LGS',examYear:2027,status:'active'}],goals:[{id:'99000000-0000-4000-8000-000000000004',target:{school:'Demo Lisesi'},provenance:'CLIENT_REPORTED'}],exams:[],meetings:[{id:'99000000-0000-4000-8000-000000000005',sharedSummary:'Çarpanlar tekrar edilecek.',nextWeekFocus:'MAT'}]},
}};

async function binary(){if(process.platform==='win32')return 'C:/Program Files/Google/Chrome/Application/chrome.exe';browserTemp=await mkdtemp(join(tmpdir(),'cza-u9-browser-'));const entry=fileURLToPath(import.meta.resolve('@sparticuz/chromium'));return inflate(resolve(dirname(entry),'../bin/chromium.br'));}
async function startServer(){const child=spawn(process.execPath,['tests/u7-learning-profile-e2e-server.mjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development'},stdio:['ignore','pipe','pipe']});await new Promise((ready,reject)=>{const timeout=setTimeout(()=>reject(new Error('U9_BROWSER_SERVER_TIMEOUT')),20000);const inspect=chunk=>{if(chunk.toString().includes('CZA_U7_E2E_READY')){clearTimeout(timeout);ready();}};child.stdout.on('data',inspect);child.stderr.on('data',inspect);child.once('exit',code=>reject(new Error(`U9_BROWSER_SERVER_EXIT_${code}`)));});return child;}
async function viewport(page,width,height){await page.setViewport({width,height,deviceScaleFactor:1});await page.goto(`${origin}/parent`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.includes('Veli Paneli')&&document.body.innerText.includes('Matematik Planı'));const state=await page.evaluate(()=>({text:document.body.innerText,overflow:document.documentElement.scrollWidth>window.innerWidth,overlay:Boolean(document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay'))}));for(const label of ['Veli Paneli','Ada Demo','Matematik Planı','Öğrenme profili','Rapor özeti','Koçluk / LGS / YKS','Çarpanlar tekrar edilecek.'])assert.ok(state.text.includes(label),label);assert.equal(state.overflow,false,`${width}x${height} overflow`);assert.equal(state.overlay,false,`${width}x${height} overlay`);}

try{
  server=await startServer();browser=await puppeteer.launch({executablePath:await binary(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());const respond=body=>request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});if(url.pathname==='/api/guardian-auth')return void respond({ok:true,user:{name:'Demo Veli'}});if(url.pathname==='/api/guardian/students')return void respond({ok:true,students});if(url.pathname==='/api/guardian/dashboard')return void respond(dashboard);void request.continue();});
  for(const [width,height] of [[1440,900],[768,1024],[390,844]])await viewport(page,width,height);
  assert.deepEqual(errors,[]);
  process.stdout.write('U9_BROWSER_ACCEPTANCE=PASS UI_DESKTOP=PASS UI_TABLET=PASS UI_MOBILE=PASS HORIZONTAL_OVERFLOW=false ERROR_OVERLAY=false CONSOLE_ERRORS=0 MODE=LOCAL_UI_WITH_EXPLICIT_FIXTURE\n');
}finally{if(browser)await browser.close();if(server&&!server.killed)server.kill('SIGTERM');if(browserTemp)await rm(browserTemp,{recursive:true,force:true});}
