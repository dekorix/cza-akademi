import {
  allowAccountRequest,
  allowRequest,
  rateLimited,
} from '@/lib/request-guard';
import {
  EducatorRequestError,
  readEducatorAuthRequest,
} from '@/lib/educator-request-security';
import {
  authenticatedEducator,
  authUrl,
  createLocalEducatorSession,
  educatorCookie,
  educatorProxyRequestAllowed,
  EDUCATOR_COOKIE,
  EDUCATOR_EMAIL,
  EDUCATOR_AUTH_USER_ID,
  readCookie,
  revokeLocalEducatorSession,
  verifyEducatorPassword,
} from '@/lib/educator-auth';

const AUTH_BUILD = '2026-09-14-auth-hardening-v2.2';

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json; charset=utf-8');
  h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: h });
}

async function authFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  if (!(await educatorProxyRequestAllowed(request))) {
    return json(
      { ok: false, error: 'trusted_proxy_required', build: AUTH_BUILD },
      403,
    );
  }
  return json({ ok: true, service: 'cza-educator-auth', build: AUTH_BUILD });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, error: 'request_origin_rejected' }, 403);

  let parsed;
  try {
    parsed = await readEducatorAuthRequest(request);
  } catch (error) {
    if (error instanceof EducatorRequestError) {
      return json(
        { ok: false, error: error.code, build: AUTH_BUILD },
        error.status,
      );
    }
    return json(
      { ok: false, error: 'invalid_request', build: AUTH_BUILD },
      400,
    );
  }
  if (!(await educatorProxyRequestAllowed(request, parsed.bodySha256))) {
    return json(
      { ok: false, error: 'trusted_proxy_required', build: AUTH_BUILD },
      403,
    );
  }

  const input = parsed.input;
  const action = input.action;
  const secure = new URL(request.url).protocol === 'https:';

  if (action === 'me') {
    const user = await authenticatedEducator(request);
    if (!user)
      return json(
        { ok: false, error: 'educator_session_required', build: AUTH_BUILD },
        401,
      );
    if (
      !readCookie(request, EDUCATOR_COOKIE) &&
      request.headers.get('oai-authenticated-user-email')
    ) {
      try {
        const local = await createLocalEducatorSession(request);
        return json({ ok: true, user: local.user, build: AUTH_BUILD }, 200, {
          'set-cookie': educatorCookie(local.cookieValue, 60 * 60 * 8, secure),
        });
      } catch {
        return json({ ok: true, user, build: AUTH_BUILD });
      }
    }
    return json({ ok: true, user, build: AUTH_BUILD });
  }

  if (action === 'logout') {
    try {
      const sessionType = await revokeLocalEducatorSession(request);
      if (sessionType === 'external-session') {
        const sessionValue = readCookie(request, EDUCATOR_COOKIE);
        const upstream = await authFetch(authUrl('/sign-out'), {
          method: 'POST',
          headers: {
            cookie: `${EDUCATOR_COOKIE}=${encodeURIComponent(sessionValue)}`,
            origin: new URL(request.url).origin,
          },
        });
        if (!upstream.ok) throw new Error('logout_revocation_failed');
      }
      return json({ ok: true, revoked: true, build: AUTH_BUILD }, 200, {
        'set-cookie': educatorCookie('', 0, secure),
      });
    } catch {
      return json(
        { ok: false, error: 'logout_revocation_failed', build: AUTH_BUILD },
        503,
      );
    }
  }

  if (action === 'request-reset') {
    const addressGate = await allowRequest(
      request,
      'educator-reset-request-address',
      3,
      30 * 60 * 1000,
      input.email || 'unknown',
    );
    if (!addressGate.allowed) return rateLimited(addressGate);
    const email = input.email;
    if (email !== EDUCATOR_EMAIL)
      return json({ ok: false, error: 'invalid_credentials' }, 401);
    const accountGate = await allowAccountRequest(
      'educator-reset-request-account',
      3,
      30 * 60 * 1000,
      EDUCATOR_AUTH_USER_ID,
    );
    if (!accountGate.allowed) return rateLimited(accountGate);
    const redirectTo = `${new URL(request.url).origin}/educator/reset-password`;
    try {
      const upstream = await authFetch(authUrl('/request-password-reset'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: new URL(request.url).origin,
        },
        body: JSON.stringify({ email, redirectTo }),
      });
      if (!upstream.ok)
        return json(
          { ok: false, error: 'reset_unavailable', build: AUTH_BUILD },
          502,
        );
      return json({ ok: true, delivery: 'email', build: AUTH_BUILD });
    } catch {
      return json(
        { ok: false, error: 'reset_unavailable', build: AUTH_BUILD },
        502,
      );
    }
  }

  if (action === 'reset') {
    const addressGate = await allowRequest(
      request,
      'educator-reset-complete-address',
      5,
      15 * 60 * 1000,
      input.token || 'unknown',
    );
    if (!addressGate.allowed) return rateLimited(addressGate);
    const { token, newPassword } = input;
    if (!token || newPassword.length < 8 || newPassword.length > 128)
      return json(
        { ok: false, error: 'invalid_reset', build: AUTH_BUILD },
        400,
      );
    const accountGate = await allowAccountRequest(
      'educator-reset-complete-account',
      5,
      15 * 60 * 1000,
      EDUCATOR_AUTH_USER_ID,
    );
    if (!accountGate.allowed) return rateLimited(accountGate);
    try {
      const upstream = await authFetch(authUrl('/reset-password'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: new URL(request.url).origin,
        },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!upstream.ok) {
        const failure = (await upstream.json().catch(() => ({}))) as {
          code?: string;
        };
        const invalid = ['INVALID_TOKEN', 'TOKEN_EXPIRED'].includes(
          failure.code || '',
        );
        return json(
          {
            ok: false,
            error: invalid ? 'invalid_reset' : 'reset_unavailable',
            build: AUTH_BUILD,
          },
          invalid ? 400 : 502,
        );
      }
      try {
        const local = await createLocalEducatorSession(request);
        return json(
          { ok: true, signedIn: true, user: local.user, build: AUTH_BUILD },
          200,
          {
            'set-cookie': educatorCookie(
              local.cookieValue,
              60 * 60 * 8,
              secure,
            ),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (
          message === 'database_unavailable' ||
          message === 'educator_mapping_missing'
        )
          return json(
            { ok: false, error: 'session_not_created', build: AUTH_BUILD },
            503,
          );
        return json(
          { ok: false, error: 'auth_unavailable', build: AUTH_BUILD },
          502,
        );
      }
    } catch {
      return json(
        { ok: false, error: 'reset_unavailable', build: AUTH_BUILD },
        502,
      );
    }
  }

  const addressGate = await allowRequest(
    request,
    'educator-login-address',
    6,
    10 * 60 * 1000,
  );
  if (!addressGate.allowed) return rateLimited(addressGate);
  if (action !== 'login')
    return json({ ok: false, error: 'invalid_action', build: AUTH_BUILD }, 400);
  const { email, password } = input;
  if (email !== EDUCATOR_EMAIL)
    return json(
      { ok: false, error: 'invalid_credentials', build: AUTH_BUILD },
      401,
    );
  if (password.length < 8 || password.length > 128)
    return json(
      { ok: false, error: 'invalid_credentials', build: AUTH_BUILD },
      401,
    );
  const accountGate = await allowAccountRequest(
    'educator-login-account',
    12,
    10 * 60 * 1000,
    EDUCATOR_AUTH_USER_ID,
  );
  if (!accountGate.allowed) return rateLimited(accountGate);

  try {
    const valid = await verifyEducatorPassword(password);
    if (!valid)
      return json(
        { ok: false, error: 'invalid_credentials', build: AUTH_BUILD },
        401,
      );
    const local = await createLocalEducatorSession(request);
    return json({ ok: true, user: local.user, build: AUTH_BUILD }, 200, {
      'set-cookie': educatorCookie(local.cookieValue, 60 * 60 * 8, secure),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message === 'database_unavailable' ||
      message === 'educator_mapping_missing'
    )
      return json(
        { ok: false, error: 'session_not_created', build: AUTH_BUILD },
        503,
      );
    return json(
      { ok: false, error: 'auth_unavailable', build: AUTH_BUILD },
      502,
    );
  }
}
