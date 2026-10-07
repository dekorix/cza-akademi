import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:4183';
let browser;
let server;
let browserTemp;

async function binary() {
  browserTemp = await mkdtemp(join(tmpdir(), 'cza-u3-browser-'));
  const entry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(entry), '../bin/chromium.br'));
}

async function startServer() {
  const child = spawn(process.execPath, ['tests/u3-educator-e2e-server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('U3_BROWSER_SERVER_TIMEOUT')), 20_000);
    const inspect = (chunk) => {
      if (chunk.toString().includes('CZA_U3_E2E_READY')) {
        clearTimeout(timeout);
        resolveReady();
      }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('exit', (code) => reject(new Error(`U3_BROWSER_SERVER_EXIT_${code}`)));
  });
  return child;
}

const student = {
  id: 'd3000000-0000-4000-8000-000000000006',
  name: 'U3 Demo Öğrenci A',
  code: 'U3-A',
  username: 'u3-demo-a',
};
const detail = {
  ok: true,
  student: { ...student, campusCode: student.code },
  work: {
    active: [{ id: 'w1', name: 'Parmak Okuma', moduleCode: 'finger_read', source: 'teacher_assignment', active: true, session: { id: 's1', status: 'active', startedAt: new Date().toISOString(), completedAt: null, progress: {} } }],
    completed: [{ id: 'w2', name: 'Flash Anzan', moduleCode: 'flash_anzan', source: 'teacher_assignment', active: true, session: { id: 's2', status: 'completed', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), progress: {} } }],
  },
  attempts: [{ id: 'a1', moduleCode: 'finger_read', questionIndex: 1, isCorrect: false, errorType: 'CLIENT_ERROR', responseTimeMs: 900, createdAt: new Date().toISOString(), provenance: 'client_reported' }],
  errors: [{ id: 'a1', moduleCode: 'finger_read', questionIndex: 1, errorType: 'CLIENT_ERROR', errorDetail: 'Demo hata', createdAt: new Date().toISOString(), provenance: 'client_reported' }],
  evidence: [{ id: 'e1', type: 'skill_observation', verificationStatus: 'server_verified', verificationAuthority: 'demo-authority', skillCode: 'number-recognition', observedAt: new Date().toISOString() }],
  history: [{ id: 'h1', moduleCode: 'finger_read', recordOrigin: 'client_reported', verificationStatus: 'client_reported', completedAt: new Date().toISOString(), performance: {}, skills: ['number-recognition'] }],
  learningProfile: { clientReportedSkills: ['number-recognition'], serverVerifiedSkills: ['number-recognition'], clientReportedRecordCount: 1, serverVerifiedEvidenceCount: 1 },
};

async function viewport(page, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('U3 Demo Öğrenci A'));
  const state = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      list: text.includes('Yetkili öğrencilerim'),
      active: text.includes('Aktif ve devam eden çalışmalar'),
      errors: text.includes('Hata görünümü'),
      evidence: text.includes('Evidence görünümü'),
      history: text.includes('Kronolojik öğrenci geçmişi'),
      profile: text.includes('Student Learning Profile özeti'),
      client: text.includes('Öğrenci/istemci bildirimi'),
      verified: text.includes('Sunucu doğrulamalı'),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  assert.deepEqual(state, {
    list: true, active: true, errors: true, evidence: true, history: true,
    profile: true, client: true, verified: true, overflow: false,
  });
}

try {
  server = await startServer();
  browser = await puppeteer.launch({
    executablePath: await binary(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    const respond = (body) => request.respond({
      status: 200, contentType: 'application/json', body: JSON.stringify(body),
    });
    if (url.pathname === '/api/educator-auth') return void respond({ ok: true, user: { name: 'Demo Eğitmen' } });
    if (url.pathname === '/api/educator-students') return void respond({ ok: true, students: [student], hasMore: false });
    if (url.pathname === '/api/educator-student-detail') return void respond(detail);
    if (url.pathname === '/api/educator-assignments') return void respond({ ok: true, assignments: [] });
    if (url.pathname === '/api/educator-student-history') return void respond({ ok: true, timeline: { events: [], hasMore: false, nextCursor: null } });
    void request.continue();
  });
  const response = await page.goto(`${origin}/educator`, { waitUntil: 'networkidle0' });
  assert.equal(response?.status(), 200);
  await viewport(page, 1440, 900);
  await viewport(page, 390, 844);
  assert.deepEqual(errors, []);
  process.stdout.write('U3_BROWSER_ACCEPTANCE=PASS UI_DESKTOP=PASS UI_MOBILE=PASS HORIZONTAL_OVERFLOW=false CONSOLE_ERRORS=0\n');
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill('SIGTERM');
  if (browserTemp) await rm(browserTemp, { recursive: true, force: true });
}
