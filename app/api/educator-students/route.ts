import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  const gate = allowRequest(request, 'educator-students', 30, 60000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  try {
    const educator = await authenticatedEducator(request);
    if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
    const page = Number(new URL(request.url).searchParams.get('page') || 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return json({ ok: false, error: 'invalid_page' }, 400);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT s.id, concat_ws(' ', s.first_name, s.last_name) AS name,
        i.identifier_value AS code, u.username
      FROM public.students s
      LEFT JOIN public.users u ON u.id = s.user_id
      LEFT JOIN public.student_external_identifiers i
        ON i.student_id = s.id AND i.identifier_type = 'campus_student_code'
      WHERE EXISTS (
        SELECT 1 FROM public.teacher_student_links l
        JOIN public.users t ON t.id = l.teacher_id
        WHERE l.student_id = s.id AND l.can_view = true
          AND t.auth_user_id = ${educator.id} AND t.is_active = true
      )
      ORDER BY s.id LIMIT 51 OFFSET ${page * 50}
    `;
    return json({ ok: true, students: rows.slice(0, 50), hasMore: rows.length > 50 });
  } catch {
    return json({ ok: false, error: 'student_list_unavailable' }, 503);
  }
}
