import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const CORRECT_ANSWERS = new Map([
  ['Çocuk neyi inceledi?', 'Eski haritayı'],
  ['Kuş neden çatıya kondu?', 'Yağmur başladığı için'],
  ['Kitabı en son kim aldı?', 'Ece’nin arkadaşı'],
  ['Deniz fidanı neden suladı?', 'Susuz kalmasın diye'],
  ['Mert neden okula yürüdü?', 'Otobüsü kaçırdı'],
  ['Aslı telefonunu nerede sessize aldı?', 'Kütüphanede'],
  ['Dala takılan şey neydi?', 'Mavi atkı'],
  ['Ayşe kekin ne kadarını götürdü?', 'Yarısını'],
  ['Elektrik kesilince ne yandı?', 'Küçük lamba'],
  ['Tohumlar ne zaman filizlendi?', 'Bahar gelince'],
  ['Bora bardağı nereye bıraktı?', 'Masaya'],
  ['Kedi nerede uyudu?', 'Minderin altında'],
  ['Selim eldivenlerini neden giydi?', 'Kar yağdı'],
  ['Duru kalemini nereye koydu?', 'Çekmeceye'],
  ['Aile pikniği neden erken bitirdi?', 'Koyu bulutları gördü'],
]);

const root = process.cwd();
const originalTmpDir = process.env.TMPDIR;
const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  preview: process.env.CZA_FAST_READING_ISOLATED_PREVIEW,
  secret: process.env.CZA_FAST_READING_SESSION_SECRET,
  databaseUrl: process.env.DATABASE_URL,
};

let browser;
let serverProcess;
let taskTemp;

async function startTestServer() {
  const child = spawn(process.execPath, ['tests/fast-reading-e2e-server.mjs'], {
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
    process.stderr.write(`[e2e-server] ${chunk.toString()}`);
  });

  await new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => {
      rejectReady(new Error(`E2E server startup timed out:\n${output}`));
    }, 20_000);

    const poll = setInterval(() => {
      if (!output.includes('CZA_FAST_READING_E2E_READY')) return;
      clearInterval(poll);
      clearTimeout(timeout);
      resolveReady();
    }, 25);

    child.once('exit', (code, signal) => {
      clearInterval(poll);
      clearTimeout(timeout);
      rejectReady(
        new Error(
          `E2E server exited before startup (${code ?? signal}):\n${output}`,
        ),
      );
    });
  });

  return { child, output: () => output };
}

async function stopTestServer(server) {
  if (!server || server.child.exitCode !== null) return;
  const exited = new Promise((resolveExit) =>
    server.child.once('exit', resolveExit),
  );
  server.child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ]);
  if (server.child.exitCode === null) server.child.kill('SIGKILL');
}

function setEnvironment() {
  process.env.NODE_ENV = 'development';
  process.env.CZA_FAST_READING_ISOLATED_PREVIEW = 'true';
  process.env.CZA_FAST_READING_SESSION_SECRET = randomBytes(32).toString('hex');
  delete process.env.DATABASE_URL;
}

