// LOCAL MOCK TRANSPORT ONLY: exercises real Studio/player on desktop/mobile.
// Live login, Neon writes, and multiconnection SQL races require approved QA migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
const recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4',
  session = '40000000-0000-4000-8000-000000000001';
const config = {
  mode: 'finger-read',
  digits: 1,
  rounds: 10,
  terms: 3,
  interval: 1,
  operation: 'add',
  pool: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  minDigits: 1,
  maxDigits: 1,
  minValue: 1,
  maxValue: 900,
  presentationDurationMs: 1400,
  answerDurationMs: 0,
  practiceMode: 'guided_practice',
  feedbackMode: 'immediate',
  countdownEnabled: false,
};
const questions = Array.from({ length: 10 }, (_, i) => ({
  answer: (i % 9) + 1,
  sequence: [(i % 9) + 1],
  questionId: 'v04:' + session + ':' + (i + 1),
}));
const evidence = {
  mode: 'LOCAL_MOCK_TRANSPORT_ONLY',
  runtimeAcceptance: 'UNVERIFIED',
  checks: [],
  errors: [],
};
const check = (name, ok) => {
  evidence.checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
};
const out = process.env.CZA_V04_EVIDENCE_DIR || '/tmp/v04-local-browser';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({
  root: process.cwd(),
  configFile: false,
  logLevel: 'error',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
  server: { host: '127.0.0.1', port: 4190, strictPort: true },
});
let browser;
const attempts = new Map();
let drop = false,
  finishFail = true;
const requestIds = [];
try {
  await server.listen();
  const executablePath =
    process.env.CZA_BROWSER_PATH ||
    ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) =>
      fs.existsSync(p),
    ) ||
    (await chromium.executablePath());
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox'],
  });
  evidence.browser = await browser.version();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog', (d) => void d.accept());
  page.on('pageerror', (e) => evidence.errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  async function intercept(page) {
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (!url.pathname.startsWith('/api/')) return void r.continue();
      const send = (body, status = 200) =>
        r.respond({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      if (url.pathname === '/api/core/assignments')
        return void send({
          ok: true,
          assignment: {
            id: recipe,
            module_code: 'finger_read',
            settings: config,
          },
        });
      if (url.pathname === '/api/core') {
        const p = JSON.parse(r.postData() || '{}');
        if (p.action === 'me')
          return void send({
            ok: true,
            student: {
              id: '20000000-0000-4000-8000-000000000001',
              name: 'Local synthetic',
            },
          });
        if (p.action === 'start')
          return void send({
            ok: true,
            sessionId: session,
            resumed: attempts.size > 0,
            questions,
            workProgress: {
              attemptCount: attempts.size,
              correctCount: attempts.size,
            },
          });
        if (p.action === 'attempt') {
          requestIds.push(p.payload.clientAttemptId);
          attempts.set(p.payload.clientAttemptId, p.payload);
          if (!drop) {
            drop = true;
            return void r.abort('failed');
          }
          return void send({
            ok: true,
            workProgress: { attemptCount: attempts.size },
          });
        }
        if (p.action === 'finish') {
          if (finishFail) {
            finishFail = false;
            return void send(
              { ok: false, error: 'work_persistence_unavailable' },
              503,
            );
          }
          return void send({
            ok: true,
            workCompletion: {
              status: 'completed',
              attemptCount: 10,
              correctCount: 10,
              timeoutCount: 0,
              averageResponseMs: 800,
              fastestCorrectMs: 500,
            },
          });
        }
      }
      return void send({ ok: true });
    });
  }
  await intercept(page);
  const url = 'http://127.0.0.1:4190/studio?program=assigned&recipe=' + recipe;
  async function start(page) {
    await page.waitForFunction(() =>
      document.body.textContent.includes(
        'Atanmış çalışman ve kaydedilmiş ilerlemen sunucudan yüklenir.',
      ),
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some((b) =>
        b.textContent.includes('Çalışmaya başla'),
      ),
    );
    await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent.includes('Çalışmaya başla'))
        .click(),
    );
    await page.waitForSelector('#answer');
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await start(page);
  check(
    'desktop actual finger stimulus',
    await page.evaluate(
      () =>
        !!document.querySelector('svg') &&
        document.body.textContent.includes('Yanıtı kaydet'),
    ),
  );
  await page.type('#answer', '1');
  await page.click('button[type=submit]');
  await page.waitForFunction(() =>
    document.body.textContent.includes('Cevabın ekranda tutuldu'),
  );
  check(
    'uncertain answer remains frozen',
    await page.$eval('#answer', (e) => e.value === '1' && e.readOnly),
  );
  await page.click('button[type=submit]');
  await page.waitForFunction(() => document.body.textContent.includes('DOĞRU'));
  check(
    'same request UUID after uncertain acknowledgement',
    requestIds.length === 2 &&
      requestIds[0] === requestIds[1] &&
      attempts.size === 1,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await start(page);
  check(
    'reload resumes original session and question two',
    await page.evaluate(() =>
      document.body.textContent.includes('1 / 10 yanıt'),
    ),
  );
  await page.setViewport({ width: 390, height: 844 });
  check(
    'mobile no horizontal overflow',
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  for (let i = 1; i < 10; i++) {
    await page.waitForSelector('#answer');
    await page.$eval('#answer', (e) => {
      const s = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set;
      s.call(e, '');
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#answer', String(questions[i].answer));
    await page.click('button[type=submit]');
    await page.waitForFunction(() =>
      document.body.textContent.includes('DOĞRU'),
    );
    if (i < 9)
      await page.waitForFunction(() => !!document.querySelector('#answer'));
  }
  await page.waitForFunction(() =>
    document.body.textContent.includes('ile yeniden dene.'),
  );
  check(
    'failed completion has no success UI',
    !(await page.evaluate(() =>
      document.body.textContent.includes('Çalışma performansın hazır.'),
    )),
  );
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Bitir ve kaydet'))
      .click(),
  );
  await page.waitForFunction(
    () =>
      document.body.textContent.includes('Çalışma performansın hazır.') ||
      location.pathname === '/work',
  );
  check('10 canonical answers only', attempts.size === 10);
  check(
    'reported durations and stable question IDs sent',
    [...attempts.values()].every(
      (p, i) =>
        p.questionId === questions[i].questionId &&
        p.questionIndex === i + 1 &&
        Number.isInteger(p.responseLatencyMs) &&
        Number.isInteger(p.stimulusDurationMs) &&
        p.metadata.attemptType === 'PRIMARY',
    ),
  );
  check('zero page errors', evidence.errors.length === 0);
  evidence.passed = true;
} catch (e) {
  evidence.failure = e.message;
  evidence.passed = false;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await server.close();
  fs.writeFileSync(out + '/browser.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
