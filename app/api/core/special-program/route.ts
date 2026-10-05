import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { buildSpecialDailyWork } from '@/lib/special-daily-work';
import type { SpecialEducationProgramDraft } from '@/lib/special-education-program';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFLECTIONS = new Set(['EASY', 'OKAY', 'HARD']);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function planOf(value: unknown): SpecialEducationProgramDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const plan = value as SpecialEducationProgramDraft;
  if (!Array.isArray(plan.priorities) || !Array.isArray(plan.weeks)) return null;
  if (plan.durationWeeks !== 4) return null;
  if (!Number.isInteger(plan.sessionsPerWeek) || !Number.isInteger(plan.sessionMinutes)) return null;
  return plan;
}

async function activeProgram(sql: any, student: { student_id: string; academy_id: string }, programId?: string) {
  if (programId && !UUID.test(programId)) return null;
  const rows = programId
    ? await sql`
        SELECT id, assessment_session_id, profile_code, version, duration_weeks,
               sessions_per_week, session_minutes, plan, starts_at, ends_at, status
        FROM public.special_education_programs
        WHERE id = ${programId}::uuid
          AND student_id = ${student.student_id}::uuid
          AND academy_id = ${student.academy_id}::uuid
          AND status = 'active'
          AND starts_at <= now()
          AND ends_at > now()
        LIMIT 1
      `
    : await sql`
        SELECT id, assessment_session_id, profile_code, version, duration_weeks,
               sessions_per_week, session_minutes, plan, starts_at, ends_at, status
        FROM public.special_education_programs
        WHERE student_id = ${student.student_id}::uuid
          AND academy_id = ${student.academy_id}::uuid
          AND status = 'active'
          AND starts_at <= now()
          AND ends_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      `;
  return rows[0] as Record<string, unknown> | undefined;
}

