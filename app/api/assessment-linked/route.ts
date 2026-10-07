import { neon } from '@neondatabase/serverless';
import { assessmentTasks } from '@/lib/assessment-routing';
import { t4P2Definition, p2DefinitionStatus } from '@/lib/assessment-definition';
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
  const cycleKey = typeof input.assessmentCycleKey === 'string' ? input.assessmentCycleKey : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cycleKey)) {
    return json({ ok: false, error: 'assessment_cycle_key_required' }, 400);
  }

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
      WHERE educator_user.auth_user_id::text = ${educator.id}::text
        AND educator_user.is_active = true
        AND educator_user.role::text IN ('admin','teacher','educator')
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

    // The session and its outbox event are committed by one database statement.
    // Any duplicate initial cycle returns the same session without resetting its lifecycle.
    const rows = await sql`
      WITH session_row AS (
        INSERT INTO public.assessment_sessions (
          student_id, template_code, student_label, current_task_code,
          metadata, definition_contract, assessment_cycle_key, assessment_cycle_type
        )
        SELECT ${student.id}::uuid, 'CZA_1_TO_2_V1', ${studentLabel}, ${firstTask},
          ${JSON.stringify(metadata)}::jsonb,
          ${JSON.stringify(t4P2Definition())}::jsonb,
          ${cycleKey}::uuid, 'INITIAL'
        WHERE NOT EXISTS (
          SELECT 1 FROM public.assessment_sessions legacy
          WHERE legacy.student_id = ${student.id}::uuid
            AND legacy.template_code = 'CZA_1_TO_2_V1'
            AND legacy.assessment_cycle_type IS NULL
        ) OR EXISTS (
          SELECT 1 FROM public.assessment_sessions initial
          WHERE initial.student_id = ${student.id}::uuid
            AND initial.template_code = 'CZA_1_TO_2_V1'
            AND initial.assessment_cycle_type = 'INITIAL'
        )
        ON CONFLICT (student_id, template_code, assessment_cycle_type)
          WHERE assessment_cycle_type IS NOT NULL
        DO UPDATE SET id = public.assessment_sessions.id
        RETURNING id, student_id, template_code, student_label, status,
                  current_task_code, started_at, metadata, definition_contract
      ),
      event_row AS (
        INSERT INTO public.assessment_session_outbox (session_id, event_type)
        SELECT id, 'P2_ASSESSMENT_SESSION_CREATED' FROM session_row
        ON CONFLICT (session_id, event_type) DO NOTHING
        RETURNING id
      )
      SELECT session_row.*, EXISTS(SELECT 1 FROM event_row) AS event_created
      FROM session_row
    `;
    if (!rows.length) return json({ ok: false, error: 'legacy_initial_requires_explicit_cycle' }, 409);
    const definitionStatus = p2DefinitionStatus(rows[0].definition_contract);
    if (definitionStatus === 'mismatch') {
      return json({ ok: false, error: 'assessment_definition_mismatch' }, 409);
    }
    const { event_created: eventCreated, ...session } = rows[0];
    return json({
      ok: true,
      session,
      replayed: !eventCreated,
      student: {
        id: student.id,
        name: studentLabel,
        code: student.code || null,
        username: student.username || null,
      },
      tasks: assessmentTasks,
    });
  } catch {
    return json({ ok: false, error: 'assessment_link_unavailable' }, 503);
  }
}
