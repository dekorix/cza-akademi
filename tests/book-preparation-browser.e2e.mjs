import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const previewSecret = 'd'.repeat(64);
const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  preview: process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW,
  previewSecret: process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  tempDirectory: process.env.TMPDIR,
};

let browser;
let serverProcess;
let taskTemp;

function configureEnvironment() {
  process.env.NODE_ENV = 'development';
  process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET = previewSecret;
  delete process.env.DATABASE_URL;
}

function restoreEnvironment() {
  for (const [name, value] of [
    ['NODE_ENV', originalEnvironment.nodeEnv],
    ['CZA_BOOK_PREPARATION_ISOLATED_PREVIEW', originalEnvironment.preview],
    [
      'CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET',
      originalEnvironment.previewSecret,
    ],
    ['DATABASE_URL', originalEnvironment.databaseUrl],
    ['TMPDIR', originalEnvironment.tempDirectory],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function signedBootstrapTicket(subject = 'educator-preview:browser-test') {
  const issuedAt = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      version: 'cza-book-preparation-bootstrap-hmac-v2',
      audience: 'book-preparation-bootstrap',
      role: 'educator',
      subject,
      nonce: randomBytes(32).toString('hex'),
      issuedAt,
      expiresAt: issuedAt + 2 * 60_000,
    }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', previewSecret)
    .update(payload, 'utf8')
    .digest('base64url');
  return `${payload}.${signature}`;
}

async function chromiumBinary() {
  taskTemp = await mkdtemp(join(tmpdir(), 'cza-book-preparation-e2e-'));
  process.env.TMPDIR = taskTemp;
  const packageEntry = fileURLToPath(
    import.meta.resolve('@sparticuz/chromium'),
  );
  return inflate(resolve(dirname(packageEntry), '../bin/chromium.br'));
}

async function startServer() {
  const child = spawn(
    process.execPath,
    ['tests/book-preparation-e2e-server.mjs'],
    {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
    process.stderr.write(`[book-e2e-server] ${chunk.toString()}`);
  });
  await new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new Error(`Book E2E server timeout:\n${output}`)),
      20_000,
    );
    const poll = setInterval(() => {
      if (!output.includes('CZA_BOOK_PREPARATION_E2E_READY')) return;
      clearInterval(poll);
      clearTimeout(timeout);
      resolveReady();
    }, 25);
    child.once('exit', (code, signal) => {
      clearInterval(poll);
      clearTimeout(timeout);
      rejectReady(
        new Error(`Book E2E server exited (${code ?? signal}):\n${output}`),
      );
    });
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function clickButton(page, label) {
  const handle = await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll('button')].find(
        (button) => !button.disabled && button.textContent?.includes(expected),
      ),
    { timeout: 10_000 },
    label,
  );
  const element = handle.asElement();
  assert.ok(element, `button not found: ${label}`);
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

try {
  configureEnvironment();
  const executablePath = await chromiumBinary();
  serverProcess = await startServer();
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  const browserContext = browser.defaultBrowserContext();
  const unauthenticated = await page.goto(
    'http://localhost:4174/book-preparation',
    { waitUntil: 'networkidle0' },
  );
  assert.equal(unauthenticated?.status(), 404);
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /Kitap Hazırlama Stüdyosu/,
  );

  const ticket = signedBootstrapTicket();
  await page.goto('http://localhost:4174/book-preparation/access', {
    waitUntil: 'networkidle0',
  });
  await waitForText(page, 'Kitap Hazırlama erişimi');
  await page.type('#book-preview-exchange-token', `${ticket}x`);
  await clickButton(page, 'Eğitimci önizlemesini aç');
  await waitForText(page, 'Erişim doğrulanamadı');

  await page.click('#book-preview-exchange-token');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type(ticket);
  await clickButton(page, 'Eğitimci önizlemesini aç');
  await page.waitForFunction(
    () => window.location.pathname === '/book-preparation',
    { timeout: 10_000 },
  );
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await waitForText(page, 'Kitap Hazırlama Stüdyosu');
  await waitForText(page, 'Persistence kapalı');
  assert.equal(
    await page.$eval('#book-title', (input) => input.value),
    'Gökyüzü Kütüphanesi',
  );
  assert.ok(await page.$('[data-testid="book-rendered-preview"]'));
  assert.equal(
    await page.$eval('textarea[aria-label="Blok 2 metni"]', (element) =>
      element.value.includes('Ada, sabah penceresini açınca'),
    ),
    true,
  );

  await clickButton(page, 'Sunucuda doğrula ve önizle');
  await waitForText(page, 'Sunucu doğrulaması tamamlandı');
  const summary = await page.$eval(
    '[data-testid="book-server-summary"]',
    (element) => element.textContent || '',
  );
  assert.match(summary, /[0-9a-f]{64}/);
  assert.match(summary, /serverValidated=true · persisted=false/);
  assert.deepEqual(consoleErrors, []);

  const previewCookies = (await browserContext.cookies()).filter(
    (cookie) => cookie.name === '__Host-cza_book_preparation_educator_preview',
  );
  assert.equal(previewCookies.length, 1);
  assert.equal(previewCookies[0].httpOnly, true);
  assert.equal(previewCookies[0].secure, true);
  assert.equal(previewCookies[0].sameSite, 'Strict');
  const capturedCookie = `${previewCookies[0].name}=${previewCookies[0].value}`;

  await page.click('textarea[aria-label="Blok 2 metni"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type('<script>globalThis.bookInjected=true</script>');
  await clickButton(page, 'Sunucuda doğrula ve önizle');
  await waitForText(page, 'Önizleme reddedildi: book_block_text_invalid');
  assert.equal(await page.evaluate(() => globalThis.bookInjected), undefined);
  assert.equal(
    await page.$('[data-testid="book-rendered-preview"] script'),
    null,
  );
  assert.equal(consoleErrors.length, 1);
  assert.match(consoleErrors[0], /status of 400/);

  const [logoutNavigation] = await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    clickButton(page, 'Güvenli çıkış'),
  ]);
  assert.equal(logoutNavigation?.status(), 404);
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /Kitap Hazırlama Stüdyosu/,
  );
  assert.equal(
    (await browserContext.cookies()).some(
      (cookie) =>
        cookie.name === '__Host-cza_book_preparation_educator_preview',
    ),
    false,
  );
  const revokedReplay = await fetch(
    'http://localhost:4174/api/book-preparation/preview',
    {
      method: 'POST',
      headers: {
        origin: 'http://localhost:4174',
        'content-type': 'application/json',
        cookie: capturedCookie,
      },
      body: JSON.stringify({ action: 'preview', draft: {} }),
    },
  );
  assert.equal(revokedReplay.status, 404);

  process.stdout.write(
    'book-preparation browser E2E: bootstrap cookie, render, injection rejection, logout revocation PASS\n',
  );
} finally {
  if (browser) await browser.close();
  await stopServer(serverProcess);
  restoreEnvironment();
  if (taskTemp) await rm(taskTemp, { recursive: true, force: true });
}
