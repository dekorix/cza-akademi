import { createHash, timingSafeEqual } from 'node:crypto';
import { db, error, json, storage } from '@appdeploy/sdk';

/**
 * SEC-C gate for the two voice routes left open by SEC-A.
 *
 * Bearer rules and document fields match PR #115 (`childAccess.ts`):
 * `Authorization: Bearer`, SHA-256 hex in `childAccessTokenHash`, expiry in
 * `childAccessExpiresAt`. This file stays separate so the later merge does not
 * collide with that new module. After the merge, import `presentedBearer` and
 * `childAccessStatus` from `childAccess.ts` and delete the copies below.
 *
 * The sample counter lives in the existing document store (`cza_voice_sample_quota`),
 * addressed by the id `db.add` returns and linked with `voiceSampleQuotaId`.
 * No SQL column and no migration.
 *
 * `count` and `bytes` are a read-modify-write of one whole record. `db.update`
 * has no condition, increment, or compare-and-set in this codebase. Two
 * overlapping requests can both pass the ceiling and both write. The global
 * daily 2 GiB ceiling is not enforced until an atomic counter exists.
 */

/** P2 `voice-sample` request ceiling. Overflow is 413 and writes nothing. */
export const VOICE_SAMPLE_MAX_BYTES = 4 * 1024 * 1024;

/** E2 `early-voice-sample` request ceiling. Overflow is 413 and writes nothing. */
export const EARLY_SAMPLE_MAX_BYTES = 1 * 1024 * 1024;

/** Shared by both voice routes. Overflow is 429 and writes nothing. */
export const VOICE_SAMPLE_MAX_PER_SESSION = 16;

/** Shared stored-byte total for one session. Overflow is 429 and writes nothing. */
export const VOICE_SESSION_MAX_BYTES = 24 * 1024 * 1024;

export const VOICE_QUOTA_COLLECTION = 'cza_voice_sample_quota';

const ABSENT_TOKEN_HASH = createHash('sha256').update('cza-child-access-absent').digest('hex');

const AUTH_REQUIRED = 'Oturum erişim belirteci gerekli';
const AUTH_INVALID = 'Oturum erişim belirteci geçersiz';
const AUTH_EXPIRED = 'Oturum erişim belirtecinin süresi doldu';
const TOO_LARGE = 'Ses kaydı boyut sınırını aşıyor';
const TOO_MANY = 'Bu oturum için ses örneği sınırına ulaşıldı';
const TOO_MUCH = 'Bu oturum için toplam ses boyutu sınırına ulaşıldı';
const INVALID_AUDIO = 'Ses kaydı geçersiz';
const AUDIO_ONLY = 'Yalnız ses kaydı kabul edilir';
const QUOTA_FAILED = 'Ses örneği sınırı kaydedilemedi';
const EARLY_VERSION = 'Erken gelişim ses örneği yalnız E2-v7 oturumunda kullanılabilir';
const SESSION_MISSING = 'Oturum bulunamadı';

type HeaderMap = Record<string, string | undefined>;

type VoiceSession = {
  voiceSampleQuotaId?: string;
  childAccessTokenHash?: string;
  childAccessExpiresAt?: string;
  earlyDevelopment?: { version?: string };
};

type VoiceKind = 'stroop' | 'early';

type VoiceRequest = {
  method?: string;
  httpMethod?: string;
  path?: string;
  url?: string;
  headers?: HeaderMap | { get?: (name: string) => string | null };
  body?: unknown;
};

type VoiceCtx = {
  params?: { id?: string };
  body?: unknown;
  event?: { headers?: HeaderMap };
};

type EducatorCheck = (headers: HeaderMap) => Promise<boolean>;

type PresentedBearer =
  | { state: 'absent'; token: '' }
  | { state: 'malformed'; token: '' }
  | { state: 'ok'; token: string };

let educatorAuthorized: EducatorCheck = async () => false;

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function equalHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function presentedBearer(headers: HeaderMap): PresentedBearer {
  const raw = headers.authorization || headers.Authorization;
  if (!raw || !String(raw).trim()) return { state: 'absent', token: '' };
  const match = /^Bearer\s+([A-Za-z0-9_-]{43,128})$/.exec(String(raw).trim());
  if (!match) return { state: 'malformed', token: '' };
  return { state: 'ok', token: match[1] };
}

