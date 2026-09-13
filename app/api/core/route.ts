const DEFAULT_CORE_URL =
  'https://br-aged-bird-b2ml5crw-czastudent.compute.c-6.eu-central-1.aws.neon.tech/';
import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedStudent, readRequestCookie } from '@/lib/student-session';
import { LearningContractError, parseCanonicalLearningRecord } from '@/lib/learning-contract-server';
import { CanonicalPersistenceError, persistCanonicalLearningRecord } from '@/lib/persistence/canonical-repository';

const ALLOWED_ACTIONS = new Set([
  'login',
  'me',
  'start',
  'finish',
  'interaction',
  'attempt',
  'module_record',
  'logout',
]);

const COOKIE_NAME = 'cza_student_session';
const ASSIGNMENT_COOKIE = 'cza_assignment_recipe';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 64 * 1024;

function readCookie(request: Request, name: string) {
  return readRequestCookie(request, name);
}

function sessionCookie(value: string, maxAge: number, secure: boolean) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/api/core',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

function assignmentCookie(value: string, maxAge: number, secure: boolean) {
  return [
    `${ASSIGNMENT_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/api/core',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export async function POST(request: Request) {
  const secureCookie = new URL(request.url).protocol === 'https:';
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  let input: Record<string, unknown>;
  try {
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return json({ ok: false, error: 'request_too_large' }, 413);
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ ok: false, error: 'request_too_large' }, 413);
    }
    input = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const action = typeof input.action === 'string' ? input.action : '';
  if (!ALLOWED_ACTIONS.has(action)) {
    return json({ ok: false, error: 'invalid_action' }, 400);
  }

  if (action === 'login') {
    const gate = allowRequest(request, 'student-login', 6, 10 * 60 * 1000);
    if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  }

  const sessionToken = readCookie(request, COOKIE_NAME);
  if (action !== 'login' && !sessionToken) {
    return json({ ok: false, error: 'session_required' }, 401);
  }

  if (action === 'module_record') {
    const gate = allowRequest(request, 'module-record', 120, 60 * 1000);
    if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

    if (!process.env.DATABASE_URL) {
      return json({ ok: false, error: 'database_unavailable' }, 503);
    }

    const student = await authenticatedStudent(request);
    if (!student) return json({ ok: false, error: 'session_required' }, 401);

    try {
      const record = parseCanonicalLearningRecord(
        input.record,
        request.headers.get('x-cza-contract-version'),
      );
      const persisted = await persistCanonicalLearningRecord(student, record);
      return json({ ok: true, ...persisted }, persisted.replayed ? 200 : 201);
    } catch (error) {
      if (error instanceof LearningContractError) {
        return json({ ok: false, error: error.code }, 400);
      }
      if (error instanceof CanonicalPersistenceError) {
        return json({ ok: false, error: error.code }, error.status);
      }
      return json({ ok: false, error: 'learning_persistence_unavailable' }, 503);
    }
  }

  const payload = { ...input };
  delete payload.sessionToken;
  if (action !== 'login') payload.sessionToken = sessionToken;

  let launchedAssignment = false;
  if (action === 'start') {
    const recipeId = readCookie(request, ASSIGNMENT_COOKIE);
    if (recipeId) {
      if (!UUID_PATTERN.test(recipeId)) return json({ ok: false, error: 'invalid_assignment_id' }, 400);
      if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
      const student = await authenticatedStudent(request);
      if (!student) return json({ ok: false, error: 'session_required' }, 401);
      const sql = neon(process.env.DATABASE_URL);
      const recipes = await sql`
        SELECT id, module_code, settings
        FROM public.training_recipes
        WHERE id = ${recipeId}::uuid
          AND student_id = ${student.student_id}::uuid
          AND academy_id = ${student.academy_id}::uuid
          AND source = 'teacher_assignment'
          AND is_active = true
          AND (starts_at IS NULL OR starts_at <= now())
          AND (expires_at IS NULL OR expires_at > now())
        LIMIT 1
      `;
      if (!recipes.length) return json({ ok: false, error: 'assignment_not_found' }, 404);
      const recipe = recipes[0] as { id: string; module_code: string; settings: Record<string, unknown> };
      payload.recipeId = recipe.id;
      payload.moduleCode = recipe.module_code;
      payload.source = 'teacher_assignment';
      payload.settings = recipe.settings;
      launchedAssignment = true;
    }
  }

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
      return json(safeResult, 200, { 'set-cookie': sessionCookie(token, 60 * 60 * 8, secureCookie) });
    }

    if (action === 'logout') {
      return json(result, 200, { 'set-cookie': sessionCookie('', 0, secureCookie) });
    }

    if (launchedAssignment) {
      return json(result, 200, { 'set-cookie': assignmentCookie('', 0, secureCookie) });
    }

    return json(result);
  } catch {
    if (action === 'logout') {
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, secureCookie) });
    }
    return json({ ok: false, error: 'core_unavailable' }, 502);
  }
}
