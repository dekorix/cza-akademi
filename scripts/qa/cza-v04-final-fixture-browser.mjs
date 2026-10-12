// REAL QA, normal login, one fixed fixture; no fabricated cookie or mocked response.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
assert.equal(process.env.CZA_V04_FINAL_FIXTURE_APPROVED, 'YES');
const base =
  'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
const student = '20000000-0000-4000-8000-000000000001',
  recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4',
  session = '40000004-0000-4000-8000-000000000091';
const fixture = JSON.parse(
  fs.readFileSync(process.env.CZA_QA_STUDENT_FIXTURE_FILE, 'utf8'),
);
assert.equal(fixture.studentId, student);
assert.equal(fixture.recipeId, recipe);
const out = process.env.CZA_QA_EVIDENCE_DIR;
fs.mkdirSync(out, { recursive: true });
const proof = {
  scope: 'REAL_FINAL_FIXED_QA_FIXTURE',
  studentId: student,
  recipeId: recipe,
  sessionId: session,
  mocks: false,
  cookieInjection: false,
  stateInjection: false,
  checks: [],
  errors: [],
  answers: [],
  passed: false,
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
const context = await browser.createBrowserContext();
let canonical;
const pages = [];
async function page(width, height) {
  const p = await context.newPage();
  pages.push(p);
  p.setDefaultTimeout(30000);
  p.on('dialog', (d) => void d.accept());
  p.on('pageerror', (e) => proof.errors.push(e.message));
  await p.setViewport({ width, height });
  return p;
}
const actionResponse = (p, action) => {
  const pending = p.waitForResponse(
    (r) =>
      r.url() === base + '/api/core' &&
      r.request().method() === 'POST' &&
      r
        .request()
        .postData()
        ?.includes('"action":"' + action + '"'),
  );
  pending.catch(() => {});
  return pending;
};
const post = (p, input) =>
  p.evaluate(async (input) => {
    const r = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return { status: r.status, body: await r.json() };
  }, input);
const get = (p, path) =>
  p.evaluate(async (path) => {
    const r = await fetch(path, { cache: 'no-store' });
    return { status: r.status, body: await r.json() };
  }, path);
async function login(p) {
  await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#home-username');
  await p.type('#home-username', fixture.username);
  await p.type('#home-pin', fixture.pin);
  const pending = actionResponse(p, 'login');
  await p.click('form button[type=submit]');
  const r = await pending,
    b = await r.json();
  check(
    'normal student login same canonical ID',
    r.status() === 200 && b.student?.id === student,
  );
  await p.waitForSelector('#route');
}
async function open(p) {
  await p.goto(base + '/studio?program=assigned&recipe=' + recipe, {
    waitUntil: 'domcontentloaded',
  });
  await p.waitForFunction(() =>
    document.body.textContent.includes(
      'Atanmış çalışman ve kaydedilmiş ilerlemen sunucudan yüklenir.',
    ),
  );
  const pending = actionResponse(p, 'start');
  await p.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Çalışmaya başla'))
      .click(),
  );
  const r = await pending,
    b = await r.json();
  check(
    'approved fixed session start/resume',
    r.status() === 200 && b.sessionId === session && b.questions?.length === 10,
  );
  if (canonical)
    check(
      'same server question plan',
      JSON.stringify(b.questions) === JSON.stringify(canonical.questions),
    );
  else canonical = b;
  return b;
}
async function ready(p, index) {
  await p.waitForFunction(
    (index) =>
      document.querySelector('[data-player-phase="answer"]') &&
      document.querySelector('#answer')?.value === '' &&
      document.body.textContent.includes(index - 1 + ' / 10 yanıt'),
    {},
    index,
  );
}
async function solve(p, index, wrong = false) {
  await ready(p, index);
  await p.type(
    '#answer',
    String(canonical.questions[index - 1].answer + (wrong ? 1 : 0)),
  );
  const pending = actionResponse(p, 'attempt');
  await p.click('button[type=submit]');
  const r = await pending,
    payload = JSON.parse(r.request().postData()).payload;
  check(
    'native UI answer ' + index,
    r.status() === 200 &&
      payload.questionIndex === index &&
      payload.questionId === canonical.questions[index - 1].questionId,
  );
  proof.answers.push(payload);
  await p.waitForSelector('[data-player-phase="feedback"]');
}
async function nativeResult(p, label, width, height) {
  await p.setViewport({ width, height });
  await p.waitForFunction(
    () =>
      document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim() ===
      'Harika, 10 soru çalıştın.',
  );
  const data = await p.evaluate(() => ({
    heading: document
      .querySelector('h1')
      .textContent.replace(/\s+/g, ' ')
      .trim(),
    counters: [...document.querySelectorAll('main section .grid > div')]
      .filter((e) => e.querySelector('b'))
      .map((e) => ({
        value: e.querySelector('b').textContent.trim(),
        label: e.querySelector('p').textContent.trim(),
      })),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  check(
    label +
      ' native guided result heading / 10 questions / 8 correct / 2 wrong',
    data.heading === 'Harika, 10 soru çalıştın.' &&
      data.counters.find((x) => x.label === 'Soru')?.value === '10' &&
      data.counters.find((x) => x.label === 'Doğru')?.value === '8' &&
      data.counters.find((x) => x.label === 'Birlikte bakalım')?.value ===
        '2' &&
      !data.overflow,
  );
  proof[label + 'Result'] = data;
  await p.screenshot({
    path: out + '/' + label + '-native-result.png',
    fullPage: true,
  });
}
try {
  proof.chromeVersion = await browser.version();
  const desktop = await page(1440, 900),
    mobile = await page(390, 844);
  await login(desktop);
  const cookies = await context.cookies(),
    authCookie = cookies.find((c) => c.name === 'cza_student_session');
  check(
    'secure HttpOnly login cookie',
    authCookie?.httpOnly &&
      authCookie?.secure &&
      authCookie?.sameSite === 'Lax',
  );
  await open(desktop);
  await open(mobile);
  await ready(desktop, 1);
  await ready(mobile, 1);
  const paused = [];
  const intercept = async (p) => {
    await p.setRequestInterception(true);
    const listener = (r) => {
      let body;
      try {
        body = JSON.parse(r.postData() || '{}');
      } catch {}
      if (
        r.url() === base + '/api/core' &&
        body?.action === 'attempt' &&
        body.payload.questionIndex === 1
      )
        paused.push({ request: r, payload: body.payload });
      else void r.continue();
    };
    p.on('request', listener);
    return listener;
  };
  const listeners = await Promise.all([intercept(desktop), intercept(mobile)]);
  await Promise.all([
    desktop.type('#answer', String(canonical.questions[0].answer)),
    mobile.type('#answer', String(canonical.questions[0].answer)),
  ]);
  const pending = [
    actionResponse(desktop, 'attempt'),
    actionResponse(mobile, 'attempt'),
  ];
  await Promise.all([
    desktop.click('button[type=submit]'),
    mobile.click('button[type=submit]'),
  ]);
  const until = Date.now() + 10000;
  while (paused.length < 2 && Date.now() < until)
    await new Promise((r) => setTimeout(r, 50));
  check(
    'two actual UI POSTs paused before real concurrent release',
    paused.length === 2 &&
      paused[0].payload.clientAttemptId !== paused[1].payload.clientAttemptId &&
      paused.every((x) => x.payload.questionIndex === 1),
  );
  proof.raceRelease = {
    requests: 2,
    differentUUIDs: true,
    responseMocks: false,
    barrier: 'REQUEST_CONTINUE_UNMODIFIED',
  };
  await Promise.all(paused.map((x) => x.request.continue()));
  const responses = await Promise.all(pending);
  const outcomes = await Promise.all(
    responses.map(async (r) => ({
      status: r.status(),
      body: await r.json(),
      payload: JSON.parse(r.request().postData()).payload,
    })),
  );
  proof.race = outcomes;
  check(
    'active question race exactly one200 and one409',
    outcomes.filter((x) => x.status === 200).length === 1 &&
      outcomes.filter(
        (x) => x.status === 409 && x.body.error === 'work_question_conflict',
      ).length === 1,
  );
  for (let i = 0; i < 2; i++) {
    [desktop, mobile][i].off('request', listeners[i]);
    await [desktop, mobile][i].setRequestInterception(false);
  }
  const winner = outcomes.find((x) => x.status === 200).payload;
  proof.answers.push(winner);
  const replay = await post(desktop, {
    action: 'attempt',
    sessionId: session,
    payload: winner,
  });
  proof.exactReplay = replay;
  check(
    'winning UUID exact payload replay200 and count1',
    replay.status === 200 &&
      replay.body.workProgress.replayed &&
      replay.body.workProgress.attemptCount === 1,
  );
  const altered = {
    ...winner,
    studentNumericAnswer: winner.studentNumericAnswer + 1,
    metadata: {
      ...winner.metadata,
      given: winner.studentNumericAnswer + 1,
      responsePayload: { value: winner.studentNumericAnswer + 1 },
    },
  };
  proof.changedReplay = await post(desktop, {
    action: 'attempt',
    sessionId: session,
    payload: altered,
  });
  check(
    'same UUID different answer denied409',
    proof.changedReplay.status === 409 &&
      proof.changedReplay.body.error === 'IDEMPOTENCY_KEY_REUSED',
  );
  proof.oldSessionDenied = await post(desktop, {
    action: 'attempt',
    sessionId: 'bdb87fbc-0938-4eb1-82e5-0a2cb362d30f',
    payload: winner,
  });
  check(
    'old accepted session cannot be addressed by fixture',
    proof.oldSessionDenied.status === 404,
  );
  const resumed = await open(desktop);
  check(
    'race recovery retains one answer same session',
    resumed.workProgress.attemptCount === 1,
  );
  await solve(desktop, 2, true);
  await solve(desktop, 3, true);
  await solve(desktop, 4);
  await desktop.screenshot({
    path: out + '/desktop-active.png',
    fullPage: true,
  });
  const loggedOut = await post(desktop, { action: 'logout' });
  check('normal logout succeeds', loggedOut.status === 200);
  const revoked = await fetch(base + '/api/core', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      cookie: 'cza_student_session=' + authCookie.value,
    },
    body: JSON.stringify({
      action: 'attempt',
      sessionId: session,
      payload: winner,
    }),
  });
  check('actual revoked token denied401', revoked.status === 401);
  await login(mobile);
  const again = await open(mobile);
  check(
    'real mobile relogin resumes fixed session with4 answers',
    again.workProgress.attemptCount === 4 &&
      again.workProgress.correctCount === 2,
  );
  proof.foreignSelectors = await get(
    mobile,
    '/api/core/dashboard?studentId=20000000-0000-4000-8000-000000000002&academyId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  );
  check(
    'foreign student/academy selectors preserve authenticated ID',
    proof.foreignSelectors.status === 200 &&
      proof.foreignSelectors.body.dashboard.profile.id === student,
  );
  proof.foreignSession = await post(mobile, {
    action: 'finish',
    sessionId: '30000000-0000-4000-8000-000000000002',
  });
  check(
    'foreign session finish rejected404',
    proof.foreignSession.status === 404,
  );
  for (let i = 5; i <= 9; i++) await solve(mobile, i);
  const finishing = actionResponse(mobile, 'finish');
  await solve(mobile, 10);
  const finished = await finishing,
    b = await finished.json();
  proof.completion = { status: finished.status(), body: b };
  check(
    'native completion response10/8',
    finished.status() === 200 &&
      b.workCompletion.status === 'completed' &&
      b.workCompletion.attemptCount === 10 &&
      b.workCompletion.correctCount === 8,
  );
  await nativeResult(mobile, 'mobile', 390, 844);
  await nativeResult(mobile, 'desktop', 1440, 900);
  const repeated = await Promise.all(
    Array.from({ length: 6 }, () =>
      post(mobile, { action: 'finish', sessionId: session }),
    ),
  );
  proof.finishReplay = repeated;
  check(
    'six finish replays same one record/evidence',
    repeated.every(
      (r) =>
        r.status === 200 &&
        r.body.workCompletion.replayed &&
        r.body.workCompletion.learningRecordId ===
          b.workCompletion.learningRecordId &&
        r.body.workCompletion.evidenceId === b.workCompletion.evidenceId,
    ),
  );
  proof.profile = await get(mobile, '/api/core/learning-profile');
  check(
    'same Student Learning Profile includes both accepted and fixture records',
    proof.profile.status === 200 &&
      proof.profile.body.profile.student.id === student &&
      proof.profile.body.profile.recentRecords.some(
        (r) => r.recordId === b.workCompletion.learningRecordId,
      ) &&
      proof.profile.body.profile.recentRecords.some(
        (r) => r.recordId === 'a1d057e4-cb08-46be-94c8-e2b6a4fa8c79',
      ),
  );
  check(
    'cleanup logout',
    (await post(mobile, { action: 'logout' })).status === 200,
  );
  check(
    'post-logout finish401',
    (await post(mobile, { action: 'finish', sessionId: session })).status ===
      401,
  );
  check('zero page errors', proof.errors.length === 0);
  proof.passed = true;
} catch (e) {
  proof.failure = e.message;
  process.exitCode = 1;
  for (let i = 0; i < pages.length; i++) {
    try {
      await pages[i].screenshot({
        path: out + '/failure-' + i + '.png',
        fullPage: true,
      });
    } catch {}
  }
} finally {
  await browser.close();
  fs.writeFileSync(out + '/final-browser.json', JSON.stringify(proof, null, 2));
  console.log(
    JSON.stringify({
      passed: proof.passed,
      checks: proof.checks.length,
      failure: proof.failure,
    }),
  );
}
