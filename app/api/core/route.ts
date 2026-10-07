import { isPackageAccessCode } from '@/lib/package-catalog';
import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  reportGuardStage,
  reportUpstreamRedirect,
  stagingDiagnosticsEnabled,
} from '@/lib/k3e-staging-diagnostics';
import {
  authenticatedStudent,
  readRequestCookie,
  revokeStudentSession,
  StudentSessionError,
} from '@/lib/student-session';
import {
  configuredCoreUrl,
  CoreRequestError,
  parseCoreRequest,
  readBoundedJson,
  type CoreAction,
} from '@/lib/core-request-security';
import {
  LearningContractError,
  parseCanonicalLearningRecord,
} from '@/lib/learning-contract-server';
import {
  CanonicalPersistenceError,
  persistCanonicalLearningRecord,
} from '@/lib/persistence/canonical-repository';
import {
  assignedSessionForRecipe,
  bindAssignedSession,
  completeAssignedSession,
  ownedSession,
  recordAssignedAttempt,
  WorkCenterPersistenceError,
  type WorkStudent,
} from '@/lib/persistence/work-center-repository';
import { isAssignedEngineModule } from '@/lib/work-center';
import { exerciseForModuleCode } from '@/lib/exercise-registry';
import { engineDefinition } from '@/lib/engine-registry';
import type { EngineReference } from '@/lib/engine-contract';

const COOKIE_NAME = 'cza_student_session';
const ASSIGNMENT_COOKIE = 'cza_assignment_recipe';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

function readCookie(request: Request, name: string) {
  return readRequestCookie(request, name);
}

function cookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
  path = '/api/core',
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=' + path,
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

function sessionCookie(value: string, maxAge: number, secure: boolean) {
  return cookie(COOKIE_NAME, value, maxAge, secure, '/api');
}

function assessmentSessionCookie(
  value: string,
  maxAge: number,
  secure: boolean,
) {
  return cookie(COOKIE_NAME, value, maxAge, secure, '/api/assessment');
}

function assignmentCookie(value: string, maxAge: number, secure: boolean) {
  return cookie(ASSIGNMENT_COOKIE, value, maxAge, secure);
}

