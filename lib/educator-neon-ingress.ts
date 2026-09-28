import {
  type EducatorAuthRequest,
  EDUCATOR_MAX_REQUEST_BYTES,
  readBoundedBytes,
} from '@/lib/educator-request-security';
import {
  allowAccountRequest,
  allowRequest,
  rateLimited,
} from '@/lib/request-guard';

export const STAGING_EDUCATOR_ORIGIN =
  'https://cza-akademi-staging.cza-staging-habip.workers.dev';
export const STAGING_NEON_AUTH =
  'https://ep-falling-resonance-b2qnvtwf.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth';
export const NEON_EDUCATOR_COOKIE = '__Host-cza_neon_educator';
const PROVIDER_COOKIE = '__Secure-neon-auth.session_token';
const protectedHeaders = [
  'oai-authenticated-user-email',
  'x-cza-proxy-timestamp',
  'x-cza-proxy-nonce',
  'x-cza-proxy-signature',
  'x-cza-role',
  'x-educator-id',
  'x-academy-id',
];
export type NeonIdentity = { id: string; expiresAt: number };
export type EducatorIdentity = { id: string; email: string; name: string };
export const neonEducatorEnabled = () =>
  process.env.CZA_EDUCATOR_AUTH_MODE === 'neon';
const reply = (error: string, status: number) =>
  Response.json(
    { ok: false, error },
    { status, headers: { 'cache-control': 'no-store' } },
  );

export function neonIngressAllowed(request: Request) {
  const url = new URL(request.url);
  return (
    neonEducatorEnabled() &&
    url.origin === STAGING_EDUCATOR_ORIGIN &&
    process.env.CZA_NEON_AUTH_BASE_URL === STAGING_NEON_AUTH &&
    !protectedHeaders.some((header) => request.headers.has(header)) &&
    (!request.headers.has('origin') ||
      request.headers.get('origin') === STAGING_EDUCATOR_ORIGIN) &&
    !['cross-site', 'same-site'].includes(
      request.headers.get('sec-fetch-site') || '',
    ) &&
    (['GET', 'HEAD'].includes(request.method) ||
      request.headers.get('origin') === STAGING_EDUCATOR_ORIGIN)
  );
}

