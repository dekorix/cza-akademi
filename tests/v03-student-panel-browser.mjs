// LOCAL MOCK UI ONLY. No real login, Neon readback or Worker acceptance is claimed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const evidenceDir = process.env.CZA_V03_EVIDENCE_DIR || 'docs/evidence/v03-local';
fs.mkdirSync(evidenceDir, { recursive: true });
const studentId = '20000000-0000-4000-8000-000000000001'; // Existing #87 synthetic ID.
const recipeId = '30000000-0000-4000-8000-000000000001';
const dashboard = { profile: { id: studentId, name: 'Sentetik QA', username: 'qa' },
  summary: { activeAssignments: 1, completedSessions: 0, totalAttempts: 1, correctAttempts: 1, accuracy: 100 },
  assignments: [{ id: recipeId, moduleCode: 'soroban_read', moduleName: 'Soroban', title: 'Yerel UI test ataması',
    status: 'in_progress', instructions: 'Önce kaldığın çalışmayı sürdür.', sessionCount: 1, completedCount: 0,
    progressPercent: 25, launchPath: '/studio?program=assigned&recipe=' + recipeId }],
  recentActivity: [], skillProfile: [] };
const profile = { student: { id: studentId, name: 'Sentetik QA', recordedFrom: null },
  calculatedAt: '2026-10-11T05:00:00Z', dataThrough: null, coverage: { attempts: 0 },
  studyPattern: { assignments: { active: 1, completed: 0, cancelled: 0 }, sessions: { total: 0, activeDaysLast30: 0 } },
  modules: [], skills: [], process: { insufficiencyReason: 'Yeterli kayıt yok.' }, recentRecords: [], errors: [], periods: [] };
const server = await createServer({ root: process.cwd(), configFile: false, logLevel: 'error',
  css: { postcss: { plugins: [tailwindcss()] } }, plugins: [vinext()],
  server: { host: '127.0.0.1', port: 4188, strictPort: true } });
let browser;
const evidence = { mode: 'LOCAL_MOCK_UI_ONLY', studentId, recipeId, checks: [], runtimeAcceptance: 'UNVERIFIED' };
try {
  await server.listen();
  const executablePath = process.env.CZA_BROWSER_PATH
    || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(path => fs.existsSync(path))
    || await chromium.executablePath();
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  evidence.browser = await browser.version();
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let authorized = true;
    await page.setRequestInterception(true);
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith('/api/')) return void request.continue();
      const send = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (!authorized) return void send({ ok: false, error: 'session_required' }, 401);
      if (path === '/api/core/dashboard') return void send({ ok: true, dashboard });
      if (path === '/api/core/learning-profile') return void send({ ok: true, profile });
      if (path === '/api/core/history') return void send({ ok: true, timeline: { events: [], hasMore: false } });
      return void send({ ok: true, program: null, coaching: null });
    });
    await page.goto('http://127.0.0.1:4188/', { waitUntil: 'networkidle0' });
    const inspect = () => page.evaluate(() => ({
      title: document.querySelector('#route-heading')?.textContent,
      route: document.querySelector('#route')?.textContent,
      recipe: document.querySelector('#route a[href^="/assignment"]')?.getAttribute('href'),
      profile: document.querySelector('#profile')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    const first = await inspect();
    assert.equal(first.title, 'Benim Öğrenme Rotam');
    assert.ok(first.route.includes('Kaldığın yerden devam et'));
    assert.ok(first.route.includes('Yerel UI test ataması'));
    assert.equal(first.recipe, '/assignment?recipe=' + recipeId);
    assert.ok(first.profile.includes('Sentetik QA'));
    assert.equal(first.overflow, false);
    await page.screenshot({ path: evidenceDir + '/' + width + '.png', fullPage: true });
    await page.reload({ waitUntil: 'networkidle0' });
    assert.deepEqual(await inspect(), first);
    authorized = false;
    await page.reload({ waitUntil: 'networkidle0' });
    assert.ok(await page.$('#home-username'));
    assert.equal(await page.$('#route'), null);
    authorized = true;
    await page.reload({ waitUntil: 'networkidle0' });
    assert.deepEqual(await inspect(), first);
    assert.deepEqual(errors, []);
    evidence.checks.push({ width, height, routeAndProfile: true, sameRecipeAfterReload: true,
      mock401HidesPanel: true, sameRecipeAfterMockReentry: true, horizontalOverflow: false, pageErrors: 0 });
    await page.close();
  }
  evidence.passed = true;
  fs.writeFileSync(evidenceDir + '/browser.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  if (browser) await browser.close();
  await server.close();
}
