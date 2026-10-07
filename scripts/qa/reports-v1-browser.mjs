import { installTrustedEducatorTransport, verifyTrustedEducatorBackend, selectEducatorStudent } from './trusted-educator-transport.mjs';
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
await verifyTrustedEducatorBackend(sql);
const educatorToken = crypto.randomBytes(32).toString('hex');
const educatorTokenHash = crypto.createHash('sha256').update(educatorToken).digest('hex');
const marker = 'CZA_REPORTS_V1_BROWSER_' + Date.now();
let educatorSessionId = '';
let chrome;
let chromeStderr = '';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function reportDuration(milliseconds) {
  const totalMinutes = Math.max(0, Math.round(Number(milliseconds || 0) / 60000));
  if (totalMinutes < 1) return '1 dk altı';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return String(minutes) + ' dk';
  return minutes ? String(hours) + ' sa ' + String(minutes) + ' dk' : String(hours) + ' sa';
}

function stable(value) {
  return JSON.stringify(value);
}

function normalizeForReload(rows) {
  return [...rows].map(item => ({
    moduleCode: String(item.moduleCode),
    sessions: Number(item.sessions),
    totalQuestions: Number(item.totalQuestions),
    correct: Number(item.correct),
    wrong: Number(item.wrong),
    accuracy: Number(item.accuracy),
    totalDurationMs: Number(item.totalDurationMs),
  })).sort((a,b) => a.moduleCode.localeCompare(b.moduleCode));
}

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

async function readUiValues(page) {
  return await evalJson(page, `(() => {
    const metrics = Object.fromEntries(Array.from(document.querySelectorAll('[data-report-label]')).map(el => [
      el.getAttribute('data-report-label'),
      el.getAttribute('data-report-value'),
    ]));
    const assignments = Object.fromEntries(Array.from(document.querySelectorAll('[data-assignment-label]')).map(el => [
      el.getAttribute('data-assignment-label'),
      el.getAttribute('data-assignment-value'),
    ]));
    const signals = Object.fromEntries(Array.from(document.querySelectorAll('[data-signal-type]')).map(el => [
      el.getAttribute('data-signal-type'),
      el.getAttribute('data-signal-value'),
    ]));
    const errors = Array.from(document.querySelectorAll('[data-error-type]')).map(el => ({
      error_type: el.getAttribute('data-error-type'),
      count: Number(el.getAttribute('data-error-count') || 0),
    })).sort((a,b) => String(a.error_type).localeCompare(String(b.error_type)));
    const modules = Array.from(document.querySelectorAll('[data-module-code]')).map(el => ({
      moduleCode: el.getAttribute('data-module-code'),
      sessions: Number(el.getAttribute('data-module-sessions') || 0),
      totalQuestions: Number(el.getAttribute('data-module-total-questions') || 0),
      correct: Number(el.getAttribute('data-module-correct') || 0),
      wrong: Number(el.getAttribute('data-module-wrong') || 0),
      accuracy: Number(el.getAttribute('data-module-accuracy') || 0),
      totalDurationMs: Number(el.getAttribute('data-module-duration-ms') || 0),
    })).sort((a,b) => String(a.moduleCode).localeCompare(String(b.moduleCode)));
    return { metrics, assignments, signals, errors, modules };
  })()`);
}

function assertUiMatchesApi(ui, api, label) {
  const expectedMetrics = {
    'Tamamlanan oturum': String(api.reportInsights.sessions),
    'Toplam çalışma': reportDuration(api.reportInsights.totalDurationMs),
    'Toplam soru': String(api.reportInsights.totalQuestions),
    'Canonical doğruluk': '%' + String(api.reportInsights.accuracy),
  };
  const expectedAssignments = {
    'Toplam': String(api.assignmentProgress.total),
    'Atandı': String(api.assignmentProgress.assigned),
    'Başladı': String(api.assignmentProgress.started),
    'Tamamlandı': String(api.assignmentProgress.completed),
  };
  const expectedSignals = {
    timeout: String(api.reportInsights.timeoutCount),
    retry: String(api.reportInsights.retryCount),
  };
  const expectedErrors = [...(api.errorSummary || [])].map(item => ({
    error_type: String(item.error_type),
    count: Number(item.count),
  })).sort((a,b) => a.error_type.localeCompare(b.error_type));
  const expectedModules = [...(api.moduleProgress || [])].map(item => ({
    moduleCode: String(item.moduleCode),
    sessions: Number(item.sessions),
    totalQuestions: Number(item.totalQuestions),
    correct: Number(item.correct),
    wrong: Number(item.wrong),
    accuracy: Number(item.accuracy),
    totalDurationMs: Number(item.totalDurationMs),
  })).sort((a,b) => a.moduleCode.localeCompare(b.moduleCode));

  if (stable(ui.metrics) !== stable(expectedMetrics)) throw new Error(label + '_ui_summary_api_mismatch:' + stable({ ui: ui.metrics, expected: expectedMetrics }));
  if (stable(ui.assignments) !== stable(expectedAssignments)) throw new Error(label + '_ui_assignment_api_mismatch:' + stable({ ui: ui.assignments, expected: expectedAssignments }));
  if (stable(ui.signals) !== stable(expectedSignals)) throw new Error(label + '_ui_signal_api_mismatch:' + stable({ ui: ui.signals, expected: expectedSignals }));
  if (stable(ui.errors) !== stable(expectedErrors)) throw new Error(label + '_ui_error_api_mismatch:' + stable({ ui: ui.errors, expected: expectedErrors }));
  if (stable(ui.modules) !== stable(expectedModules)) throw new Error(label + '_ui_module_api_mismatch:' + stable({ ui: ui.modules, expected: expectedModules }));
}