export async function GET(request: Request) {
  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  const programId = new URL(request.url).searchParams.get('program')?.trim() || '';
  const sql = neon(process.env.DATABASE_URL);

  try {
    const program = await activeProgram(sql, student, programId || undefined);
    if (!program) return json({ ok: true, program: null, completedSessions: 0, totalSessions: 0, progress: 0, today: null, activeSession: null });

    const plan = planOf(program.plan);
    if (!plan) return json({ ok: false, error: 'special_program_plan_invalid' }, 409);

    const [countRows, activeRows] = await Promise.all([
      sql`
        SELECT count(*)::int AS completed
        FROM public.special_education_program_sessions
        WHERE program_id = ${String(program.id)}::uuid
          AND student_id = ${student.student_id}::uuid
          AND status = 'completed'
      `,
      sql`
        SELECT id, session_index, week_no, session_in_week, status, plan_snapshot, started_at
        FROM public.special_education_program_sessions
        WHERE program_id = ${String(program.id)}::uuid
          AND student_id = ${student.student_id}::uuid
          AND status = 'in_progress'
        ORDER BY session_index ASC
        LIMIT 1
      `,
    ]);

    const completedSessions = Number(countRows[0]?.completed || 0);
    const totalSessions = plan.durationWeeks * plan.sessionsPerWeek;
    const today = buildSpecialDailyWork(plan, completedSessions);

    return json({
      ok: true,
      program: {
        id: String(program.id),
        profileCode: String(program.profile_code || ''),
        version: Number(program.version || 1),
        startsAt: program.starts_at,
        endsAt: program.ends_at,
        profileLabel: plan.profileLabel,
        durationWeeks: plan.durationWeeks,
        sessionsPerWeek: plan.sessionsPerWeek,
        sessionMinutes: plan.sessionMinutes,
      },
      completedSessions,
      totalSessions,
      progress: totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0,
      today,
      activeSession: activeRows[0] || null,
    });
  } catch {
    return json({ ok: false, error: 'special_program_schema_unavailable' }, 503);
  }
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'student-special-program', 60, 10 * 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const action = typeof input.action === 'string' ? input.action : '';
  const sql = neon(process.env.DATABASE_URL);

  if (action === 'start') {
    const programId = typeof input.programId === 'string' ? input.programId.trim() : '';
    if (!UUID.test(programId)) return json({ ok: false, error: 'invalid_program_id' }, 400);

    try {
      const program = await activeProgram(sql, student, programId);
      if (!program) return json({ ok: false, error: 'special_program_not_found' }, 404);
      const plan = planOf(program.plan);
      if (!plan) return json({ ok: false, error: 'special_program_plan_invalid' }, 409);

      const inProgress = await sql`
        SELECT id, session_index, week_no, session_in_week, status, plan_snapshot, started_at
        FROM public.special_education_program_sessions
        WHERE program_id = ${programId}::uuid
          AND student_id = ${student.student_id}::uuid
          AND status = 'in_progress'
        ORDER BY session_index ASC
        LIMIT 1
      `;
      if (inProgress.length) return json({ ok: true, resumed: true, session: inProgress[0] });

      const countRows = await sql`
        SELECT count(*)::int AS completed
        FROM public.special_education_program_sessions
        WHERE program_id = ${programId}::uuid
          AND student_id = ${student.student_id}::uuid
          AND status = 'completed'
      `;
      const completed = Number(countRows[0]?.completed || 0);
      const today = buildSpecialDailyWork(plan, completed);
      if (!today) return json({ ok: false, error: 'special_program_already_complete' }, 409);

      const inserted = await sql`
        INSERT INTO public.special_education_program_sessions (
          program_id, academy_id, student_id, session_index, week_no, session_in_week,
          status, plan_snapshot, started_at
        ) VALUES (
          ${programId}::uuid,
          ${student.academy_id}::uuid,
          ${student.student_id}::uuid,
          ${today.sessionIndex},
          ${today.week},
          ${today.sessionInWeek},
          'in_progress',
          ${JSON.stringify(today)}::jsonb,
          now()
        )
        ON CONFLICT (program_id, session_index) DO UPDATE
          SET updated_at = now()
        RETURNING id, session_index, week_no, session_in_week, status, plan_snapshot, started_at
      `;
      return json({ ok: true, resumed: false, session: inserted[0], today }, 201);
    } catch {
      return json({ ok: false, error: 'special_program_session_unavailable' }, 503);
    }
  }

  if (action === 'complete') {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
    if (!UUID.test(sessionId)) return json({ ok: false, error: 'invalid_session_id' }, 400);
    const reflection = typeof input.reflection === 'string' ? input.reflection.trim().toUpperCase() : '';
    if (!REFLECTIONS.has(reflection)) return json({ ok: false, error: 'invalid_reflection' }, 400);
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';

    try {
      const sessions = await sql`
        SELECT s.id, s.program_id, s.session_index, p.duration_weeks, p.sessions_per_week
        FROM public.special_education_program_sessions s
        JOIN public.special_education_programs p ON p.id = s.program_id
        WHERE s.id = ${sessionId}::uuid
          AND s.student_id = ${student.student_id}::uuid
          AND s.academy_id = ${student.academy_id}::uuid
          AND s.status = 'in_progress'
          AND p.status = 'active'
        LIMIT 1
      `;
      if (!sessions.length) return json({ ok: false, error: 'special_program_session_not_found' }, 404);
      const current = sessions[0] as Record<string, unknown>;

      await sql`
        UPDATE public.special_education_program_sessions
        SET status = 'completed',
            completed_at = now(),
            updated_at = now(),
            student_reflection = ${JSON.stringify({ reflection, note, source: 'STUDENT', schemaVersion: 1 })}::jsonb
        WHERE id = ${sessionId}::uuid
      `;

      const countRows = await sql`
        SELECT count(*)::int AS completed
        FROM public.special_education_program_sessions
        WHERE program_id = ${String(current.program_id)}::uuid
          AND student_id = ${student.student_id}::uuid
          AND status = 'completed'
      `;
      const completed = Number(countRows[0]?.completed || 0);
      const total = Number(current.duration_weeks || 4) * Number(current.sessions_per_week || 1);
      const programCompleted = completed >= total;

      if (programCompleted) {
        await sql`
          UPDATE public.special_education_programs
          SET status = 'completed', completed_at = now(), updated_at = now()
          WHERE id = ${String(current.program_id)}::uuid
            AND student_id = ${student.student_id}::uuid
            AND status = 'active'
        `;
      }

      return json({
        ok: true,
        completedSessions: completed,
        totalSessions: total,
        progress: total ? Math.round((completed / total) * 100) : 100,
        programCompleted,
        reassessmentDue: programCompleted,
      });
    } catch {
      return json({ ok: false, error: 'special_program_session_unavailable' }, 503);
    }
  }

  return json({ ok: false, error: 'invalid_action' }, 400);
}
