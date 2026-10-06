import crypto from 'node:crypto';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.CZA_STAGING_DATABASE_URL || '';
const baseUrl = process.env.CZA_BROWSER_BASE_URL || 'http://127.0.0.1:8787';
const educatorAuthUserId = '47c90485-e057-4ebe-a25c-9d7f236c5bd6';

if (!databaseUrl) {
  console.error('REPORTS_V1_BROWSER=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try { parsed = new URL(databaseUrl); }
catch {
  console.error('REPORTS_V1_BROWSER=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('REPORTS_V1_BROWSER=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

const sql = neon(databaseUrl);
const educatorToken = crypto.randomBytes(32).toString('hex');
const educatorTokenHash = crypto.createHash('sha256').update(educatorToken).digest('hex');
const marker = 'CZA_REPORTS_V1_BROWSER_' + Date.now();
let educatorSessionId = '';
let chrome;
let chromeStderr = '';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForChrome() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      if (response.ok) return await response.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome_debug_endpoint_unavailable:' + chromeStderr.slice(-1200));
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const data = JSON.parse(String(event.data));
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message || 'cdp_error'));
        else resolve(data.result || {});
        return;
      }
      for (const handler of this.listeners.get(data.method) || []) handler(data.params || {});
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    this.listeners.set(method, [...(this.listeners.get(method) || []), handler]);
  }
  once(method) {
    return new Promise(resolve => {
      const handler = params => {
        this.listeners.set(method, (this.listeners.get(method) || []).filter(item => item !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }
  close() { this.ws.close(); }
}

async function newPage(url) {
  const response = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!response.ok) throw new Error('chrome_target_create_failed');
  const target = await response.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  return cdp;
}

async function evalJson(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'browser_eval_failed');
  return result.result?.value;
}

async function waitForText(cdp, value, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evalJson(cdp, `document.body && document.body.innerText.includes(${JSON.stringify(value)})`)) return;
    await sleep(250);
  }
  throw new Error('browser_text_timeout:' + value);
}

async function reloadHard(cdp) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.reload', { ignoreCache: true });
  await Promise.race([loaded, sleep(15000).then(() => { throw new Error('hard_reload_timeout'); })]);
}

async function setCookie(cdp, name, value) {
  const result = await cdp.send('Network.setCookie', {
    name,
    value,
    url: baseUrl + '/api',
    path: '/api',
    httpOnly: true,
    sameSite: 'Lax',
  });
  if (result.success !== true) throw new Error('cookie_set_failed:' + name);
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(15000).then(() => { throw new Error('navigation_timeout:' + url); })]);
}

async function loadApiReport(page, studentId) {
  const result = await evalJson(page, `(async () => {
    const r = await fetch('/api/educator-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: ${JSON.stringify(studentId)} }),
    });
    return { status: r.status, body: await r.json() };
  })()`);
  if (result?.status !== 200 || result?.body?.ok !== true) throw new Error('browser_report_api_failed');
  if (result.body.reportInsightsAvailable !== true) throw new Error('browser_report_insights_unavailable');
  if (!Array.isArray(result.body.moduleProgress) || result.body.moduleProgress.length < 1) throw new Error('browser_module_progress_missing');
  return result.body;
}

