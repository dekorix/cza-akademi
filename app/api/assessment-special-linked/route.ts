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
const PRE_ENROLL_UNIQUE_INDEX = 'assessment_sessions_pre_enroll_active_identity_uq';

function validPreEnrollIndex(row: Record<string, unknown> | undefined) {
  if (!row || row.is_unique !== true || row.is_valid !== true ||
      row.is_ready !== true || row.is_live !== true || row.method !== 'btree' ||
      Number(row.key_count) !== 5 || Number(row.attribute_count) !== 5) return false;
  // PostgreSQL keywords can be normalized, but JSON keys and SQL string literals
  // are case-sensitive. Never lowercase values inside single quotes.
  const canonical = (value: unknown) => String(value || '')
    .match(/'(?:''|[^'])*'|[^']+/g)?.map((token) => {
      if (token.startsWith("'")) return token;
      return token.replace(/::text\b/gi, '')
        .replace(/\b(?:IS|NOT|NULL)\b/gi, (keyword) => keyword.toLowerCase())
        .replace(/[()\s]/g, '');
    }).join('') || '';
  const keys = ['academyId', 'createdByEducatorId', 'candidateId', 'cycleId'];
  for (let n = 0; n < keys.length; n++) {
    if (canonical(row['key_' + (n + 1)]) !== canonical(`metadata->>'${keys[n]}'`)) return false;
  }
  if (canonical(row.key_5) !== 'template_code') return false;
  const clauses = String(row.predicate || '').split(/\s+AND\s+/i).map(canonical).sort();
  const expected = [
    'student_idisnull', "status='active'",
    "metadata->>'source'='EDUCATOR_PRE_ENROLLMENT'",
    "metadata->>'candidateId'isnotnull", "metadata->>'cycleId'isnotnull"
  ].map(canonical).sort();
  return clauses.length === expected.length &&
    clauses.every((clause, index) => clause === expected[index]);
}

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
        SELECT 1 FROM public.users t
        WHERE t.auth_user_id = ${educatorId}
          AND t.role = 'educator' AND t.is_active = true
          AND (
            (a.student_id IS NULL
              AND a.metadata->>'createdByEducatorId' = ${educatorId}
              AND a.metadata->>'academyId' = t.academy_id::text)
            OR (a.student_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.teacher_student_links l
              WHERE l.student_id = a.student_id AND l.teacher_id = t.id AND l.can_view = true
            ))
          )
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
  const gate = await allowRequest(request, 'assessment-special-linked', 180, 10 * 60_000);
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
      if (studentId && !UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'student_id_invalid' }, 400);
      if (!isSpecialProfileCode(profileCode)) return json({ ok: false, error: 'special_profile_invalid' }, 400);

      const student = studentId ? await educatorStudent(sql, educatorId, studentId) : undefined;
      if (studentId && !student) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);
      const studentLabel = student
        ? String(student.name || student.username || 'Öğrenci').trim().slice(0, 80)
        : sanitizeShortText(input.studentLabel, 80);
      if (!studentLabel) return json({ ok: false, error: 'student_name_required' }, 400);
      const educatorRows = await sql`
        SELECT academy_id FROM public.users
        WHERE auth_user_id = ${educatorId} AND role = 'educator' AND is_active = true
        LIMIT 1
      `;
      if (!educatorRows.length) return json({ ok: false, error: 'educator_identity_invalid' }, 403);
      const academyId = String(educatorRows[0].academy_id);

      const templateCode = specialTemplateCode(profileCode);
      const candidateId = sanitizeShortText(input.candidateId, 80);
      const cycleId = sanitizeShortText(input.cycleId, 80);
      if (!student && (!UUID_PATTERN.test(candidateId) || !UUID_PATTERN.test(cycleId))) {
        return json({ ok: false, error: 'candidate_cycle_identity_required' }, 400);
      }
      // The database index is the concurrency gate. Refuse candidate writes until
      // the separately approved migration has been applied to this environment.
      if (!student) {
        const indexes = await sql`
          SELECT i.indisunique AS is_unique, i.indisvalid AS is_valid,
                 i.indisready AS is_ready, i.indislive AS is_live,
                 i.indnkeyatts AS key_count, i.indnatts AS attribute_count,
                 am.amname AS method,
                 pg_get_indexdef(i.indexrelid, 1, true) AS key_1,
                 pg_get_indexdef(i.indexrelid, 2, true) AS key_2,
                 pg_get_indexdef(i.indexrelid, 3, true) AS key_3,
                 pg_get_indexdef(i.indexrelid, 4, true) AS key_4,
                 pg_get_indexdef(i.indexrelid, 5, true) AS key_5,
                 pg_get_expr(i.indpred, i.indrelid) AS predicate
          FROM pg_index i
          JOIN pg_class idx ON idx.oid = i.indexrelid
          JOIN pg_namespace ns ON ns.oid = idx.relnamespace
          JOIN pg_am am ON am.oid = idx.relam
          WHERE ns.nspname = 'public' AND idx.relname = ${PRE_ENROLL_UNIQUE_INDEX}
            AND i.indrelid = 'public.assessment_sessions'::regclass
          LIMIT 1
        `;
        if (!validPreEnrollIndex(indexes[0])) {
          return json({ ok: false, error: 'pre_enroll_integrity_schema_missing' }, 503);
        }
      }
      const existing = await sql`
        SELECT id, student_id, template_code, student_label, status, current_task_code,
               started_at, completed_at, metadata
        FROM public.assessment_sessions
        WHERE (
          (${student?.id || null}::uuid IS NOT NULL AND student_id = ${student?.id || null}::uuid)
          OR
          (${student?.id || null}::uuid IS NULL AND student_id IS NULL
            AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
            AND metadata->>'academyId' = ${academyId}
            AND metadata->>'candidateId' = ${candidateId}
            AND metadata->>'cycleId' = ${cycleId})
        )
          AND template_code = ${templateCode}
          AND status = 'active'
          AND metadata->>'createdByEducatorId' = ${educatorId}
        ORDER BY started_at DESC
        LIMIT 1
      `;
      if (existing.length) {
        const bundle = await sessionBundle(sql, educatorId, String(existing[0].id));
        if (!bundle) return json({ ok: false, error: 'special_session_not_found' }, 404);
        return json({ ok: true, resumed: true, ...bundle }, 200);
      }

      const metadata = {
        version: SPECIAL_TEMPLATE_VERSION,
        moduleCode: SPECIAL_MODULE_CODE,
        profileCode,
        centralStudentId: student?.id || null,
        campusStudentCode: student?.code || null,
        createdByEducatorId: educatorId,
        academyId,
        candidateId: student ? null : candidateId,
        cycleId: student ? null : cycleId,
        grade: sanitizeShortText(input.grade, 80) || null,
        readingStage: sanitizeShortText(input.readingStage, 120) || null,
        birthDate: sanitizeShortText(input.birthDate, 20) || null,
        concerns: sanitizeShortText(input.concerns, 2000) || null,
        diagnosticUse: false,
        source: student ? 'EDUCATOR' : 'EDUCATOR_PRE_ENROLLMENT',
      };

      const rows = await sql`
        INSERT INTO public.assessment_sessions (
          student_id, template_code, student_label, current_task_code, metadata
        ) VALUES (
          ${student?.id || null}::uuid,
          ${templateCode},
          ${studentLabel},
          NULL,
          ${JSON.stringify(metadata)}::jsonb
        )
        ON CONFLICT DO NOTHING
        RETURNING id, student_id, template_code, student_label, status,
                  current_task_code, started_at, completed_at, metadata
      `;
      if (!rows.length) {
        // A concurrent request won the same candidate/cycle insert. Read the
        // winner through the normal authorization path, including its evidence.
        const winner = await sql`
          SELECT id FROM public.assessment_sessions
          WHERE student_id IS NULL AND template_code = ${templateCode}
            AND status = 'active'
            AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
            AND metadata->>'academyId' = ${academyId}
            AND metadata->>'createdByEducatorId' = ${educatorId}
            AND metadata->>'candidateId' = ${candidateId}
            AND metadata->>'cycleId' = ${cycleId}
          LIMIT 1
        `;
        if (!winner.length) return json({ ok: false, error: 'special_session_conflict' }, 409);
        const bundle = await sessionBundle(sql, educatorId, String(winner[0].id));
        if (!bundle) return json({ ok: false, error: 'special_session_not_found' }, 404);
        return json({ ok: true, resumed: true, ...bundle }, 200);
      }

      return json({
        ok: true,
        resumed: false,
        session: rows[0],
        attempts: [],
        observations: [],
        student: student ? {
          id: student.id,
          name: studentLabel,
          code: student.code || null,
          username: student.username || null,
        } : { id: null, name: studentLabel },
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