function validCookie(value: string) {
  return (
    value.length > 0 &&
    value.length <= 4096 &&
    /^[A-Za-z0-9._~%+/-]+$/.test(value)
  );
}
export function neonCookieValue(request: Request) {
  const pairs = (request.headers.get('cookie') || '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.startsWith(NEON_EDUCATOR_COOKIE + '='));
  if (pairs.length !== 1) return '';
  const value = pairs[0].slice(NEON_EDUCATOR_COOKIE.length + 1);
  return validCookie(value) ? value : '';
}
function cookie(value: string, seconds: number) {
  return `${NEON_EDUCATOR_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}
async function provider(
  path:
    | '/sign-in/email'
    | '/get-session?disableCookieCache=true&disableRefresh=true'
    | '/sign-out',
  value = '',
  body?: object,
) {
  const headers: Record<string, string> = {
    origin: STAGING_EDUCATOR_ORIGIN,
    accept: 'application/json',
  };
  if (value) headers.cookie = `${PROVIDER_COOKIE}=${value}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(STAGING_NEON_AUTH + path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  // Workers rejects redirect:'error' before sending the request. Never follow
  // provider redirects or forward credentials to a redirect destination.
  if (response.status >= 300 && response.status < 400)
    throw new Error('provider_redirect_rejected');
  return response;
}
export async function verifiedNeonIdentity(
  request: Request,
): Promise<NeonIdentity | null> {
  if (!neonIngressAllowed(request)) return null;
  const value = neonCookieValue(request);
  if (!value) return null;
  try {
    const response = await provider(
      '/get-session?disableCookieCache=true&disableRefresh=true',
      value,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      user?: { id?: unknown };
      session?: { userId?: unknown; expiresAt?: unknown };
    };
    const id = data.user?.id;
    const expiresAt =
      typeof data.session?.expiresAt === 'string'
        ? Date.parse(data.session.expiresAt)
        : NaN;
    if (
      typeof id !== 'string' ||
      !id ||
      id.length > 256 ||
      data.session?.userId !== id ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    )
      return null;
    return { id, expiresAt };
  } catch {
    return null;
  }
}

export async function handleNeonEducatorAuth(
  request: Request,
  input: EducatorAuthRequest,
  authenticate: (request: Request) => Promise<EducatorIdentity | null>,
) {
  if (!neonIngressAllowed(request))
    return reply('request_origin_or_identity_rejected', 403);
  const gate = await allowRequest(
    request,
    'educator-neon-' + input.action,
    input.action === 'login' ? 6 : 60,
    60000,
  );
  if (!gate.allowed) return rateLimited(gate);
  if (input.action === 'me') {
    const user = await authenticate(request);
    return user
      ? Response.json(
          { ok: true, user },
          { headers: { 'cache-control': 'no-store' } },
        )
      : reply('educator_session_required', 401);
  }
  if (input.action === 'logout') {
    const value = neonCookieValue(request);
    try {
      if (value) {
        const response = await provider('/sign-out', value, {});
        if (!response.ok) return reply('logout_revocation_failed', 503);
      }
      return Response.json(
        { ok: true, revoked: true },
        {
          headers: { 'cache-control': 'no-store', 'set-cookie': cookie('', 0) },
        },
      );
    } catch {
      return reply('logout_revocation_failed', 503);
    }
  }
  // Password recovery remains the existing provider's responsibility; no local reset/session fallback.
  if (input.action !== 'login')
    return reply('neon_password_recovery_not_enabled', 400);
  if (!input.email || input.password.length < 8)
    return reply('invalid_credentials', 401);
  const accountGate = await allowAccountRequest(
    'educator-neon-login',
    12,
    600000,
    input.email,
  );
  if (!accountGate.allowed) return rateLimited(accountGate);
  let value = '';
  try {
    const response = await provider('/sign-in/email', '', {
      email: input.email,
      password: input.password,
      rememberMe: false,
    });
    if (!response.ok)
      return reply(
        response.status === 401 || response.status === 400
          ? 'invalid_credentials'
          : 'auth_unavailable',
        response.status === 401 || response.status === 400 ? 401 : 503,
      );
    const cookies = response.headers
      .getSetCookie()
      .filter((c) => c.startsWith(PROVIDER_COOKIE + '='));
    if (cookies.length !== 1)
      return reply('provider_session_cookie_missing', 502);
    value = cookies[0].split(';')[0].slice(PROVIDER_COOKIE.length + 1);
    if (!validCookie(value))
      return reply('provider_session_cookie_invalid', 502);
    const headers = new Headers(request.headers);
    // Only the new provider cookie is transported; never promote an existing local/owner cookie.
    headers.set('cookie', `${NEON_EDUCATOR_COOKIE}=${value}`);
    const body = await readBoundedBytes(
      request.clone(),
      EDUCATOR_MAX_REQUEST_BYTES,
    );
    const sessionRequest = new Request(request.url, {
      method: request.method,
      headers,
      body,
    });
    const user = await authenticate(sessionRequest);
    if (!user) {
      const revoked = await provider('/sign-out', value, {});
      return reply(
        revoked.ok ? 'educator_session_required' : 'logout_revocation_failed',
        revoked.ok ? 401 : 503,
      );
    }
    return Response.json(
      { ok: true, user },
      {
        headers: {
          'cache-control': 'no-store',
          'set-cookie': cookie(value, 8 * 60 * 60),
        },
      },
    );
  } catch {
    if (value) {
      try {
        await provider('/sign-out', value, {});
      } catch {
        /* no raw upstream errors */
      }
    }
    return reply('auth_unavailable', 503);
  }
}
