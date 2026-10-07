import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:4182';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('U2_STAGING_DATABASE_URL_REQUIRED');
if (process.env.CZA_U2_STAGING_PROJECT_ID !== 'orange-resonance-01270480') {
  throw new Error('U2_STAGING_PROJECT_ID_MISMATCH');
}
if (process.env.CZA_U2_STAGING_BRANCH_ID !== 'br-lucky-rain-b2po93vx') {
  throw new Error('U2_STAGING_BRANCH_ID_MISMATCH');
}

let browser;
let server;
let browserTemp;

async function browserBinary() {
  browserTemp = await mkdtemp(join(tmpdir(), 'cza-u2-browser-'));
  const packageEntry = fileURLToPath(
    import.meta.resolve('@sparticuz/chromium'),
  );
  return inflate(resolve(dirname(packageEntry), '../bin/chromium.br'));
}

async function startServer() {
  const child = spawn(
    process.execPath,
    ['tests/u2-work-center-e2e-server.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DATABASE_URL: databaseUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('U2_BROWSER_SERVER_TIMEOUT')),
      20_000,
    );
    const inspect = (chunk) => {
      const text = chunk.toString();
      if (text.includes('CZA_U2_E2E_READY')) {
        clearTimeout(timeout);
        resolveReady();
      }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`U2_BROWSER_SERVER_EXIT_${code}`));
    });
  });
  return child;
}

async function assertViewport(page, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const dashboardProbe = await page.evaluate(async () => {
    const response = await fetch('/api/core/dashboard', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const body = await response.json();
    return {
      status: response.status,
      ok: body.ok,
      error: body.error,
      assignments: Array.isArray(body.dashboard?.assignments)
        ? body.dashboard.assignments.map((item) => item.title)
        : [],
    };
  });
  assert.deepEqual(
    { status: dashboardProbe.status, ok: dashboardProbe.ok },
    { status: 200, ok: true },
    `dashboard probe failed: ${JSON.stringify(dashboardProbe)}`,
  );
  await page.waitForFunction(
    () => document.body.innerText.includes('U2 Acceptance Demo A'),
    { timeout: 15_000 },
  );
  const state = await page.evaluate(() => {
    const text = document.body.innerText.toLocaleLowerCase('tr-TR');
    return {
      heading: document.querySelector('h1')?.textContent?.trim(),
      hasWorkCenter: text.includes('çalışma merkezim'),
      hasCompleted: text.includes('tamamladıklarım'),
      hasHistory: text.includes('son çalışma geçmişim'),
      hasAssignment: text.includes('u2 acceptance demo a'),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  assert.equal(state.hasWorkCenter, true);
  assert.equal(state.hasCompleted, true);
  assert.equal(state.hasHistory, true);
  assert.equal(state.hasAssignment, true);
  assert.equal(state.overflow, false);
  assert.ok(state.heading);
}

try {
  server = await startServer();
  browser = await puppeteer.launch({
    executablePath: await browserBinary(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await browser.defaultBrowserContext().setCookie({
    name: 'cza_student_session',
    value: 'u2-acceptance-demo-a-20260917',
    url: origin,
    httpOnly: true,
    sameSite: 'Lax',
  });
  const response = await page.goto(`${origin}/work`, {
    waitUntil: 'domcontentloaded',
  });
  assert.equal(response?.status(), 200);
  await assertViewport(page, 1440, 900);
  await assertViewport(page, 390, 844);
  assert.deepEqual(consoleErrors, []);
  process.stdout.write(
    'U2_BROWSER_ACCEPTANCE=PASS UI_DESKTOP=PASS UI_MOBILE=PASS HORIZONTAL_OVERFLOW=false CONSOLE_ERRORS=0\n',
  );
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill('SIGTERM');
  if (browserTemp) await rm(browserTemp, { recursive: true, force: true });
}
