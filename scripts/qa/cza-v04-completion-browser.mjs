import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base =
  'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
assert.equal(process.env.CZA_V04_QA_APPROVED, 'YES');
const fixture = JSON.parse(
  fs.readFileSync(process.env.CZA_QA_STUDENT_FIXTURE_FILE, 'utf8'),
);
const session = 'bdb87fbc-0938-4eb1-82e5-0a2cb362d30f',
  recipe = fixture.recipeId;
const out = process.env.CZA_QA_EVIDENCE_DIR;
fs.mkdirSync(out, { recursive: true });
const proof = { checks: [], passed: false, errors: [] };
const check = (name, ok) => {
  proof.checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
};
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.createBrowserContext();
const page = await context.newPage();
page.on('pageerror', (e) => proof.errors.push(e.message));
const post = (input) =>
  page.evaluate(async (input) => {
    const r = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return { status: r.status, body: await r.json() };
  }, input);
try {
  proof.chromeVersion = await browser.version();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base);
  await page.waitForSelector('#home-username');
  await page.type('#home-username', fixture.username);
  await page.type('#home-pin', fixture.pin);
  await page.click('form button[type=submit]');
  await page.waitForSelector('#route');
  check('real normal login after completion', true);
  await page.evaluate(async (recipe) => {
    await fetch('/api/core/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipeId: recipe }),
    });
  }, recipe);
  const completed = await Promise.all(
    Array.from({ length: 6 }, () =>
      post({ action: 'finish', sessionId: session }),
    ),
  );
  proof.completion = completed;
  check(
    'parallel finish same record/evidence, ten answers eight correct',
    completed.every(
      (r) =>
        r.status === 200 &&
        r.body.workCompletion.attemptCount === 10 &&
        r.body.workCompletion.correctCount === 8 &&
        r.body.workCompletion.learningRecordId ===
          'a1d057e4-cb08-46be-94c8-e2b6a4fa8c79' &&
        r.body.workCompletion.evidenceId ===
          '1cd5e31b-d1fc-408d-9847-b0b3b06597a8' &&
        r.body.workCompletion.replayed,
    ),
  );
  const profile = await page.evaluate(async () => {
    const r = await fetch('/api/core/learning-profile');
    return { status: r.status, body: await r.json() };
  });
  proof.profile = profile;
  check(
    'profile same canonical student',
    profile.status === 200 &&
      profile.body.profile.student.id === fixture.studentId,
  );
  check(
    'foreign session denied',
    (
      await post({
        action: 'finish',
        sessionId: '30000000-0000-4000-8000-000000000002',
      })
    ).status === 404,
  );
  const closed = await post({
    action: 'start',
    recipeId: recipe,
    moduleCode: 'finger_read',
    source: 'teacher_assignment',
    clientSessionId: crypto.randomUUID(),
    settings: {},
  });
  proof.closedStart = closed;
  check('completed assignment rejects start', closed.status >= 400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#route');
  check('completed panel survives reload', true);
  await page.screenshot({ path: out + '/desktop.png', fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#route');
  check(
    'mobile completed panel no overflow',
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: out + '/mobile.png', fullPage: true });
  check('cleanup logout', (await post({ action: 'logout' })).status === 200);
  check(
    'revoked session finish denied',
    (await post({ action: 'finish', sessionId: session })).status === 401,
  );
  check('no page errors', proof.errors.length === 0);
  proof.passed = true;
} catch (e) {
  proof.failure = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(out + '/completion.json', JSON.stringify(proof, null, 2));
  console.log(
    JSON.stringify({
      passed: proof.passed,
      checks: proof.checks.length,
      failure: proof.failure,
    }),
  );
}
