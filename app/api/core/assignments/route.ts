import { isAssignableModule, assignmentLaunchPath } from '@/lib/training-recipes';
import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  assignedEnginePath,
  type WorkAssignmentState,
} from '@/lib/work-center';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function timestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
}

function assignmentState(row: Record<string, unknown>): WorkAssignmentState {
  const now = Date.now();
  const startsAt = timestamp(row.starts_at);
  const expiresAt = timestamp(row.expires_at);
  if (row.cancelled_at) return 'cancelled';
  if (row.is_active !== true) return 'closed';
  if (expiresAt && Date.parse(expiresAt) <= now) return 'expired';
  if (row.completed_session_id) return 'completed';
  if (row.active_session_id) return 'in_progress';
  if (startsAt && Date.parse(startsAt) > now) return 'assigned';
  return 'available';
}

function expectedCount(settings: unknown) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings))
    return 1;
  const record = settings as Record<string, unknown>;
  const exercise =
    record.exercise &&
    typeof record.exercise === 'object' &&
    !Array.isArray(record.exercise)
      ? (record.exercise as Record<string, unknown>)
      : null;
  const value = record.rounds ?? record.questionCount ?? exercise?.rounds;
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}

function assignmentResponse(row: Record<string, unknown>) {
  const state = assignmentState(row);
  const attempts = Number(row.attempt_count) || 0;
  const expected = expectedCount(row.settings);
  const moduleCode = String(row.module_code);
  const recipeId = String(row.id);
  return {
    ...row,
    status: state,
    active_session_id: row.active_session_id || null,
    launchPath:
      state === 'available' || state === 'in_progress'
        ? (assignedEnginePath(moduleCode, recipeId) ?? (isAssignableModule(moduleCode) ? assignmentLaunchPath(moduleCode, recipeId) : null))
        : null,
    progress: {
      attemptCount: attempts,
      expectedCount: expected,
      percent:
        state === 'completed'
          ? 100
          : Math.min(99, Math.round((100 * attempts) / expected)),
    },
  };
}

export async function GET(request: Request) {
  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL)
    return json({ ok: false, error: 'database_unavailable' }, 503);

  const sql = neon(process.env.DATABASE_URL);
  const recipeId =
    new URL(request.url).searchParams.get('recipeId')?.trim() || '';
  if (recipeId && !UUID_PATTERN.test(recipeId))
    return json({ ok: false, error: 'invalid_assignment_id' }, 400);

  if (recipeId) {
    const rows = await sql`
      SELECT tr.id, tr.module_code, tr.name, tr.instructions, tr.settings, tr.starts_at, tr.expires_at, tr.is_active, tr.cancelled_at,
             m.name AS module_name,
             active_session.id AS active_session_id,
             active_session.last_activity_at,
             completed_session.id AS completed_session_id,
             COALESCE(active_session.attempt_count, completed_session.attempt_count, 0)::int AS attempt_count
           , (SELECT lr.id FROM public.learning_records lr
              JOIN public.training_sessions ts ON ts.id = lr.training_session_id
              WHERE ts.recipe_id = tr.id
                AND lr.academy_id = ${student.academy_id}::uuid
                AND lr.student_id = ${student.student_id}::uuid
              ORDER BY lr.completed_at DESC, lr.created_at DESC LIMIT 1) AS latest_learning_record_id
      FROM public.training_recipes tr
      JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
      LEFT JOIN LATERAL (
        SELECT sessions.id, sessions.last_activity_at,
               count(attempts.id) FILTER (
                 WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
               )::int AS attempt_count
        FROM public.training_sessions sessions
        LEFT JOIN public.question_attempts attempts
          ON attempts.training_session_id = sessions.id
         AND attempts.academy_id = ${student.academy_id}::uuid
         AND attempts.student_id = ${student.student_id}::uuid
        WHERE sessions.recipe_id = tr.id
          AND sessions.academy_id = ${student.academy_id}::uuid
          AND sessions.student_id = ${student.student_id}::uuid
          AND sessions.status = 'active'
        GROUP BY sessions.id
        ORDER BY sessions.last_activity_at DESC, sessions.id DESC
        LIMIT 1
      ) active_session ON true
      LEFT JOIN LATERAL (
        SELECT sessions.id,
               count(attempts.id) FILTER (
                 WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
               )::int AS attempt_count
        FROM public.training_sessions sessions
        LEFT JOIN public.question_attempts attempts
          ON attempts.training_session_id = sessions.id
         AND attempts.academy_id = ${student.academy_id}::uuid
         AND attempts.student_id = ${student.student_id}::uuid
        WHERE sessions.recipe_id = tr.id
          AND sessions.academy_id = ${student.academy_id}::uuid
          AND sessions.student_id = ${student.student_id}::uuid
          AND sessions.status = 'completed'
        GROUP BY sessions.id
        ORDER BY sessions.completed_at DESC, sessions.id DESC
        LIMIT 1
      ) completed_session ON true
      WHERE tr.id = ${recipeId}::uuid
        AND tr.student_id = ${student.student_id}::uuid
        AND tr.academy_id = ${student.academy_id}::uuid
        AND tr.source = 'teacher_assignment'
        AND tr.is_active = true
        AND (tr.starts_at IS NULL OR tr.starts_at <= now())
        AND (tr.expires_at IS NULL OR tr.expires_at > now())
      LIMIT 1
    `;
    if (!rows.length)
      return json({ ok: false, error: 'assignment_not_found' }, 404);
    return json({
      ok: true,
      assignment: assignmentResponse(rows[0] as Record<string, unknown>),
    });
  }

  const rows = await sql`
    SELECT tr.id, tr.module_code, tr.name, tr.instructions, tr.settings, tr.starts_at, tr.expires_at,
           tr.is_active, tr.cancelled_at, m.name AS module_name,
           (SELECT count(*)::int FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = ${student.academy_id}::uuid
              AND ts.student_id = ${student.student_id}::uuid) AS session_count,
           (SELECT id FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = ${student.academy_id}::uuid
              AND ts.student_id = ${student.student_id}::uuid
              AND ts.status = 'active'
            ORDER BY ts.last_activity_at DESC, ts.id DESC LIMIT 1) AS active_session_id,
           (SELECT id FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = ${student.academy_id}::uuid
              AND ts.student_id = ${student.student_id}::uuid
              AND ts.status = 'completed'
            ORDER BY ts.completed_at DESC, ts.id DESC LIMIT 1) AS completed_session_id,
           (SELECT count(*)::int
            FROM public.question_attempts qa
            JOIN public.training_sessions ts ON ts.id = qa.training_session_id
            WHERE ts.recipe_id = tr.id
              AND qa.academy_id = ${student.academy_id}::uuid
              AND qa.student_id = ${student.student_id}::uuid
              AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS attempt_count,
           (SELECT max(ts.completed_at) FROM public.training_sessions ts
            WHERE ts.recipe_id = tr.id
              AND ts.academy_id = ${student.academy_id}::uuid
              AND ts.student_id = ${student.student_id}::uuid
              AND ts.status = 'completed') AS last_completed_at
           , (SELECT lr.id FROM public.learning_records lr
              JOIN public.training_sessions ts ON ts.id = lr.training_session_id
              WHERE ts.recipe_id = tr.id
                AND lr.academy_id = ${student.academy_id}::uuid
                AND lr.student_id = ${student.student_id}::uuid
              ORDER BY lr.completed_at DESC, lr.created_at DESC LIMIT 1) AS latest_learning_record_id
    FROM public.training_recipes tr
    JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
    WHERE tr.student_id = ${student.student_id}::uuid
      AND tr.academy_id = ${student.academy_id}::uuid
      AND tr.source = 'teacher_assignment'
    ORDER BY tr.created_at DESC
    LIMIT 50
  `;
  return json({
    ok: true,
    assignments: rows.map((row) =>
      assignmentResponse(row as Record<string, unknown>),
    ),
  });
}

