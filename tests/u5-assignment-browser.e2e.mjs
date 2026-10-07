import assert from 'node:assert/strict';
import { selectEducatorStudent } from '../scripts/qa/trusted-educator-transport.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:4183';
let browser; let server; let browserTemp;
const student = { id: '55000000-0000-4000-8000-000000000009', name: 'U5 Demo Öğrenci', code: 'U5-A', username: 'u5-demo' };
const detail = { ok: true, student: { ...student, campusCode: student.code }, work: { active: [], completed: [] }, attempts: [], errors: [], evidence: [], history: [], learningProfile: { clientReportedSkills: [], serverVerifiedSkills: [], clientReportedRecordCount: 0, serverVerifiedEvidenceCount: 0 } };
let assignments = [{ id: '55000000-0000-4000-8000-000000000012', module_code: 'finger_read', name: 'U5 Atanmış Çalışma', instructions: 'On turu dikkatle tamamla.', starts_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), status: 'active', session_count: 0, completed_count: 0 }];
const profile = { ok: true, profile: { student: { id: student.id, name: student.name, recordedFrom: null }, calculatedAt: new Date().toISOString(), dataThrough: null, coverage: { assignments: 0, sessions: 0, attempts: 0, records: 0, evidence: 0 }, studyPattern: { assignments: { active: 0, completed: 0, cancelled: 0 }, sessions: { total: 0, completed: 0, activeDaysLast30: 0, lastStudyAt: null }, provenance: 'SERVER_AUTHORITATIVE' }, modules: [], skills: [], recentRecords: [], errors: [], process: { supportLevels: [], strategy: null, selfCorrection: null, repetition: null, transfer: null, insufficiencyReason: 'Yeterli kayıt yok' }, periods: [], coaching: { activePrograms: 1, publishedPlans: 1, studyLogs: 0, examResults: 1, performanceProvenance: 'CLIENT_REPORTED' } } };
let created;

async function binary() {
  browserTemp = await mkdtemp(join(tmpdir(), 'cza-u5-browser-'));
  const entry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(entry), '../bin/chromium.br'));
}
async function startServer() {
  const child = spawn(process.execPath, ['tests/u3-educator-e2e-server.mjs'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('U5_BROWSER_SERVER_TIMEOUT')), 20000);
    const inspect = (chunk) => { if (chunk.toString().includes('CZA_U3_E2E_READY')) { clearTimeout(timeout); done(); } };
    child.stdout.on('data', inspect); child.stderr.on('data', inspect); child.once('exit', (code) => reject(new Error(`U5_BROWSER_SERVER_EXIT_${code}`)));
  }); return child;
}
async function verifyViewport(page, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 }); await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Ödev yönetimi')).catch(async error => { console.error('U5_UI_STATE=' + (await page.evaluate(() => document.body.innerText)).slice(0,1200)); throw error; });
  const state = await page.evaluate(() => ({ text: document.body.innerText, overflow: document.documentElement.scrollWidth > window.innerWidth }));
  for (const label of ['Ödev yönetimi', 'Ödev oluştur', 'Eğitmen talimatı', 'U5 Atanmış Çalışma', 'Düzenle', 'İptal']) assert.ok(state.text.includes(label), label);
  assert.equal(state.overflow, false);
}

try {
  server = await startServer(); browser = await puppeteer.launch({ executablePath: await binary(), headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage(); const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') { errors.push(message.text()); console.error('U5_CONSOLE_ERROR=' + message.text()); } }); page.on('pageerror', (error) => { errors.push(error.message); console.error('U5_PAGE_ERROR=' + error.message); });
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url()); const reply = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/educator-learning-profile') return void reply(profile);
    if (url.pathname === '/api/educator-analytics') return void reply({ok:true, report:{summary:{assignments:null,sessions:null,clientPerformance:null},modules:[],errors:[],evidence:[],trend:[],sessions:[],nextCursor:null}});
    if (url.pathname === '/api/educator-coaching') return void reply({ok:true,coaching:{programs:[],goals:[],topics:[],plans:[],studyLogs:[],exams:[],mistakes:[],meetings:[],templates:[],provenance:'CLIENT_REPORTED'}});
    if (url.pathname === '/api/educator-auth') return void reply({ ok: true, user: { name: 'Demo Eğitmen' } });
    if (url.pathname === '/api/educator-students') return void reply({ ok: true, students: [student], hasMore: false });
    if (url.pathname === '/api/educator-student-detail') return void reply(detail);
    if (url.pathname === '/api/educator-student-history') return void reply({ ok: true, timeline: { events: [], hasMore: false, nextCursor: null } });
    if (url.pathname === '/api/educator-assignments') {
      const body = JSON.parse((await request.fetchPostData()) || '{}');
      if (body.action === 'list') return void reply({ ok: true, assignments });
      if (body.action === 'create') { created = body; assignments = [...assignments, { id: '55000000-0000-4000-8000-000000000014', module_code: body.moduleCode, name: body.title, instructions: body.instructions, starts_at: null, expires_at: null, status: 'active', session_count: 0, completed_count: 0 }]; return void reply({ ok: true, assignment: assignments.at(-1) }, 201); }
    }
    void request.continue();
  });
  await page.goto(`${origin}/educator`, { waitUntil: 'networkidle0' });
  await verifyViewport(page, 1440, 900); await verifyViewport(page, 390, 844);
  await selectEducatorStudent(await page.createCDPSession(), student.id);
  await page.type('#u5-title', 'U5 Yeni Demo Ödevi'); await page.type('#u5-instructions', 'Demo talimatı');
  await page.evaluate(() => document.querySelector('#u5-title')?.closest('form')?.requestSubmit());
  await page.waitForFunction(() => document.body.innerText.includes('Ödev oluşturuldu.'));
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(el => el.textContent?.includes('Çalışma raporu'))?.click());
  await page.waitForFunction(() => document.querySelector('#studentCode')?.value === '55000000-0000-4000-8000-000000000009');
  assert.equal(await page.$eval('#studentCode', el => el.value), student.id);
  assert.equal(created.studentId, student.id); assert.match(created.clientRequestId, /^[0-9a-f-]{36}$/); assert.equal(created.educatorId, undefined); assert.deepEqual(errors, []);
  process.stdout.write('U5_BROWSER_ACCEPTANCE=PASS UI_DESKTOP=PASS UI_MOBILE=PASS HORIZONTAL_OVERFLOW=false CONSOLE_ERRORS=0\n');
} finally {
  if (browser) await browser.close(); if (server && !server.killed) server.kill('SIGTERM'); if (browserTemp) await rm(browserTemp, { recursive: true, force: true });
}
