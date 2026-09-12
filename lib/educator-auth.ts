import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const AUTH_BASE = process.env.CZA_NEON_AUTH_BASE_URL || 'https://ep-delicate-sky-b2fyqu4m.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth';
export const EDUCATOR_COOKIE = 'cza_educator_session';
const SITE_OWNER_EMAIL = 'habipcann65@gmail.com';
export const EDUCATOR_EMAIL = 'celikzihin.akademisi@gmail.com';
export const EDUCATOR_AUTH_USER_ID = '47c90485-e057-4ebe-a25c-9d7f236c5bd6';
const LOCAL_PREFIX = 'local.';
const SCRYPT_OPTIONS = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 } as const;

function derivePasswordKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password.normalize('NFKC'), salt, 64, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function readCookie(request: Request, name: string) {
  const value = (request.headers.get('cookie') || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}

export function educatorCookie(value: string, maxAge: number, secure: boolean) {
  return [`${EDUCATOR_COOKIE}=${encodeURIComponent(value)}`,'Path=/api','HttpOnly',...(secure?['Secure']:[]),'SameSite=Lax',`Max-Age=${maxAge}`].join('; ');
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function educatorDbUser() {
  if (!process.env.DATABASE_URL) return null;
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT id, academy_id, auth_user_id, email, display_name
    FROM public.users
    WHERE auth_user_id = ${EDUCATOR_AUTH_USER_ID}
      AND is_active = true
      AND role::text IN ('admin','teacher')
    LIMIT 1
  `;
  return rows[0] as { id: string; academy_id: string; auth_user_id: string; email: string | null; display_name: string } | undefined;
}

export async function verifyEducatorPassword(password: string) {
  if (!process.env.DATABASE_URL) throw new Error('database_unavailable');
  if (password.length < 8 || password.length > 128) return false;
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT a.password
    FROM neon_auth.account a
    JOIN neon_auth."user" au ON au.id = a."userId"
    WHERE au.id = ${EDUCATOR_AUTH_USER_ID}
      AND lower(au.email) = lower(${EDUCATOR_EMAIL})
      AND a."providerId" = 'credential'
    LIMIT 1
  `;
  const stored = typeof rows[0]?.password === 'string' ? rows[0].password : '';
  const [salt, keyHex, extra] = stored.split(':');
  if (extra !== undefined || !/^[0-9a-f]{32}$/i.test(salt || '') || !/^[0-9a-f]{128}$/i.test(keyHex || '')) return false;
  const derived = await derivePasswordKey(password, salt);
  const expected = Buffer.from(keyHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function createLocalEducatorSession(request: Request) {
  if (!process.env.DATABASE_URL) throw new Error('database_unavailable');
  const educator = await educatorDbUser();
  if (!educator) throw new Error('educator_mapping_missing');
  const token = randomBytes(32).toString('hex');
  const sql = neon(process.env.DATABASE_URL);
  await sql`
    INSERT INTO public.educator_sessions
      (academy_id, educator_user_id, token_hash, expires_at, user_agent)
    VALUES
      (${educator.academy_id}::uuid, ${educator.id}::uuid, ${tokenHash(token)}, now() + interval '8 hours', ${request.headers.get('user-agent') || ''})
  `;
  return {
    cookieValue: `${LOCAL_PREFIX}${token}`,
    user: { id: EDUCATOR_AUTH_USER_ID, email: EDUCATOR_EMAIL, name: educator.display_name || 'CZA Eğitimci' },
  };
}

async function localEducator(cookieValue: string) {
  if (!cookieValue.startsWith(LOCAL_PREFIX) || !process.env.DATABASE_URL) return null;
  const token = cookieValue.slice(LOCAL_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT es.id AS session_id, u.auth_user_id, u.email, u.display_name
    FROM public.educator_sessions es
    JOIN public.users u ON u.id = es.educator_user_id
    WHERE es.token_hash = ${tokenHash(token)}
      AND es.revoked_at IS NULL
      AND es.expires_at > now()
      AND u.is_active = true
      AND u.role::text IN ('admin','teacher')
      AND u.auth_user_id = ${EDUCATOR_AUTH_USER_ID}
    LIMIT 1
  `;
  if (!rows.length) return null;
  await sql`UPDATE public.educator_sessions SET last_seen_at = now() WHERE id = ${rows[0].session_id}::uuid`;
  const row = rows[0] as { auth_user_id: string; email: string | null; display_name: string };
  return { id: row.auth_user_id, email: row.email || EDUCATOR_EMAIL, name: row.display_name || 'CZA Eğitimci' };
}

export async function revokeLocalEducatorSession(request: Request) {
  const cookieValue = readCookie(request, EDUCATOR_COOKIE);
  if (!cookieValue.startsWith(LOCAL_PREFIX) || !process.env.DATABASE_URL) return;
  const token = cookieValue.slice(LOCAL_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(token)) return;
  const sql = neon(process.env.DATABASE_URL);
  await sql`UPDATE public.educator_sessions SET revoked_at = now() WHERE token_hash = ${tokenHash(token)} AND revoked_at IS NULL`;
}

export async function authenticatedEducator(request: Request) {
  const siteEmail = (request.headers.get('oai-authenticated-user-email') || '').trim().toLowerCase();
  if (siteEmail === SITE_OWNER_EMAIL) {
    return { id: EDUCATOR_AUTH_USER_ID, email: EDUCATOR_EMAIL, name: 'Habip Çelik' };
  }
  const sessionCookie = readCookie(request, EDUCATOR_COOKIE);
  if (!sessionCookie) return null;

  const local = await localEducator(sessionCookie);
  if (local) return local;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${AUTH_BASE}/get-session`,{headers:{cookie:sessionCookie},cache:'no-store',signal:controller.signal});
    if (!response.ok) return null;
    const data = await response.json() as {user?:{id?:string;email?:string;name?:string}};
    const userEmail = (data.user?.email || '').trim().toLowerCase();
    return data.user?.id === EDUCATOR_AUTH_USER_ID && userEmail === EDUCATOR_EMAIL ? data.user : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function authUrl(path: string) { return `${AUTH_BASE}${path}`; }
