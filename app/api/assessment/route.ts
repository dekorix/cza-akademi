import { neon } from '@neondatabase/serverless';
import { assessmentTasks } from '@/lib/assessment-routing';
import { calculateLearningResponse, type AssessmentAttemptRecord } from '@/lib/assessment-learning-response';
import { generateAssessmentReport, type ReportAttempt, type ReportObservation } from '@/lib/assessment-report';
import { authenticatedStudent } from '@/lib/student-session';
import { authenticatedEducator } from '@/lib/educator-auth';

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

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('database_unavailable');
  return neon(url);
}

type Sql = ReturnType<typeof database>;

function uuid(value: unknown) {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : '';
}

function hasActorOverride(input: Record<string, unknown>) {
  return [
    'student_id',
    'studentId',
    'teacher_id',
    'teacherId',
    'observer_user_id',
    'observerUserId',
    'observer_academy_id',
    'observerAcademyId',
    'observation_origin',
    'observationOrigin',
  ].some((key) => Object.hasOwn(input, key));
}

async function studentSessionAccess(
  sql: Sql,
  sessionId: string,
  student: { student_id: string; academy_id: string },
) {
  const rows = await sql`
    SELECT session.id, session.student_id, session.status
    FROM public.assessment_sessions session
    JOIN public.students student ON student.id = session.student_id
    WHERE session.id = ${sessionId}::uuid
      AND session.student_id = ${student.student_id}::uuid
      AND student.academy_id = ${student.academy_id}::uuid
    LIMIT 1
  `;
  return rows[0] as { id: string; student_id: string; status: string } | undefined;
}

async function educatorSessionAccess(
  sql: Sql,
  sessionId: string,
  educator: { id: string },
) {
  const rows = await sql`
    SELECT
      session.id,
      session.student_id,
      session.status,
      educator.id AS observer_user_id,
      educator.academy_id AS observer_academy_id
    FROM public.assessment_sessions session
    JOIN public.students student ON student.id = session.student_id
    JOIN public.users educator
      ON educator.auth_user_id::text = ${educator.id}::text
     AND educator.is_active = true
     AND educator.role::text = 'educator'
     AND educator.academy_id = student.academy_id
    JOIN public.teacher_student_links link
      ON link.teacher_id = educator.id
     AND link.student_id = student.id
     AND link.academy_id = educator.academy_id
     AND link.can_view = true
    WHERE session.id = ${sessionId}::uuid
    LIMIT 1
  `;
  return rows[0] as {
    id: string;
    student_id: string;
    status: string;
    observer_user_id: string;
    observer_academy_id: string;
  } | undefined;
}

async function readAccess(request: Request, sql: Sql, sessionId: string) {
  const student = await authenticatedStudent(request);
  if (student) {
    const session = await studentSessionAccess(sql, sessionId, student);
    if (session) return { kind: 'student' as const, session };
  }

  const educator = await authenticatedEducator(request);
  if (educator) {
    const session = await educatorSessionAccess(sql, sessionId, educator);
    if (session) return { kind: 'educator' as const, session };
  }

  return null;
}

async function educatorAccess(request: Request, sql: Sql, sessionId: string) {
  const educator = await authenticatedEducator(request);
  if (!educator) return null;
  const session = await educatorSessionAccess(sql, sessionId, educator);
  return session ? { educator, session } : null;
}

