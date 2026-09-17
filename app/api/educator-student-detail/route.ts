import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function timestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 32)
    : [];
}

export async function GET(request: Request) {
  const gate = await allowRequest(request, 'educator-student-detail', 30, 60_000);
  if (!gate.allowed) return rateLimited(gate);
  try {
    const educator = await authenticatedEducator(request);
    if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
    const studentId = new URL(request.url).searchParams.get('studentId')?.trim() || '';
    if (!UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);
    if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

    const sql = neon(process.env.DATABASE_URL);
    const authorized = await sql`
      SELECT s.id, s.academy_id, concat_ws(' ', s.first_name, s.last_name) AS name,
             student_user.username, campus.identifier_value AS campus_code
      FROM public.users AS educator_user
      JOIN public.teacher_student_links AS link
        ON link.teacher_id = educator_user.id AND link.can_view = true
      JOIN public.students AS s
        ON s.id = link.student_id AND s.academy_id = educator_user.academy_id
      LEFT JOIN public.users AS student_user ON student_user.id = s.user_id
      LEFT JOIN public.student_external_identifiers AS campus
        ON campus.student_id = s.id AND campus.identifier_type = 'campus_student_code'
      WHERE educator_user.auth_user_id = ${educator.id}
        AND educator_user.is_active = true
        AND s.status = 'active'
        AND s.id = ${studentId}::uuid
      LIMIT 1
    `;
    if (!authorized.length) return json({ ok: false, error: 'student_not_authorized' }, 403);

    const student = authorized[0] as Record<string, unknown>;
    const academyId = String(student.academy_id);
    const [workRows, attemptRows, historyRows, evidenceRows] = await Promise.all([
      sql`
        SELECT recipe.id, recipe.name, recipe.module_code, recipe.source,
               recipe.is_active, recipe.starts_at, recipe.expires_at,
               session.id AS session_id, session.status AS session_status,
               session.started_at, session.completed_at, session.progress
        FROM public.training_recipes AS recipe
        LEFT JOIN LATERAL (
          SELECT candidate.id, candidate.status, candidate.started_at,
                 candidate.completed_at, candidate.progress
          FROM public.training_sessions AS candidate
          WHERE candidate.academy_id = recipe.academy_id
            AND candidate.student_id = recipe.student_id
            AND candidate.recipe_id = recipe.id
          ORDER BY candidate.started_at DESC, candidate.id DESC LIMIT 1
        ) AS session ON true
        WHERE recipe.academy_id = ${academyId}::uuid
          AND recipe.student_id = ${studentId}::uuid
        ORDER BY recipe.is_active DESC, recipe.created_at DESC, recipe.id DESC
        LIMIT 50
      `,
      sql`
        SELECT id, training_session_id, module_code, question_index, question_id,
               is_correct, error_type, error_detail, total_response_time_ms,
               learning_mode, created_at
        FROM public.question_attempts
        WHERE academy_id = ${academyId}::uuid AND student_id = ${studentId}::uuid
        ORDER BY created_at DESC, id DESC LIMIT 50
      `,
      sql`
        SELECT id, training_session_id, module_code, record_origin,
               verification_status, completed_at, support_level,
               performance, skills
        FROM public.learning_records
        WHERE academy_id = ${academyId}::uuid AND student_id = ${studentId}::uuid
        ORDER BY completed_at DESC, id DESC LIMIT 50
      `,
      sql`
        SELECT id, learning_record_id, evidence_type, verification_status,
               verification_authority, skill_code, support_level,
               observed_at, payload
        FROM public.learning_evidence
        WHERE academy_id = ${academyId}::uuid AND student_id = ${studentId}::uuid
        ORDER BY observed_at DESC, id DESC LIMIT 50
      `,
    ]);

    const works = workRows.map((row) => ({
      id: String(row.id), name: String(row.name), moduleCode: String(row.module_code),
      source: String(row.source), active: row.is_active === true,
      startsAt: timestamp(row.starts_at), expiresAt: timestamp(row.expires_at),
      session: row.session_id ? {
        id: String(row.session_id), status: String(row.session_status),
        startedAt: timestamp(row.started_at), completedAt: timestamp(row.completed_at),
        progress: row.progress && typeof row.progress === 'object' ? row.progress : {},
      } : null,
    }));
    const attempts = attemptRows.map((row) => ({
      id: String(row.id), sessionId: String(row.training_session_id),
      moduleCode: String(row.module_code), questionIndex: Number(row.question_index),
      questionId: String(row.question_id), isCorrect: row.is_correct === true,
      errorType: String(row.error_type),
      errorDetail: typeof row.error_detail === 'string' ? row.error_detail : null,
      responseTimeMs: Number(row.total_response_time_ms) || null,
      learningMode: typeof row.learning_mode === 'string' ? row.learning_mode : null,
      createdAt: timestamp(row.created_at), provenance: 'client_reported' as const,
    }));
    const history = historyRows.map((row) => ({
      id: String(row.id), sessionId: String(row.training_session_id),
      moduleCode: String(row.module_code), recordOrigin: String(row.record_origin),
      verificationStatus: String(row.verification_status),
      completedAt: timestamp(row.completed_at), supportLevel: String(row.support_level),
      performance: row.performance && typeof row.performance === 'object' ? row.performance : {},
      skills: stringArray(row.skills),
    }));
    const evidence = evidenceRows.map((row) => ({
      id: String(row.id), learningRecordId: String(row.learning_record_id),
      type: String(row.evidence_type), verificationStatus: String(row.verification_status),
      verificationAuthority: typeof row.verification_authority === 'string' ? row.verification_authority : null,
      skillCode: typeof row.skill_code === 'string' ? row.skill_code : null,
      supportLevel: String(row.support_level), observedAt: timestamp(row.observed_at),
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    }));
    const reportedSkills = [...new Set(history.flatMap((record) => record.skills))].sort();
    const verifiedSkills = [...new Set(evidence
      .filter((item) => item.verificationStatus === 'server_verified' && item.skillCode)
      .map((item) => item.skillCode as string))].sort();

    return json({
      ok: true,
      student: {
        id: String(student.id),
        name: typeof student.name === 'string' && student.name.trim() ? student.name : 'Öğrenci',
        username: typeof student.username === 'string' ? student.username : null,
        campusCode: typeof student.campus_code === 'string' ? student.campus_code : null,
      },
      work: {
        active: works.filter((item) => item.active && item.session?.status !== 'completed'),
        completed: works.filter((item) => item.session?.status === 'completed'),
      },
      attempts,
      errors: attempts.filter((attempt) => !attempt.isCorrect),
      evidence,
      history,
      learningProfile: {
        clientReportedSkills: reportedSkills,
        serverVerifiedSkills: verifiedSkills,
        clientReportedRecordCount: history.filter((record) => record.verificationStatus === 'client_reported').length,
        serverVerifiedEvidenceCount: evidence.filter((item) => item.verificationStatus === 'server_verified').length,
      },
    });
  } catch {
    return json({ ok: false, error: 'student_detail_unavailable' }, 503);
  }
}
