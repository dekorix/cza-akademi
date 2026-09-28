import { neon } from '@neondatabase/serverless';
import { assessmentTasks } from '@/lib/assessment-routing';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function assessmentDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('database_unavailable');
  return neon(url);
}

export async function POST(request: Request) {
  const gate = await allowRequest(request, 'assessment-linked-create', 20, 60_000);
  if (!gate.allowed) return rateLimited(gate);

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : '';
  if (!studentId) return json({ ok: false, error: 'student_required' }, 400);

  try {
    const sql = assessmentDb();
    const students = await sql`
      SELECT
        s.id,
        concat_ws(' ', s.first_name, s.last_name) AS name,
        i.identifier_value AS code,
        student_user.username
      FROM public.users educator_user
      JOIN public.teacher_student_links link
        ON link.teacher_id = educator_user.id
       AND link.academy_id = educator_user.academy_id
       AND link.can_view = true
      JOIN public.students s
        ON s.id = link.student_id
       AND s.academy_id = educator_user.academy_id
      LEFT JOIN public.users student_user ON student_user.id = s.user_id
      LEFT JOIN public.student_external_identifiers i
        ON i.student_id = s.id
       AND i.identifier_type = 'campus_student_code'
      WHERE educator_user.auth_user_id = ${educator.id}::uuid
        AND educator_user.is_active = true
        AND educator_user.role::text = 'educator'
        AND s.id = ${studentId}::uuid
      LIMIT 1
    `;

    if (!students.length) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);

    const student = students[0] as { id: string; name?: string; code?: string | null; username?: string | null };
    const studentLabel = String(student.name || student.username || 'Öğrenci').trim().slice(0, 80);
    const firstTask = assessmentTasks[0]?.id ?? null;
    const metadata = {
      version: 5,
      stations: ['WARMUP', 'MATHEMATICS', 'LANGUAGE', 'COGNITIVE'],
      learningResponseVersion: 1,
      reportVersion: 1,
      czaCoreIntegrationVersion: 1,
      moduleCode: 'development_assessment',
      centralStudentId: student.id,
      campusStudentCode: student.code || null,
      createdByEducatorId: educator.id,
    };

    const rows = await sql`
      INSERT INTO public.assessment_sessions (
        student_id,
        template_code,
        student_label,
        current_task_code,
        metadata
      ) VALUES (
        ${student.id}::uuid,
        'CZA_1_TO_2_V1',
        ${studentLabel},
        ${firstTask},
        ${JSON.stringify(metadata)}::jsonb
      )
      RETURNING id, student_id, template_code, student_label, status, current_task_code, started_at, metadata
    `;

    return json({
      ok: true,
      session: rows[0],
      student: {
        id: student.id,
        name: studentLabel,
        code: student.code || null,
        username: student.username || null,
      },
      tasks: assessmentTasks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'assessment_link_unavailable';
    return json({ ok: false, error: message }, 500);
  }
}
