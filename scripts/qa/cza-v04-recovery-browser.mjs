// Run ONLY after architect approval + isolated SQL application + exact source deploy.
// Real normal student login; no fabricated cookies, no owner URL, no new identity/recipe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { neon } from '@neondatabase/serverless';
const base =
  'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const student = '20000000-0000-4000-8000-000000000001',
  recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';
assert.equal(process.env.CZA_V04_QA_APPROVED, 'YES');
const fixture = JSON.parse(
  fs.readFileSync(process.env.CZA_QA_STUDENT_FIXTURE_FILE, 'utf8'),
);
assert.equal(fixture.studentId, student);
assert.equal(fixture.recipeId, recipe);
const runtime = process.env.CZA_V04_QA_RUNTIME_URL;
if (runtime) {
  const connection = new URL(runtime);
  assert.equal(connection.username, 'cza_v01_app_runtime_min');
  assert.equal(connection.pathname, '/cza_t5_synthetic');
} else assert.equal(process.env.CZA_V04_BROWSER_ONLY, 'YES');
const sql = runtime ? neon(runtime) : null,
  out = process.env.CZA_QA_EVIDENCE_DIR || 'docs/evidence/v04-runtime';
fs.mkdirSync(out, { recursive: true });
const proof = {
  mode: 'REAL_ISOLATED_QA',
  mocks: false,
  cookieInjection: false,
  studentId: student,
  recipeId: recipe,
  checks: [],
  errors: [],
  attempts: [],
  passed: false,
};
const check = (name, ok) => {
  console.log(JSON.stringify({ check: name, passed: !!ok }));
  proof.checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
};
const browser = await puppeteer.launch({
  executablePath:
    process.env.CZA_CHROMIUM_EXECUTABLE ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
let canonical, firstPayload;
const get = (page, path) =>
  page.evaluate(async (path) => {
    const r = await fetch(path, { cache: 'no-store' });
    return { status: r.status, body: await r.json() };
  }, path);
const post = (page, input) =>
  page.evaluate(async (input) => {
    const r = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return { status: r.status, body: await r.json() };
  }, input);
const starts = (page) =>
  page.evaluate(
    async (recipe) =>
      Promise.all(
        Array.from({ length: 6 }, async () => {
          const r = await fetch('/api/core', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'start',
              recipeId: recipe,
              moduleCode: 'finger_read',
              source: 'teacher_assignment',
              clientSessionId: crypto.randomUUID(),
              settings: {},
            }),
          });
          return { status: r.status, body: await r.json() };
        }),
      ),
    recipe,
  );
