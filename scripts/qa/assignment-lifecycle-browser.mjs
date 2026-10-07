import { installTrustedEducatorTransport, verifyTrustedEducatorBackend, selectEducatorStudent } from './trusted-educator-transport.mjs';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.CZA_STAGING_DATABASE_URL || '';
const baseUrl = process.env.CZA_BROWSER_BASE_URL || 'http://127.0.0.1:8787';
const educatorAuthUserId = '47c90485-e057-4ebe-a25c-9d7f236c5bd6';

if (!databaseUrl) {
  console.error('ASSIGNMENT_BROWSER=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try { parsed = new URL(databaseUrl); }
catch {
  console.error('ASSIGNMENT_BROWSER=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('ASSIGNMENT_BROWSER=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

const sql = neon(databaseUrl);
await verifyTrustedEducatorBackend(sql);
const studentToken = crypto.randomBytes(32).toString('hex');
const educatorToken = crypto.randomBytes(32).toString('hex');
const studentTokenHash = crypto.createHash('sha256').update(studentToken).digest('hex');
const educatorTokenHash = crypto.createHash('sha256').update(educatorToken).digest('hex');
const marker = 'CZA_ASSIGNMENT_BROWSER_' + Date.now();
let studentSessionId = '';
let educatorSessionId = '';
let assignmentId = '';
let chrome;
let chromeStderr = '';

const moduleLabels = {
  finger_read: 'Parmak Okuma',
  soroban_read: 'Soroban Okuma',
  soroban_write: 'Soroban Yazma',
  flash_anzan: 'Flash Anzan',
  audio_anzan: 'Sesli Anzan',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function installCoreMeIntercept(cdp, displayName) {
  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: '*://*/api/core', requestStage: 'Request' }],
  });
  cdp.on('Fetch.requestPaused', async params => {
    try {
      let action = '';
      try { action = JSON.parse(params.request.postData || '{}').action || ''; } catch {}
      if (action !== 'me') {
        await cdp.send('Fetch.continueRequest', { requestId: params.requestId });
        return;
      }
      const payload = { ok: true, student: { name: displayName, username: 'assignment-browser-qa' } };
      await cdp.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'application/json; charset=utf-8' },
          { name: 'cache-control', value: 'no-store' },
        ],
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      });
    } catch {
      await cdp.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' }).catch(() => undefined);
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
    WITH candidate_students AS (
      SELECT
        s.id AS student_id,
        s.academy_id,
        s.first_name,
        s.last_name,
        l.teacher_id AS educator_user_id,
        ss.student_user_id
      FROM public.students s
      JOIN public.teacher_student_links l
        ON l.student_id = s.id
       AND l.can_view = true
      JOIN public.users t
        ON t.id = l.teacher_id
       AND t.is_active = true
       AND t.auth_user_id = ${educatorAuthUserId}
      JOIN public.student_sessions ss
        ON ss.student_id = s.id
       AND ss.academy_id = s.academy_id
      WHERE s.status = 'active'
      ORDER BY s.id
    ),
    modules(code) AS (
      VALUES ('finger_read'), ('soroban_read'), ('soroban_write'), ('flash_anzan'), ('audio_anzan')
    )
    SELECT cs.*, modules.code AS module_code
    FROM candidate_students cs
    CROSS JOIN modules
    JOIN public.modules m ON m.code = modules.code AND m.is_active = true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.training_recipes tr
      WHERE tr.student_id = cs.student_id
        AND tr.academy_id = cs.academy_id
        AND tr.module_code = modules.code
        AND tr.source = 'teacher_assignment'
        AND tr.is_active = true
        -- Match the staging unique-active index, including expired active flags.
    )
    ORDER BY cs.student_id, modules.code
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('ASSIGNMENT_BROWSER=BLOCKED');
    console.error('REASON=NO_ASSIGNABLE_LINKED_STUDENT_FIXTURE');
    process.exit(2);
  }

  const fixture = fixtures[0];
  const studentName = [fixture.first_name, fixture.last_name].filter(Boolean).join(' ') || 'CZA QA Öğrenci';
  const moduleLabel = moduleLabels[fixture.module_code] || fixture.module_code;

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

  const chromeBinary = process.env.CHROME_BIN || 'google-chrome';
  chrome = spawn(chromeBinary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/cza-assignment-browser-chrome',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr?.on('data', chunk => { chromeStderr += String(chunk); });
  chrome.on('error', error => { chromeStderr += '\nSPAWN_ERROR=' + error.message; });
  chrome.on('exit', (code, signal) => { chromeStderr += '\nCHROME_EXIT=' + code + ':' + signal; });
  await waitForChrome();

  const educatorPage = await newPage('about:blank');
  await installTrustedEducatorTransport(educatorPage);
  await setCookie(educatorPage, 'cza_educator_session', 'local.' + educatorToken);
  await navigate(educatorPage, baseUrl + '/educator');
  await waitForText(educatorPage, 'Eğitimci kontrol merkezi');
  await selectEducatorStudent(educatorPage, String(fixture.student_id));
  await waitForText(educatorPage, 'Ödev yönetimi');
  const assigned = await evalJson(educatorPage, `(async () => {
    const select = document.querySelector('#u5-module');
    const title = document.querySelector('#u5-title');
    if (!select || !title) return {ok:false,reason:'assignment_form_missing'};
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(String(fixture.module_code))});
    select.dispatchEvent(new Event('change',{bubbles:true}));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(title,${JSON.stringify(moduleLabel + ' · Başlangıç çalışması')});
    title.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,100));
    title.closest('form').requestSubmit();
    return {ok:true};
  })()`);
  if (!assigned?.ok) throw new Error('educator_assignment_ui_failed:' + assigned?.reason);
  await waitForText(educatorPage, 'Ödev oluşturuldu.');

  const assignmentRows = await sql`
    SELECT id
    FROM public.training_recipes
    WHERE academy_id = ${fixture.academy_id}::uuid
      AND student_id = ${fixture.student_id}::uuid
      AND module_code = ${fixture.module_code}::text
      AND source = 'teacher_assignment'
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  `;
  assignmentId = String(assignmentRows[0]?.id || '');
  if (!assignmentId) throw new Error('assignment_not_persisted');

  await waitForText(educatorPage, moduleLabel + ' · Başlangıç çalışması');
  await waitForText(educatorPage, 'Aktif');
  const currentAssignment = await evalJson(educatorPage, `Array.from(document.querySelectorAll('[data-assignment-id]')).some(el=>el.getAttribute('data-assignment-id')===${JSON.stringify(assignmentId)} && el.innerText.includes('Aktif'))`);
  if (!currentAssignment) throw new Error('current_assignment_active_state_missing');

  await reloadHard(educatorPage);
  await waitForText(educatorPage, 'Eğitimci kontrol merkezi');
  await selectEducatorStudent(educatorPage, String(fixture.student_id));
  // Reload restores the default module filter; select this assignment's module again.
  await evalJson(educatorPage, `(() => {
    const select = document.querySelector('#u5-module');
    if (!select) throw new Error('assignment_module_filter_missing');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(String(fixture.module_code))});
    select.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  const assignmentDeadline = Date.now() + 15000;
  while (Date.now() < assignmentDeadline) {
    if (await evalJson(educatorPage, `Array.from(document.querySelectorAll('[data-assignment-id]')).some(el=>el.getAttribute('data-assignment-id')===${JSON.stringify(assignmentId)})`)) break;
    await sleep(250);
  }
  await waitForText(educatorPage, moduleLabel + ' · Başlangıç çalışması');
  await waitForText(educatorPage, 'Aktif');
  const reloadedAssignment = await evalJson(educatorPage, `Array.from(document.querySelectorAll('[data-assignment-id]')).some(el=>el.getAttribute('data-assignment-id')===${JSON.stringify(assignmentId)} && el.innerText.includes('Aktif'))`);
  if (!reloadedAssignment) throw new Error('current_assignment_active_state_reload_missing');

  const studentPage = await newPage('about:blank');
  await installCoreMeIntercept(studentPage, studentName);
  await setCookie(studentPage, 'cza_student_session', studentToken);
  await navigate(studentPage, baseUrl + '/work');
  await waitForText(studentPage, moduleLabel + ' · Başlangıç çalışması');
  const launchVisible = await evalJson(studentPage, `Array.from(document.querySelectorAll('a')).some(el=>el.getAttribute('href')===${JSON.stringify('/assignment?recipe=' + assignmentId)})`);
  if (!launchVisible) throw new Error('student_assignment_launch_missing');
  await reloadHard(studentPage);
  await waitForText(studentPage, moduleLabel + ' · Başlangıç çalışması');
  const reloadLaunchVisible = await evalJson(studentPage, `Array.from(document.querySelectorAll('a')).some(el=>el.getAttribute('href')===${JSON.stringify('/assignment?recipe=' + assignmentId)})`);
  if (!reloadLaunchVisible) throw new Error('student_assignment_launch_reload_missing');

  console.log('ASSIGNMENT_BROWSER=PASS');
  console.log('EDUCATOR_ASSIGN_UI=PASS');
  console.log('EDUCATOR_LIST_UI=PASS');
  console.log('EDUCATOR_HARD_RELOAD=PASS');
  console.log('STUDENT_ASSIGNMENT_UI=PASS');
  console.log('STUDENT_HARD_RELOAD=PASS');
  console.log('ASSIGNED_STATE_UI=PASS');
  console.log('ASSIGNMENT_ID_SHA256=' + crypto.createHash('sha256').update(assignmentId).digest('hex'));

  educatorPage.close();
  studentPage.close();
} catch (error) {
  console.error('ASSIGNMENT_BROWSER=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (assignmentId) {
    await sql`
      DELETE FROM public.training_recipes
      WHERE id = ${assignmentId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM public.training_sessions ts
          WHERE ts.recipe_id = ${assignmentId}::uuid
        )
    `.catch(() => undefined);
  }
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