async function openUiReport(page, studentId) {
  await selectEducatorStudent(page, studentId);
  const openedFromStudent = await evalJson(page, `(() => {
    const rows = Array.from(document.querySelectorAll('div')).filter(el =>
      el.innerText?.includes(${JSON.stringify(studentId)}) &&
      Array.from(el.querySelectorAll('button')).some(button => button.textContent?.includes('Çalışma raporu'))
    );
    const row = rows.sort((a,b) => a.innerText.length - b.innerText.length)[0];
    if (!row) return false;
    const button = Array.from(row.querySelectorAll('button')).find(el => el.textContent?.includes('Çalışma raporu'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!openedFromStudent) throw new Error('student_report_button_missing');
  await waitForText(page, 'Gerçek kaydı getir');

  const inputValue = await evalJson(page, `document.querySelector('#studentCode')?.value || ''`);
  if (String(inputValue) !== String(studentId)) throw new Error('report_student_id_not_carried_from_row');

  const submitted = await evalJson(page, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.includes('Gerçek kaydı getir'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!submitted) throw new Error('report_form_submit_missing');

  try {
    await waitForText(page, 'RAPORLAR V1');
  } catch {
    const snapshot = await evalJson(page, `document.body?.innerText?.slice(-3500) || ''`);
    throw new Error('reports_v1_ui_missing:' + String(snapshot).replaceAll('\\n', ' | '));
  }
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
  await installTrustedEducatorTransport(page);
  await setCookie(page, 'cza_educator_session', 'local.' + educatorToken);
  await navigate(page, baseUrl + '/educator');
  await waitForText(page, 'Eğitimci kontrol merkezi');

  const before = await loadApiReport(page, String(fixture.student_id));
  await openUiReport(page, String(fixture.student_id));
  const uiBefore = await readUiValues(page);
  assertUiMatchesApi(uiBefore, before, 'before_reload');

  await reloadHard(page);
  await waitForText(page, 'Eğitimci kontrol merkezi');
  const after = await loadApiReport(page, String(fixture.student_id));
  await openUiReport(page, String(fixture.student_id));
  const uiAfter = await readUiValues(page);
  assertUiMatchesApi(uiAfter, after, 'after_reload');

  const reloadStable =
    before.reportInsights.sessions === after.reportInsights.sessions &&
    before.reportInsights.totalQuestions === after.reportInsights.totalQuestions &&
    before.reportInsights.accuracy === after.reportInsights.accuracy &&
    before.reportInsights.totalDurationMs === after.reportInsights.totalDurationMs &&
    stable(before.assignmentProgress) === stable(after.assignmentProgress) &&
    stable(normalizeForReload(before.moduleProgress || [])) === stable(normalizeForReload(after.moduleProgress || []));

  if (!reloadStable) throw new Error('report_metrics_changed_after_hard_reload');

  console.log('REPORTS_V1_BROWSER=PASS');
  console.log('EDUCATOR_REPORT_UI=PASS');
  console.log('REPORT_SUMMARY_UI=PASS');
  console.log('MODULE_PROGRESS_UI=PASS');
  console.log('ASSIGNMENT_PROGRESS_UI=PASS');
  console.log('ERROR_SIGNAL_UI=PASS');
  console.log('HARD_RELOAD=PASS');
  console.log('API_UI_SAME_SOURCE=PASS');
  console.log('UI_API_EXACT_VALUES=PASS');
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