/** 403 when the digest is missing or different. 401 when the matching digest is expired. */
export function childAccessStatus(input: {
  presentedToken: string;
  storedHash?: string;
  expiresAt?: string;
  now?: number;
}): 200 | 401 | 403 {
  const now = input.now ?? Date.now();
  const stored = input.storedHash || ABSENT_TOKEN_HASH;
  const matches = equalHex(stored, sha256Hex(input.presentedToken));
  if (!matches || !input.storedHash) return 403;
  const expires = Date.parse(input.expiresAt || '');
  if (!input.expiresAt || !Number.isFinite(expires) || expires <= now) return 401;
  return 200;
}

function plainHeaders(request: VoiceRequest): HeaderMap {
  const headers = request?.headers;
  if (!headers) return {};
  if (typeof headers.get === 'function') {
    const out: HeaderMap = {};
    for (const key of ['authorization', 'cookie', 'content-length']) {
      const value = headers.get(key);
      if (value != null) out[key] = value;
    }
    return out;
  }
  return headers;
}

function requestMethod(request: VoiceRequest) {
  return String(request?.method || request?.httpMethod || 'GET').toUpperCase();
}

function requestPath(request: VoiceRequest) {
  if (typeof request?.path === 'string' && request.path) return request.path.split('?')[0];
  if (typeof request?.url === 'string' && request.url) {
    try {
      return new URL(request.url, 'http://localhost').pathname;
    } catch {
      return '';
    }
  }
  return '';
}

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function voiceRouteOf(method: string, path: string): { kind: VoiceKind; sessionId: string } | null {
  if (method !== 'POST') return null;
  const match = /^\/api\/session\/([^/]+)\/(early-voice-sample|voice-sample)$/.exec(path);
  if (!match) return null;
  return { sessionId: decodeSegment(match[1]), kind: match[2] === 'early-voice-sample' ? 'early' : 'stroop' };
}

function cookiePresented(headers: HeaderMap) {
  const raw = headers.cookie || headers.Cookie || '';
  const entry = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('cza_session='));
  return Boolean(entry && entry.length > 'cza_session='.length);
}

/** Null when the header is absent. Infinity when it is not a safe decimal length. */
export function declaredContentLength(headers: HeaderMap): number | null {
  const raw = headers['content-length'] ?? headers['Content-Length'];
  if (raw == null || String(raw).trim() === '') return null;
  const text = String(raw).trim();
  if (!/^\d{1,10}$/.test(text)) return Number.POSITIVE_INFINITY;
  return Number(text);
}

function rawBodyBytes(body: unknown): number | null {
  if (typeof body === 'string') return Buffer.byteLength(body);
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return body.byteLength;
  return null;
}

async function loadSession(sessionId: string): Promise<VoiceSession | null> {
  const [session] = await db.get<VoiceSession>('assessment_sessions', [sessionId]);
  return session || null;
}

async function authorize(headers: HeaderMap, sessionId: string): Promise<
  | { ok: true; session: VoiceSession }
  | { ok: false; status: number; message: string }
> {
  const presented = presentedBearer(headers);
  const educator = cookiePresented(headers) ? await educatorAuthorized(headers) : false;
  if (!educator && presented.state === 'absent') return { ok: false, status: 401, message: AUTH_REQUIRED };
  if (!educator && presented.state === 'malformed') return { ok: false, status: 403, message: AUTH_INVALID };
  const session = await loadSession(sessionId);
  if (!educator) {
    const decision = childAccessStatus({
      presentedToken: presented.state === 'ok' ? presented.token : '',
      storedHash: session?.childAccessTokenHash,
      expiresAt: session?.childAccessExpiresAt,
    });
    if (!session || decision === 403) return { ok: false, status: 403, message: AUTH_INVALID };
    if (decision !== 200) return { ok: false, status: 401, message: AUTH_EXPIRED };
    return { ok: true, session };
  }
  if (!session) return { ok: false, status: 404, message: SESSION_MISSING };
  return { ok: true, session };
}

