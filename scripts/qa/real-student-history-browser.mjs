import { installTrustedEducatorTransport, verifyTrustedEducatorBackend } from './trusted-educator-transport.mjs';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.CZA_STAGING_DATABASE_URL || '';
const baseUrl = process.env.CZA_BROWSER_BASE_URL || 'http://127.0.0.1:8787';
const educatorAuthUserId = '47c90485-e057-4ebe-a25c-9d7f236c5bd6';

if (!databaseUrl) {
  console.error('REAL_HISTORY_BROWSER=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.error('REAL_HISTORY_BROWSER=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('REAL_HISTORY_BROWSER=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

const sql = neon(databaseUrl);
await verifyTrustedEducatorBackend(sql);
const marker = 'CZA_REAL_HISTORY_BROWSER_' + Date.now();
const studentToken = crypto.randomBytes(32).toString('hex');
const educatorToken = crypto.randomBytes(32).toString('hex');
const studentTokenHash = crypto.createHash('sha256').update(studentToken).digest('hex');
const educatorTokenHash = crypto.createHash('sha256').update(educatorToken).digest('hex');
let studentSessionId = '';
let educatorSessionId = '';
let chrome;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForChrome() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      if (response.ok) return await response.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome_debug_endpoint_unavailable');
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
      const handlers = this.listeners.get(data.method) || [];
      for (const handler of handlers) handler(data.params || {});
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
    const current = this.listeners.get(method) || [];
    current.push(handler);
    this.listeners.set(method, current);
  }

  once(method) {
    return new Promise(resolve => {
      const handler = params => {
        const current = this.listeners.get(method) || [];
        this.listeners.set(method, current.filter(item => item !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }

  close() {
    this.ws.close();
  }
}

async function newPage(url) {
  const response = await fetch(
    'http://127.0.0.1:9222/json/new?' + encodeURIComponent(url),
    { method: 'PUT' },
  );
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
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'browser_eval_failed');
  }
  return result.result?.value;
}

async function waitForText(cdp, text, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await evalJson(
      cdp,
      `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
    );
    if (found) return;
    await sleep(250);
  }
  throw new Error('browser_text_timeout:' + text);
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

async function installCoreMeIntercept(cdp, displayName) {
  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: '*://*/api/core', requestStage: 'Request' }],
  });
  cdp.on('Fetch.requestPaused', async params => {
    try {
      let action = '';
      try {
        action = JSON.parse(params.request.postData || '{}').action || '';
      } catch {}
      const payload = action === 'me'
        ? { ok: true, student: { name: displayName, username: 'browser-qa' } }
        : { ok: false, error: 'browser_qa_core_action_blocked' };
      await cdp.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: action === 'me' ? 200 : 400,
        responseHeaders: [
          { name: 'content-type', value: 'application/json; charset=utf-8' },
          { name: 'cache-control', value: 'no-store' },
        ],
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      });
    } catch {
      await cdp.send('Fetch.failRequest', {
        requestId: params.requestId,
        errorReason: 'Failed',
      }).catch(() => undefined);
    }
  });
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(15000).then(() => { throw new Error('navigation_timeout:' + url); })]);
}

try {
  const fixtures = await sql`
    SELECT
      lr.id AS record_id,
      lr.academy_id,
      lr.student_id,
      lr.module_code,
      s.first_name,
      s.last_name,
      ss.student_user_id,
      t.id AS educator_user_id
    FROM public.learning_records lr
    JOIN public.students s
      ON s.id = lr.student_id
     AND s.academy_id = lr.academy_id
     AND s.status = 'active'
    JOIN public.student_sessions ss
      ON ss.id = lr.student_session_id
     AND ss.student_id = lr.student_id
     AND ss.academy_id = lr.academy_id
    JOIN public.users su
      ON su.id = ss.student_user_id
     AND su.is_active = true
     AND su.role = 'student'
    JOIN public.teacher_student_links l
      ON l.student_id = lr.student_id
     AND l.can_view = true
    JOIN public.users t
      ON t.id = l.teacher_id
     AND t.is_active = true
     AND t.role::text IN ('admin','teacher')
     AND t.auth_user_id = ${educatorAuthUserId}
    ORDER BY lr.completed_at DESC, lr.created_at DESC
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('REAL_HISTORY_BROWSER=BLOCKED');
    console.error('REASON=NO_BROWSER_ACCEPTANCE_FIXTURE');
    process.exit(2);
  }

  const fixture = fixtures[0];
  const studentSessionRows = await sql`
    INSERT INTO public.student_sessions (
      academy_id, student_id, student_user_id, token_hash,
      expires_at, last_seen_at, user_agent
    ) VALUES (
      ${fixture.academy_id}::uuid,
      ${fixture.student_id}::uuid,
      ${fixture.student_user_id}::uuid,
      ${studentTokenHash},
      now() + interval '15 minutes',
      now(),
      ${marker}
    )
    RETURNING id
  `;
  studentSessionId = String(studentSessionRows[0]?.id || '');

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

  if (!studentSessionId || !educatorSessionId) {
    throw new Error('browser_session_fixture_creation_failed');
  }

  const chromeBinary = process.env.CHROME_BIN || 'google-chrome';
  chrome = spawn(chromeBinary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/cza-history-browser-chrome',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  await waitForChrome();

  const studentPage = await newPage('about:blank');
  await installCoreMeIntercept(
    studentPage,
    [fixture.first_name, fixture.last_name].filter(Boolean).join(' ') || 'CZA QA Öğrenci',
  );
  await setCookie(studentPage, 'cza_student_session', studentToken);
  await navigate(studentPage, baseUrl + '/work');
  await waitForText(studentPage, 'Canonical Learning Record');
  await waitForText(studentPage, 'Son çalışmalarım');

  const studentBefore = await evalJson(studentPage, `(async () => {
    const r = await fetch('/api/student-history', { cache: 'no-store' });
    return { status: r.status, body: await r.json() };
  })()`);
  if (studentBefore?.status !== 200 || studentBefore?.body?.ok !== true) {
    throw new Error('student_history_browser_read_failed');
  }
  const studentHasRecord = studentBefore.body.records?.some(record => String(record.id) === String(fixture.record_id));
  if (!studentHasRecord) throw new Error('student_browser_record_missing');

  await reloadHard(studentPage);
  await waitForText(studentPage, 'Canonical Learning Record');
  await waitForText(studentPage, 'Son çalışmalarım');
  const studentAfter = await evalJson(studentPage, `(async () => {
    const r = await fetch('/api/student-history', { cache: 'no-store' });
    return { status: r.status, body: await r.json() };
  })()`);
  if (
    studentAfter?.status !== 200 ||
    !studentAfter?.body?.records?.some(record => String(record.id) === String(fixture.record_id))
  ) {
    throw new Error('student_hard_reload_record_missing');
  }

  const educatorPage = await newPage('about:blank');
  await installTrustedEducatorTransport(educatorPage);
  await setCookie(educatorPage, 'cza_educator_session', 'local.' + educatorToken);
  await navigate(educatorPage, baseUrl + '/educator');
  await waitForText(educatorPage, 'Eğitimci kontrol merkezi');

  async function loadEducatorReport() {
    const result = await evalJson(educatorPage, `(async () => {
      const r = await fetch('/api/educator-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: ${JSON.stringify(String(fixture.student_id))} }),
      });
      return { status: r.status, body: await r.json() };
    })()`);
    if (result?.status !== 200 || result?.body?.ok !== true) {
      throw new Error('educator_history_browser_read_failed');
    }
    if (!result.body.learningHistory?.some(record => String(record.id) === String(fixture.record_id))) {
      throw new Error('educator_browser_record_missing');
    }
    return result;
  }

  async function openEducatorUiReport() {
    const uiLoaded = await evalJson(educatorPage, `(() => {
      const button = Array.from(document.querySelectorAll('nav[aria-label="Eğitimci bölümleri"] button')).find(el => el.textContent?.includes('Çalışma raporu'));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!uiLoaded) throw new Error('educator_reports_tab_missing');
    await waitForText(educatorPage, 'Gerçek kaydı getir');

    const filled = await evalJson(educatorPage, `(() => {
      const input = document.querySelector('#studentCode');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, ${JSON.stringify(String(fixture.student_id))});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    if (!filled) throw new Error('educator_report_form_missing');
    await sleep(150);

    const submitted = await evalJson(educatorPage, `(() => {
      const input = document.querySelector('#studentCode');
      if (!input) return false;
      input.closest('form')?.requestSubmit();
      return true;
    })()`);
    if (!submitted) throw new Error('educator_report_submit_missing');
    await waitForText(educatorPage, 'Gerçek çalışma geçmişi');
  }

  const educatorBefore = await loadEducatorReport();
  await openEducatorUiReport();

  await reloadHard(educatorPage);
  await waitForText(educatorPage, 'Eğitimci kontrol merkezi');
  const educatorAfter = await loadEducatorReport();
  await openEducatorUiReport();

  const sameRecord =
    studentBefore.body.records.some(record => record.id === fixture.record_id) &&
    studentAfter.body.records.some(record => record.id === fixture.record_id) &&
    educatorBefore.body.learningHistory.some(record => record.id === fixture.record_id) &&
    educatorAfter.body.learningHistory.some(record => record.id === fixture.record_id);

  if (!sameRecord) throw new Error('cross_role_record_identity_mismatch');

  console.log('REAL_HISTORY_BROWSER=PASS');
  console.log('STUDENT_AUTH_BROWSER=PASS');
  console.log('STUDENT_UI_HISTORY=PASS');
  console.log('STUDENT_HARD_RELOAD=PASS');
  console.log('EDUCATOR_AUTH_BROWSER=PASS');
  console.log('EDUCATOR_UI_HISTORY=PASS');
  console.log('EDUCATOR_HARD_RELOAD=PASS');
  console.log('CROSS_ROLE_SAME_RECORD=PASS');
  console.log('RECORD_ID_SHA256=' + crypto.createHash('sha256').update(String(fixture.record_id)).digest('hex'));

  studentPage.close();
  educatorPage.close();
} catch (error) {
  console.error('REAL_HISTORY_BROWSER=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (studentSessionId) {
    await sql`
      DELETE FROM public.student_sessions
      WHERE id = ${studentSessionId}::uuid
        AND user_agent = ${marker}
    `.catch(() => undefined);
  }
  if (educatorSessionId) {
    await sql`
      DELETE FROM public.educator_sessions
      WHERE id = ${educatorSessionId}::uuid
        AND user_agent = ${marker}
    `.catch(() => undefined);
  }
  if (chrome && !chrome.killed) chrome.kill('SIGTERM');
}
