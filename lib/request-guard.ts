import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { trustedRequestAddress } from '@/lib/trusted-client-address';

export { trustedRequestAddress } from '@/lib/trusted-client-address';

type Bucket = { count: number; resetAt: number };

export type RequestGate = {
  allowed: boolean;
  retryAfterSeconds: number;
  unavailable?: boolean;
};

type DistributedGateRow = {
  allowed: boolean;
  retry_after_seconds: number | string;
};

const developmentStore = new Map<string, Bucket>();
const SCOPE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function subjectHash(
  address: string,
  scope: string,
  authenticatedSubject?: string,
) {
  const material = [
    scope,
    authenticatedSubject?.slice(0, 160) || 'anonymous',
    address,
  ].join('\u0000');
  return createHash('sha256').update(material).digest('hex');
}

function accountHash(scope: string, accountSubject: string) {
  const material = [scope, 'account', accountSubject].join('\u0000');
  return createHash('sha256').update(material).digest('hex');
}

function localLimit(key: string, limit: number, windowMs: number): RequestGate {
  const now = Date.now();
  const current = developmentStore.get(key);
  if (!current || current.resetAt <= now) {
    developmentStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Production requests are counted atomically in PostgreSQL so every isolate and
 * region shares the same bucket. Local memory is only a development fallback.
 */
export async function allowRequest(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
  authenticatedSubject?: string,
): Promise<RequestGate> {
  if (
    !SCOPE_PATTERN.test(scope) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10_000 ||
    !Number.isInteger(windowMs) ||
    windowMs < 1000 ||
    windowMs > 86_400_000
  ) {
    return { allowed: false, retryAfterSeconds: 30, unavailable: true };
  }

  const address = trustedRequestAddress(request);
  if (!address) {
    return { allowed: false, retryAfterSeconds: 30, unavailable: true };
  }
  const hash = subjectHash(address, scope, authenticatedSubject);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, retryAfterSeconds: 30, unavailable: true };
    }
    return localLimit(`${scope}:${hash}`, limit, windowMs);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT allowed, retry_after_seconds
      FROM public.cza_consume_rate_limit(
        ${scope}::text,
        ${hash}::text,
        ${limit}::integer,
        ${Math.ceil(windowMs / 1000)}::integer
      )
    `;
    const row = rows[0] as DistributedGateRow | undefined;
    if (!row || typeof row.allowed !== 'boolean') {
      return { allowed: false, retryAfterSeconds: 30, unavailable: true };
    }
    return {
      allowed: row.allowed,
      retryAfterSeconds: row.allowed
        ? 0
        : Math.max(1, Number(row.retry_after_seconds) || 1),
    };
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return localLimit(`${scope}:${hash}`, limit, windowMs);
    }
    return { allowed: false, retryAfterSeconds: 30, unavailable: true };
  }
}

/**
 * Account-wide protection that cannot be multiplied by changing source IPs.
 * Use it together with allowRequest when both abuse dimensions matter.
 */
export async function allowAccountRequest(
  scope: string,
  limit: number,
  windowMs: number,
  accountSubject: string,
): Promise<RequestGate> {
  const normalizedSubject = accountSubject.trim().toLowerCase();
  if (
    !SCOPE_PATTERN.test(scope) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10_000 ||
    !Number.isInteger(windowMs) ||
    windowMs < 1000 ||
    windowMs > 86_400_000 ||
    !normalizedSubject ||
    Buffer.byteLength(normalizedSubject, 'utf8') > 160
  ) {
    return { allowed: false, retryAfterSeconds: 30, unavailable: true };
  }

  const hash = accountHash(scope, normalizedSubject);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, retryAfterSeconds: 30, unavailable: true };
    }
    return localLimit(`${scope}:${hash}`, limit, windowMs);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT allowed, retry_after_seconds
      FROM public.cza_consume_rate_limit(
        ${scope}::text,
        ${hash}::text,
        ${limit}::integer,
        ${Math.ceil(windowMs / 1000)}::integer
      )
    `;
    const row = rows[0] as DistributedGateRow | undefined;
    if (!row || typeof row.allowed !== 'boolean') {
      return { allowed: false, retryAfterSeconds: 30, unavailable: true };
    }
    return {
      allowed: row.allowed,
      retryAfterSeconds: row.allowed
        ? 0
        : Math.max(1, Number(row.retry_after_seconds) || 1),
    };
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return localLimit(`${scope}:${hash}`, limit, windowMs);
    }
    return { allowed: false, retryAfterSeconds: 30, unavailable: true };
  }
}

export function requestGuardRejected(gate: RequestGate) {
  const unavailable = gate.unavailable === true;
  return new Response(
    JSON.stringify({
      ok: false,
      error: unavailable ? 'rate_limit_unavailable' : 'rate_limited',
    }),
    {
      status: unavailable ? 503 : 429,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': String(Math.max(1, gate.retryAfterSeconds)),
        'cache-control': 'no-store',
      },
    },
  );
}

export function rateLimited(gate: number | RequestGate) {
  return requestGuardRejected(
    typeof gate === 'number'
      ? { allowed: false, retryAfterSeconds: gate }
      : gate,
  );
}
