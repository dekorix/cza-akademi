const DEFAULT_CORE_URL =
  'https://br-aged-bird-b2ml5crw-czastudent.compute.c-6.eu-central-1.aws.neon.tech/';

const ALLOWED_ACTIONS = new Set([
  'login',
  'me',
  'start',
  'finish',
  'interaction',
  'attempt',
  'logout',
]);

const COOKIE_NAME = 'cza_student_session';

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get('cookie') || '';
  const pair = cookies
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}

function sessionCookie(value: string, maxAge: number) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/api/core',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const action = typeof input.action === 'string' ? input.action : '';
  if (!ALLOWED_ACTIONS.has(action)) {
    return json({ ok: false, error: 'invalid_action' }, 400);
  }

  const sessionToken = readCookie(request, COOKIE_NAME);
  if (action !== 'login' && !sessionToken) {
    return json({ ok: false, error: 'session_required' }, 401);
  }

  const payload = { ...input };
  delete payload.sessionToken;
  if (action !== 'login') payload.sessionToken = sessionToken;

  const coreUrl = process.env.CZA_CORE_API_URL || DEFAULT_CORE_URL;

  try {
    const upstream = await fetch(coreUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await upstream.json()) as Record<string, unknown>;

    if (!upstream.ok || result.ok === false) {
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return json({ ok: false, error: result.error || 'core_unavailable' }, status);
    }

    if (action === 'login') {
      const token = typeof result.sessionToken === 'string' ? result.sessionToken : '';
      if (!token) return json({ ok: false, error: 'session_not_created' }, 502);
      const safeResult = { ...result };
      delete safeResult.sessionToken;
      return json(safeResult, 200, { 'set-cookie': sessionCookie(token, 60 * 60 * 8) });
    }

    if (action === 'logout') {
      return json(result, 200, { 'set-cookie': sessionCookie('', 0) });
    }

    return json(result);
  } catch {
    if (action === 'logout') {
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
    }
    return json({ ok: false, error: 'core_unavailable' }, 502);
  }
}
