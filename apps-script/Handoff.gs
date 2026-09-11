const CZA_WORK_PANEL_URL = 'https://cza-egzersiz-akademisi.habipcann65.chatgpt.site/work';
const CZA_WORK_HANDOFF_PREFIX = 'cza_work_handoff_';
const CZA_WORK_HANDOFF_SECONDS = 120;

/**
 * Creates a short-lived, single-use handoff ticket for the already-authenticated
 * student. The student's code/PIN is never placed in the browser URL.
 */
function createWorkPanelHandoff(token) {
  const session = requireSession_(token);
  const studentCode = normalizeCode_(session && session.code);
  if (!studentCode) throw new Error('Öğrenci oturumu doğrulanamadı. Lütfen yeniden giriş yapın.');

  const ticket = (
    Utilities.getUuid().replace(/-/g, '')
    + Utilities.getUuid().replace(/-/g, '')
  ).toLowerCase();

  CacheService.getScriptCache().put(
    CZA_WORK_HANDOFF_PREFIX + ticket,
    JSON.stringify({ studentCode: studentCode, createdAt: Date.now() }),
    CZA_WORK_HANDOFF_SECONDS
  );

  return {
    ok: true,
    url: CZA_WORK_PANEL_URL + '?handoff=' + encodeURIComponent(ticket),
    expiresInSeconds: CZA_WORK_HANDOFF_SECONDS,
  };
}

/**
 * Consumed only by the CZA work-panel backend. The ticket is deleted while a
 * script lock is held, so a successful ticket cannot be replayed.
 */
function consumeWorkPanelHandoff(ticket) {
  const cleanTicket = String(ticket || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(cleanTicket)) {
    return { ok: false, error: 'invalid_ticket' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const key = CZA_WORK_HANDOFF_PREFIX + cleanTicket;
    const stored = cache.get(key);
    if (!stored) return { ok: false, error: 'ticket_expired_or_used' };

    cache.remove(key);
    const handoff = JSON.parse(stored);
    const studentCode = normalizeCode_(handoff && handoff.studentCode);
    if (!studentCode || !findStudent_(studentCode)) {
      return { ok: false, error: 'student_not_found' };
    }

    return { ok: true, studentCode: studentCode };
  } catch (error) {
    return { ok: false, error: 'handoff_unavailable' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * JSON endpoint used by app/api/legacy-handoff/route.ts. No student session,
 * PIN or personal data is accepted here; possession of the short-lived ticket
 * is the only handoff credential.
 */
function doPost(event) {
  try {
    const raw = event && event.postData ? String(event.postData.contents || '') : '';
    const body = raw ? JSON.parse(raw) : {};
    if (body.action !== 'consumeWorkPanelHandoff') {
      return czaHandoffJson_({ ok: false, error: 'unsupported_action' });
    }
    return czaHandoffJson_(consumeWorkPanelHandoff(body.ticket));
  } catch (error) {
    return czaHandoffJson_({ ok: false, error: 'invalid_request' });
  }
}

function czaHandoffJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
