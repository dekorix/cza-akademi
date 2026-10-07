import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { parseTimelineRequest, readLearningTimeline, TimelineInputError } from '@/lib/persistence/learning-timeline';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const educator = await authenticatedEducator(request);
    if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
    const gate = await allowRequest(request, 'educator-learning-timeline', 60, 60_000, educator.id);
    if (!gate.allowed) return rateLimited(gate);
    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId')?.trim() || '';
    if (!UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
    const sql = neon(process.env.DATABASE_URL);
    const authorized = await sql`
      SELECT student.id, student.academy_id
      FROM public.users educator
      JOIN public.teacher_student_links link
        ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students student
        ON student.id=link.student_id AND student.academy_id=educator.academy_id
      WHERE educator.auth_user_id=${educator.id}
        AND educator.is_active=true
        AND educator.role::text IN ('admin','teacher','educator')
        AND student.status='active'
        AND student.id=${studentId}::uuid
      LIMIT 1
    `;
    if (!authorized.length) return json({ ok: false, error: 'student_not_authorized' }, 403);
    const input = parseTimelineRequest(url);
    const timeline = await readLearningTimeline({
      sql, academyId: String(authorized[0].academy_id), studentId, ...input,
    });
    return json({ ok: true, timeline });
  } catch (error) {
    if (error instanceof TimelineInputError) return json({ ok: false, error: error.code }, 400);
    return json({ ok: false, error: 'timeline_unavailable' }, 503);
  }
}
