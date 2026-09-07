type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  return `${scope}:${forwarded.split(',')[0].trim().slice(0, 80)}`;
}

/**
 * Isolate-local protective limit. It reduces accidental and abusive bursts now;
 * production must also enforce equivalent limits at the edge or central API.
 */
export function allowRequest(request: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = clientKey(request, scope);
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimited(retryAfterSeconds: number) {
  return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'retry-after': String(retryAfterSeconds),
      'cache-control': 'no-store',
    },
  });
}
