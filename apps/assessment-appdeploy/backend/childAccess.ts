import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Child/parent capability lifetime. Matches the existing educator session window so a multi-day E2 sitting can resume. */
export const CHILD_ACCESS_DAYS = 30;

/**
 * UTF-8 JSON byte cap for one assessment_sessions document.
 * Measured here: 50 restart-warmup + 2000-character answer rounds store 108,555 bytes.
 * The reported ~827 KB matches that same loop with ~16 KB answers (50 × 16 KiB = 800 KiB, plus attempt metadata).
 * 512 KiB stays above three max-length passes of the longest 30-task chain, the E2 item bank, and educator notes,
 * and it rejects the 827 KB shape. Overflow returns 413 and does not call update.
 */
export const SESSION_RECORD_MAX_BYTES = 512 * 1024;

/**
 * Longest single pass is 30 tasks (W1 through MV1, including the DA and M support detours).
 * 96 = 30 × 3 + 6: three complete journeys plus the spare support items beside that path.
 * The next answer returns 429 and does not call update.
 */
export const SESSION_ATTEMPT_MAX = 96;

/**
 * Twenty restart routes, two reopenings of each section.
 * A 50-round restart loop is rejected on round 41. The stored document is left as it was.
 */
export const SESSION_RESTART_MAX = 40;

const ABSENT_TOKEN_HASH = createHash('sha256').update('cza-child-access-absent').digest('hex');

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/** Fixed-length hex compare. SHA-256 inputs are always 32 bytes, so the length check does not branch on the secret. */
export function equalHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function sessionRecordBytes(record: unknown) {
  return Buffer.byteLength(JSON.stringify(record), 'utf8');
}

/**
 * Every /api/session/:id route requires the session capability unless it is listed here.
 * Voice routes stay open for SEC-C. They store audio outside the session document.
 */
export const SESSION_ROUTE_ALLOWLIST: Record<string, string> = {
  'POST /api/session/:id/voice-sample':
    'SEC-C: stroop ses kaydı depolamaya yazılır, oturum belgesine yazılmaz. Belirteç kapısı bu uçta bilinçli olarak yoktur.',
  'POST /api/session/:id/early-voice-sample':
    'SEC-C: erken gelişim ses örneği depolamaya yazılır, oturum belgesine yazılmaz. Belirteç kapısı bu uçta bilinçli olarak yoktur.',
};

/** Top-level keys a child or parent bearer may receive. Educator notes are not in this list. */
export const CHILD_SESSION_RESPONSE_KEYS = [
  'id',
  'studentLabel',
  'status',
  'startStation',
  'currentTask',
  'attempts',
  'createdAt',
  'profileCode',
  'ageMonths',
  'assessmentPurpose',
  'earlyDevelopment',
  'assessmentStartedAt',
  'assessmentPausedAt',
  'assessmentPausedTotalMs',
  'assessmentCompletedAt',
  'assessmentActiveDurationMs',
] as const;

/** A completed sitting must not keep accepting the child bearer. The educator cookie is unchanged. */
export function revokeCompletedSession<T extends { status?: string; childAccessTokenHash?: string; childAccessExpiresAt?: string }>(record: T): T {
  if (record.status !== 'completed') return record;
  const next = { ...record };
  delete next.childAccessTokenHash;
  delete next.childAccessExpiresAt;
  return next;
}

/**
 * Shared parent-intake ceiling. All callers share one window and one UTC day.
 * A desk opening sessions one by one stays inside 30 per 10 minutes.
 * 200 per day covers one campus intake day. This is not lib/request-guard.ts.
 */
export const PARENT_SESSION_WINDOW_MS = 10 * 60 * 1000;
export const PARENT_SESSION_WINDOW_MAX = 30;
export const PARENT_SESSION_DAILY_MAX = 200;

export type ParentQuotaState = {
  windowStartedAt: number;
  windowCount: number;
  day: string;
  dayCount: number;
};

export function decideParentSessionQuota(state: ParentQuotaState | undefined, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const freshWindow = !state?.windowStartedAt || now - state.windowStartedAt >= PARENT_SESSION_WINDOW_MS;
  const windowStartedAt = freshWindow ? now : state!.windowStartedAt;
  const windowCount = freshWindow ? 0 : state!.windowCount;
  const dayCount = state?.day === day ? state.dayCount : 0;
  if (windowCount >= PARENT_SESSION_WINDOW_MAX || dayCount >= PARENT_SESSION_DAILY_MAX) {
    return { ok: false as const };
  }
  return {
    ok: true as const,
    next: {
      windowStartedAt,
      windowCount: windowCount + 1,
      day,
      dayCount: dayCount + 1,
    },
  };
}

/** 256-bit secret. Only the SHA-256 hex digest is persisted. The secret is returned once to the caller. */
export function issueChildAccess(now = Date.now()) {
  const secret = randomBytes(32).toString('base64url');
  return {
    secret,
    childAccessTokenHash: sha256Hex(secret),
    childAccessExpiresAt: new Date(now + CHILD_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export type PresentedBearer =
  | { state: 'absent'; token: '' }
  | { state: 'malformed'; token: '' }
  | { state: 'ok'; token: string };

export function presentedBearer(headers: Record<string, string | undefined>): PresentedBearer {
  const raw = headers.authorization || headers.Authorization;
  if (!raw || !String(raw).trim()) return { state: 'absent', token: '' };
  const match = /^Bearer\s+([A-Za-z0-9_-]{43,128})$/.exec(String(raw).trim());
  if (!match) return { state: 'malformed', token: '' };
  return { state: 'ok', token: match[1] };
}

/**
 * 401 when the credential is expired.
 * 403 when it does not match this session.
 * Comparison always runs against a 32-byte digest, including when the session has no digest yet.
 */
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
