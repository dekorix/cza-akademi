import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedStudent } from '@/lib/student-session';
import { readStudentLearningProfile } from '@/lib/persistence/student-learning-profile';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const student = await authenticatedStudent(request);
    if (!student) return json({ ok: false, error: 'session_required' }, 401);
    const gate = await allowRequest(request, 'student-learning-profile', 40, 60_000, student.student_id);
    if (!gate.allowed) return rateLimited(gate);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
    const profile = await readStudentLearningProfile({
      sql: neon(process.env.DATABASE_URL), academyId: student.academy_id, studentId: student.student_id,
    });
    return profile ? json({ ok: true, profile }) : json({ ok: false, error: 'student_profile_not_found' }, 404);
  } catch {
    return json({ ok: false, error: 'learning_profile_unavailable' }, 503);
  }
}
