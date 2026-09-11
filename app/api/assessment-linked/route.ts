import { neon } from '@neondatabase/serverless';
import { assessmentTasks } from '@/lib/assessment-routing';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

async function assessmentDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('database_unavailable');
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS public.assessment_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      template_code text NOT NULL,
      student_label text NULL,
      status text NOT NULL DEFAULT 'active',
      current_task_code text NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`ALTER TABLE public.assessment_sessions ADD COLUMN IF NOT EXISTS student_id uuid NULL`;
  await sql`CREATE INDEX IF NOT EXISTS assessment_sessions_student_id_idx ON public.assessment_sessions(student_id)`;
  return sql;
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'assessment-linked-create', 20, 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

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
    const sql = await assessmentDb();
    const students = await sql`
      SELECT
        s.id,
        concat_ws(' ', s.first_name, s.last_name) AS name,
        i.identifier_value AS code,
        u.username
      FROM public.students s
      LEFT JOIN public.users u ON u.id = s.user_id
      LEFT JOIN public.student_external_identifiers i
        ON i.student_id = s.id AND i.identifier_type = 'campus_student_code'
      WHERE s.id = ${studentId}::uuid
        AND EXISTS (
          SELECT 1
          FROM public.teacher_student_links l
          JOIN public.users t ON t.id = l.teacher_id
          WHERE l.student_id = s.id
            AND l.can_view = true
            AND t.auth_user_id = ${educator.id}
            AND t.is_active = true
        )
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
