import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { readStudentLearningProfile } from '@/lib/persistence/student-learning-profile';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const identity = await authenticatedEducator(request);
    if (!identity) return json({ ok: false, error: 'educator_session_required' }, 401);
    const gate = await allowRequest(request, 'educator-learning-profile', 40, 60_000, identity.id);
    if (!gate.allowed) return rateLimited(gate);
    const studentId = new URL(request.url).searchParams.get('studentId')?.trim() || '';
    if (!UUID.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
    const sql = neon(process.env.DATABASE_URL);
    const authorized = await sql`
      SELECT student.academy_id
      FROM public.users educator
      JOIN public.teacher_student_links link ON link.teacher_id=educator.id AND link.can_view=true
      JOIN public.students student ON student.id=link.student_id AND student.academy_id=educator.academy_id
      WHERE educator.auth_user_id=${identity.id}
        AND educator.role::text='educator' AND educator.is_active=true
        AND student.status='active' AND student.id=${studentId}::uuid
      LIMIT 1
    `;
    if (!authorized.length) return json({ ok: false, error: 'student_not_authorized' }, 403);
    const profile = await readStudentLearningProfile({ sql, academyId: String(authorized[0].academy_id), studentId });
    if(!profile)return json({ ok: false, error: 'student_profile_not_found' }, 404);
    return json({ ok: true, profile });
  } catch {
    return json({ ok: false, error: 'learning_profile_unavailable' }, 503);
  }
}
