import { createHash } from 'node:crypto';

type AccessClaims = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  jti?: unknown;
};

type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

const encoder = new TextEncoder();
const cache = new Map<string, { expiresAt: number; keys: Map<string, Jwk>; negativeKids: Map<string, number>; lastRefreshAt: number; pending?: Promise<void> }>();
const JWKS_TTL_MS = 5 * 60_000;
const REFRESH_COOLDOWN_MS = 5_000;
const NEGATIVE_KID_TTL_MS = 15_000;
const MAX_NEGATIVE_KIDS = 64;

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

async function refresh(teamDomain: string, entry: ReturnType<typeof entryFor>) {
  const now = Date.now();
  if (entry.pending) return entry.pending;
  if (now - entry.lastRefreshAt < REFRESH_COOLDOWN_MS) return;
  entry.lastRefreshAt = now;
  entry.pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('ACCESS_JWKS_UNAVAILABLE');
      const value = await response.json() as { keys?: Jwk[] };
      if (!Array.isArray(value.keys) || value.keys.length > 32) throw new Error('ACCESS_JWKS_INVALID');
      const keys = new Map<string, Jwk>();
      for (const key of value.keys) if (typeof key.kid === 'string' && key.kid.length <= 160) keys.set(key.kid, key);
      if (!keys.size) throw new Error('ACCESS_JWKS_INVALID');
      entry.keys = keys;
      entry.expiresAt = Date.now() + JWKS_TTL_MS;
      entry.negativeKids.clear();
    } finally {
      clearTimeout(timeout);
      entry.pending = undefined;
    }
  })();
  return entry.pending;
}

function entryFor(teamDomain: string) {
  let value = cache.get(teamDomain);
  if (!value) {
    value = { expiresAt: 0, keys: new Map(), negativeKids: new Map(), lastRefreshAt: 0 };
    cache.set(teamDomain, value);
  }
  return value;
}

async function keyFor(teamDomain: string, kid: string) {
  const entry = entryFor(teamDomain);
  const now = Date.now();
  if (entry.expiresAt <= now) await refresh(teamDomain, entry);
  let key = entry.keys.get(kid);
  if (key) return key;
  if ((entry.negativeKids.get(kid) || 0) > now) throw new Error('ACCESS_JWT_KID_UNKNOWN');
  await refresh(teamDomain, entry);
  key = entry.keys.get(kid);
  if (key) return key;
  if (entry.negativeKids.size >= MAX_NEGATIVE_KIDS) {
    const oldest = entry.negativeKids.keys().next().value as string | undefined;
    if (oldest) entry.negativeKids.delete(oldest);
  }
  entry.negativeKids.set(kid, now + NEGATIVE_KID_TTL_MS);
  throw new Error('ACCESS_JWT_KID_UNKNOWN');
}

export async function verifyCloudflareAccessJwt(token: string, teamDomain: string, expectedAudience: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!/^[a-z0-9.-]+$/i.test(teamDomain) || !teamDomain.endsWith('.cloudflareaccess.com')) throw new Error('ACCESS_TEAM_INVALID');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('ACCESS_JWT_INVALID');
  let header: { alg?: unknown; kid?: unknown };
  let claims: AccessClaims;
  try {
    header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
    claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  } catch {
    throw new Error('ACCESS_JWT_INVALID');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('ACCESS_JWT_INVALID');
  const jwk = await keyFor(teamDomain, header.kid);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!verified) throw new Error('ACCESS_JWT_SIGNATURE_INVALID');
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== `https://${teamDomain}` || !audience.includes(expectedAudience)) throw new Error('ACCESS_JWT_BINDING_INVALID');
  if (!Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || (claims.nbf !== undefined && !Number.isSafeInteger(claims.nbf))) throw new Error('ACCESS_JWT_TIME_INVALID');
  if ((claims.exp as number) <= nowSeconds || (claims.iat as number) > nowSeconds + 5 || ((claims.nbf as number | undefined) ?? 0) > nowSeconds + 5) throw new Error('ACCESS_JWT_TIME_INVALID');
  if (typeof claims.sub !== 'string' || claims.sub.length < 1 || claims.sub.length > 256) throw new Error('ACCESS_JWT_SUBJECT_INVALID');
  return Object.freeze({
    subject: claims.sub,
    subjectHash: createHash('sha256').update(claims.sub).digest('hex'),
    jwtIdHash: typeof claims.jti === 'string' ? createHash('sha256').update(claims.jti).digest('hex') : null,
    expiresAt: claims.exp as number,
  });
}
