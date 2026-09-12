import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';
import { allowRequest, rateLimited } from '@/lib/request-guard';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export async function GET(request: Request) {
  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  const sql = neon(process.env.DATABASE_URL);
  const recipeId = new URL(request.url).searchParams.get('recipeId')?.trim() || '';
  if (recipeId && !UUID_PATTERN.test(recipeId)) return json({ ok: false, error: 'invalid_assignment_id' }, 400);

  if (recipeId) {
    const rows = await sql`
      SELECT tr.id, tr.module_code, tr.name, tr.settings, tr.starts_at, tr.expires_at, tr.is_active,
             m.name AS module_name
      FROM public.training_recipes tr
      JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
      WHERE tr.id = ${recipeId}::uuid
        AND tr.student_id = ${student.student_id}::uuid
        AND tr.academy_id = ${student.academy_id}::uuid
        AND tr.source = 'teacher_assignment'
        AND tr.is_active = true
        AND (tr.starts_at IS NULL OR tr.starts_at <= now())
        AND (tr.expires_at IS NULL OR tr.expires_at > now())
      LIMIT 1
    `;
    if (!rows.length) return json({ ok: false, error: 'assignment_not_found' }, 404);
    return json({ ok: true, assignment: rows[0] });
  }

  const rows = await sql`
    SELECT tr.id, tr.module_code, tr.name, tr.settings, tr.starts_at, tr.expires_at,
           m.name AS module_name,
           (SELECT count(*)::int FROM public.training_sessions ts WHERE ts.recipe_id = tr.id) AS session_count,
           (SELECT max(ts.completed_at) FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed') AS last_completed_at
    FROM public.training_recipes tr
    JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
    WHERE tr.student_id = ${student.student_id}::uuid
      AND tr.academy_id = ${student.academy_id}::uuid
      AND tr.source = 'teacher_assignment'
      AND tr.is_active = true
      AND (tr.starts_at IS NULL OR tr.starts_at <= now())
      AND (tr.expires_at IS NULL OR tr.expires_at > now())
    ORDER BY tr.created_at DESC
    LIMIT 20
  `;
  return json({ ok: true, assignments: rows });
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'student-assignment-launch', 20, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'request_origin_rejected' }, 403);

  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }
  const recipeId = typeof input.recipeId === 'string' ? input.recipeId.trim() : '';
  if (!UUID_PATTERN.test(recipeId)) return json({ ok: false, error: 'invalid_assignment_id' }, 400);

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT tr.id, tr.module_code, tr.settings
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
  if (!rows.length) return json({ ok: false, error: 'assignment_not_found' }, 404);

  const secure = new URL(request.url).protocol === 'https:';
  const cookie = [
    `cza_assignment_recipe=${encodeURIComponent(recipeId)}`,
    'Path=/api/core',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    'Max-Age=900',
  ].join('; ');
  return json({ ok: true, assignment: rows[0] }, 200, { 'set-cookie': cookie });
}