function restoreEnvironment() {
  for (const [name, value] of [
    ['NODE_ENV', originalEnvironment.nodeEnv],
    ['CZA_FAST_READING_ISOLATED_PREVIEW', originalEnvironment.preview],
    ['CZA_FAST_READING_SESSION_SECRET', originalEnvironment.secret],
    ['DATABASE_URL', originalEnvironment.databaseUrl],
    ['TMPDIR', originalTmpDir],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

async function browserBinary() {
  taskTemp = await mkdtemp(join(tmpdir(), 'cza-fast-reading-e2e-'));
  process.env.TMPDIR = taskTemp;
  const packageEntry = fileURLToPath(
    import.meta.resolve('@sparticuz/chromium'),
  );
  const binaryArchive = resolve(dirname(packageEntry), '../bin/chromium.br');
  return inflate(binaryArchive);
}

async function clickButton(page, text, exact = false) {
  const handle = await page.waitForFunction(
    (label, requireExact) =>
      [...document.querySelectorAll('button')].find((button) => {
        const content = button.textContent?.replace(/\s+/g, ' ').trim() || '';
        return (
          !button.disabled &&
          (requireExact ? content === label : content.includes(label))
        );
      }),
    { timeout: 10_000 },
    text,
    exact,
  );
  const element = handle.asElement();
  assert.ok(element, `button not found: ${text}`);
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

async function answerCurrentQuestion(page, correctly) {
  await page.waitForSelector('fieldset button');
  const state = await page.evaluate(() => ({
    prompt:
      document.querySelector('fieldset')?.previousElementSibling?.textContent,
    options: [...document.querySelectorAll('fieldset button')].map((button) =>
      button.textContent?.replace(/\s+/g, ' ').trim(),
    ),
  }));
  const correct = CORRECT_ANSWERS.get(state.prompt || '');
  assert.ok(correct, `unknown prompt: ${state.prompt}`);
  const selected = correctly
    ? correct
    : state.options.find((option) => option && option !== correct);
  assert.ok(selected);
  await clickButton(page, selected, true);
  await waitForText(
    page,
    correctly
      ? 'Doğru — anlamı yakaladın.'
      : 'Bu yanıtta anlam ayrıntısı kaçtı',
  );
}

async function waitForCurrentPhraseToHide(page) {
  await page.waitForSelector('[data-testid="tachistoscope-phrase"]', {
    timeout: 10_000,
  });
  const presentation = await page.$eval(
    '[data-testid="tachistoscope-phrase"]',
    (element) => ({
      phrase: element.textContent?.trim() || '',
      exposureMs: Number(element.getAttribute('data-exposure-ms')),
      startedAt: performance.now(),
    }),
  );
  assert.notEqual(presentation.phrase, 'Metin kapandı');
  assert.ok(presentation.exposureMs >= 650);
  await page.waitForFunction(
    (phrase) => {
      const element = document.querySelector(
        '[data-testid="tachistoscope-phrase"]',
      );
      return (
        element?.textContent?.trim() === 'Metin kapandı' &&
        !document.body.innerText.includes(phrase)
      );
    },
    { timeout: 5_000 },
    presentation.phrase,
  );
  const elapsedMs = await page.evaluate(
    (startedAt) => performance.now() - startedAt,
    presentation.startedAt,
  );
  assert.ok(elapsedMs >= presentation.exposureMs - 100);
  return presentation;
}

async function completeReadingAttempt(page, correctAnswerCount) {
  for (let index = 0; index < 5; index += 1) {
    await waitForCurrentPhraseToHide(page);
    await clickButton(page, 'Soruyu göster');
    await answerCurrentQuestion(page, index < correctAnswerCount);
    await clickButton(
      page,
      index === 4 ? 'Sonucu gör' : 'Sonraki kelime grubu',
    );
  }
}

async function verifyFeedbackWaitCannotPreAgeNextTrial(page, consoleErrors) {
  await page.click('button[data-exercise-id="tachistoscope"]');
  await clickButton(page, 'Egzersizi başlat');
  const firstPresentation = await waitForCurrentPhraseToHide(page);
  await clickButton(page, 'Soruyu göster');
  await answerCurrentQuestion(page, false);

  await new Promise((resolveWait) =>
    setTimeout(resolveWait, firstPresentation.exposureMs * 2),
  );
  const phraseStartResponse = page.waitForResponse((response) => {
    const request = response.request();
    if (
      request.method() !== 'POST' ||
      !response.url().endsWith('/api/fast-reading/telemetry')
    ) {
      return false;
    }
    try {
      return JSON.parse(request.postData() || '{}').action === 'phrase-start';
    } catch {
      return false;
    }
  });
  await clickButton(page, 'Sonraki kelime grubu');
  const started = await phraseStartResponse;
  const startedBody = await started.json();
  assert.equal(started.status(), 200);
  assert.equal(typeof startedBody.sessionToken, 'string');

  assert.deepEqual(consoleErrors, []);
  const earlyRead = await page.evaluate(async (sessionToken) => {
    const response = await fetch('/api/fast-reading/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'read', sessionToken }),
    });
    return { status: response.status, body: await response.json() };
  }, startedBody.sessionToken);
  assert.equal(earlyRead.status, 400);
  assert.equal(earlyRead.body.error, 'fast_reading_duration_invalid');
  assert.equal(consoleErrors.length, 1);
  assert.match(consoleErrors[0], /status of 400/);
  consoleErrors.length = 0;
}

try {
  setEnvironment();
  const executablePath = await browserBinary();
  serverProcess = await startTestServer();

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--use-gl=disabled',
      '--disable-software-rasterizer',
    ],
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.goto('http://127.0.0.1:4173/speed-reading', {
    waitUntil: 'networkidle0',
  });

  const deliveredClientCode = await page.evaluate(async () => {
    const urls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /(?:\.js|\.tsx)(?:\?|$)/.test(url));
    return (
      await Promise.all(
        urls.map((url) => fetch(url).then((item) => item.text())),
      )
    ).join('\n');
  });
  assert.doesNotMatch(deliveredClientCode, /correctOptionIndex|Meraklı çocuk/);

  const lockedInitially = await page.$eval(
    'button[aria-label="Keşif — kilitli"]',
    (button) => button.disabled,
  );
  assert.equal(lockedInitially, true);

  await verifyFeedbackWaitCannotPreAgeNextTrial(page, consoleErrors);
  await page.reload({ waitUntil: 'networkidle0' });

  await page.click('button[data-exercise-id="tachistoscope"]');
  await clickButton(page, 'Egzersizi başlat');
  await completeReadingAttempt(page, 0);
  await waitForText(page, 'üst seviye kilitli kaldı');
  await waitForText(
    page,
    'Sunucu makbuzu: client_telemetry · persisted=false · serverVerified=false',
  );
  await waitForText(page, 'SUNUCU GÖZLEMLİ YAKLAŞIK HIZ');
  await waitForText(page, 'ağ ve render gecikmesi dahil');
  await clickButton(page, 'Başka çalışma seç');
  assert.equal(
    await page.$eval('button[aria-label="Keşif — kilitli"]', (button) =>
      Boolean(button.disabled),
    ),
    true,
  );

  await page.click('button[data-exercise-id="tachistoscope"]');
  await clickButton(page, 'Egzersizi başlat');
  await completeReadingAttempt(page, 4);
  await waitForText(page, 'Keşif seviyesi açıldı');
  await clickButton(page, 'Başka çalışma seç');
  assert.equal(
    await page.$eval('button[aria-label="Keşif"]', (button) =>
      Boolean(button.disabled),
    ),
    false,
  );
  assert.equal(
    await page.$eval('button[aria-label="Hızlanma — kilitli"]', (button) =>
      Boolean(button.disabled),
    ),
    true,
  );

  await page.click('button[data-exercise-id="schulte_scan"]');
  await clickButton(page, 'Egzersizi başlat');
  await clickButton(page, '2', true);
  await waitForText(page, '1 yanlış seçim');

  assert.deepEqual(consoleErrors, []);
  process.stdout.write(
    'fast-reading browser E2E: lazy phrase start, early-read rejection, timed hide, thresholds, lock, receipt, unlock, Schulte error PASS\n',
  );
} finally {
  if (browser) await browser.close();
  await stopTestServer(serverProcess);
  restoreEnvironment();
  if (taskTemp) await rm(taskTemp, { recursive: true, force: true });
}
