import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  isSpecialProfileCode,
  isTaskAllowedForProfile,
  normalizeSpecialEvidence,
  sanitizeShortText,
  sanitizeStringList,
  specialTemplateCode,
  SPECIAL_MODULE_CODE,
  SPECIAL_TEMPLATE_VERSION,
  type SpecialProfileCode,
} from '@/lib/special-assessment';

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_SUMMARY_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
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
  await sql`ALTER TABLE public.assessment_sessions ADD COLUMN IF NOT EXISTS student_id uuid NULL`;
  await sql`CREATE INDEX IF NOT EXISTS assessment_sessions_student_id_idx ON public.assessment_sessions(student_id)`;

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

async function educatorStudent(sql: any, educatorId: string, studentId: string) {
  const rows = await sql`
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
          AND t.auth_user_id = ${educatorId}
          AND t.is_active = true
      )
    LIMIT 1
  `;
  return rows[0] as { id: string; name?: string; code?: string | null; username?: string | null } | undefined;
}

async function authorizedSession(sql: any, educatorId: string, sessionId: string) {
  const rows = await sql`
    SELECT
      a.id,
      a.student_id,
      a.template_code,
      a.student_label,
      a.status,
      a.current_task_code,
      a.started_at,
      a.completed_at,
      a.metadata
    FROM public.assessment_sessions a
    WHERE a.id = ${sessionId}::uuid
      AND a.template_code LIKE 'CZA_SPECIAL_V1_%'
      AND EXISTS (
        SELECT 1
        FROM public.teacher_student_links l
        JOIN public.users t ON t.id = l.teacher_id
        WHERE l.student_id = a.student_id
          AND l.can_view = true
          AND t.auth_user_id = ${educatorId}
          AND t.is_active = true
      )
    LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

async function sessionBundle(sql: any, educatorId: string, sessionId: string) {
  const session = await authorizedSession(sql, educatorId, sessionId);
  if (!session) return null;
  const attempts = await sql`
    SELECT id, task_code, answer_text, answer_payload, support_level, self_corrected,
           response_latency_ms, total_response_time_ms, shown_at, first_action_at,
           completed_at, created_at
    FROM public.assessment_attempts
    WHERE session_id = ${sessionId}::uuid
    ORDER BY created_at ASC
  `;
  const observations = await sql`
    SELECT id, task_code, observation_codes, educator_note, confidence, created_at
    FROM public.assessment_observations
    WHERE session_id = ${sessionId}::uuid
    ORDER BY created_at ASC
  `;
  return { session, attempts, observations };
}

function profileFromSession(session: Record<string, unknown>): SpecialProfileCode | null {
  const metadata = session.metadata && typeof session.metadata === 'object'
    ? session.metadata as Record<string, unknown>
    : {};
  return isSpecialProfileCode(metadata.profileCode) ? metadata.profileCode : null;
}

function safeSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > MAX_SUMMARY_BYTES) {
    throw new Error('summary_too_large');
  }
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'assessment-special-linked', 180, 10 * 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
  const educatorId = educator.id;
  if (!educatorId) return json({ ok: false, error: 'educator_identity_invalid' }, 401);

  let input: Record<string, unknown>;
  try {
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return json({ ok: false, error: 'request_too_large' }, 413);
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ ok: false, error: 'request_too_large' }, 413);
    }
    input = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const action = typeof input.action === 'string' ? input.action : '';

  try {
    const sql = await db();

    if (action === 'create') {
      const studentId = sanitizeShortText(input.studentId, 80);
      const profileCode = input.profileCode;
      if (!studentId) return json({ ok: false, error: 'student_required' }, 400);
      if (!UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'student_id_invalid' }, 400);
      if (!isSpecialProfileCode(profileCode)) return json({ ok: false, error: 'special_profile_invalid' }, 400);

      const student = await educatorStudent(sql, educatorId, studentId);
      if (!student) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);

      const templateCode = specialTemplateCode(profileCode);
      const existing = await sql`
        SELECT id, student_id, template_code, student_label, status, current_task_code,
               started_at, completed_at, metadata
        FROM public.assessment_sessions
        WHERE student_id = ${student.id}::uuid
          AND template_code = ${templateCode}
          AND status = 'active'
          AND metadata->>'createdByEducatorId' = ${educatorId}
        ORDER BY started_at DESC
        LIMIT 1
      `;
      if (existing.length) {
        const bundle = await sessionBundle(sql, educatorId, String(existing[0].id));
        return json({ ok: true, resumed: true, ...bundle }, 200);
      }

      const studentLabel = String(student.name || student.username || 'Öğrenci').trim().slice(0, 80);
      const metadata = {
        version: SPECIAL_TEMPLATE_VERSION,
        moduleCode: SPECIAL_MODULE_CODE,
        profileCode,
        centralStudentId: student.id,
        campusStudentCode: student.code || null,
        createdByEducatorId: educatorId,
        grade: sanitizeShortText(input.grade, 80) || null,
        readingStage: sanitizeShortText(input.readingStage, 120) || null,
        birthDate: sanitizeShortText(input.birthDate, 20) || null,
        concerns: sanitizeShortText(input.concerns, 2000) || null,
        diagnosticUse: false,
        source: 'EDUCATOR',
      };

      const rows = await sql`
        INSERT INTO public.assessment_sessions (
          student_id, template_code, student_label, current_task_code, metadata
        ) VALUES (
          ${student.id}::uuid,
          ${templateCode},
          ${studentLabel},
          NULL,
          ${JSON.stringify(metadata)}::jsonb
        )
        RETURNING id, student_id, template_code, student_label, status,
                  current_task_code, started_at, completed_at, metadata
      `;

      return json({
        ok: true,
        resumed: false,
        session: rows[0],
        attempts: [],
        observations: [],
        student: {
          id: student.id,
          name: studentLabel,
          code: student.code || null,
          username: student.username || null,
        },
      }, 201);
    }

    const sessionId = sanitizeShortText(input.sessionId, 80);
    if (!sessionId) return json({ ok: false, error: 'session_required' }, 400);
    if (!UUID_PATTERN.test(sessionId)) return json({ ok: false, error: 'session_id_invalid' }, 400);
    const bundle = await sessionBundle(sql, educatorId, sessionId);
    if (!bundle) return json({ ok: false, error: 'special_session_not_found' }, 404);
    const profileCode = profileFromSession(bundle.session);
    if (!profileCode) return json({ ok: false, error: 'special_session_profile_invalid' }, 409);

    if (action === 'get' || action === 'report') {
      return json({ ok: true, profileCode, ...bundle });
    }

    if (action === 'attempt') {
      if (bundle.session.status === 'completed') {
        return json({ ok: false, error: 'session_completed' }, 409);
      }
      const normalized = normalizeSpecialEvidence(profileCode, input);
      const nowIso = new Date().toISOString();
      const existing = await sql`
        SELECT id
        FROM public.assessment_attempts
        WHERE session_id = ${sessionId}::uuid
          AND task_code = ${normalized.taskCode}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (existing.length) {
        await sql`
          UPDATE public.assessment_attempts
          SET answer_text = ${normalized.answerText},
              answer_payload = ${JSON.stringify(normalized.payload)}::jsonb,
              support_level = ${normalized.supportLevelNumber},
              self_corrected = ${normalized.selfCorrected},
              response_latency_ms = ${normalized.responseLatencyMs},
              total_response_time_ms = ${normalized.totalResponseTimeMs},
              completed_at = ${nowIso}::timestamptz
          WHERE id = ${existing[0].id}::uuid
        `;
      } else {
        await sql`
          INSERT INTO public.assessment_attempts (
            session_id, task_code, shown_at, completed_at, answer_text, answer_payload,
            answer_changes, support_level, self_corrected, rubric_scores,
            response_latency_ms, total_response_time_ms
          ) VALUES (
            ${sessionId}::uuid,
            ${normalized.taskCode},
            now(),
            ${nowIso}::timestamptz,
            ${normalized.answerText},
            ${JSON.stringify(normalized.payload)}::jsonb,
            0,
            ${normalized.supportLevelNumber},
            ${normalized.selfCorrected},
            '{}'::jsonb,
            ${normalized.responseLatencyMs},
            ${normalized.totalResponseTimeMs}
          )
        `;
      }

      const flags = sanitizeStringList(input.flags);
      const note = sanitizeShortText(input.note, 4000) || null;
      const confidence = input.confidence == null
        ? null
        : Math.max(1, Math.min(5, Number(input.confidence) || 1));
      const existingObservation = await sql`
        SELECT id
        FROM public.assessment_observations
        WHERE session_id = ${sessionId}::uuid
          AND task_code = ${normalized.taskCode}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (existingObservation.length) {
        await sql`
          UPDATE public.assessment_observations
          SET observation_codes = ${JSON.stringify(flags)}::jsonb,
              educator_note = ${note},
              confidence = ${confidence}
          WHERE id = ${existingObservation[0].id}::uuid
        `;
      } else {
        await sql`
          INSERT INTO public.assessment_observations (
            session_id, task_code, observation_codes, educator_note, confidence
          ) VALUES (
            ${sessionId}::uuid,
            ${normalized.taskCode},
            ${JSON.stringify(flags)}::jsonb,
            ${note},
            ${confidence}
          )
        `;
      }

      const nextTaskCode = sanitizeShortText(input.nextTaskCode, 40);
      if (nextTaskCode && isTaskAllowedForProfile(profileCode, nextTaskCode)) {
        await sql`
          UPDATE public.assessment_sessions
          SET current_task_code = ${nextTaskCode}
          WHERE id = ${sessionId}::uuid
        `;
      }

      return json({ ok: true, updated: existing.length > 0 });
    }

    if (action === 'finish') {
      const attempted = bundle.attempts.length;
      if (!attempted) return json({ ok: false, error: 'special_session_empty' }, 409);
      const summary = safeSummary(input.summary);
      const summaryPatch = summary
        ? { specialEducationSummary: summary, summarySchemaVersion: 1 }
        : { summarySchemaVersion: 1 };
      await sql`
        UPDATE public.assessment_sessions
        SET status = 'completed',
            completed_at = now(),
            current_task_code = NULL,
            metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(summaryPatch)}::jsonb
        WHERE id = ${sessionId}::uuid
      `;
      return json({ ok: true, completed: true, attempted });
    }

    return json({ ok: false, error: 'invalid_action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'special_assessment_unavailable';
    if (message === 'special_task_not_allowed') return json({ ok: false, error: message }, 400);
    if (message === 'summary_too_large') return json({ ok: false, error: message }, 413);
    return json({ ok: false, error: message }, 500);
  }
}
