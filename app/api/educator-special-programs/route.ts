import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { buildSpecialLearningProfile } from '@/lib/special-learning-profile';
import { buildSpecialEducationProgramDraft } from '@/lib/special-education-program';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function int(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function selectedPriorityKeys(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(String).map(value => value.trim()).filter(Boolean).slice(0, 4);
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'educator-special-programs', 30, 10 * 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  const educator = await authenticatedEducator(request);
  if (!educator?.id) return json({ ok: false, error: 'educator_session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const action = typeof input.action === 'string' ? input.action : '';
  const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : '';
  if (!UUID.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);

  const sql = neon(process.env.DATABASE_URL);

  const authorized = await sql`
    SELECT s.id AS student_id, s.academy_id, t.id AS educator_user_id,
           concat_ws(' ', s.first_name, s.last_name) AS student_name
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id = t.id
      AND l.can_view = true
    JOIN public.students s
      ON s.id = l.student_id
      AND s.academy_id = t.academy_id
    WHERE t.auth_user_id = ${educator.id}
      AND t.is_active = true
      AND s.status = 'active'
      AND s.id = ${studentId}::uuid
    LIMIT 1
  `;
  if (!authorized.length) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);
  const link = authorized[0] as {
    student_id: string;
    academy_id: string;
    educator_user_id: string;
    student_name: string | null;
  };

  if (action === 'list') {
    try {
      const rows = await sql`
        SELECT id, assessment_session_id, profile_code, version, status,
               duration_weeks, sessions_per_week, session_minutes, plan,
               approved_at, starts_at, ends_at, completed_at, cancelled_at, created_at
        FROM public.special_education_programs
        WHERE academy_id = ${link.academy_id}::uuid
          AND student_id = ${studentId}::uuid
        ORDER BY created_at DESC
        LIMIT 30
      `;
      return json({ ok: true, programs: rows });
    } catch {
      return json({ ok: false, error: 'special_program_schema_unavailable' }, 503);
    }
  }

  const assessmentSessionId = typeof input.assessmentSessionId === 'string'
    ? input.assessmentSessionId.trim()
    : '';
  if (!UUID.test(assessmentSessionId)) {
    return json({ ok: false, error: 'invalid_assessment_session_id' }, 400);
  }

  const sessions = await sql`
    SELECT id, template_code, completed_at, metadata
    FROM public.assessment_sessions
    WHERE id = ${assessmentSessionId}::uuid
      AND student_id = ${studentId}::uuid
      AND status = 'completed'
      AND template_code LIKE 'CZA_SPECIAL_V1_%'
    LIMIT 1
  `;
  if (!sessions.length) return json({ ok: false, error: 'special_assessment_not_found' }, 404);

  const session = sessions[0] as {
    id: string;
    template_code: string;
    completed_at: string | null;
    metadata: unknown;
  };
  const [attempts, observations] = await Promise.all([
    sql`
      SELECT task_code, answer_payload, support_level
      FROM public.assessment_attempts
      WHERE session_id = ${assessmentSessionId}::uuid
      ORDER BY created_at ASC
    `,
    sql`
      SELECT task_code, observation_codes
      FROM public.assessment_observations
      WHERE session_id = ${assessmentSessionId}::uuid
      ORDER BY created_at ASC
    `,
  ]);

  const profile = buildSpecialLearningProfile({ session, attempts, observations });
  if (!profile) return json({ ok: false, error: 'special_profile_unavailable' }, 409);
  if (profile.evidenceCount < 2) return json({ ok: false, error: 'insufficient_special_evidence' }, 409);

  const draft = buildSpecialEducationProgramDraft(profile, {
    sessionsPerWeek: int(input.sessionsPerWeek, 3),
    sessionMinutes: int(input.sessionMinutes, 25),
    selectedPriorityKeys: selectedPriorityKeys(input.selectedPriorityKeys),
  });

  if (action === 'preview') {
    let activeProgram = null;
    try {
      const rows = await sql`
        SELECT id, profile_code, version, status, approved_at, starts_at, ends_at
        FROM public.special_education_programs
        WHERE academy_id = ${link.academy_id}::uuid
          AND student_id = ${studentId}::uuid
          AND profile_code = ${profile.profileCode}
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      activeProgram = rows[0] || null;
    } catch {
      activeProgram = null;
    }
    return json({
      ok: true,
      student: { id: studentId, name: link.student_name || 'Öğrenci' },
      profile,
      draft,
      activeProgram,
      educatorApprovalRequired: true,
    });
  }

  if (action === 'create') {
    if (input.confirm !== true) {
      return json({ ok: false, error: 'educator_approval_required' }, 409);
    }

    try {
      const existing = await sql`
        SELECT id
        FROM public.special_education_programs
        WHERE academy_id = ${link.academy_id}::uuid
          AND student_id = ${studentId}::uuid
          AND profile_code = ${profile.profileCode}
          AND status = 'active'
        LIMIT 1
      `;
      if (existing.length) return json({ ok: false, error: 'active_special_program_exists' }, 409);

      const versionRows = await sql`
        SELECT COALESCE(max(version), 0)::int + 1 AS next_version
        FROM public.special_education_programs
        WHERE academy_id = ${link.academy_id}::uuid
          AND student_id = ${studentId}::uuid
          AND profile_code = ${profile.profileCode}
      `;
      const version = Number(versionRows[0]?.next_version || 1);

      const rows = await sql`
        INSERT INTO public.special_education_programs (
          academy_id, student_id, assessment_session_id, profile_code, version,
          status, duration_weeks, sessions_per_week, session_minutes, plan,
          approved_by, approved_at, starts_at, ends_at
        ) VALUES (
          ${link.academy_id}::uuid,
          ${studentId}::uuid,
          ${assessmentSessionId}::uuid,
          ${profile.profileCode},
          ${version},
          'active',
          4,
          ${draft.sessionsPerWeek},
          ${draft.sessionMinutes},
          ${JSON.stringify(draft)}::jsonb,
          ${link.educator_user_id}::uuid,
          now(),
          now(),
          now() + interval '28 days'
        )
        RETURNING id, assessment_session_id, profile_code, version, status,
                  duration_weeks, sessions_per_week, session_minutes, plan,
                  approved_at, starts_at, ends_at, created_at
      `;

      return json({
        ok: true,
        program: rows[0],
        source: {
          assessmentSessionId,
          profileCode: profile.profileCode,
          evidenceCount: profile.evidenceCount,
          educatorApproval: true,
        },
      }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('special_education_programs')) {
        return json({ ok: false, error: 'special_program_schema_unavailable' }, 503);
      }
      return json({ ok: false, error: 'special_program_create_failed' }, 500);
    }
  }

  if (action === 'cancel') {
    const programId = typeof input.programId === 'string' ? input.programId.trim() : '';
    if (!UUID.test(programId)) return json({ ok: false, error: 'invalid_program_id' }, 400);
    try {
      const rows = await sql`
        UPDATE public.special_education_programs
        SET status = 'cancelled', cancelled_at = now(), updated_at = now()
        WHERE id = ${programId}::uuid
          AND academy_id = ${link.academy_id}::uuid
          AND student_id = ${studentId}::uuid
          AND approved_by = ${link.educator_user_id}::uuid
          AND status = 'active'
        RETURNING id
      `;
      if (!rows.length) return json({ ok: false, error: 'special_program_not_found' }, 404);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: 'special_program_schema_unavailable' }, 503);
    }
  }

  return json({ ok: false, error: 'invalid_action' }, 400);
}
