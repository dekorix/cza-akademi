import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';
import { isolatedQaEnabled } from '@/lib/isolated-qa-auth';
import { qaDemoRead, demoReadDenied } from '@/lib/qa-demo-read';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { COMPLETED_WORK_QUERY, mapWorkResult } from '@/lib/student-work-result';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}
export async function GET(request: Request) {
  try {
    const student = await authenticatedStudent(request);
    if (!student) return json({ ok: false, error: 'session_required' }, 401);
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(key => key !== 'sessionId'))
      return json({ ok: false, error: 'student_scope_rejected' }, 403);
    const sessionId = url.searchParams.get('sessionId');
    if (sessionId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId))
      return json({ ok: false, error: 'work_result_not_found' }, 404);
    const gate = await allowRequest(request, 'student-work-results', 60, 60_000, student.student_id);
    if (!gate.allowed) return rateLimited(gate);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
    const rows = isolatedQaEnabled()
      ? await qaDemoRead(request, 'completed_results', { sessionId })
      : await neon(process.env.DATABASE_URL).query(COMPLETED_WORK_QUERY, [student.academy_id, student.student_id, sessionId]);
    if (sessionId && !rows.length) return json({ ok: false, error: 'work_result_not_found' }, 404);
    return json({ ok: true, results: rows.map(mapWorkResult) });
  } catch (error) {
    return demoReadDenied(error)
      ? json({ ok: false, error: 'student_read_forbidden' }, 403)
      : json({ ok: false, error: 'work_results_unavailable' }, 503);
  }
}