function mutable(status: string) {
  return status === 'active';
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    input = (await request.clone().json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const action = typeof input.action === 'string' ? input.action : '';

  if (action === 'create') {
    return json({ ok: false, error: 'assessment_creation_requires_authorized_link' }, 403);
  }

  if (hasActorOverride(input)) {
    return json({ ok: false, error: 'actor_identity_server_derived' }, 400);
  }

  try {
    const sql = database();

    if (action === 'get' || action === 'report') {
      const sessionId = uuid(input.sessionId);
      if (!sessionId) return json({ ok: false, error: 'session_required' }, 400);

      const access = await readAccess(request, sql, sessionId);
      if (!access) return json({ ok: false, error: 'session_not_authorized' }, 403);

      const sessions = await sql`
        SELECT id, student_id, template_code, student_label, status,
               current_task_code, started_at, completed_at, metadata
        FROM public.assessment_sessions
        WHERE id = ${sessionId}::uuid
        LIMIT 1
      `;
      if (!sessions.length) return json({ ok: false, error: 'session_not_found' }, 404);

      const attempts = await sql`
        SELECT *
        FROM public.assessment_attempts
        WHERE session_id = ${sessionId}::uuid
        ORDER BY created_at ASC
      `;
      const observations = await sql`
        SELECT id, session_id, task_code, observation_codes,
               educator_note, confidence, observation_origin, created_at
        FROM public.assessment_observations
        WHERE session_id = ${sessionId}::uuid
        ORDER BY created_at ASC
      `;

      const learningResponse = calculateLearningResponse(
        attempts as AssessmentAttemptRecord[],
        assessmentTasks,
      );
      const report = generateAssessmentReport(
        attempts as ReportAttempt[],
        observations as ReportObservation[],
        assessmentTasks,
        learningResponse,
      );

      if (action === 'report') {
        return json({ ok: true, session: sessions[0], report });
      }
      return json({
        ok: true,
        session: sessions[0],
        attempts,
        observations,
        tasks: assessmentTasks,
        learningResponse,
        report,
      });
    }

    if (action === 'attempt') {
      const sessionId = uuid(input.sessionId);
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode : '';
      if (!sessionId || !taskCode) {
        return json({ ok: false, error: 'missing_fields' }, 400);
      }
      if (!assessmentTasks.some((task) => task.id === taskCode)) {
        return json({ ok: false, error: 'task_not_found' }, 404);
      }

      const student = await authenticatedStudent(request);
      if (!student) return json({ ok: false, error: 'student_session_required' }, 401);

      const shownAt =
        typeof input.shownAt === 'number' ? new Date(input.shownAt) : new Date();
      const firstActionAt =
        typeof input.firstActionAt === 'number' ? new Date(input.firstActionAt) : null;
      const completedAt =
        typeof input.completedAt === 'number' ? new Date(input.completedAt) : new Date();

      if (
        Number.isNaN(shownAt.getTime()) ||
        Number.isNaN(completedAt.getTime()) ||
        (firstActionAt && Number.isNaN(firstActionAt.getTime()))
      ) {
        return json({ ok: false, error: 'invalid_timing' }, 400);
      }

      const answerText =
        typeof input.answerText === 'string' ? input.answerText.slice(0, 4000) : null;
      const answerPayload =
        typeof input.answerPayload === 'object' && input.answerPayload
          ? input.answerPayload
          : {};
      const answerChanges = Math.max(
        0,
        Math.min(1000, Number(input.answerChanges ?? 0)),
      );
      const supportLevel = Math.max(
        0,
        Math.min(5, Number(input.supportLevel ?? 0)),
      );
      const selfCorrected = Boolean(input.selfCorrected);
      const responseLatencyMs = firstActionAt
        ? Math.max(0, firstActionAt.getTime() - shownAt.getTime())
        : null;
      const totalResponseTimeMs = Math.max(
        0,
        completedAt.getTime() - shownAt.getTime(),
      );

      const inserted = await sql`
        INSERT INTO public.assessment_attempts (
          session_id, task_code, shown_at, first_action_at, completed_at,
          answer_text, answer_payload, answer_changes, support_level,
          self_corrected, rubric_scores, response_latency_ms, total_response_time_ms
        )
        SELECT
          session.id,
          ${taskCode},
          ${shownAt.toISOString()}::timestamptz,
          ${firstActionAt ? firstActionAt.toISOString() : null}::timestamptz,
          ${completedAt.toISOString()}::timestamptz,
          ${answerText},
          ${JSON.stringify(answerPayload)}::jsonb,
          ${answerChanges},
          ${supportLevel},
          ${selfCorrected},
          '{}'::jsonb,
          ${responseLatencyMs},
          ${totalResponseTimeMs}
        FROM public.assessment_sessions session
        JOIN public.students student ON student.id = session.student_id
        WHERE session.id = ${sessionId}::uuid
          AND session.status = 'active'
          AND session.student_id = ${student.student_id}::uuid
          AND student.academy_id = ${student.academy_id}::uuid
        RETURNING id
      `;

      if (!inserted.length) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }

      if (typeof input.nextTaskCode === 'string' && input.nextTaskCode) {
        const nextTaskCode = input.nextTaskCode;
        if (!assessmentTasks.some((task) => task.id === nextTaskCode)) {
          return json({ ok: false, error: 'next_task_not_found' }, 400);
        }
        await sql`
          UPDATE public.assessment_sessions session
          SET current_task_code = ${nextTaskCode}
          FROM public.students student
          WHERE session.id = ${sessionId}::uuid
            AND session.student_id = student.id
            AND session.status = 'active'
            AND session.student_id = ${student.student_id}::uuid
            AND student.academy_id = ${student.academy_id}::uuid
        `;
      }

      return json({ ok: true, attemptId: inserted[0].id });
    }

    if (action === 'score') {
      const sessionId = uuid(input.sessionId);
      const attemptId = uuid(input.attemptId);
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode : '';
      if (!sessionId || !attemptId || !taskCode) {
        return json({ ok: false, error: 'missing_fields' }, 400);
      }

      const access = await educatorAccess(request, sql, sessionId);
      if (!access) return json({ ok: false, error: 'educator_not_authorized' }, 403);
      if (!mutable(access.session.status)) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }

      const task = assessmentTasks.find((item) => item.id === taskCode);
      if (!task) return json({ ok: false, error: 'task_not_found' }, 404);

      const rawScores =
        typeof input.rubricScores === 'object' && input.rubricScores
          ? (input.rubricScores as Record<string, unknown>)
          : {};
      const rubricScores: Record<string, number> = {};
      for (const dimension of task.rubric) {
        const raw = rawScores[dimension.id];
        if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
        rubricScores[dimension.id] = Math.max(
          0,
          Math.min(dimension.max, Math.round(raw)),
        );
      }

      const updated = await sql`
        UPDATE public.assessment_attempts attempt
        SET rubric_scores = ${JSON.stringify(rubricScores)}::jsonb
        FROM public.assessment_sessions session
        WHERE attempt.id = ${attemptId}::uuid
          AND attempt.session_id = session.id
          AND session.id = ${sessionId}::uuid
          AND attempt.task_code = ${taskCode}
          AND session.status = 'active'
        RETURNING attempt.id
      `;

      if (!updated.length) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }
      return json({ ok: true, rubricScores });
    }

    if (action === 'observe') {
      const sessionId = uuid(input.sessionId);
      const taskCode = typeof input.taskCode === 'string' ? input.taskCode : '';
      if (!sessionId || !taskCode) {
        return json({ ok: false, error: 'missing_fields' }, 400);
      }
      if (!assessmentTasks.some((task) => task.id === taskCode)) {
        return json({ ok: false, error: 'task_not_found' }, 404);
      }

      const access = await educatorAccess(request, sql, sessionId);
      if (!access) return json({ ok: false, error: 'educator_not_authorized' }, 403);
      if (!mutable(access.session.status)) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }

      const codes = Array.isArray(input.observationCodes)
        ? input.observationCodes.map(String).slice(0, 20)
        : [];
      const note =
        typeof input.educatorNote === 'string'
          ? input.educatorNote.slice(0, 4000)
          : null;
      const confidence =
        input.confidence == null
          ? null
          : Math.max(1, Math.min(5, Number(input.confidence)));

      const inserted = await sql`
        INSERT INTO public.assessment_observations (
          session_id,
          task_code,
          observation_codes,
          educator_note,
          confidence,
          observer_user_id,
          observer_academy_id,
          observation_origin
        )
        SELECT
          session.id,
          ${taskCode},
          ${JSON.stringify(codes)}::jsonb,
          ${note},
          ${confidence},
          ${access.session.observer_user_id}::uuid,
          ${access.session.observer_academy_id}::uuid,
          'educator_observed'
        FROM public.assessment_sessions session
        WHERE session.id = ${sessionId}::uuid
          AND session.status = 'active'
        RETURNING id
      `;

      if (!inserted.length) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }
      return json({
        ok: true,
        observationId: inserted[0].id,
        observationOrigin: 'educator_observed',
      });
    }

    if (action === 'finish') {
      const sessionId = uuid(input.sessionId);
      if (!sessionId) return json({ ok: false, error: 'session_required' }, 400);

      const access = await readAccess(request, sql, sessionId);
      if (!access) return json({ ok: false, error: 'session_not_authorized' }, 403);

      if (access.session.status === 'completed') {
        return json({ ok: true, status: 'completed', replayed: true });
      }
      if (!mutable(access.session.status)) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }

      const updated = await sql`
        UPDATE public.assessment_sessions
        SET status = 'completed',
            completed_at = now(),
            current_task_code = NULL
        WHERE id = ${sessionId}::uuid
          AND status = 'active'
        RETURNING id, status, completed_at
      `;

      if (!updated.length) {
        return json({ ok: false, error: 'assessment_session_not_mutable' }, 409);
      }
      return json({ ok: true, status: 'completed', replayed: false });
    }

    return json({ ok: false, error: 'invalid_action' }, 400);
  } catch {
    return json({ ok: false, error: 'assessment_unavailable' }, 503);
  }
}
