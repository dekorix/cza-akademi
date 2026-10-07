import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  integration: process.env.CZA_PHASE2_INTEGRATION_PREVIEW,
  attention: process.env.CZA_ATTENTION_ISOLATED_PREVIEW,
  attentionSecret: process.env.CZA_ATTENTION_SESSION_SECRET,
  reading: process.env.CZA_FAST_READING_ISOLATED_PREVIEW,
  readingSecret: process.env.CZA_FAST_READING_SESSION_SECRET,
  book: process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW,
  bookSecret: process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  tmpdir: process.env.TMPDIR,
};

let browser;
let server;
let taskTemp;

function configureEnvironment() {
  process.env.NODE_ENV = 'development';
  process.env.CZA_PHASE2_INTEGRATION_PREVIEW = 'true';
  process.env.CZA_ATTENTION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_ATTENTION_SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.CZA_FAST_READING_ISOLATED_PREVIEW = 'true';
  process.env.CZA_FAST_READING_SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET = randomBytes(32).toString(
    'hex',
  );
  delete process.env.DATABASE_URL;
}

function restoreEnvironment() {
  for (const [name, value] of [
    ['NODE_ENV', originalEnvironment.nodeEnv],
    ['CZA_PHASE2_INTEGRATION_PREVIEW', originalEnvironment.integration],
    ['CZA_ATTENTION_ISOLATED_PREVIEW', originalEnvironment.attention],
    ['CZA_ATTENTION_SESSION_SECRET', originalEnvironment.attentionSecret],
    ['CZA_FAST_READING_ISOLATED_PREVIEW', originalEnvironment.reading],
    ['CZA_FAST_READING_SESSION_SECRET', originalEnvironment.readingSecret],
    ['CZA_BOOK_PREPARATION_ISOLATED_PREVIEW', originalEnvironment.book],
    [
      'CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET',
      originalEnvironment.bookSecret,
    ],
    ['DATABASE_URL', originalEnvironment.databaseUrl],
    ['TMPDIR', originalEnvironment.tmpdir],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

async function browserBinary() {
  taskTemp = await mkdtemp(join(tmpdir(), 'cza-phase2-e2e-'));
  process.env.TMPDIR = taskTemp;
  const packageEntry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(packageEntry), '../bin/chromium.br'));
}

async function startServer() {
  const child = spawn(process.execPath, ['tests/phase2-e2e-server.mjs'], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  await new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new Error(`phase2 server timeout:\n${output}`)),
      20_000,
    );
    const poll = setInterval(() => {
      if (!output.includes('CZA_PHASE2_E2E_READY')) return;
      clearInterval(poll);
      clearTimeout(timeout);
      resolveReady();
    }, 25);
    child.once('exit', (code) => {
      clearInterval(poll);
      clearTimeout(timeout);
      rejectReady(new Error(`phase2 server exited ${code}:\n${output}`));
    });
  });
  return child;
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once('exit', resolveExit));
  server.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function clickText(page, text) {
  const handle = await page.waitForFunction(
    (label) =>
      [...document.querySelectorAll('button')].find(
        (button) => button.textContent?.replace(/\s+/g, ' ').trim() === label,
      ),
    { timeout: 10_000 },
    text,
  );
  const element = handle.asElement();
  assert.ok(element, `button missing: ${text}`);
  await element.click();
  await handle.dispose();
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    { timeout: 10_000 },
    text,
  );
}

configureEnvironment();
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

  let response = await page.goto('http://127.0.0.1:4177/phase2', {
    waitUntil: 'networkidle0',
  });
  assert.equal(response?.status(), 200);
  assert.equal(await page.$$eval('[data-module-id]', (items) => items.length), 2);
  assert.ok(await page.$('[data-module-id="fast-reading"]'));
  assert.ok(await page.$('[data-module-id="attention"]'));
  assert.equal(await page.$('[data-module-id="book-preparation"]'), null);
  await waitForText(page, 'server_observed_approximation');
  await waitForText(page, 'synthetic_attention');

  await clickText(page, 'Eğitmen');
  assert.equal(await page.$$eval('[data-module-id]', (items) => items.length), 1);
  assert.ok(await page.$('[data-module-id="book-preparation"]'));
  assert.equal(await page.$('[data-module-id="attention"]'), null);

  response = await page.goto(
    'http://127.0.0.1:4177/book-preparation/access',
    { waitUntil: 'networkidle0' },
  );
  assert.equal(response?.status(), 200);
  await waitForText(page, 'Kitap Hazırlama erişimi');

  response = await page.goto('http://127.0.0.1:4177/speed-reading', {
    waitUntil: 'networkidle0',
  });
  assert.equal(response?.status(), 200);
  await waitForText(page, 'Hızlı Okuma');

  response = await page.goto('http://127.0.0.1:4177/attention', {
    waitUntil: 'networkidle0',
  });
  assert.equal(response?.status(), 200);
  const attentionText = await page.$eval('body', (element) => element.innerText);
  assert.match(attentionText, /Sakin bak\. Çelişkiyi yönet\. Hatırla\./);
  assert.deepEqual(consoleErrors, []);
  process.stdout.write('CZA_PHASE2_BROWSER_E2E_OK\n');
} finally {
  if (browser) await browser.close();
  await stopServer();
  if (taskTemp) await rm(taskTemp, { recursive: true, force: true });
  restoreEnvironment();
}