export async function POST(request: Request) {
  const gate = await allowRequest(
    request,
    'student-assignment-launch',
    20,
    10 * 60 * 1000,
  );
  if (!gate.allowed) return rateLimited(gate);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, error: 'request_origin_rejected' }, 403);

  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL)
    return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }
  const recipeId =
    typeof input.recipeId === 'string' ? input.recipeId.trim() : '';
  if (!UUID_PATTERN.test(recipeId))
    return json({ ok: false, error: 'invalid_assignment_id' }, 400);

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT tr.id, tr.module_code, tr.settings,
           EXISTS (
             SELECT 1 FROM public.training_sessions ts
             WHERE ts.recipe_id = tr.id
               AND ts.academy_id = ${student.academy_id}::uuid
               AND ts.student_id = ${student.student_id}::uuid
               AND ts.status = 'completed'
           ) AS completed
    FROM public.training_recipes tr
    WHERE tr.id = ${recipeId}::uuid
      AND tr.student_id = ${student.student_id}::uuid
      AND tr.academy_id = ${student.academy_id}::uuid
      AND tr.source = 'teacher_assignment'
      AND tr.is_active = true
      AND (tr.starts_at IS NULL OR tr.starts_at <= now())
      AND (tr.expires_at IS NULL OR tr.expires_at > now())
    LIMIT 1
  `;
  if (!rows.length)
    return json({ ok: false, error: 'assignment_not_found' }, 404);
  const assignment = rows[0] as Record<string, unknown>;
  if (assignment.completed === true) {
    return json({ ok: false, error: 'assignment_completed' }, 409);
  }
  const moduleCode = String(assignment.module_code);
  const launchPath = assignedEnginePath(moduleCode, recipeId) ?? (isAssignableModule(moduleCode) ? assignmentLaunchPath(moduleCode, recipeId) : null);
  if (!launchPath) {
    return json({ ok: false, error: 'unsupported_assignment_module' }, 409);
  }

  const secure = new URL(request.url).protocol === 'https:';
  const cookie = [
    `cza_assignment_recipe=${encodeURIComponent(recipeId)}`,
    'Path=/api/core',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    'Max-Age=900',
  ].join('; ');
  return json({ ok: true, assignment, launchPath }, 200, {
    'set-cookie': cookie,
  });
}
