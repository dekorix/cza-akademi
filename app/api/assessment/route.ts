import { neon } from '@neondatabase/serverless';
import { warmupTasks } from '@/lib/assessment-engine';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
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
  await sql`
    CREATE TABLE IF NOT EXISTS public.assessment_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      task_code text NOT NULL,
      shown_at timestamptz NOT NULL DEFAULT now(),
      first_action_at timestamptz NULL,
      completed_at timestamptz NULL,
      answer_text text NULL,
      answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_changes integer NOT NULL DEFAULT 0,
      support_level integer NOT NULL DEFAULT 0,
      self_corrected boolean NOT NULL DEFAULT false,
      rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      response_latency_ms integer NULL,
      total_response_time_ms integer NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.assessment_observations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      task_code text NOT NULL,
      observation_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
      educator_note text NULL,
      confidence integer NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  return sql;
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const action = typeof input.action === 'string' ? input.action : '';
  try {
    const sql = await db();

    if (action === 'create') {
      const studentLabel = typeof input.studentLabel === 'string' ? input.studentLabel.slice(0, 80) : 'Pilot öğrenci';
      const firstTask = warmupTasks[0]?.id ?? null;
      const rows = await sql`
        INSERT INTO public.assessment_sessions (template_code, student_label, current_task_code)
        VALUES ('CZA_1_TO_2_V1', ${studentLabel}, ${firstTask})
        RETURNING id, template_code, student_label, status, current_task_code, started_at
      `;
      return json({ ok: true, session: rows[0], tasks: warmupTasks });
    }

    if (action === 'get') {
      const sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
      if (!sessionId) return json({ ok: false, error: 'session_required' }, 400);
      const sessions = await sql`
        SELECT id, template_code, student_label, status, current_task_code, started_at, completed_at, metadata
        FROM public.assessment_sessions WHERE id = ${sessionId}::uuid LIMIT 1
      `;
      if (!sessions.length) return json({ ok: false, error: 'session_not_found' }, 404);
      const attempts = await sql`
        SELECT * FROM public.assessment_attempts
        WHERE session_id = ${sessionId}::uuid ORDER BY created_at ASC
      `;
      const observations = await sql`
        SELECT * FROM public.assessment_observations
        WHERE session_id = ${sessionId}::uuid ORDER BY created_at ASC
      `;
      return json({ ok: true, session: sessions[0], attempts, observations, tasks: warmupTasks });
    }

    if (action === 'attempt') {
      const sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode : '';
      if (!sessionId || !taskCode) return json({ ok: false, error: 'missing_fields' }, 400);
      const shownAt = typeof input.shownAt === 'number' ? new Date(input.shownAt) : new Date();
      const firstActionAt = typeof input.firstActionAt === 'number' ? new Date(input.firstActionAt) : null;
      const completedAt = typeof input.completedAt === 'number' ? new Date(input.completedAt) : new Date();
      const answerText = typeof input.answerText === 'string' ? input.answerText.slice(0, 4000) : null;
      const answerChanges = Number(input.answerChanges ?? 0);
      const supportLevel = Math.max(0, Math.min(5, Number(input.supportLevel ?? 0)));
      const selfCorrected = Boolean(input.selfCorrected);
      const rubricScores = typeof input.rubricScores === 'object' && input.rubricScores ? input.rubricScores : {};
      const responseLatencyMs = firstActionAt ? Math.max(0, firstActionAt.getTime() - shownAt.getTime()) : null;
      const totalResponseTimeMs = Math.max(0, completedAt.getTime() - shownAt.getTime());
      await sql`
        INSERT INTO public.assessment_attempts (
          session_id, task_code, shown_at, first_action_at, completed_at, answer_text,
          answer_changes, support_level, self_corrected, rubric_scores,
          response_latency_ms, total_response_time_ms
        ) VALUES (
          ${sessionId}::uuid, ${taskCode}, ${shownAt.toISOString()}::timestamptz,
          ${firstActionAt ? firstActionAt.toISOString() : null}::timestamptz,
          ${completedAt.toISOString()}::timestamptz, ${answerText}, ${answerChanges},
          ${supportLevel}, ${selfCorrected}, ${JSON.stringify(rubricScores)}::jsonb,
          ${responseLatencyMs}, ${totalResponseTimeMs}
        )
      `;
      if (typeof input.nextTaskCode === 'string') {
        await sql`UPDATE public.assessment_sessions SET current_task_code = ${input.nextTaskCode} WHERE id = ${sessionId}::uuid`;
      }
      return json({ ok: true });
    }

    if (action === 'observe') {
      const sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode : '';
      const codes = Array.isArray(input.observationCodes) ? input.observationCodes.map(String).slice(0, 20) : [];
      const note = typeof input.educatorNote === 'string' ? input.educatorNote.slice(0, 4000) : null;
      const confidence = input.confidence == null ? null : Math.max(1, Math.min(5, Number(input.confidence)));
      if (!sessionId || !taskCode) return json({ ok: false, error: 'missing_fields' }, 400);
      await sql`
        INSERT INTO public.assessment_observations (session_id, task_code, observation_codes, educator_note, confidence)
        VALUES (${sessionId}::uuid, ${taskCode}, ${JSON.stringify(codes)}::jsonb, ${note}, ${confidence})
      `;
      return json({ ok: true });
    }

    if (action === 'finish') {
      const sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
      if (!sessionId) return json({ ok: false, error: 'session_required' }, 400);
      await sql`
        UPDATE public.assessment_sessions
        SET status = 'completed', completed_at = now(), current_task_code = NULL
        WHERE id = ${sessionId}::uuid
      `;
      return json({ ok: true });
    }

    return json({ ok: false, error: 'invalid_action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'assessment_unavailable';
    return json({ ok: false, error: message }, 500);
  }
}
