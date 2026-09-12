import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { E3_TEMPLATE_CODE, buildE3SectionReport, e3Tasks, type E3Evidence, type E3SupportLevel } from '@/lib/preschool-e3';
import { buildE3WorkRecommendations } from '@/lib/e3-work-recommendations';
import { assignableModules, isAssignableModule, recipeSettingsFromRecommendation } from '@/lib/training-recipes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportLevels = new Set<E3SupportLevel>(['INDEPENDENT','VERBAL_PROMPT','VISUAL_PROMPT','MODELED','PHYSICAL_ASSIST','NOT_OBSERVED','NOT_ASSESSED']);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function supportLevel(value: unknown): E3SupportLevel {
  return supportLevels.has(value as E3SupportLevel) ? value as E3SupportLevel : 'NOT_ASSESSED';
}

function evidenceFromRows(rows: Record<string, unknown>[]): E3Evidence[] {
  return rows.flatMap((row) => {
    const taskCode = String(row.task_code || '');
    const task = e3Tasks.find((item) => item.id === taskCode);
    if (!task) return [];
    const payload = row.answer_payload && typeof row.answer_payload === 'object' ? row.answer_payload as Record<string, unknown> : {};
    return [{
      taskId: task.id,
      sectionId: task.sectionId,
      supportLevel: supportLevel(payload.supportLevel),
      firstMatch: typeof payload.firstMatch === 'boolean' ? payload.firstMatch : null,
      latencyMs: typeof row.response_latency_ms === 'number' ? row.response_latency_ms : null,
      touches: typeof payload.touches === 'number' ? payload.touches : null,
      note: typeof payload.note === 'string' ? payload.note : undefined,
      neutralProbe: task.neutralProbe === true,
    }];
  });
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'educator-e3-assignments', 24, 10 * 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'request_origin_rejected' }, 403);

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : '';
  const assessmentSessionId = typeof input.assessmentSessionId === 'string' ? input.assessmentSessionId.trim() : '';
  const recommendationId = typeof input.recommendationId === 'string' ? input.recommendationId.trim() : '';
  if (!UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);
  if (!UUID_PATTERN.test(assessmentSessionId)) return json({ ok: false, error: 'invalid_assessment_session_id' }, 400);
  if (!recommendationId || recommendationId.length > 180) return json({ ok: false, error: 'invalid_recommendation_id' }, 400);

  const sql = neon(process.env.DATABASE_URL);
  const linked = await sql`
    SELECT s.id AS student_id, s.academy_id, t.id AS educator_user_id
    FROM public.users t
    JOIN public.teacher_student_links l ON l.teacher_id = t.id AND l.can_view = true
    JOIN public.students s ON s.id = l.student_id
    WHERE t.auth_user_id = ${educator.id}
      AND t.is_active = true
      AND s.id = ${studentId}::uuid
    LIMIT 1
  ` as Record<string, unknown>[];
  if (!linked.length) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);

  const sessions = await sql`
    SELECT id, student_id, template_code, status, metadata
    FROM public.assessment_sessions
    WHERE id = ${assessmentSessionId}::uuid
      AND student_id = ${studentId}::uuid
      AND template_code = ${E3_TEMPLATE_CODE}
      AND status = 'completed'
    LIMIT 1
  ` as Record<string, unknown>[];
  if (!sessions.length) return json({ ok: false, error: 'completed_e3_assessment_not_found_for_student' }, 404);

  const metadata = sessions[0].metadata && typeof sessions[0].metadata === 'object' ? sessions[0].metadata as Record<string, unknown> : {};
  const ageMonths = Number(metadata.ageMonths);
  if (!Number.isInteger(ageMonths) || ageMonths < 36 || ageMonths > 47) return json({ ok: false, error: 'e3_session_age_invalid' }, 409);

  const attempts = await sql`
    SELECT task_code, answer_payload, response_latency_ms
    FROM public.assessment_attempts
    WHERE session_id = ${assessmentSessionId}::uuid
    ORDER BY created_at ASC
  ` as Record<string, unknown>[];
  const sections = buildE3SectionReport(evidenceFromRows(attempts));
  const recommendation = buildE3WorkRecommendations(sections, ageMonths, 4).find((item) => item.id === recommendationId);
  if (!recommendation) return json({ ok: false, error: 'e3_recommendation_not_found_or_age_ineligible' }, 404);
  if (!isAssignableModule(recommendation.moduleCode)) return json({ ok: false, error: 'module_not_assignable' }, 409);

  const existing = await sql`
    SELECT id
    FROM public.training_recipes
    WHERE student_id = ${studentId}::uuid
      AND module_code = ${recommendation.moduleCode}
      AND source = 'teacher_assignment'
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  ` as Record<string, unknown>[];
  if (existing.length) return json({ ok: false, error: 'active_assignment_exists' }, 409);

  let settings;
  try {
    settings = recipeSettingsFromRecommendation(recommendation.moduleCode, recommendation.suggestedSettings);
  } catch {
    return json({ ok: false, error: 'invalid_e3_recommendation_settings' }, 400);
  }

  const link = linked[0] as { academy_id: string; educator_user_id: string };
  const title = `${assignableModules[recommendation.moduleCode].label} · E3 gelişim önerisi`;
  const rows = await sql`
    INSERT INTO public.training_recipes (
      academy_id, student_id, module_code, assigned_by, source, name, settings,
      is_active, starts_at, expires_at
    ) VALUES (
      ${link.academy_id}::uuid,
      ${studentId}::uuid,
      ${recommendation.moduleCode},
      ${link.educator_user_id}::uuid,
      'teacher_assignment',
      ${title},
      ${JSON.stringify(settings)}::jsonb,
      true,
      now(),
      now() + interval '10 days'
    )
    RETURNING id, module_code, name, settings, starts_at, expires_at, is_active, created_at
  `;

  return json({
    ok: true,
    assignment: rows[0],
    source: {
      profileCode: 'E3',
      assessmentSessionId,
      recommendationId: recommendation.id,
      priority: recommendation.priority,
      sourceSections: recommendation.sourceSections,
      ageMonths,
      ageGate: recommendation.ageGate,
      reason: recommendation.reason,
    },
  }, 201);
}
