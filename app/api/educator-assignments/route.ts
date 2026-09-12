import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { assignableModules, defaultRecipeSettings, isAssignableModule } from '@/lib/training-recipes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'educator-assignments', 30, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'request_origin_rejected' }, 403);

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const action = typeof input.action === 'string' ? input.action : '';
  const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : '';
  if (!UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);

  const sql = neon(process.env.DATABASE_URL);
  const allowed = await sql`
    SELECT s.id AS student_id, s.academy_id, t.id AS educator_user_id,
           concat_ws(' ', s.first_name, s.last_name) AS student_name
    FROM public.users t
    JOIN public.teacher_student_links l ON l.teacher_id = t.id AND l.can_view = true
    JOIN public.students s ON s.id = l.student_id
    WHERE t.auth_user_id = ${educator.id}
      AND t.is_active = true
      AND s.id = ${studentId}::uuid
    LIMIT 1
  `;
  if (!allowed.length) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);
  const link = allowed[0] as { student_id: string; academy_id: string; educator_user_id: string; student_name: string | null };

  if (action === 'list') {
    const rows = await sql`
      SELECT tr.id, tr.module_code, tr.name, tr.settings, tr.starts_at, tr.expires_at,
             tr.is_active, tr.created_at,
             (SELECT count(*)::int FROM public.training_sessions ts WHERE ts.recipe_id = tr.id) AS session_count,
             (SELECT count(*)::int FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed') AS completed_count
      FROM public.training_recipes tr
      WHERE tr.student_id = ${studentId}::uuid
      ORDER BY tr.created_at DESC
      LIMIT 50
    `;
    return json({ ok: true, assignments: rows });
  }

  if (action === 'create') {
    const moduleCode = typeof input.moduleCode === 'string' ? input.moduleCode.trim() : '';
    if (!isAssignableModule(moduleCode)) return json({ ok: false, error: 'invalid_module' }, 400);

    const existing = await sql`
      SELECT id
      FROM public.training_recipes
      WHERE student_id = ${studentId}::uuid
        AND module_code = ${moduleCode}
        AND source = 'teacher_assignment'
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing.length) return json({ ok: false, error: 'active_assignment_exists' }, 409);

    const settings = defaultRecipeSettings(moduleCode);
    const title = `${assignableModules[moduleCode].label} · Başlangıç çalışması`;
    const rows = await sql`
      INSERT INTO public.training_recipes (
        academy_id, student_id, module_code, assigned_by, source, name, settings,
        is_active, starts_at, expires_at
      ) VALUES (
        ${link.academy_id}::uuid,
        ${studentId}::uuid,
        ${moduleCode},
        ${link.educator_user_id}::uuid,
        'teacher_assignment',
        ${title},
        ${JSON.stringify(settings)}::jsonb,
        true,
        now(),
        now() + interval '14 days'
      )
      RETURNING id, module_code, name, settings, starts_at, expires_at, is_active, created_at
    `;
    return json({ ok: true, assignment: rows[0] }, 201);
  }

  if (action === 'deactivate') {
    const assignmentId = typeof input.assignmentId === 'string' ? input.assignmentId.trim() : '';
    if (!UUID_PATTERN.test(assignmentId)) return json({ ok: false, error: 'invalid_assignment_id' }, 400);
    const rows = await sql`
      UPDATE public.training_recipes
      SET is_active = false, updated_at = now()
      WHERE id = ${assignmentId}::uuid
        AND student_id = ${studentId}::uuid
        AND assigned_by = ${link.educator_user_id}::uuid
      RETURNING id
    `;
    if (!rows.length) return json({ ok: false, error: 'assignment_not_found' }, 404);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'invalid_action' }, 400);
}
