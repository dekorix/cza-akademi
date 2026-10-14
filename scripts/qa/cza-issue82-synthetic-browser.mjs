import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core'),
  chromium = require('@sparticuz/chromium').default;
const fixture = JSON.parse(fs.readFileSync(process.env.CZA_QA_FIXTURE_FILE));
const base =
  'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const out = process.env.CZA_QA_EVIDENCE_DIR || 'docs/evidence/issue-82-sp-dys';
fs.mkdirSync(out, { recursive: true });
const proof = {
  profile: 'SP-DYS',
  networkMocks: false,
  cookieInjection: false,
  steps: [],
  errors: [],
  viewport: process.env.CZA_QA_MOBILE === '1' ? 390 : 1440,
};
const browser = await puppeteer.launch({
  executablePath:
    process.env.CZA_CHROMIUM_EXECUTABLE || (await chromium.executablePath()),
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--proxy-server=' + process.env.HTTPS_PROXY,
  ],
  headless: true,
});
try {
  const page = await browser.newPage();
  globalThis.qaPage = page;
  page.setDefaultTimeout(20000);
  await page.setViewport({
    width: proof.viewport,
    height: proof.viewport === 390 ? 844 : 1000,
  });
  page.on('pageerror', (e) => proof.errors.push(e.message));
  page.on('response', async (r) => {
    if (r.url().includes('/api/assessment-special-linked')) {
      const p = JSON.parse(r.request().postData() || '{}'),
        b = await r.json().catch(() => ({}));
      proof.steps.push({
        action: p.action,
        status: r.status(),
        candidateId: p.candidateId,
        cycleId: p.cycleId,
        sessionId: b.session?.id,
        error: b.error,
      });
    }
  });
  await page.goto(base + '/cza-degerlendirme/?profile=SP-DYS', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#centralEducatorLogin');
  await page.type('#centralEducatorLogin [name=email]', fixture.email);
  await page.type('#centralEducatorLogin [name=password]', fixture.password);
  await page.click('#centralEducatorLogin button');
  await page.waitForSelector('.central-link-panel.connected');
  await page.type('#name', 'QA Sentetik SP-DYS Issue82');
  await page.select('#grade', '2. sınıf');
  await page.select('#readingStage', 'Harf-ses öğreniyor');
  await page.click('#startDys');
  await page.waitForSelector('#openNextIncomplete, #dysResponse');
  if (await page.$('#openNextIncomplete'))
    await page.click('#openNextIncomplete');
  await page.waitForSelector('#dysResponse');
  const state = () =>
    page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('cza-e3-preview'));
      return {
        candidateId: s.centralCandidateId,
        cycleId: s.centralCycleId,
        sessionId: s.centralSessionId,
        screen: s.screen,
        taskIndex: s.dysTaskIndex,
      };
    });
  proof.before = await state();
  for (const k of ['candidateId', 'cycleId', 'sessionId'])
    assert.ok(proof.before[k]);
  await page.type('#dysResponse', 'al');
  await page.click('[data-verdict="MATCH"]');
  await page.click('[data-support="INDEPENDENT"]');
  await page.type('#dysNote', 'Synthetic QA first response');
  await page.click('#dysNext');
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('cza-e3-preview')).dysTaskIndex === 1,
  );
  proof.afterAnswer = await state();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dysResponse');
  proof.afterReload = await state();
  for (const k of ['candidateId', 'cycleId', 'sessionId'])
    assert.equal(proof.afterReload[k], proof.before[k]);
  assert.equal(proof.afterReload.taskIndex, 1);
  proof.centralReadback = await page.evaluate(async (sid) => {
    const r = await fetch('/api/assessment-special-linked', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'get', sessionId: sid }),
    });
    const b = await r.json();
    return {
      status: r.status,
      sessionId: b.session?.id,
      candidateId: b.session?.metadata?.candidateId,
      cycleId: b.session?.metadata?.cycleId,
      attemptCount: b.attempts?.length,
      taskCode: b.attempts?.[0]?.task_code,
      answer: b.attempts?.[0]?.answer_text,
    };
  }, proof.before.sessionId);
  assert.equal(proof.centralReadback.status, 200);
  assert.equal(proof.centralReadback.attemptCount, 1);
  assert.equal(proof.centralReadback.answer, 'al');
  for (const k of ['candidateId', 'cycleId', 'sessionId'])
    assert.equal(proof.centralReadback[k], proof.before[k]);
  await page.click('#backDysOverview');
  await page.waitForSelector('#backDysIntake');
  await page.click('#backDysIntake');
  await page.waitForSelector('#name');
  await page.click('#name', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#name', 'QA Sentetik SP-DYS Corrected');
  await page.click('#startDys');
  await page.waitForSelector('#dysResponse');
  proof.afterNameCorrection = await state();
  for (const k of ['candidateId', 'cycleId', 'sessionId'])
    assert.equal(proof.afterNameCorrection[k], proof.before[k]);
  await page.screenshot({
    path:
      out +
      (proof.viewport === 390
        ? '/mobile-independent-restored.png'
        : '/desktop-restored.png'),
    fullPage: true,
  });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: out + '/mobile-restored.png', fullPage: true });
  proof.chromeVersion = await browser.version();
  proof.cookieAttributes = (await page.cookies())
    .filter((c) => c.name === '__Host-cza_neon_educator')
    .map((c) => ({
      name: c.name,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expires: c.expires,
    }));
  const logout = await page.evaluate(async () => {
    const r = await fetch('/api/educator-auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    return { status: r.status, body: await r.json() };
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.body.revoked, true);
  proof.logout = { status: logout.status, revoked: true };
  const noSession = await page.evaluate(async () => {
    const r = await fetch('/api/educator-auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'me' }),
    });
    return r.status;
  });
  assert.equal(noSession, 401);
  proof.afterLogoutMe = noSession;
  proof.passed = proof.errors.length === 0;
} catch (e) {
  if (globalThis.qaPage) {
    proof.dom = await globalThis.qaPage
      .evaluate(() => ({
        ids: [...document.querySelectorAll('[id]')].map((x) => x.id),
        text: document.body.innerText.slice(0, 3500),
        screen: JSON.parse(localStorage.getItem('cza-e3-preview'))?.screen,
      }))
      .catch(() => null);
    await globalThis.qaPage
      .screenshot({ path: out + '/failed-ui.png', fullPage: true })
      .catch(() => {});
  }
  proof.passed = false;
  proof.failure = e.message;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    out + (proof.viewport === 390 ? '/browser-mobile.json' : '/browser.json'),
    JSON.stringify(proof, null, 2),
  );
  await browser.close();
  console.log(JSON.stringify(proof));
}