export function requestMaxBytes(kind: VoiceKind) {
  return kind === 'early' ? EARLY_SAMPLE_MAX_BYTES : VOICE_SAMPLE_MAX_BYTES;
}

type QuotaRow = { sessionId?: string; count?: number; bytes?: number };

type QuotaSnapshot = {
  quotaId: string;
  count: number;
  bytes: number;
  blocked: { status: 429; message: string } | null;
};

async function readQuota(sessionId: string, session: VoiceSession): Promise<QuotaSnapshot> {
  const quotaId = session.voiceSampleQuotaId || '';
  if (!quotaId) return { quotaId: '', count: 0, bytes: 0, blocked: null };
  const [row] = await db.get<QuotaRow>(VOICE_QUOTA_COLLECTION, [quotaId]);
  if (!row || row.sessionId !== sessionId) return { quotaId, count: 0, bytes: 0, blocked: null };
  if (!Number.isInteger(row.count) || (row.count ?? 0) < 0) {
    return {
      quotaId,
      count: VOICE_SAMPLE_MAX_PER_SESSION,
      bytes: VOICE_SESSION_MAX_BYTES,
      blocked: { status: 429, message: TOO_MANY },
    };
  }
  const bytes = row.bytes === undefined ? 0 : row.bytes;
  if (!Number.isInteger(bytes) || bytes < 0) {
    return {
      quotaId,
      count: row.count,
      bytes: VOICE_SESSION_MAX_BYTES,
      blocked: { status: 429, message: TOO_MUCH },
    };
  }
  return { quotaId, count: row.count as number, bytes, blocked: null };
}

/**
 * `extraBytes` is 0 before the body is read. A session already at 24 MiB then
 * refuses without reading. Once the sample size is known, equality with 24 MiB
 * is still allowed and only a larger sum is refused.
 */
function quotaRefusal(quota: QuotaSnapshot, extraBytes: number): { status: 429; message: string } | null {
  if (quota.blocked) return quota.blocked;
  if (quota.count >= VOICE_SAMPLE_MAX_PER_SESSION) return { status: 429, message: TOO_MANY };
  if (extraBytes === 0) {
    if (quota.bytes >= VOICE_SESSION_MAX_BYTES) return { status: 429, message: TOO_MUCH };
    return null;
  }
  if (quota.bytes + extraBytes > VOICE_SESSION_MAX_BYTES) return { status: 429, message: TOO_MUCH };
  return null;
}

async function reserveVoiceSample(sessionId: string, session: VoiceSession, contentBytes: number): Promise<
  | { ok: true; rollback: () => Promise<void> }
  | { ok: false; status: number; message: string }
> {
  const current = await readQuota(sessionId, session);
  const refusal = quotaRefusal(current, contentBytes);
  if (refusal) return { ok: false, status: refusal.status, message: refusal.message };
  const nextCount = current.count + 1;
  const nextBytes = current.bytes + contentBytes;
  const record = { sessionId, count: nextCount, bytes: nextBytes };
  const previous = { sessionId, count: current.count, bytes: current.bytes };
  if (current.quotaId) {
    const [updated] = await db.update(VOICE_QUOTA_COLLECTION, [{ id: current.quotaId, record }]);
    if (!updated) return { ok: false, status: 500, message: QUOTA_FAILED };
    return {
      ok: true,
      rollback: async () => {
        await db.update(VOICE_QUOTA_COLLECTION, [{ id: current.quotaId, record: previous }]);
      },
    };
  }
  const [created] = await db.add(VOICE_QUOTA_COLLECTION, [record]);
  if (!created) return { ok: false, status: 500, message: QUOTA_FAILED };
  const fresh = (await loadSession(sessionId)) || session;
  const [saved] = await db.update('assessment_sessions', [{ id: sessionId, record: { ...fresh, voiceSampleQuotaId: created } }]);
  if (!saved) return { ok: false, status: 500, message: QUOTA_FAILED };
  return {
    ok: true,
    rollback: async () => {
      await db.update(VOICE_QUOTA_COLLECTION, [{ id: created, record: previous }]);
    },
  };
}

