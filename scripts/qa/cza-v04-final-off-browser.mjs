import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base =
    'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev',
  recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';
const f = JSON.parse(
  fs.readFileSync(process.env.CZA_QA_STUDENT_FIXTURE_FILE, 'utf8'),
);
const proof = { scope: 'POST_CLEANUP_FLAG_OFF', passed: false };
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  protocolTimeout: 60000,
  args: ['--no-sandbox'],
});
try {
  const context = await browser.createBrowserContext(),
    p = await context.newPage();
  await p.bringToFront();
  p.setDefaultTimeout(30000);
  const response = await p.goto(base, { waitUntil: 'domcontentloaded' });
  const tls = response.securityDetails();
  proof.tls = tls ? { protocol: tls.protocol(), issuer: tls.issuer() } : null;
  assert.ok(proof.tls);
  await p.waitForSelector('#home-username');
  await p.type('#home-username', f.username);
  await p.type('#home-pin', f.pin);
  await p.evaluate(() =>
    document.querySelector('form button[type=submit]').click(),
  );
  await p.waitForSelector('#route');
  const results = await p.evaluate(async (recipe) => {
    const me = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'me' }),
    });
    const m = await me.json();
    const launch = await fetch('/api/core/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipeId: recipe }),
    });
    const l = await launch.json();
    const logout = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    return {
      me: me.status,
      studentId: m.student?.id,
      launch: launch.status,
      error: l.error,
      logout: logout.status,
    };
  }, recipe);
  proof.results = results;
  assert.equal(results.me, 200);
  assert.equal(results.studentId, f.studentId);
  assert.equal(results.launch, 409);
  assert.equal(results.error, 'assignment_completed');
  assert.equal(results.logout, 200);
  proof.chrome = await browser.version();
  proof.passed = true;
} catch (e) {
  proof.failure = e.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(
    process.env.CZA_QA_EVIDENCE_DIR + '/post-cleanup.json',
    JSON.stringify(proof, null, 2),
  );
  console.log(JSON.stringify(proof));
}
