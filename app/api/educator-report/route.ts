import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { assessmentTasks } from '@/lib/assessment-routing';
import { calculateLearningResponse, type AssessmentAttemptRecord } from '@/lib/assessment-learning-response';
import { generateAssessmentReport, type ReportAttempt, type ReportObservation } from '@/lib/assessment-report';
import { buildCzaWorkRecommendations } from '@/lib/cza-work-recommendations';

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

export async function POST(request: Request) {
  const gate = allowRequest(request, 'educator-report', 20, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const explicitStudentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
  const studentReference = typeof body.studentCode === 'string' ? body.studentCode.trim() : '';
  if (explicitStudentId && !UUID_PATTERN.test(explicitStudentId)) {
    return json({ ok: false, error: 'invalid_student_id' }, 400);
  }
  const studentId = explicitStudentId || (UUID_PATTERN.test(studentReference) ? studentReference : '');
  const code = studentId === studentReference && !explicitStudentId ? '' : studentReference;
  if (!studentId && !code) return json({ ok: false, error: 'student_reference_required' }, 400);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  const sql = neon(process.env.DATABASE_URL);
  const allowed = studentId
    ? await sql`
        SELECT s.id, s.academy_id, s.first_name, s.last_name, campus.identifier_value AS campus_code
        FROM public.users t
        JOIN public.teacher_student_links l ON l.teacher_id = t.id AND l.can_view = true
        JOIN public.students s ON s.id = l.student_id
        LEFT JOIN public.student_external_identifiers campus
          ON campus.student_id = s.id AND campus.identifier_type = 'campus_student_code'
        WHERE t.auth_user_id = ${educator.id}
          AND t.is_active = true
          AND s.id = ${studentId}::uuid
        LIMIT 1
      `
    : await sql`
        SELECT s.id, s.academy_id, s.first_name, s.last_name, i.identifier_value AS campus_code
        FROM public.users t
        JOIN public.teacher_student_links l ON l.teacher_id = t.id AND l.can_view = true
        JOIN public.students s ON s.id = l.student_id
        JOIN public.student_external_identifiers i ON i.student_id = s.id
        WHERE t.auth_user_id = ${educator.id}
          AND t.is_active = true
          AND i.identifier_value = ${code}
        LIMIT 1
      `;

  if (!allowed.length) return json({ ok: false, error: 'student_not_found' }, 404);
  const student = allowed[0] as { id: string; academy_id: string; first_name: string | null; last_name: string | null; campus_code?: string | null };

  const [summary, modules, recent] = await Promise.all([
    sql`SELECT count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct,count(*) FILTER(WHERE NOT is_correct)::int wrong,COALESCE(round(100.0*count(*) FILTER(WHERE is_correct)/NULLIF(count(*),0)),0)::int accuracy FROM public.question_attempts WHERE student_id=${student.id}`,
    sql`SELECT module_code,count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct FROM public.question_attempts WHERE student_id=${student.id} GROUP BY module_code ORDER BY module_code`,
    sql`SELECT module_code,target_number,student_numeric_answer,is_correct,error_type,error_detail,total_response_time_ms,created_at,metadata FROM public.question_attempts WHERE student_id=${student.id} ORDER BY created_at DESC LIMIT 30`,
  ]);

  let learningHistory: unknown[] = [];
  let learningHistoryAvailable = true;
  try {
    learningHistory = await sql`
      SELECT
        id,
        training_session_id,
        module_code,
        module_version,
        activity_type,
        started_at,
        completed_at,
        support_level,
        performance,
        skills,
        metadata
      FROM public.learning_records
      WHERE academy_id = ${student.academy_id}::uuid
        AND student_id = ${student.id}::uuid
      ORDER BY completed_at DESC, created_at DESC
      LIMIT 30
    `;
  } catch {
    learningHistoryAvailable = false;
  }

  let reportInsightsAvailable = true;
  let reportInsights = {
    sessions: 0,
    assignmentSessions: 0,
    independentSessions: 0,
    totalQuestions: 0,
    correct: 0,
    wrong: 0,
    accuracy: 0,
    totalDurationMs: 0,
    timeoutCount: 0,
    retryCount: 0,
  };
  let moduleProgress: unknown[] = [];
  let assignmentProgress = { total: 0, assigned: 0, started: 0, completed: 0 };
  let recentAssignments: unknown[] = [];
  let errorSummary: unknown[] = [];

  try {
    const [insightRows, moduleRows, assignmentRows, assignmentRecentRows, errorRows] = await Promise.all([
      sql`
        SELECT
          count(*)::int AS sessions,
          count(*) FILTER (WHERE metadata->>'source' = 'teacher_assignment')::int AS assignment_sessions,
          count(*) FILTER (WHERE COALESCE(metadata->>'source', '') <> 'teacher_assignment')::int AS independent_sessions,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'total') = 'number' THEN (performance->>'total')::int ELSE 0 END), 0)::int AS total_questions,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'correct') = 'number' THEN (performance->>'correct')::int ELSE 0 END), 0)::int AS correct,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'wrong') = 'number' THEN (performance->>'wrong')::int ELSE 0 END), 0)::int AS wrong,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'durationMs') = 'number' THEN (performance->>'durationMs')::float8 ELSE EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 END), 0)::float8 AS total_duration_ms,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'timeoutCount') = 'number' THEN (performance->>'timeoutCount')::int ELSE 0 END), 0)::int AS timeout_count,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'retryCount') = 'number' THEN (performance->>'retryCount')::int ELSE 0 END), 0)::int AS retry_count
        FROM public.learning_records
        WHERE academy_id = ${student.academy_id}::uuid
          AND student_id = ${student.id}::uuid
      `,
      sql`
        SELECT
          module_code,
          count(*)::int AS sessions,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'total') = 'number' THEN (performance->>'total')::int ELSE 0 END), 0)::int AS total_questions,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'correct') = 'number' THEN (performance->>'correct')::int ELSE 0 END), 0)::int AS correct,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'wrong') = 'number' THEN (performance->>'wrong')::int ELSE 0 END), 0)::int AS wrong,
          COALESCE(sum(CASE WHEN jsonb_typeof(performance->'durationMs') = 'number' THEN (performance->>'durationMs')::float8 ELSE EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 END), 0)::float8 AS total_duration_ms,
          max(completed_at) AS last_completed_at
        FROM public.learning_records
        WHERE academy_id = ${student.academy_id}::uuid
          AND student_id = ${student.id}::uuid
        GROUP BY module_code
        ORDER BY max(completed_at) DESC
      `,
      sql`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1 FROM public.training_sessions ts WHERE ts.recipe_id = tr.id
            )
          )::int AS assigned,
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM public.training_sessions ts WHERE ts.recipe_id = tr.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed'
            )
          )::int AS started,
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed'
            )
          )::int AS completed
        FROM public.training_recipes tr
        WHERE tr.academy_id = ${student.academy_id}::uuid
          AND tr.student_id = ${student.id}::uuid
          AND tr.source = 'teacher_assignment'
      `,
      sql`
        SELECT
          tr.id,
          tr.module_code,
          tr.name,
          tr.created_at,
          tr.expires_at,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM public.training_sessions ts
              WHERE ts.recipe_id = tr.id AND ts.status = 'completed'
            ) THEN 'completed'
            WHEN EXISTS (
              SELECT 1 FROM public.training_sessions ts
              WHERE ts.recipe_id = tr.id
            ) THEN 'started'
            ELSE 'assigned'
          END AS status,
          (SELECT count(*)::int FROM public.training_sessions ts WHERE ts.recipe_id = tr.id) AS session_count,
          (SELECT max(ts.completed_at) FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed') AS last_completed_at
        FROM public.training_recipes tr
        WHERE tr.academy_id = ${student.academy_id}::uuid
          AND tr.student_id = ${student.id}::uuid
          AND tr.source = 'teacher_assignment'
        ORDER BY tr.created_at DESC
        LIMIT 12
      `,
      sql`
        SELECT COALESCE(error_type, 'RESPONSE_ERROR') AS error_type, count(*)::int AS count
        FROM public.question_attempts
        WHERE student_id = ${student.id}
          AND NOT is_correct
        GROUP BY COALESCE(error_type, 'RESPONSE_ERROR')
        ORDER BY count(*) DESC, COALESCE(error_type, 'RESPONSE_ERROR')
        LIMIT 8
      `,
    ]);

    const insight = insightRows[0] as {
      sessions?: number;
      assignment_sessions?: number;
      independent_sessions?: number;
      total_questions?: number;
      correct?: number;
      wrong?: number;
      total_duration_ms?: number;
      timeout_count?: number;
      retry_count?: number;
    } | undefined;
    const totalQuestions = Math.max(0, Number(insight?.total_questions || 0));
    const correct = Math.max(0, Number(insight?.correct || 0));

    reportInsights = {
      sessions: Math.max(0, Number(insight?.sessions || 0)),
      assignmentSessions: Math.max(0, Number(insight?.assignment_sessions || 0)),
      independentSessions: Math.max(0, Number(insight?.independent_sessions || 0)),
      totalQuestions,
      correct,
      wrong: Math.max(0, Number(insight?.wrong || 0)),
      accuracy: totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0,
      totalDurationMs: Math.max(0, Number(insight?.total_duration_ms || 0)),
      timeoutCount: Math.max(0, Number(insight?.timeout_count || 0)),
      retryCount: Math.max(0, Number(insight?.retry_count || 0)),
    };

    moduleProgress = moduleRows.map(row => {
      const typed = row as {
        module_code: string;
        sessions?: number;
        total_questions?: number;
        correct?: number;
        wrong?: number;
        total_duration_ms?: number;
        last_completed_at?: string | null;
      };
      const moduleTotal = Math.max(0, Number(typed.total_questions || 0));
      const moduleCorrect = Math.max(0, Number(typed.correct || 0));
      return {
        moduleCode: typed.module_code,
        sessions: Math.max(0, Number(typed.sessions || 0)),
        totalQuestions: moduleTotal,
        correct: moduleCorrect,
        wrong: Math.max(0, Number(typed.wrong || 0)),
        accuracy: moduleTotal ? Math.round((moduleCorrect / moduleTotal) * 100) : 0,
        totalDurationMs: Math.max(0, Number(typed.total_duration_ms || 0)),
        lastCompletedAt: typed.last_completed_at || null,
      };
    });

    const assignment = assignmentRows[0] as {
      total?: number;
      assigned?: number;
      started?: number;
      completed?: number;
    } | undefined;
    assignmentProgress = {
      total: Math.max(0, Number(assignment?.total || 0)),
      assigned: Math.max(0, Number(assignment?.assigned || 0)),
      started: Math.max(0, Number(assignment?.started || 0)),
      completed: Math.max(0, Number(assignment?.completed || 0)),
    };
    recentAssignments = assignmentRecentRows;
    errorSummary = errorRows;
  } catch {
    reportInsightsAvailable = false;
  }

  let assessmentRouting: null | {
    sessionId: string;
    templateCode: string;
    completedAt: string | null;
    evidenceCoverage: number;
    recommendations: ReturnType<typeof buildCzaWorkRecommendations>;
    note: string;
  } = null;

  try {
    // Only the P2 bank is routed here for now. E2/E3 must use their own task banks;
    // this guard prevents a future profile from being interpreted with the wrong rubric.
    const assessmentSessions = await sql`
      SELECT id, template_code, completed_at
      FROM public.assessment_sessions
      WHERE student_id = ${student.id}
        AND status = 'completed'
        AND template_code = 'CZA_1_TO_2_V1'
      ORDER BY completed_at DESC NULLS LAST, started_at DESC
      LIMIT 1
    `;

    if (assessmentSessions.length) {
      const assessment = assessmentSessions[0] as { id: string; template_code: string; completed_at: string | null };
      const [assessmentAttempts, assessmentObservations] = await Promise.all([
        sql`SELECT * FROM public.assessment_attempts WHERE session_id = ${assessment.id}::uuid ORDER BY created_at ASC`,
        sql`SELECT * FROM public.assessment_observations WHERE session_id = ${assessment.id}::uuid ORDER BY created_at ASC`,
      ]);
      const learningResponse = calculateLearningResponse(assessmentAttempts as AssessmentAttemptRecord[], assessmentTasks);
      const assessmentReport = generateAssessmentReport(
        assessmentAttempts as ReportAttempt[],
        assessmentObservations as ReportObservation[],
        assessmentTasks,
        learningResponse,
      );
      const recommendations = buildCzaWorkRecommendations(assessmentReport).map(recommendation => {
        const query = new URLSearchParams({
          studentId: student.id,
          assessmentSessionId: assessment.id,
          recommendationId: recommendation.id,
        });
        return { ...recommendation, launchPath: `/educator/assessment/prescription?${query.toString()}` };
      });
      assessmentRouting = {
        sessionId: assessment.id,
        templateCode: assessment.template_code,
        completedAt: assessment.completed_at,
        evidenceCoverage: assessmentReport.evidenceCoverage,
        recommendations,
        note: 'Bu öneriler norm veya tanı değildir. Değerlendirme kanıtını mevcut CZA atölyelerine yönlendiren eğitimsel rota önerileridir ve eğitimci onayı gerektirir.',
      };
    }
  } catch {
    // Work reports must remain available even on older databases that have not yet
    // received the linked-assessment schema. No student data is mutated here.
    assessmentRouting = null;
  }

  return json({
    ok: true,
    student: {
      id: student.id,
      campusCode: student.campus_code || code || '',
      name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    },
    summary: summary[0],
    modules,
    recent,
    learningHistory,
    learningHistoryAvailable,
    reportInsights,
    reportInsightsAvailable,
    moduleProgress,
    assignmentProgress,
    recentAssignments,
    errorSummary,
    assessmentRouting,
  });
}
