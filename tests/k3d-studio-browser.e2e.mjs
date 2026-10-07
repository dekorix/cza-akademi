import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import {
  ALLOWED_ORIGIN,
  assertLocalTestRequest,
  startStudioServer,
  stopChild,
} from './k3a-studio-harness.mjs';

let browser;
let page;
let server;
let browserTemp;

async function browserBinary() {
  browserTemp = await mkdtemp(join(tmpdir(), 'cza-k3d-studio-'));
  const entry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(entry), '../bin/chromium.br'));
}

async function clickButton(label) {
  const handle = await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll('button')].find(
        (button) =>
          !button.disabled &&
          button.textContent?.replace(/\s+/g, ' ').trim().includes(expected),
      ),
    { timeout: 15_000 },
    label,
  );
  const element = handle.asElement();
  assert.ok(element, `button missing: ${label}`);
  await element.click();
  await handle.dispose();
}

async function waitForText(text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    { timeout: 15_000 },
    text,
  );
}

try {
  server = await startStudioServer();
  browser = await puppeteer.launch({
    executablePath: await browserBinary(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  page = await browser.newPage();
  const errors = [];
  const networkViolations = [];
  const actions = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    try {
      const url = assertLocalTestRequest(request.url());
      if (url.pathname !== '/api/core') return void request.continue();
      const body = JSON.parse((await request.fetchPostData()) || '{}');
      actions.push(body);
      const response =
        body.action === 'me'
          ? { ok: true, student: { name: 'K3-D Demo Öğrenci', grade: '5' } }
          : body.action === 'start'
            ? { ok: true, sessionId: 'k3d-session-1' }
            : { ok: true };
      void request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    } catch (error) {
      networkViolations.push(error);
      void request.abort('blockedbyclient');
    }
  });

  const response = await page.goto(`${ALLOWED_ORIGIN}/studio?mode=flash`, {
    waitUntil: 'networkidle0',
  });
  assert.equal(response?.status(), 200);
  await waitForText('K3-D Demo Öğrenci');
  await waitForText('Sayılar sırayla ekrana gelecek.');
  await clickButton('Performans çalışması');
  await page.click('#rounds');
  const fiveRounds = await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[role="option"]')].find(
        (option) => option.textContent?.trim() === '5 soru',
      ),
    { timeout: 10_000 },
  );
  assert.ok(fiveRounds.asElement());
  await fiveRounds.asElement().click();
  await fiveRounds.dispose();
  await clickButton('Performans çalışmasını başlat');
  await waitForText('Sayıları sırayla zihninde tut.');

  for (let round = 0; round < 5; round += 1) {
    const renderer = await page.waitForSelector(
      '.anzan-stimulus-screen[data-engine-id="ANZAN"][data-engine-version="1"]',
      { timeout: 15_000 },
    );
    assert.ok(renderer);
    await waitForText('İşlemin sonucu kaç?');
    await page.type('#answer', '0');
    await clickButton('Yanıtı kaydet');
    if (round < 4) await waitForText('Yeni soru hazırlanıyor…');
  }

  await waitForText('Çalışma performansın hazır.');
  const start = actions.find((item) => item.action === 'start');
  assert.equal(start.settings.engineId, 'ANZAN');
  assert.equal(start.settings.engineVersion, '1');
  assert.equal(start.settings.exerciseType, 'FLASH_ANZAN');
  assert.equal(actions.filter((item) => item.action === 'attempt').length, 5);
  assert.equal(actions.filter((item) => item.action === 'finish').length, 1);
  for (const attempt of actions.filter((item) => item.action === 'attempt')) {
    assert.equal(attempt.payload.metadata.responseType, 'numeric');
    assert.equal(
      typeof attempt.payload.metadata.responsePayload.value,
      'number',
    );
    assert.equal(attempt.payload.metadata.engineId, 'ANZAN');
    assert.equal(attempt.payload.metadata.engineVersion, '1');
  }
  assert.deepEqual(networkViolations, []);
  assert.deepEqual(errors, []);
  process.stdout.write(
    'K3D_STUDIO_BROWSER=PASS ANZAN_RENDERER=PASS ENGINE_REGISTRY=PASS NUMERIC_RESPONSE=PASS PROVENANCE=PASS LIFECYCLE=PASS CONSOLE_ERRORS=0\n',
  );
} finally {
  if (page && !page.isClosed()) await page.close();
  if (browser) await browser.close();
  await stopChild(server);
  if (browserTemp) await rm(browserTemp, { recursive: true, force: true });
}