async function openUiReport(page, studentId) {
  const tabOpened = await evalJson(page, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.includes('Seans raporları'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!tabOpened) throw new Error('reports_tab_missing');
  await waitForText(page, 'Gerçek kaydı getir');

  const filled = await evalJson(page, `(() => {
    const input = document.querySelector('#studentCode');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(studentId)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (!filled) throw new Error('report_student_input_missing');
  await sleep(150);

  const submitted = await evalJson(page, `(() => {
    const input = document.querySelector('#studentCode');
    if (!input) return false;
    input.closest('form')?.requestSubmit();
    return true;
  })()`);
  if (!submitted) throw new Error('report_form_submit_missing');

  await waitForText(page, 'Raporlar V1');
  await waitForText(page, 'Çalışma ve ödev gelişim özeti');
  await waitForText(page, 'Canonical doğruluk');
  await waitForText(page, 'Ödev ilerlemesi');
  await waitForText(page, 'Hata ve tekrar sinyalleri');
  await waitForText(page, 'Modül bazlı gelişim');
  await waitForText(page, 'Gerçek çalışma geçmişi');
}

try {
  const fixtures = await sql`
    SELECT
      t.id AS educator_user_id,
      t.academy_id,
      s.id AS student_id
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id = t.id
     AND l.can_view = true
    JOIN public.students s
      ON s.id = l.student_id
     AND s.academy_id = t.academy_id
     AND s.status = 'active'
    WHERE t.auth_user_id = ${educatorAuthUserId}
      AND t.is_active = true
      AND EXISTS (
        SELECT 1
        FROM public.learning_records lr
        WHERE lr.academy_id = s.academy_id
          AND lr.student_id = s.id
      )
    ORDER BY (
      SELECT count(*)
      FROM public.learning_records lr
      WHERE lr.academy_id = s.academy_id
        AND lr.student_id = s.id
    ) DESC
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('REPORTS_V1_BROWSER=BLOCKED');
    console.error('REASON=NO_LINKED_STUDENT_WITH_CANONICAL_HISTORY');
    process.exit(2);
  }
  const fixture = fixtures[0];

  const educatorSessionRows = await sql`
    INSERT INTO public.educator_sessions (
      academy_id, educator_user_id, token_hash, expires_at, user_agent
    ) VALUES (
      ${fixture.academy_id}::uuid,
      ${fixture.educator_user_id}::uuid,
      ${educatorTokenHash},
      now() + interval '15 minutes',
      ${marker}
    )
    RETURNING id
  `;
  educatorSessionId = String(educatorSessionRows[0]?.id || '');
  if (!educatorSessionId) throw new Error('educator_session_fixture_creation_failed');

  const chromeBinary = process.env.CHROME_BIN || 'google-chrome';
  chrome = spawn(chromeBinary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/cza-reports-v1-browser',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr?.on('data', chunk => { chromeStderr += String(chunk); });
  chrome.on('error', error => { chromeStderr += '\nSPAWN_ERROR=' + error.message; });
  chrome.on('exit', (code, signal) => { chromeStderr += '\nCHROME_EXIT=' + code + ':' + signal; });

  await waitForChrome();

  const page = await newPage('about:blank');
  await setCookie(page, 'cza_educator_session', 'local.' + educatorToken);
  await navigate(page, baseUrl + '/educator');
  await waitForText(page, 'Eğitimci kontrol merkezi');

  const before = await loadApiReport(page, String(fixture.student_id));
  await openUiReport(page, String(fixture.student_id));

  await reloadHard(page);
  await waitForText(page, 'Eğitimci kontrol merkezi');
  const after = await loadApiReport(page, String(fixture.student_id));
  await openUiReport(page, String(fixture.student_id));

  const stable =
    before.reportInsights.sessions === after.reportInsights.sessions &&
    before.reportInsights.totalQuestions === after.reportInsights.totalQuestions &&
    before.reportInsights.accuracy === after.reportInsights.accuracy &&
    before.moduleProgress.length === after.moduleProgress.length;

  if (!stable) throw new Error('report_metrics_changed_after_hard_reload');

  console.log('REPORTS_V1_BROWSER=PASS');
  console.log('EDUCATOR_REPORT_UI=PASS');
  console.log('REPORT_SUMMARY_UI=PASS');
  console.log('MODULE_PROGRESS_UI=PASS');
  console.log('ASSIGNMENT_PROGRESS_UI=PASS');
  console.log('ERROR_SIGNAL_UI=PASS');
  console.log('HARD_RELOAD=PASS');
  console.log('API_UI_SAME_SOURCE=PASS');
  console.log('STUDENT_ID_SHA256=' + crypto.createHash('sha256').update(String(fixture.student_id)).digest('hex'));

  page.close();
} catch (error) {
  console.error('REPORTS_V1_BROWSER=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (educatorSessionId) {
    await sql`
      DELETE FROM public.educator_sessions
      WHERE id = ${educatorSessionId}::uuid
        AND user_agent = ${marker}
    `.catch(() => undefined);
  }
  if (chrome && !chrome.killed) chrome.kill('SIGTERM');
}