function inspectVoiceContent(body: unknown, kind: VoiceKind):
  | { ok: true; content: string; contentType: string; durationMs: number; itemId: string; bytes: number }
  | { ok: false; status: number; message: string } {
  const record = (body ?? {}) as { content?: unknown; contentType?: unknown; durationMs?: unknown; itemId?: unknown };
  const content = typeof record.content === 'string' ? record.content : '';
  if (!content) return { ok: false, status: 400, message: INVALID_AUDIO };
  const bytes = Buffer.byteLength(content);
  if (bytes > requestMaxBytes(kind)) return { ok: false, status: 413, message: TOO_LARGE };
  const contentType = String(record.contentType || 'audio/webm').slice(0, 80);
  if (!contentType.startsWith('audio/')) return { ok: false, status: 400, message: AUDIO_ONLY };
  const itemId = String(record.itemId || 'sample').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) || 'sample';
  return { ok: true, content, contentType, durationMs: Math.max(0, Number(record.durationMs) || 0), itemId, bytes };
}

export async function writeVoiceSample(ctx: VoiceCtx, kind: VoiceKind) {
  const headers = ctx.event?.headers || {};
  const sessionId = String(ctx.params?.id || '');
  const gate = await authorize(headers, sessionId);
  if (!gate.ok) return error(gate.message, gate.status);
  const declared = declaredContentLength(headers);
  if (declared !== null && declared > requestMaxBytes(kind)) return error(TOO_LARGE, 413);
  if (kind === 'early' && gate.session.earlyDevelopment?.version !== 'E2-v7') return error(EARLY_VERSION, 409);
  const held = quotaRefusal(await readQuota(sessionId, gate.session), 0);
  if (held) return error(held.message, held.status);
  const inspected = inspectVoiceContent(ctx.body, kind);
  if (!inspected.ok) return error(inspected.message, inspected.status);
  const reserved = await reserveVoiceSample(sessionId, gate.session, inspected.bytes);
  if (!reserved.ok) return error(reserved.message, reserved.status);
  const path = kind === 'early'
    ? 'early/' + sessionId + '/' + inspected.itemId + '-' + Date.now() + '.webm'
    : 'voice/' + sessionId + '/stroop-' + Date.now() + '.webm';
  const [ok] = await storage.write([{ path, content: inspected.content, contentType: inspected.contentType }]);
  if (!ok) {
    await reserved.rollback();
    return error(kind === 'early' ? 'Ses örneği saklanamadı' : 'Ses kaydı saklanamadı', 500);
  }
  return json({ path, durationMs: inspected.durationMs });
}

export function guardVoiceSamples(inner: (request: VoiceRequest) => Promise<unknown>, options: { educatorAuthorized: EducatorCheck }) {
  educatorAuthorized = options.educatorAuthorized;
  return async function voiceGuardedHandler(request: VoiceRequest) {
    const route = voiceRouteOf(requestMethod(request), requestPath(request));
    if (!route) return inner(request);
    const headers = plainHeaders(request);
    if (!cookiePresented(headers) && presentedBearer(headers).state === 'absent') return error(AUTH_REQUIRED, 401);
    const gate = await authorize(headers, route.sessionId);
    if (!gate.ok) return error(gate.message, gate.status);
    const declared = declaredContentLength(headers);
    if (declared !== null && declared > requestMaxBytes(route.kind)) return error(TOO_LARGE, 413);
    if (route.kind === 'early' && gate.session.earlyDevelopment?.version !== 'E2-v7') return error(EARLY_VERSION, 409);
    const held = quotaRefusal(await readQuota(route.sessionId, gate.session), 0);
    if (held) return error(held.message, held.status);
    const rawBody = Object.getOwnPropertyDescriptor(request, 'body');
    const rawBytes = rawBody && 'value' in rawBody ? rawBodyBytes(rawBody.value) : null;
    if (rawBytes !== null && rawBytes > requestMaxBytes(route.kind)) return error(TOO_LARGE, 413);
    return inner(request);
  };
}
