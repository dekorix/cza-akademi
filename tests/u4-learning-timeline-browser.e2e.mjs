import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:4184';
let browser, server, browserTemp;
const now = '2026-09-17T15:21:06.920Z';
const event = (eventId, eventType, verificationStatus, title, resultSummary = null) => ({
  eventId, studentId: 'c2000000-0000-4000-8000-000000000003', occurredAt: now,
  eventType, moduleCode: 'finger_read', assignmentId: null, trainingSessionId: null,
  learningRecordId: null, title, status: 'completed', resultSummary,
  errorSummary: eventType === 'ERROR_OBSERVED' ? { errorType: 'demo_error' } : null,
  skillSummary: null, supportLevel: null,
  provenance: verificationStatus === 'server_verified' ? 'server_authoritative' : 'client_reported',
  verificationStatus, sourceReference: eventType === 'ERROR_OBSERVED' ? 'question_attempts' : 'training_sessions',
});
const timeline = { ok: true, timeline: { events: [
  event('session:c2000000-0000-4000-8000-000000000015', 'WORK_COMPLETED', 'server_verified', 'Parmak Okuma', { attemptCount: 2, correctCount: 2, accuracy: 100 }),
  event('record:22d35e09-adb7-4c9f-82f3-e9def4df19ad', 'LEARNING_RESULT', 'client_reported', 'Parmak Okuma', { attemptCount: 2, correctCount: 1, accuracy: 50 }),
  event('error:cb3a0adf-99c3-4527-b478-e83de3990ec6', 'ERROR_OBSERVED', 'client_reported', 'Parmak Okuma'),
], hasMore: false, nextCursor: null } };
const dashboard = { ok: true, dashboard: {
  profile: { id: 'c2000000-0000-4000-8000-000000000003', name: 'U4 Demo Öğrenci', username: 'u4-demo' },
  summary: { activeAssignments: 1, completedSessions: 1, totalAttempts: 2, correctAttempts: 1, accuracy: 50, availableAssignments: 1, inProgressAssignments: 0, completedAssignments: 1 },
  assignments: [], recentActivity: [], skillProfile: [],
} };
const educatorStudent = { id: 'c2000000-0000-4000-8000-000000000003', name: 'U4 Demo Öğrenci', code: 'U4-A', username: 'u4-demo' };
const educatorDetail = { ok: true, student: { ...educatorStudent, campusCode: 'U4-A' }, work: { active: [], completed: [] }, attempts: [], errors: [], evidence: [], history: [], learningProfile: { clientReportedSkills: [], serverVerifiedSkills: [], clientReportedRecordCount: 1, serverVerifiedEvidenceCount: 1 } };

async function binary() {
  browserTemp = await mkdtemp(join(tmpdir(), 'cza-u4-browser-'));
  const entry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(entry), '../bin/chromium.br'));
}
async function startServer() {
  const child = spawn(process.execPath, ['tests/u4-learning-timeline-e2e-server.mjs'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ready, reject) => {
    const timeout = setTimeout(() => reject(new Error('U4_BROWSER_SERVER_TIMEOUT')), 20_000);
    const inspect = (chunk) => { if (chunk.toString().includes('CZA_U4_E2E_READY')) { clearTimeout(timeout); ready(); } };
    child.stdout.on('data', inspect); child.stderr.on('data', inspect);
    child.once('exit', (code) => reject(new Error(`U4_BROWSER_SERVER_EXIT_${code}`)));
  });
  return child;
}
async function assertViewport(page, path, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Doğrulanmış kanıt') && document.body.innerText.includes('Kaydedilen sonuç'));
  await page.evaluate(() => document.querySelectorAll('details').forEach((detail) => { detail.open = true; }));
  const state = await page.evaluate(() => ({
    timeline: document.body.innerText.includes('Kronolojik öğrenci geçmişi') || document.body.innerText.includes('Geçmişim'),
    verified: document.body.innerText.includes('Doğrulanmış kanıt'), reported: document.body.innerText.includes('Kaydedilen sonuç'),
    reportedCorrectness: document.body.innerText.includes('Bildirilen: 1/2 doğru'),
    forgedVerifiedCorrectness: document.body.innerText.includes('2/2 doğru'),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  assert.deepEqual(state, { timeline: true, verified: true, reported: true, reportedCorrectness: true, forgedVerifiedCorrectness: false, overflow: false });
}

try {
  server = await startServer();
  browser = await puppeteer.launch({ executablePath: await binary(), headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    const respond = (body) => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/core/dashboard') return void respond(dashboard);
    if (url.pathname === '/api/core/history' || url.pathname === '/api/educator-student-history') return void respond(timeline);
    if (url.pathname === '/api/educator-auth') return void respond({ ok: true, user: { name: 'U4 Demo Eğitmen' } });
    if (url.pathname === '/api/educator-students') return void respond({ ok: true, students: [educatorStudent], hasMore: false });
    if (url.pathname === '/api/educator-student-detail') return void respond(educatorDetail);
    if (url.pathname === '/api/educator-assignments') return void respond({ ok: true, assignments: [] });
    void request.continue();
  });
  for (const [path, width, height] of [['/', 1440, 900], ['/', 390, 844], ['/educator', 1440, 900], ['/educator', 390, 844]]) await assertViewport(page, path, width, height);
  assert.deepEqual(errors, []);
  process.stdout.write('U4_BROWSER_ACCEPTANCE=PASS UI_DESKTOP=PASS UI_MOBILE=PASS HORIZONTAL_OVERFLOW=false CONSOLE_ERRORS=0\n');
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill('SIGTERM');
  if (browserTemp) await rm(browserTemp, { recursive: true, force: true });
}
