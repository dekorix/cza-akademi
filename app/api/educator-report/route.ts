import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'educator-report', 20, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
  const code = typeof body.studentCode === 'string' ? body.studentCode.trim() : '';
  if (!studentId && !code) return json({ ok: false, error: 'student_reference_required' }, 400);
  if (studentId && !UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  const sql = neon(process.env.DATABASE_URL);
  const allowed = studentId
    ? await sql`
        SELECT s.id, s.first_name, s.last_name, campus.identifier_value AS campus_code
        FROM public.users t
        JOIN public.teacher_student_links l ON l.teacher_id = t.id AND l.can_view = true
        JOIN public.students s ON s.id = l.student_id
        LEFT JOIN public.student_external_identifiers campus
          ON campus.student_id = s.id AND campus.identifier_type = 'campus_student_code'
        WHERE t.auth_user_id = ${educator.id}
          AND t.is_active = true
          AND s.id = ${studentId}::uuid
        LIMIT 1
      `
    : await sql`
        SELECT s.id, s.first_name, s.last_name, i.identifier_value AS campus_code
        FROM public.users t
        JOIN public.teacher_student_links l ON l.teacher_id = t.id AND l.can_view = true
        JOIN public.students s ON s.id = l.student_id
        JOIN public.student_external_identifiers i ON i.student_id = s.id
        WHERE t.auth_user_id = ${educator.id}
          AND t.is_active = true
          AND i.identifier_value = ${code}
        LIMIT 1
      `;

  if (!allowed.length) return json({ ok: false, error: 'student_not_found' }, 404);
  const student = allowed[0] as { id: string; first_name: string | null; last_name: string | null; campus_code?: string | null };

  const [summary, modules, recent] = await Promise.all([
    sql`SELECT count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct,count(*) FILTER(WHERE NOT is_correct)::int wrong,COALESCE(round(100.0*count(*) FILTER(WHERE is_correct)/NULLIF(count(*),0)),0)::int accuracy FROM public.question_attempts WHERE student_id=${student.id}`,
    sql`SELECT module_code,count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct FROM public.question_attempts WHERE student_id=${student.id} GROUP BY module_code ORDER BY module_code`,
    sql`SELECT module_code,target_number,student_numeric_answer,is_correct,error_type,error_detail,total_response_time_ms,created_at,metadata FROM public.question_attempts WHERE student_id=${student.id} ORDER BY created_at DESC LIMIT 30`,
  ]);

  return json({
    ok: true,
    student: {
      id: student.id,
      campusCode: student.campus_code || code || '',
      name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    },
    summary: summary[0],
    modules,
    recent,
  });
}
