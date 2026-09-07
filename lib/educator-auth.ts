const AUTH_BASE = process.env.CZA_NEON_AUTH_BASE_URL || 'https://ep-delicate-sky-b2fyqu4m.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth';
export const EDUCATOR_COOKIE = 'cza_educator_session';

export function readCookie(request: Request, name: string) {
  const value = (request.headers.get('cookie') || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}

export function educatorCookie(value: string, maxAge: number, secure: boolean) {
  return [`${EDUCATOR_COOKIE}=${encodeURIComponent(value)}`,'Path=/api','HttpOnly',...(secure?['Secure']:[]),'SameSite=Lax',`Max-Age=${maxAge}`].join('; ');
}

export async function authenticatedEducator(request: Request) {
  const upstreamCookie = readCookie(request, EDUCATOR_COOKIE);
  if (!upstreamCookie) return null;
  const response = await fetch(`${AUTH_BASE}/get-session`,{headers:{cookie:upstreamCookie},cache:'no-store'});
  if (!response.ok) return null;
  const data = await response.json() as {user?:{id?:string;email?:string;name?:string}};
  return data.user?.id ? data.user : null;
}

export function authUrl(path: string) { return `${AUTH_BASE}${path}`; }
