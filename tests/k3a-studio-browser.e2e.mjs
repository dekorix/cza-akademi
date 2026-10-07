import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { ALLOWED_ORIGIN, assertLocalTestRequest, startStudioServer, stopChild } from './k3a-studio-harness.mjs';

let browser;
let page;
let server;
let browserTemp;

async function browserBinary() {
  browserTemp = await mkdtemp(join(tmpdir(), 'cza-k3a-studio-'));
  const entry = fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  return inflate(resolve(dirname(entry), '../bin/chromium.br'));
}

async function clickButton(page, label) {
  const handle = await page.waitForFunction(expected => [...document.querySelectorAll('button')].find(button => !button.disabled && button.textContent?.replace(/\s+/g, ' ').trim().includes(expected)), { timeout: 15_000 }, label);
  const element = handle.asElement();
  assert.ok(element, `button missing: ${label}`);
  await element.click();
  await handle.dispose();
}

async function waitForText(page, text) {
  await page.waitForFunction(expected => document.body.innerText.includes(expected), { timeout: 15_000 }, text);
}

try {
  server = await startStudioServer();
  browser = await puppeteer.launch({ executablePath: await browserBinary(), headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  page = await browser.newPage();
  const errors = [];
  const actions = [];
  const networkViolations = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    try {
      const url = assertLocalTestRequest(request.url());
      if (url.pathname !== '/api/core') return void request.continue();
      const body = JSON.parse(await request.fetchPostData() || '{}');
      actions.push(body);
      const response = body.action === 'me'
        ? { ok:true, student:{ name:'K3-A Demo Öğrenci', grade:'5' } }
        : body.action === 'start'
          ? { ok:true, sessionId:'k3a-session-1' }
          : { ok:true };
      void request.respond({ status:200, contentType:'application/json', body:JSON.stringify(response) });
    } catch (error) {
      networkViolations.push(error);
      void request.abort('blockedbyclient');
    }
  });

  const response = await page.goto(`${ALLOWED_ORIGIN}/studio`, { waitUntil:'networkidle0' });
  assert.equal(response?.status(), 200);
  await waitForText(page, 'K3-A Demo Öğrenci');

  await clickButton(page, 'Parmak Okuma');
  await waitForText(page, 'Ekrandaki gerçekçi parmak desenine dikkatlice bak.');
  await clickButton(page, 'Performans çalışması');
  await page.click('#rounds');
  const fiveRounds = await page.waitForFunction(() => [...document.querySelectorAll('[role="option"]')].find(option => option.textContent?.trim() === '5 soru'), { timeout:10_000 });
  assert.ok(fiveRounds.asElement());
  await fiveRounds.asElement().click();
  await fiveRounds.dispose();
  assert.match(await page.$eval('#rounds', element => element.textContent || ''), /^5/);
  await waitForText(page, 'Paritmetik Parmak Okuma');
  await clickButton(page, 'Performans çalışmasını başlat');

  await waitForText(page, 'Parmakları hızlıca tanımaya hazırlan.');
  await page.waitForSelector('[aria-label="Zamanlı görsel uyaran"]', { timeout:15_000 });

  for (let round = 0; round < 5; round += 1) {
    await waitForText(page, 'Gördüğün sayı kaçtı?');
    await page.type('#answer', '0');
    await clickButton(page, 'Yanıtı kaydet');
    if (round < 4) {
      await waitForText(page, 'Yeni soru hazırlanıyor…');
      await waitForText(page, 'Dikkatlice bak');
    }
  }

  await waitForText(page, 'Çalışma performansın hazır.');
  assert.equal(actions.filter(item => item.action === 'start').length, 1);
  assert.equal(actions.filter(item => item.action === 'attempt').length, 5);
  assert.equal(actions.filter(item => item.action === 'finish').length, 1);
  const start = actions.find(item => item.action === 'start');
  assert.equal(start.moduleCode, 'finger_read');
  assert.equal(start.settings.exerciseType, 'FINGER_READING');
  assert.equal(start.settings.engine, 'cza-exercise-engine-v14');
  assert.deepEqual(networkViolations, []);
  assert.deepEqual(errors, []);
  process.stdout.write('K3A_STUDIO_BEHAVIOR=PASS START=PASS STIMULUS=PASS ANSWER=PASS SUBMIT=PASS NEXT=PASS COMPLETION=PASS MODE_BINDING=PASS ENV_ALLOWLIST=ENFORCED LOCALHOST_ONLY=ENFORCED EXTERNAL_NETWORK=DENIED CONSOLE_ERRORS=0\n');
} finally {
  if (page && !page.isClosed()) await page.close();
  if (browser) await browser.close();
  await stopChild(server);
  if (browserTemp) await rm(browserTemp, { recursive:true, force:true });
}
