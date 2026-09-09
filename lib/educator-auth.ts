import { neon } from '@neondatabase/serverless';

const AUTH_BASE = process.env.CZA_NEON_AUTH_BASE_URL || 'https://ep-delicate-sky-b2fyqu4m.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth';
export const EDUCATOR_COOKIE = 'cza_educator_session';
const SITE_OWNER_EMAIL = 'habipcann65@gmail.com';
const EDUCATOR_EMAIL = 'celikzihin.akademisi@gmail.com';

export function readCookie(request: Request, name: string) {
  const value = (request.headers.get('cookie') || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}

export function educatorCookie(value: string, maxAge: number, secure: boolean) {
  return [`${EDUCATOR_COOKIE}=${encodeURIComponent(value)}`,'Path=/api','HttpOnly',...(secure?['Secure']:[]),'SameSite=Lax',`Max-Age=${maxAge}`].join('; ');
}

export async function authenticatedEducator(request: Request) {
  const siteEmail = (request.headers.get('oai-authenticated-user-email') || '').trim().toLowerCase();
  if (siteEmail === SITE_OWNER_EMAIL && process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT u.id::text AS id, u.email, u.name
      FROM neon_auth."user" u
      JOIN teachers t ON t.auth_user_id = u.id
      WHERE lower(u.email) = ${EDUCATOR_EMAIL}
        AND t.is_active = true
      LIMIT 1
    `;
    if (rows[0]?.id) return rows[0] as { id: string; email?: string; name?: string };
  }
  const upstreamCookie = readCookie(request, EDUCATOR_COOKIE);
  if (!upstreamCookie) return null;
  const response = await fetch(`${AUTH_BASE}/get-session`,{headers:{cookie:upstreamCookie},cache:'no-store'});
  if (!response.ok) return null;
  const data = await response.json() as {user?:{id?:string;email?:string;name?:string}};
  return data.user?.id ? data.user : null;
}

export function authUrl(path: string) { return `${AUTH_BASE}${path}`; }
