import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedStudent } from '@/lib/student-session';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: Request) {
  const gate = allowRequest(request, 'student-history', 60, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  const sql = neon(process.env.DATABASE_URL);

  try {
    const [summaryRows, records] = await Promise.all([
      sql`
        SELECT
          count(*)::int AS total_records,
          count(DISTINCT module_code)::int AS module_count,
          COALESCE(sum(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000), 0)::float8 AS total_duration_ms,
          max(completed_at) AS latest_completed_at
        FROM public.learning_records
        WHERE academy_id = ${student.academy_id}::uuid
          AND student_id = ${student.student_id}::uuid
      `,
      sql`
        SELECT
          id,
          training_session_id,
          module_code,
          module_version,
          activity_type,
          started_at,
          completed_at,
          support_level,
          performance,
          skills,
          metadata
        FROM public.learning_records
        WHERE academy_id = ${student.academy_id}::uuid
          AND student_id = ${student.student_id}::uuid
        ORDER BY completed_at DESC, created_at DESC
        LIMIT 30
      `,
    ]);

    const summary = summaryRows[0] as {
      total_records?: number;
      module_count?: number;
      total_duration_ms?: number;
      latest_completed_at?: string | null;
    } | undefined;

    return json({
      ok: true,
      summary: {
        totalRecords: Number(summary?.total_records || 0),
        moduleCount: Number(summary?.module_count || 0),
        totalDurationMs: Math.max(0, Number(summary?.total_duration_ms || 0)),
        latestCompletedAt: summary?.latest_completed_at || null,
      },
      records,
    });
  } catch {
    return json({ ok: false, error: 'learning_history_unavailable' }, 503);
  }
}