async function login(page) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#home-username');
  await page.type('#home-username', fixture.username);
  await page.type('#home-pin', fixture.pin);
  const pending = page.waitForResponse(
    (r) => r.url() === base + '/api/core' && r.request().method() === 'POST',
  );
  await page.click('form button[type=submit]');
  const r = await pending,
    body = await r.json();
  check(
    'normal login same existing student',
    r.status() === 200 &&
      body.ok &&
      body.student?.id === student &&
      !('sessionToken' in body),
  );
  await page.waitForSelector('#route');
}
async function open(page, fromPanel = false) {
  if (fromPanel) {
    await page.click('#route a[href^="/assignment"]');
    await page.waitForFunction(() => location.pathname === '/studio');
  } else
    await page.goto(base + '/studio?program=assigned&recipe=' + recipe, {
      waitUntil: 'domcontentloaded',
    });
  await page.waitForFunction(() =>
    document.body.textContent.includes(
      'Atanmış çalışman ve kaydedilmiş ilerlemen sunucudan yüklenir.',
    ),
  );
  let initialRace;
  const onLaunch = (r) => {
    if (
      !canonical &&
      r.url() === base + '/api/core/assignments' &&
      r.request().method() === 'POST'
    )
      initialRace = starts(page);
  };
  page.on('response', onLaunch);
  const pending = page.waitForResponse(
    (r) =>
      r.url() === base + '/api/core' &&
      r.request().postData()?.includes('"action":"start"'),
  );
  pending.catch(() => {});
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Çalışmaya başla'))
      .click(),
  );
  const r = await pending,
    result = await r.json();
  check(
    'assigned studio real start',
    r.status() === 200 && result.sessionId && result.questions.length === 10,
  );
  if (canonical)
    check(
      'same canonical training session',
      result.sessionId === canonical.sessionId,
    );
  else canonical = result;
  page.off('response', onLaunch);
  if (initialRace) {
    const racing = await initialRace;
    check(
      'concurrent initial start insert yields one training session',
      racing.every(
        (r) => r.status === 200 && r.body.sessionId === canonical.sessionId,
      ),
    );
  }
  console.log('waiting first answer');
  await page.waitForSelector('#answer');
  return result;
}
async function solve(page, index, wrong = false) {
  await page.waitForSelector('#answer');
  await page.type(
    '#answer',
    String(canonical.questions[index - 1].answer + (wrong ? 1 : 0)),
  );
  const pending = page.waitForResponse(
    (r) =>
      r.url() === base + '/api/core' &&
      r.request().postData()?.includes('"action":"attempt"'),
  );
  pending.catch(() => {});
  await page.click('button[type=submit]');
  const r = await pending,
    payload = JSON.parse(r.request().postData()).payload;
  check(
    'actual UI answer ' + index,
    r.status() === 200 &&
      payload.questionIndex === index &&
      payload.questionId === canonical.questions[index - 1].questionId,
  );
  proof.attempts.push({
    questionIndex: index,
    clientAttemptId: payload.clientAttemptId,
    questionId: payload.questionId,
    target: payload.targetNumber,
    answer: payload.studentNumericAnswer,
    responseLatencyMs: payload.responseLatencyMs,
    stimulusDurationMs: payload.stimulusDurationMs,
    totalResponseTimeMs: payload.totalResponseTimeMs,
  });
  if (index === 1) firstPayload = payload;
  await page.waitForFunction(() =>
    document.querySelector('[data-player-phase="feedback"]'),
  );
  if (index < 10) await page.waitForSelector('#answer');
}
try {
  proof.chromeVersion = await browser.version();
  if (sql) {
    proof.database = (
      await sql.query(
        "SELECT current_user role,current_database() database,current_setting('neon.project_id',true) project,current_setting('neon.branch_id',true) branch,has_function_privilege(current_user,'public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb)','EXECUTE') allowed",
      )
    )[0];
    check(
      'only exact QA/minimum role',
      proof.database.role === 'cza_v01_app_runtime_min' &&
        proof.database.database === 'cza_t5_synthetic' &&
        proof.database.project === 'patient-firefly-51111834' &&
        proof.database.branch === 'br-withered-queen-b15ltb40' &&
        proof.database.allowed,
    );
  } else
    proof.database = {
      verification: 'SEPARATE_NEON_CONNECTOR_READBACK_REQUIRED',
    };
  const context = await browser.createBrowserContext(),
    page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('dialog', (d) => void d.accept());
  page.on('pageerror', (e) => proof.errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().endsWith('/api/core'))
      console.log(
        JSON.stringify({
          action:
            r.request().method() === 'POST'
              ? JSON.parse(r.request().postData()).action
              : 'me',
          status: r.status(),
        }),
      );
  });
  await page.setViewport({ width: 1440, height: 900 });
  await login(page);
  const cookies = await context.cookies();
  check(
    'server secure HttpOnly cookie',
    cookies.some(
      (c) =>
        c.name === 'cza_student_session' &&
        c.httpOnly &&
        c.secure &&
        c.sameSite === 'Lax',
    ),
  );
  await open(page, true);
  const racing = await starts(page);
  check(
    'parallel starts same canonical session',
    racing.every(
      (r) => r.status === 200 && r.body.sessionId === canonical.sessionId,
    ),
  );
  proof.recovery = {
    existingAttempts: canonical.workProgress.attemptCount,
    reason: 'Preserve prior actual partial run; no reset/new session',
  };
  check(
    'resume actual existing three answers',
    canonical.workProgress.attemptCount === 3,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  const resumed = await open(page);
  check(
    'hard reload preserves session and three answers',
    resumed.workProgress.attemptCount === 3,
  );
  await solve(page, 4);
  await page.screenshot({ path: out + '/desktop.png', fullPage: true });
  check(
    'desktop no horizontal overflow',
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const tab = await context.newPage();
  tab.on('dialog', (d) => void d.accept());
  tab.on('pageerror', (e) => proof.errors.push(e.message));
  await tab.setViewport({ width: 390, height: 844 });
  const newTab = await open(tab);
  check(
    'new mobile tab same session/next question',
    newTab.workProgress.attemptCount === 4,
  );
  check(
    'mobile no horizontal overflow',
    await tab.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  check(
    'logout succeeds',
    (await post(tab, { action: 'logout' })).status === 200,
  );
  check(
    'old session denied',
    (await post(page, { action: 'me' })).status === 401,
  );
  await login(tab);
  const relogin = await open(tab);
  check(
    'relogin same work session/progress',
    relogin.workProgress.attemptCount === 4,
  );
  const spoof = await get(
    tab,
    '/api/core/dashboard?studentId=20000000-0000-4000-8000-000000000002&academyId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  );
  check(
    'foreign student/academy selectors cannot switch identity',
    spoof.status === 200 && spoof.body.dashboard.profile.id === student,
  );
  check(
    'foreign recipe denied',
    (
      await get(
        tab,
        '/api/core/assignments?recipeId=30000000-0000-4000-8000-000000000002',
      )
    ).status === 404,
  );
  // Fault injection drops only a real committed response; no response is mocked.
  const cdp = await tab.createCDPSession();
  let original;
  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: base + '/api/core', requestStage: 'Response' }],
  });
  cdp.on('Fetch.requestPaused', async (e) => {
    const body = JSON.parse(e.request.postData || '{}');
    if (
      !original &&
      body.action === 'attempt' &&
      body.payload.questionIndex === 5
    ) {
      original = body.payload;
      await cdp.send('Fetch.failRequest', {
        requestId: e.requestId,
        errorReason: 'Aborted',
      });
    } else await cdp.send('Fetch.continueRequest', { requestId: e.requestId });
  });
  await tab.type('#answer', String(canonical.questions[4].answer));
  await tab.click('button[type=submit]');
  await tab.waitForFunction(() =>
    document.body.textContent.includes('Cevabın ekranda tutuldu'),
  );
  await cdp.send('Fetch.disable');
  await cdp.detach();
  check(
    'real uncertain acknowledgement keeps submitted answer',
    await tab.$eval('#answer', (e) => e.readOnly && !!e.value),
  );
  const retryResponse = tab.waitForResponse(
    (r) =>
      r.url() === base + '/api/core' &&
      r.request().postData()?.includes('\"action\":\"attempt\"'),
  );
  await tab.click('button[type=submit]');
  const retried = await retryResponse,
    retryBody = await retried.json(),
    retryPayload = JSON.parse(retried.request().postData()).payload;
  check(
    'real network retry exact UUID/answer/timings and no duplicate',
    retried.status() === 200 &&
      retryBody.workProgress.replayed &&
      retryBody.workProgress.attemptCount === 5 &&
      JSON.stringify(original) === JSON.stringify(retryPayload),
  );
  proof.networkFault = 'DROPPED_REAL_RESPONSE_AFTER_COMMIT';
  proof.attempts.push({
    questionIndex: 5,
    clientAttemptId: retryPayload.clientAttemptId,
    questionId: retryPayload.questionId,
    target: retryPayload.targetNumber,
    answer: retryPayload.studentNumericAnswer,
    responseLatencyMs: retryPayload.responseLatencyMs,
    stimulusDurationMs: retryPayload.stimulusDurationMs,
    totalResponseTimeMs: retryPayload.totalResponseTimeMs,
  });
  await tab.waitForSelector('[data-player-phase=feedback]');
  await tab.waitForSelector('#answer');
  for (let i = 6; i <= 10; i++) await solve(tab, i);
  await tab.waitForFunction(
    () =>
      document.body.textContent.includes('Çalışma performansın hazır.') ||
      document.body.textContent.includes('Harika, 10 soru çalıştın.'),
  );
  const finishes = await tab.evaluate(
    async (session) =>
      Promise.all(
        Array.from({ length: 6 }, async () => {
          const r = await fetch('/api/core', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'finish', sessionId: session }),
          });
          return { status: r.status, body: await r.json() };
        }),
      ),
    canonical.sessionId,
  );
  const complete = finishes[0].body.workCompletion;
  check(
    'parallel finish one ledger/evidence identity',
    finishes.every(
      (r) =>
        r.status === 200 &&
        r.body.workCompletion.learningRecordId === complete.learningRecordId &&
        r.body.workCompletion.evidenceId === complete.evidenceId &&
        r.body.workCompletion.attemptCount === 10 &&
        r.body.workCompletion.correctCount === 8,
    ),
  );
  proof.completion = complete;
  const profile = await get(tab, '/api/core/learning-profile');
  check(
    'canonical profile same Student ID',
    profile.status === 200 && profile.body.profile.student.id === student,
  );
  proof.profile = profile.body.profile;
  await tab.screenshot({ path: out + '/mobile.png', fullPage: true });
  check(
    'cleanup logout',
    (await post(tab, { action: 'logout' })).status === 200,
  );
  check('zero page errors', proof.errors.length === 0);
  proof.passed = true;
  await context.close();
} catch (e) {
  proof.failure = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(out + '/browser.json', JSON.stringify(proof, null, 2));
  console.log(
    JSON.stringify({
      passed: proof.passed,
      checks: proof.checks.length,
      failure: proof.failure,
      errors: proof.errors,
    }),
  );
}
