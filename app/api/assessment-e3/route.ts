import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  E3_TEMPLATE_CODE,
  buildE3SectionReport,
  e3CaregiverQuestions,
  e3FirstMatch,
  e3NextSection,
  e3NextTask,
  e3ReportDisclaimer,
  e3Sections,
  e3Tasks,
  type E3Evidence,
  type E3SectionId,
  type E3SupportLevel,
} from '@/lib/preschool-e3';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const supportToNumber: Record<E3SupportLevel, number> = {
  INDEPENDENT: 0,
  VERBAL_PROMPT: 1,
  VISUAL_PROMPT: 2,
  MODELED: 3,
  PHYSICAL_ASSIST: 4,
  NOT_OBSERVED: 5,
  NOT_ASSESSED: 5,
};

function validSupport(value: unknown): E3SupportLevel {
  const allowed: E3SupportLevel[] = ['INDEPENDENT','VERBAL_PROMPT','VISUAL_PROMPT','MODELED','PHYSICAL_ASSIST','NOT_OBSERVED','NOT_ASSESSED'];
  return allowed.includes(value as E3SupportLevel) ? value as E3SupportLevel : 'NOT_ASSESSED';
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

function evidenceFromRows(rows: Record<string, unknown>[]): E3Evidence[] {
  return rows.flatMap((row) => {
    const taskCode = String(row.task_code || '');
    const task = e3Tasks.find((item) => item.id === taskCode);
    if (!task) return [];
    const payload = row.answer_payload && typeof row.answer_payload === 'object' ? row.answer_payload as Record<string, unknown> : {};
    return [{
      taskId: taskCode,
      sectionId: task.sectionId,
      supportLevel: validSupport(payload.supportLevel),
      firstMatch: typeof payload.firstMatch === 'boolean' ? payload.firstMatch : null,
      latencyMs: typeof row.response_latency_ms === 'number' ? row.response_latency_ms : null,
      touches: typeof payload.touches === 'number' ? payload.touches : null,
      note: typeof payload.note === 'string' ? payload.note : undefined,
      neutralProbe: task.neutralProbe === true,
    }];
  });
}

async function sessionBundle(sql: ReturnType<typeof neon>, sessionId: string) {
  const sessions = await sql`
    SELECT id, student_id, template_code, student_label, status, current_task_code,
           started_at, completed_at, metadata
    FROM public.assessment_sessions
    WHERE id = ${sessionId}::uuid AND template_code = ${E3_TEMPLATE_CODE}
    LIMIT 1
  `;
  if (!sessions.length) return null;
  const attempts = await sql`
    SELECT id, task_code, answer_text, answer_payload, support_level, response_latency_ms,
           total_response_time_ms, shown_at, first_action_at, completed_at, created_at
    FROM public.assessment_attempts
    WHERE session_id = ${sessionId}::uuid
    ORDER BY created_at ASC
  `;
  return { session: sessions[0] as Record<string, unknown>, attempts: attempts as Record<string, unknown>[] };
}

function currentContent(currentTaskCode: string | null) {
  if (!currentTaskCode) return { task: null, caregiverQuestion: null };
  const task = e3Tasks.find((item) => item.id === currentTaskCode) ?? null;
  const caregiverQuestion = e3CaregiverQuestions.find(([code]) => `E3-${code}` === currentTaskCode) ?? null;
  return { task, caregiverQuestion };
}

function caregiverRows(rows: Record<string, unknown>[]) {
  return rows.filter((row) => String(row.task_code || '').startsWith('E3-CG-'));
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'assessment-e3', 120, 10 * 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const action = typeof input.action === 'string' ? input.action : '';
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
  if (!sessionId) return json({ ok: false, error: 'session_required' }, 400);

  try {
    const sql = await db();
    const bundle = await sessionBundle(sql, sessionId);
    if (!bundle) return json({ ok: false, error: 'e3_session_not_found' }, 404);
    const metadata = bundle.session.metadata && typeof bundle.session.metadata === 'object' ? bundle.session.metadata as Record<string, unknown> : {};
    const ageMonths = Number(metadata.ageMonths);
    if (!Number.isInteger(ageMonths) || ageMonths < 36 || ageMonths > 47) return json({ ok: false, error: 'e3_session_age_invalid' }, 409);

    if (action === 'get') {
      const currentTaskCode = typeof bundle.session.current_task_code === 'string' ? bundle.session.current_task_code : null;
      return json({
        ok: true,
        session: bundle.session,
        ...currentContent(currentTaskCode),
        sections: e3Sections,
        evidence: evidenceFromRows(bundle.attempts),
        caregiverAnswered: caregiverRows(bundle.attempts).length,
        caregiverTotal: e3CaregiverQuestions.length,
      });
    }

    if (action === 'attempt') {
      if (bundle.session.status === 'completed') return json({ ok: false, error: 'session_completed' }, 409);
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode.trim() : '';
      const task = e3Tasks.find((item) => item.id === taskCode);
      if (!task) return json({ ok: false, error: 'e3_task_not_found' }, 404);
      if (bundle.session.current_task_code !== task.id) return json({ ok: false, error: 'e3_task_out_of_sequence' }, 409);
      if (task.minMonth > ageMonths) return json({ ok: false, error: 'e3_task_not_age_eligible' }, 409);

      const shownAtMs = typeof input.shownAt === 'number' ? input.shownAt : Date.now();
      const firstActionMs = typeof input.firstActionAt === 'number' ? input.firstActionAt : null;
      const completedAtMs = typeof input.completedAt === 'number' ? input.completedAt : Date.now();
      const shownAt = new Date(shownAtMs);
      const firstActionAt = firstActionMs == null ? null : new Date(firstActionMs);
      const completedAt = new Date(completedAtMs);
      const answerText = typeof input.answerText === 'string' ? input.answerText.slice(0, 2000) : '';
      const supportLevel = validSupport(input.supportLevel);
      const firstMatch = e3FirstMatch(task, answerText);
      const touches = Math.max(0, Math.min(100, Number(input.touches ?? 0)));
      const note = typeof input.note === 'string' ? input.note.slice(0, 2000) : '';
      const responseLatencyMs = firstActionAt ? Math.max(0, firstActionAt.getTime() - shownAt.getTime()) : null;
      const totalResponseTimeMs = Math.max(0, completedAt.getTime() - shownAt.getTime());
      const payload = {
        profileCode: 'E3',
        sectionId: task.sectionId,
        responseMode: task.responseMode,
        supportLevel,
        firstMatch,
        touches,
        note,
        neutralProbe: task.neutralProbe === true,
        evidenceFocus: task.evidenceFocus,
      };

      await sql`
        INSERT INTO public.assessment_attempts (
          session_id, task_code, shown_at, first_action_at, completed_at,
          answer_text, answer_payload, answer_changes, support_level, self_corrected,
          rubric_scores, response_latency_ms, total_response_time_ms
        ) VALUES (
          ${sessionId}::uuid, ${task.id}, ${shownAt.toISOString()}::timestamptz,
          ${firstActionAt ? firstActionAt.toISOString() : null}::timestamptz,
          ${completedAt.toISOString()}::timestamptz, ${answerText || null},
          ${JSON.stringify(payload)}::jsonb, ${Math.max(0, Math.min(100, Number(input.answerChanges ?? 0)))},
          ${supportToNumber[supportLevel]}, ${Boolean(input.selfCorrected)}, '{}'::jsonb,
          ${responseLatencyMs}, ${totalResponseTimeMs}
        )
      `;

      const refreshed = await sessionBundle(sql, sessionId);
      if (!refreshed) return json({ ok: false, error: 'e3_session_not_found' }, 404);
      const evidence = evidenceFromRows(refreshed.attempts);
      let nextTask = e3NextTask(ageMonths, task.sectionId, evidence);
      let nextSection: E3SectionId | null = task.sectionId;
      while (!nextTask) {
        nextSection = e3NextSection(nextSection);
        if (!nextSection) break;
        nextTask = e3NextTask(ageMonths, nextSection, evidence);
      }
      const nextTaskCode = nextTask?.id ?? 'E3-CG-01';
      await sql`UPDATE public.assessment_sessions SET current_task_code = ${nextTaskCode} WHERE id = ${sessionId}::uuid`;
      return json({ ok: true, nextTaskCode, nextTask, childPhaseComplete: !nextTask });
    }

    if (action === 'caregiver') {
      if (bundle.session.status === 'completed') return json({ ok: false, error: 'session_completed' }, 409);
      const questionCode = typeof input.questionCode === 'string' ? input.questionCode.trim() : '';
      const index = e3CaregiverQuestions.findIndex(([code]) => code === questionCode);
      if (index < 0) return json({ ok: false, error: 'caregiver_question_not_found' }, 404);
      const taskCode = `E3-${questionCode}`;
      if (bundle.session.current_task_code !== taskCode) return json({ ok: false, error: 'caregiver_question_out_of_sequence' }, 409);
      const answerText = typeof input.answerText === 'string' ? input.answerText.slice(0, 2000) : '';
      if (!answerText.trim()) return json({ ok: false, error: 'caregiver_answer_required' }, 400);
      const payload = { profileCode: 'E3', source: 'CAREGIVER', category: e3CaregiverQuestions[index][1] };
      await sql`
        INSERT INTO public.assessment_attempts (
          session_id, task_code, completed_at, answer_text, answer_payload,
          answer_changes, support_level, self_corrected, rubric_scores,
          response_latency_ms, total_response_time_ms
        ) VALUES (
          ${sessionId}::uuid, ${taskCode}, now(), ${answerText}, ${JSON.stringify(payload)}::jsonb,
          0, 0, false, '{}'::jsonb, NULL, NULL
        )
      `;
      const next = e3CaregiverQuestions[index + 1];
      const nextTaskCode = next ? `E3-${next[0]}` : null;
      await sql`UPDATE public.assessment_sessions SET current_task_code = ${nextTaskCode} WHERE id = ${sessionId}::uuid`;
      return json({ ok: true, nextTaskCode, caregiverComplete: !next });
    }

    if (action === 'observe') {
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode.trim() : '';
      if (!e3Tasks.some((item) => item.id === taskCode)) return json({ ok: false, error: 'e3_task_not_found' }, 404);
      const codes = Array.isArray(input.observationCodes) ? input.observationCodes.map(String).slice(0, 20) : [];
      const note = typeof input.educatorNote === 'string' ? input.educatorNote.slice(0, 4000) : null;
      const confidence = input.confidence == null ? null : Math.max(1, Math.min(5, Number(input.confidence)));
      await sql`
        INSERT INTO public.assessment_observations (session_id, task_code, observation_codes, educator_note, confidence)
        VALUES (${sessionId}::uuid, ${taskCode}, ${JSON.stringify(codes)}::jsonb, ${note}, ${confidence})
      `;
      return json({ ok: true });
    }

    if (action === 'finish') {
      const currentTaskCode = typeof bundle.session.current_task_code === 'string' ? bundle.session.current_task_code : null;
      const caregiverCount = caregiverRows(bundle.attempts).length;
      if (currentTaskCode || caregiverCount < e3CaregiverQuestions.length) {
        return json({ ok: false, error: 'e3_sources_incomplete', caregiverAnswered: caregiverCount, caregiverTotal: e3CaregiverQuestions.length }, 409);
      }
      await sql`
        UPDATE public.assessment_sessions
        SET status = 'completed', completed_at = now(), current_task_code = NULL
        WHERE id = ${sessionId}::uuid AND template_code = ${E3_TEMPLATE_CODE}
      `;
      return json({ ok: true });
    }

    if (action === 'report') {
      const evidence = evidenceFromRows(bundle.attempts);
      const sections = buildE3SectionReport(evidence);
      const caregiver = caregiverRows(bundle.attempts).map((row) => {
        const code = String(row.task_code || '').replace(/^E3-/, '');
        const question = e3CaregiverQuestions.find(([itemCode]) => itemCode === code);
        return { code, category: question?.[1] || 'Bakımveren', question: question?.[2] || code, answer: String(row.answer_text || '') };
      });
      const childAssessed = sections.reduce((sum, section) => sum + section.assessed, 0);
      return json({
        ok: true,
        session: bundle.session,
        report: {
          profileCode: 'E3',
          ageMonths,
          ageBand: metadata.ageBand,
          assessmentPurpose: metadata.assessmentPurpose,
          childAssessed,
          sections,
          caregiver,
          caregiverCoverage: Math.round(100 * caregiver.length / e3CaregiverQuestions.length),
          disclaimer: e3ReportDisclaimer(),
        },
      });
    }

    return json({ ok: false, error: 'invalid_action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'e3_assessment_unavailable';
    return json({ ok: false, error: message }, 500);
  }
}