function json(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
  cookies: string[] = [],
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  for (const value of cookies) responseHeaders.append('set-cookie', value);
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function lifecycleCookies(action: CoreAction, secure: boolean) {
  const values: string[] = [];
  if (action === 'login' || action === 'start') {
    values.push(assignmentCookie('', 0, secure));
  }
  return values;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const secureCookie = requestUrl.protocol === 'https:';
  if (process.env.NODE_ENV === 'production' && !secureCookie) {
    return json({ ok: false, error: 'secure_transport_required' }, 400);
  }

  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (
    (origin && origin !== requestUrl.origin) ||
    (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')
  ) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  let input;
  try {
    input = parseCoreRequest(await readBoundedJson(request, MAX_REQUEST_BYTES));
  } catch (error) {
    if (error instanceof CoreRequestError) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const action = input.action;
  const responseCookies = lifecycleCookies(action, secureCookie);
  const respond = (
    body: unknown,
    status = 200,
    headers?: HeadersInit,
    extraCookies: string[] = [],
  ) => json(body, status, headers, [...responseCookies, ...extraCookies]);

  if (action === 'login') {
    const diagnostic = stagingDiagnosticsEnabled(requestUrl);
    const gate = await allowRequest(
      request,
      'student-login',
      6,
      10 * 60 * 1000,
      undefined,
      diagnostic ? reportGuardStage : undefined,
    );
    if (!gate.allowed) {
      const response = rateLimited(gate);
      for (const value of responseCookies)
        response.headers.append('set-cookie', value);
      return response;
    }
  }

  const sessionToken = readCookie(request, COOKIE_NAME);
  if (action !== 'login' && !sessionToken) {
    return respond({ ok: false, error: 'session_required' }, 401);
  }

  if (action === 'logout') {
    try {
      await revokeStudentSession(request);
      return json({ ok: true, revoked: true }, 200, undefined, [
        assignmentCookie('', 0, secureCookie),
        sessionCookie('', 0, secureCookie),
        assessmentSessionCookie('', 0, secureCookie),
      ]);
    } catch (error) {
      const code =
        error instanceof StudentSessionError
          ? error.code
          : 'logout_revocation_failed';
      // Preserve both cookies so the user can retry durable revocation.
      return json({ ok: false, error: code }, 503);
    }
  }

  if (action === 'module_record') {
    if (!process.env.DATABASE_URL) {
      return respond({ ok: false, error: 'database_unavailable' }, 503);
    }

    const student = await authenticatedStudent(request);
    if (!student) return respond({ ok: false, error: 'session_required' }, 401);

    const gate = await allowRequest(
      request,
      'module-record',
      120,
      60 * 1000,
      student.student_id,
    );
    if (!gate.allowed) return rateLimited(gate);

    try {
      const record = parseCanonicalLearningRecord(
        input.record,
        request.headers.get('x-cza-contract-version'),
      );
      const persisted = await persistCanonicalLearningRecord(student, record);
      return respond(
        { ok: true, ...persisted },
        persisted.replayed ? 200 : 201,
      );
    } catch (error) {
      if (error instanceof LearningContractError) {
        return respond({ ok: false, error: error.code }, 400);
      }
      if (error instanceof CanonicalPersistenceError) {
        return respond({ ok: false, error: error.code }, error.status);
      }
      return respond(
        { ok: false, error: 'learning_persistence_unavailable' },
        503,
      );
    }
  }

  const payload: Record<string, unknown> = { ...input };
  delete payload.sessionToken;
  if (action !== 'login') payload.sessionToken = sessionToken;
  let workStudent: WorkStudent | null = null;
  let workRecipeId = '';
  let assignedTrainingSessionId = '';
  let workEngine: EngineReference | null = null;

  if (action === 'start') {
    const recipeId = readCookie(request, ASSIGNMENT_COOKIE);
    if (
      !recipeId &&
      (payload.source === 'teacher_assignment' || payload.recipeId !== null)
    ) {
      return respond({ ok: false, error: 'assignment_launch_required' }, 403);
    }

    if (recipeId) {
      if (!UUID_PATTERN.test(recipeId)) {
        return respond({ ok: false, error: 'invalid_assignment_id' }, 400);
      }
      if (!process.env.DATABASE_URL) {
        return respond({ ok: false, error: 'database_unavailable' }, 503);
      }
      const student = await authenticatedStudent(request);
      if (!student)
        return respond({ ok: false, error: 'session_required' }, 401);
      workStudent = student;
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
      if (!recipes.length) {
        return respond({ ok: false, error: 'assignment_not_found' }, 404);
      }
      const recipe = recipes[0] as {
        id: string;
        module_code: string;
        settings: Record<string, unknown>;
      };
      if (!isAssignedEngineModule(recipe.module_code)) {
        return respond(
          { ok: false, error: 'unsupported_assignment_module' },
          409,
        );
      }
      let existing;
      try {
        existing = await assignedSessionForRecipe(student, recipe.id);
      } catch (error) {
        if (error instanceof WorkCenterPersistenceError) {
          return respond({ ok: false, error: error.code }, error.status);
        }
        return respond(
          { ok: false, error: 'work_persistence_unavailable' },
          503,
        );
      }
      if (existing?.status === 'completed') {
        return respond({ ok: false, error: 'assignment_completed' }, 409);
      }
      if (existing?.status === 'active') {
        return respond({
          ok: true,
          sessionId: existing.sessionId,
          resumed: true,
          workStatus: 'in_progress',
          startedAt: existing.startedAt,
          workProgress: {
            attemptCount: existing.attemptCount,
            correctCount: existing.correctCount,
          },
        });
      }
      workRecipeId = recipe.id;
      const exercise = exerciseForModuleCode(recipe.module_code);
      workEngine = exercise?.engine
        ? engineDefinition(
            exercise.engine.engineId,
            exercise.engine.engineVersion,
          )
        : null;
      payload.recipeId = recipe.id;
      payload.moduleCode = recipe.module_code;
      payload.source = 'teacher_assignment';
      payload.settings = recipe.settings;
    } else {
      payload.recipeId = null;
      payload.source = 'free_practice';
    }
  }

  if (action === 'attempt' || action === 'interaction' || action === 'finish') {
    const student = await authenticatedStudent(request);
    if (!student) return respond({ ok: false, error: 'session_required' }, 401);
    workStudent = student;
    const sessionId =
      typeof input.sessionId === 'string' ? input.sessionId : '';
    try {
      const session = await ownedSession(student, sessionId);
      if (!session) return respond({ ok: false, error: 'work_not_found' }, 404);
      if (session.recipe_id) assignedTrainingSessionId = session.id;
    } catch (error) {
      if (error instanceof WorkCenterPersistenceError) {
        return respond({ ok: false, error: error.code }, error.status);
      }
      return respond({ ok: false, error: 'work_persistence_unavailable' }, 503);
    }
  }

  // Assigned completion has one owner: U2. Legacy Core finish must never
  // mark the row completed before canonical attempt/ledger validation.
  if (action === 'finish' && workStudent && assignedTrainingSessionId) {
    try {
      const completion = await completeAssignedSession(
        workStudent,
        assignedTrainingSessionId,
        input.aborted === true,
      );
      return respond({ ok: true, workCompletion: completion });
    } catch (error) {
      if (error instanceof WorkCenterPersistenceError) {
        return respond({ ok: false, error: error.code }, error.status);
      }
      return respond({ ok: false, error: 'work_persistence_unavailable' }, 503);
    }
  }

  if (action === 'start' && !workRecipeId) {
    const moduleCode = typeof payload.moduleCode === 'string' ? payload.moduleCode.trim() : '';
    if (moduleCode && isPackageAccessCode(moduleCode)) {
      if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
      const student = await authenticatedStudent(request);
      if (!student) return json({ ok: false, error: 'session_required' }, 401);
      const sql = neon(process.env.DATABASE_URL);
      try {
        const entitlements = await sql`
          SELECT e.id
          FROM public.student_access_entitlements e
          JOIN public.student_package_enrollments p
            ON p.id = e.enrollment_id
           AND p.status = 'active'
          WHERE e.academy_id = ${student.academy_id}::uuid
            AND e.student_id = ${student.student_id}::uuid
            AND e.access_code = ${moduleCode}
            AND e.status = 'active'
            AND p.starts_at <= now()
            AND (p.ends_at IS NULL OR p.ends_at > now())
          LIMIT 1
        `;
        if (!entitlements.length) return json({ ok: false, error: 'module_access_required' }, 403);
      } catch {
        return json({ ok: false, error: 'package_schema_unavailable' }, 503);
      }
    }
  }

  let coreUrl: string;
  try {
    coreUrl = configuredCoreUrl();
  } catch (error) {
    if (error instanceof CoreRequestError) {
      return respond({ ok: false, error: error.code }, error.status);
    }
    return respond({ ok: false, error: 'core_configuration_unavailable' }, 503);
  }

  const controller = new AbortController();
  const diagnostic = stagingDiagnosticsEnabled(requestUrl);
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstreamHeaders = new Headers({
      'content-type': 'application/json',
      accept: 'application/json',
    });
    const vercelBypassSecret =
      process.env.CZA_CORE_VERCEL_BYPASS_SECRET?.trim();
    if (vercelBypassSecret) {
      upstreamHeaders.set('x-vercel-protection-bypass', vercelBypassSecret);
    }
    const upstream = await fetch(coreUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      if (diagnostic) {
        reportUpstreamRedirect(
          upstream.status,
          upstream.headers.get('location'),
          coreUrl,
        );
      }
      return respond({ ok: false, error: 'core_unavailable' }, 502);
    }
    const result = await readBoundedJson(upstream, MAX_REQUEST_BYTES);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return respond({ ok: false, error: 'core_invalid_response' }, 502);
    }

    const upstreamResult = result as Record<string, unknown>;
    if (!upstream.ok || upstreamResult.ok === false) {
      const status =
        upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      const error =
        typeof upstreamResult.error === 'string'
          ? upstreamResult.error
          : 'core_unavailable';
      return respond({ ok: false, error }, status);
    }

    if (action === 'login') {
      const token =
        typeof upstreamResult.sessionToken === 'string'
          ? upstreamResult.sessionToken
          : '';
      if (!token || token.length > 512) {
        return respond({ ok: false, error: 'session_not_created' }, 502);
      }
      const safeResult = { ...upstreamResult };
      delete safeResult.sessionToken;
      return respond(safeResult, 200, undefined, [
        sessionCookie(token, 60 * 60 * 8, secureCookie),
        assessmentSessionCookie(token, 60 * 60 * 8, secureCookie),
      ]);
    }

    if (action === 'start' && workStudent && workRecipeId) {
      const trainingSessionId =
        typeof upstreamResult.sessionId === 'string'
          ? upstreamResult.sessionId
          : '';
      if (!UUID_PATTERN.test(trainingSessionId)) {
        return respond({ ok: false, error: 'core_invalid_response' }, 502);
      }
      const bound = await bindAssignedSession(workStudent, {
        recipeId: workRecipeId,
        clientSessionId: String(payload.clientSessionId),
        trainingSessionId,
        startedAt: new Date().toISOString(),
        engine: workEngine,
      });
      if (bound.status === 'completed') {
        return respond({ ok: false, error: 'assignment_completed' }, 409);
      }
      return respond({
        ...upstreamResult,
        sessionId: bound.sessionId,
        resumed: bound.resumed,
        workStatus: bound.status,
        startedAt: bound.startedAt,
        workProgress: {
          attemptCount: bound.attemptCount,
          correctCount: bound.correctCount,
          lastActivityAt: bound.lastActivityAt,
        },
      });
    }

    if (action === 'attempt' && workStudent && assignedTrainingSessionId) {
      const progress = await recordAssignedAttempt(
        workStudent,
        assignedTrainingSessionId,
        input.payload as Record<string, unknown>,
      );
      return respond({ ...upstreamResult, workProgress: progress });
    }

    return respond(upstreamResult);
  } catch (error) {
    if (error instanceof WorkCenterPersistenceError) {
      return respond({ ok: false, error: error.code }, error.status);
    }
    if (error instanceof CoreRequestError) {
      return respond({ ok: false, error: 'core_invalid_response' }, 502);
    }
    return respond({ ok: false, error: 'core_unavailable' }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
