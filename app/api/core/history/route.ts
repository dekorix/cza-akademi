import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedStudent } from '@/lib/student-session';
import { parseTimelineRequest, readLearningTimeline, TimelineInputError } from '@/lib/persistence/learning-timeline';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const student = await authenticatedStudent(request);
    if (!student) return json({ ok: false, error: 'session_required' }, 401);
    const gate = await allowRequest(request, 'student-learning-timeline', 60, 60_000, student.student_id);
    if (!gate.allowed) return rateLimited(gate);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
    const input = parseTimelineRequest(new URL(request.url));
    const timeline = await readLearningTimeline({
      sql: neon(process.env.DATABASE_URL), academyId: student.academy_id,
      studentId: student.student_id, ...input,
    });
    return json({ ok: true, timeline });
  } catch (error) {
    if (error instanceof TimelineInputError) return json({ ok: false, error: error.code }, 400);
    return json({ ok: false, error: 'timeline_unavailable' }, 503);
  }
}
