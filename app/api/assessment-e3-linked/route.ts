import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { E3_REPORT_VERSION, E3_TASK_BANK_VERSION, E3_TEMPLATE_CODE, e3BandForAge, e3Sections } from '@/lib/preschool-e3';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function completedMonths(birthDate: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) throw new Error('invalid_birth_date');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) throw new Error('invalid_birth_date');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (born > today) throw new Error('invalid_birth_date');
  let months = (today.getUTCFullYear() - year) * 12 + (today.getUTCMonth() - (month - 1));
  if (today.getUTCDate() < day) months -= 1;
  return months;
}

async function db() {
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
  const gate = allowRequest(request, 'assessment-e3-linked-create', 20, 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'request_origin_rejected' }, 403);

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : '';
  const birthDate = typeof input.birthDate === 'string' ? input.birthDate.trim() : '';
  const assessmentPurpose = input.assessmentPurpose === 'LANGUAGE' ? 'LANGUAGE' : 'GENERAL';
  if (!studentId) return json({ ok: false, error: 'student_required' }, 400);
  if (!birthDate) return json({ ok: false, error: 'birth_date_required' }, 400);

  try {
    const ageMonths = completedMonths(birthDate);
    const ageBand = e3BandForAge(ageMonths);
    const sql = await db();
    const students = await sql`
      SELECT s.id, concat_ws(' ', s.first_name, s.last_name) AS name,
             i.identifier_value AS code, u.username
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
    const firstTaskCode = `E3-${e3Sections[0].id.toUpperCase().replace(/_/g, '-')}-01`;
    const metadata = {
      version: 1,
      profileCode: 'E3',
      assessmentPurpose,
      birthDate,
      ageMonths,
      ageBand,
      ageRange: '36-48',
      taskBankVersion: E3_TASK_BANK_VERSION,
      reportVersion: E3_REPORT_VERSION,
      czaCoreIntegrationVersion: 2,
      moduleCode: 'development_assessment',
      centralStudentId: student.id,
      campusStudentCode: student.code || null,
      createdByEducatorId: educator.id,
      sections: e3Sections.map((section) => section.id),
      childSourceRequired: true,
      caregiverSourceRequired: true,
      diagnosticUse: false,
    };

    const rows = await sql`
      INSERT INTO public.assessment_sessions (
        student_id, template_code, student_label, current_task_code, metadata
      ) VALUES (
        ${student.id}::uuid,
        ${E3_TEMPLATE_CODE},
        ${studentLabel},
        ${firstTaskCode},
        ${JSON.stringify(metadata)}::jsonb
      )
      RETURNING id, student_id, template_code, student_label, status, current_task_code, started_at, metadata
    `;

    return json({
      ok: true,
      session: rows[0],
      student: { id: student.id, name: studentLabel, code: student.code || null, username: student.username || null },
      ageMonths,
      ageBand,
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'e3_link_unavailable';
    if (message === 'e3_age_out_of_range') return json({ ok: false, error: message }, 422);
    if (message === 'invalid_birth_date') return json({ ok: false, error: message }, 400);
    return json({ ok: false, error: message }, 500);
  }
}
