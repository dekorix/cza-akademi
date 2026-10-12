import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base =
  'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const student = '20000000-0000-4000-8000-000000000001',
  recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4',
  session = 'bdb87fbc-0938-4eb1-82e5-0a2cb362d30f';
const fixture = JSON.parse(
  fs.readFileSync(process.env.CZA_QA_STUDENT_FIXTURE_FILE, 'utf8'),
);
assert.equal(fixture.studentId, student);
assert.equal(fixture.recipeId, recipe);
const out = process.env.CZA_QA_EVIDENCE_DIR;
fs.mkdirSync(out, { recursive: true });
const proof = {
  scope: 'EXISTING_COMPLETED_RECORD_ONLY',
  mocks: false,
  stateInjection: false,
  checks: [],
  resultScreen: 'UNVERIFIED',
  requests: [],
  errors: [],
};
const check = (name, ok) => {
  proof.checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
  console.log(JSON.stringify({ name, passed: !!ok }));
};
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.createBrowserContext(),
  page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('dialog', (d) => void d.accept());
page.on('pageerror', (e) => proof.errors.push(e.message));
page.on('request', async (r) => {
  if (r.url().startsWith(base + '/api/')) {
    const data = r.method() === 'POST' ? await r.fetchPostData() : undefined;
    let action;
    try {
      action = JSON.parse(data || '{}').action;
    } catch {}
    proof.requests.push({
      path: new URL(r.url()).pathname,
      method: r.method(),
      action,
    });
  }
});
const post = (input) =>
  page.evaluate(async (input) => {
    const r = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return { status: r.status, body: await r.json() };
  }, input);
const get = (path) =>
  page.evaluate(async (path) => {
    const r = await fetch(path, { cache: 'no-store' });
    return { status: r.status, body: await r.json() };
  }, path);
try {
  proof.chrome = await browser.version();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#home-username');
  await page.type('#home-username', fixture.username);
  await page.type('#home-pin', fixture.pin);
  await page.click('form button[type=submit]');
  await page.waitForSelector('#route');
  proof.assignment = await get('/api/core/assignments?recipeId=' + recipe);
  check(
    'existing assignment completed',
    proof.assignment.status === 200 &&
      proof.assignment.body.assignment.status === 'completed',
  );
  proof.navigation = [];
  for (const [label, width, height] of [
    ['desktop', 1440, 900],
    ['mobile', 390, 844],
  ]) {
    await page.setViewport({ width, height });
    await page.goto(base + '/work', { waitUntil: 'networkidle2' });
    proof.navigation.push({
      label,
      links: await page.$$eval('a', (a) =>
        a
          .map((x) => ({
            label: x.textContent.trim(),
            href: x.getAttribute('href'),
          }))
          .filter((x) => /studio|assignment|result/.test(x.href || '')),
      ),
    });
    await page.goto(
      base +
        '/studio?program=assigned&recipe=' +
        recipe +
        '&sessionId=' +
        session +
        '&view=results',
      { waitUntil: 'networkidle2' },
    );
    await page.waitForFunction(() =>
      document.body.textContent.includes(
        'Atanmış çalışman ve kaydedilmiş ilerlemen sunucudan yüklenir.',
      ),
    );
    const state = await page.evaluate(() => ({
      headings: [...document.querySelectorAll('h1,h2')].map(
        (x) => x.textContent,
      ),
      phase: document
        .querySelector('[data-player-phase]')
        ?.getAttribute('data-player-phase'),
      hasGuidedResult: document.body.textContent.includes(
        'Harika, 10 soru çalıştın.',
      ),
      hasPerformanceResult: document.body.textContent.includes(
        'Çalışma performansın hazır.',
      ),
      hasStart: [...document.querySelectorAll('button')].some((b) =>
        b.textContent.includes('Çalışmaya başla'),
      ),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    proof.navigation.push({ label, studio: state });
    check(
      label + ' completed navigation stays ready without a result route',
      state.hasStart && !state.hasGuidedResult && !state.hasPerformanceResult,
    );
    await page.screenshot({
      path: out + '/' + label + '-studio-readonly.png',
      fullPage: true,
    });
  }
  proof.resultScreen = 'BLOCKED_NO_READ_ONLY_STUDIO_RESTORE_PATH';
  const payload = {
    clientAttemptId: 'a2a80757-2500-46e6-b1bd-6f2ca9d37a43',
    questionIndex: 1,
    questionId: 'v04:' + session + ':1',
    targetNumber: 7,
    studentNumericAnswer: 9,
    isCorrect: true,
    patternValid: true,
    errorType: 'OK',
    stimulusDurationMs: 556,
    responseLatencyMs: 556,
    totalResponseTimeMs: 556,
    metadata: {
      sequence: [7],
      attemptType: 'PRIMARY',
      responsePayload: { value: 9 },
      timeout: false,
    },
  };
  proof.changedAnswer = await post({
    action: 'attempt',
    sessionId: session,
    payload,
  });
  check(
    'same committed UUID with different answer rejected as key reuse',
    proof.changedAnswer.status === 409 &&
      proof.changedAnswer.body.error === 'IDEMPOTENCY_KEY_REUSED',
  );
  const tab = await context.newPage();
  await tab.goto(base + '/studio?program=assigned&recipe=' + recipe, {
    waitUntil: 'networkidle2',
  });
  const send = (p, v) =>
    p.evaluate(async (v) => {
      const r = await fetch('/api/core', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v),
      });
      return { status: r.status, body: await r.json() };
    }, v);
  proof.closedTwoTab = await Promise.all([
    send(page, {
      action: 'attempt',
      sessionId: session,
      payload: { ...payload, clientAttemptId: crypto.randomUUID() },
    }),
    send(tab, {
      action: 'attempt',
      sessionId: session,
      payload: {
        ...payload,
        clientAttemptId: crypto.randomUUID(),
        studentNumericAnswer: 7,
        metadata: { ...payload.metadata, responsePayload: { value: 7 } },
      },
    }),
  ]);
  check(
    'two tabs both denied on completed same question; not an active-question race',
    proof.closedTwoTab.every(
      (r) => r.status === 409 && r.body.error === 'work_session_closed',
    ),
  );
  await tab.close();
  proof.foreignSession = await post({
    action: 'attempt',
    sessionId: '0f255515-8035-49c5-a2e1-e240c4dbbc9d',
    payload,
  });
  check(
    'existing unrelated work session rejected',
    proof.foreignSession.status === 404 &&
      proof.foreignSession.body.error === 'work_not_found',
  );
  proof.foreignSelectors = await get(
    '/api/core/dashboard?studentId=20000000-0000-4000-8000-000000000002&academyId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  );
  check(
    'foreign student/academy selectors cannot change identity',
    proof.foreignSelectors.status === 200 &&
      proof.foreignSelectors.body.dashboard.profile.id === student,
  );
  check(
    'no start or finish calls issued',
    !proof.requests.some((r) => r.action === 'start' || r.action === 'finish'),
  );
  check('cleanup logout', (await post({ action: 'logout' })).status === 200);
  check(
    'revoked answer denied',
    (await post({ action: 'attempt', sessionId: session, payload })).status ===
      401,
  );
  check('no page errors', proof.errors.length === 0);
  proof.safeChecksPassed = true;
} catch (e) {
  proof.failure = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(
    out + '/readonly-and-negative.json',
    JSON.stringify(proof, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: proof.checks.length,
      resultScreen: proof.resultScreen,
      failure: proof.failure,
    }),
  );
}
