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
  preview: process.env.CZA_ATTENTION_ISOLATED_PREVIEW,
  secret: process.env.CZA_ATTENTION_SESSION_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  tmpdir: process.env.TMPDIR,
};

let browser;
let server;
let taskTemp;

function configureEnvironment() {
  process.env.NODE_ENV = 'development';
  process.env.CZA_ATTENTION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_ATTENTION_SESSION_SECRET = randomBytes(32).toString('hex');
  delete process.env.DATABASE_URL;
}

function restoreEnvironment() {
  for (const [name, value] of [
    ['NODE_ENV', originalEnvironment.nodeEnv],
    ['CZA_ATTENTION_ISOLATED_PREVIEW', originalEnvironment.preview],
    ['CZA_ATTENTION_SESSION_SECRET', originalEnvironment.secret],
    ['DATABASE_URL', originalEnvironment.databaseUrl],
    ['TMPDIR', originalEnvironment.tmpdir],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

async function browserBinary() {
  taskTemp = await mkdtemp(join(tmpdir(), 'cza-attention-e2e-'));
  process.env.TMPDIR = taskTemp;
  const packageEntry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(packageEntry), '../bin/chromium.br'));
}

async function startServer() {
  const child = spawn(process.execPath, ['tests/attention-e2e-server.mjs'], {
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
      () => rejectReady(new Error(`attention server timeout:\n${output}`)),
      20_000,
    );
    const poll = setInterval(() => {
      if (!output.includes('CZA_ATTENTION_E2E_READY')) return;
      clearInterval(poll);
      clearTimeout(timeout);
      resolveReady();
    }, 25);
    child.once('exit', (code) => {
      clearInterval(poll);
      clearTimeout(timeout);
      rejectReady(new Error(`attention server exited ${code}:\n${output}`));
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
        (button) =>
          !button.disabled &&
          button.textContent?.replace(/\s+/g, ' ').trim().includes(label),
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

async function completeStroop(page) {
  await clickText(page, 'Egzersizi hazırla');
  await clickText(page, 'Uyaranı göster');
  for (let round = 0; round < 4; round += 1) {
    await page.waitForSelector('[data-testid="stroop-word"]');
    await new Promise((resolveWait) => setTimeout(resolveWait, 140));
    const ink = await page.$eval('[data-testid="stroop-word"]', (element) => {
      const mapping = {
        'text-red-600': 'red',
        'text-emerald-600': 'green',
        'text-blue-600': 'blue',
        'text-amber-500': 'amber',
      };
      return Object.entries(mapping).find(([className]) =>
        element.classList.contains(className),
      )?.[1];
    });
    assert.ok(ink);
    await page.click(`button[data-color-id="${ink}"]`);
    if (round < 3) {
      await waitForText(page, 'Doğru odak');
      await clickText(page, 'Sonraki turu başlat');
    }
  }
  await waitForText(page, 'Sentetik dikkat özeti');
  await waitForText(page, '4/4');
}

async function completeMatrix(page) {
  await clickText(page, 'Yeniden çalış');
  await page.click('button[data-exercise-id="visual_memory_matrix"]');
  await clickText(page, 'Egzersizi hazırla');
  await clickText(page, 'Uyaranı göster');
  for (let round = 0; round < 4; round += 1) {
    await page.waitForSelector('[data-testid="memory-matrix"][data-visible="true"]');
    const activeLabels = await page.$$eval(
      '[data-testid="memory-matrix"] button.bg-sky-500',
      (buttons) => buttons.map((button) => button.getAttribute('aria-label')),
    );
    assert.equal(activeLabels.length, 3);
    await page.waitForSelector(
      '[data-testid="memory-matrix"][data-visible="false"]',
      { timeout: 5_000 },
    );
    for (const label of activeLabels) {
      assert.ok(label);
      await page.click(`button[aria-label="${label}"]`);
    }
    await clickText(page, 'Yanıtı gönder');
    if (round < 3) {
      await waitForText(page, 'Doğru odak');
      await clickText(page, 'Sonraki turu başlat');
    }
  }
  await waitForText(page, 'Sentetik dikkat özeti');
  await waitForText(page, '4/4');
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
  const response = await page.goto('http://127.0.0.1:4175/attention', {
    waitUntil: 'networkidle0',
  });
  assert.equal(response?.status(), 200);
  await completeStroop(page);
  await completeMatrix(page);
  assert.deepEqual(consoleErrors, []);
  process.stdout.write('CZA_ATTENTION_BROWSER_E2E_OK\n');
} finally {
  if (browser) await browser.close();
  await stopServer();
  if (taskTemp) await rm(taskTemp, { recursive: true, force: true });
  restoreEnvironment();
}
