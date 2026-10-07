import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { assessmentTasks } from '@/lib/assessment-routing';
import { calculateLearningResponse, type AssessmentAttemptRecord } from '@/lib/assessment-learning-response';
import { generateAssessmentReport, type ReportAttempt, type ReportObservation } from '@/lib/assessment-report';
import { buildCzaWorkRecommendations } from '@/lib/cza-work-recommendations';
import { assignableModules, defaultRecipeSettings, isAssignableModule, recipeSettingsFromRecommendation } from '@/lib/training-recipes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Lifecycle state is derived from canonical training_sessions and learning_records; no parallel assignment state table.

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function optionalText(value: unknown, maximum: number) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('invalid_text');
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error('invalid_text');
  return normalized;
}

function optionalTimestamp(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid_date');
  return new Date(value).toISOString();
}

function requestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function statusOf(row: Record<string, unknown>) {
  if (row.cancelled_at) return 'cancelled';
  if (row.completed_session_id) return 'completed';
  if (row.active_session_id) return 'active';
  const startsAt = row.starts_at instanceof Date ? row.starts_at.toISOString() : typeof row.starts_at === 'string' ? row.starts_at : '';
  const expiresAt = row.expires_at instanceof Date ? row.expires_at.toISOString() : typeof row.expires_at === 'string' ? row.expires_at : '';
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return 'expired';
  if (startsAt && Date.parse(startsAt) > Date.now()) return 'upcoming';
  return row.is_active === true ? 'active' : 'cancelled';
}

export async function POST(request: Request) {
  const gate = await allowRequest(request, 'educator-assignments', 30, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'request_origin_rejected' }, 403);

  const educator = await authenticatedEducator(request);
  if (!educator) return json({ ok: false, error: 'educator_session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_request' }, 400); }

  const action = typeof input.action === 'string' ? input.action : '';
  const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : '';
  if (!UUID_PATTERN.test(studentId)) return json({ ok: false, error: 'invalid_student_id' }, 400);

  const sql = neon(process.env.DATABASE_URL);
  const allowed = await sql`
    SELECT s.id AS student_id, s.academy_id, t.id AS educator_user_id,
           concat_ws(' ', s.first_name, s.last_name) AS student_name
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id = t.id AND l.academy_id = t.academy_id AND l.can_view = true
    JOIN public.students s
      ON s.id = l.student_id AND s.academy_id = t.academy_id
    WHERE t.auth_user_id = ${educator.id}
      AND t.is_active = true
      AND t.role::text = 'educator'
      AND s.status = 'active'
      AND s.id = ${studentId}::uuid
    LIMIT 1
  `;
  if (!allowed.length) return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);
  const link = allowed[0] as { student_id: string; academy_id: string; educator_user_id: string; student_name: string | null };

  if (action === 'list') {
    const rows = await sql`
      SELECT tr.id, tr.student_id, tr.module_code, tr.name, tr.instructions, tr.settings,
             tr.starts_at, tr.expires_at, tr.is_active, tr.cancelled_at, tr.created_at,
             active_session.id AS active_session_id,
             completed_session.id AS completed_session_id,
             (SELECT count(*)::int FROM public.training_sessions ts WHERE ts.recipe_id = tr.id) AS session_count,
             (SELECT count(*)::int FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed') AS completed_count,
             (SELECT max(ts.started_at) FROM public.training_sessions ts WHERE ts.recipe_id = tr.id) AS last_started_at,
             (SELECT max(ts.completed_at) FROM public.training_sessions ts WHERE ts.recipe_id = tr.id AND ts.status = 'completed') AS last_completed_at,
             (
               SELECT lr.id
               FROM public.learning_records lr
               JOIN public.training_sessions ts ON ts.id = lr.training_session_id
               WHERE ts.recipe_id = tr.id
                 AND lr.academy_id = ${link.academy_id}::uuid
                 AND lr.student_id = ${studentId}::uuid
               ORDER BY lr.completed_at DESC, lr.created_at DESC
               LIMIT 1
             ) AS latest_learning_record_id
      FROM public.training_recipes tr
      LEFT JOIN LATERAL (
        SELECT ts.id FROM public.training_sessions ts
        WHERE ts.recipe_id=tr.id AND ts.status='active'
        ORDER BY ts.last_activity_at DESC, ts.id DESC LIMIT 1
      ) active_session ON true
      LEFT JOIN LATERAL (
        SELECT ts.id FROM public.training_sessions ts
        WHERE ts.recipe_id=tr.id AND ts.status='completed'
        ORDER BY ts.completed_at DESC, ts.id DESC LIMIT 1
      ) completed_session ON true
      WHERE tr.student_id = ${studentId}::uuid
        AND tr.academy_id = ${link.academy_id}::uuid
        AND tr.assigned_by = ${link.educator_user_id}::uuid
        AND tr.source = 'teacher_assignment'
      ORDER BY tr.created_at DESC
      LIMIT 50
    `;
    const moduleFilter = typeof input.moduleCode === 'string' ? input.moduleCode.trim() : '';
    const statusFilter = typeof input.status === 'string' ? input.status.trim() : '';
    const normalized: Array<Record<string, unknown> & { status: string }> = rows.map((row) => ({ ...(row as Record<string, unknown>), status: statusOf(row as Record<string, unknown>) }));
    const assignments = normalized
      .filter((row) => !moduleFilter || row['module_code'] === moduleFilter)
      .filter((row) => !statusFilter || row.status === statusFilter);
    return json({ ok: true, assignments });
  }

  if (action === 'create_from_assessment') {
    const assessmentSessionId = typeof input.assessmentSessionId === 'string' ? input.assessmentSessionId.trim() : '';
    const recommendationId = typeof input.recommendationId === 'string' ? input.recommendationId.trim() : '';
    const clientRequestId = typeof input.clientRequestId === 'string' ? input.clientRequestId.trim() : '';
    if (!UUID_PATTERN.test(assessmentSessionId)) return json({ ok: false, error: 'invalid_assessment_session_id' }, 400);
    if (!recommendationId || recommendationId.length > 180) return json({ ok: false, error: 'invalid_recommendation_id' }, 400);
    if (!UUID_PATTERN.test(clientRequestId)) return json({ ok: false, error: 'invalid_idempotency_key' }, 400);

    const assessmentSessions = await sql`
      SELECT id, template_code
      FROM public.assessment_sessions
      WHERE id = ${assessmentSessionId}::uuid
        AND student_id = ${studentId}::uuid
        AND status = 'completed'
        AND template_code = 'CZA_1_TO_2_V1'
      LIMIT 1
    `;
    if (!assessmentSessions.length) return json({ ok: false, error: 'assessment_not_found_for_student' }, 404);

    const [assessmentAttempts, assessmentObservations] = await Promise.all([
      sql`SELECT * FROM public.assessment_attempts WHERE session_id = ${assessmentSessionId}::uuid ORDER BY created_at ASC`,
      sql`SELECT * FROM public.assessment_observations WHERE session_id = ${assessmentSessionId}::uuid ORDER BY created_at ASC`,
    ]);
    const learningResponse = calculateLearningResponse(assessmentAttempts as AssessmentAttemptRecord[], assessmentTasks);
    const assessmentReport = generateAssessmentReport(
      assessmentAttempts as ReportAttempt[],
      assessmentObservations as ReportObservation[],
      assessmentTasks,
      learningResponse,
    );
    const recommendation = buildCzaWorkRecommendations(assessmentReport, 8).find(item => item.id === recommendationId);
    if (!recommendation) return json({ ok: false, error: 'recommendation_not_found' }, 404);
    if (!isAssignableModule(recommendation.moduleCode)) return json({ ok: false, error: 'module_not_assignable_yet' }, 409);

    let settings;
    try {
      settings = recipeSettingsFromRecommendation(recommendation.moduleCode, recommendation.suggestedSettings);
    } catch {
      return json({ ok: false, error: 'invalid_recommendation_settings' }, 400);
    }

    const title = `${assignableModules[recommendation.moduleCode].label} · Değerlendirme önerisi`;
    const hash = requestHash({ studentId, assessmentSessionId, recommendationId, moduleCode: recommendation.moduleCode, title, settings });
    const replay = await sql`
      SELECT id, module_code, name, settings, starts_at, expires_at, is_active, created_at, request_hash
      FROM public.training_recipes
      WHERE academy_id=${link.academy_id}::uuid AND assigned_by=${link.educator_user_id}::uuid
        AND client_request_id=${clientRequestId}::uuid
      LIMIT 1
    `;
    if (replay.length) {
      if (replay[0].request_hash !== hash) return json({ ok: false, error: 'idempotency_conflict' }, 409);
      return json({ ok: true, assignment: replay[0], replayed: true });
    }
    const existing = await sql`
      SELECT id
      FROM public.training_recipes
      WHERE student_id = ${studentId}::uuid
        AND academy_id = ${link.academy_id}::uuid
        AND module_code = ${recommendation.moduleCode}
        AND source = 'teacher_assignment'
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND NOT EXISTS (
          SELECT 1 FROM public.training_sessions ts
          WHERE ts.recipe_id = training_recipes.id AND ts.status = 'completed'
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing.length) return json({ ok: false, error: 'active_assignment_exists' }, 409);
    let rows;
    try {
      rows = await sql`
        INSERT INTO public.training_recipes (
          academy_id, student_id, module_code, assigned_by, source, name, settings,
          is_active, starts_at, expires_at, client_request_id, request_hash
        ) VALUES (
          ${link.academy_id}::uuid, ${studentId}::uuid, ${recommendation.moduleCode},
          ${link.educator_user_id}::uuid, 'teacher_assignment', ${title},
          ${JSON.stringify(settings)}::jsonb, true, now(), now() + interval '14 days',
          ${clientRequestId}::uuid, ${hash}
        )
        ON CONFLICT (academy_id, assigned_by, client_request_id)
          WHERE client_request_id IS NOT NULL
        DO UPDATE SET updated_at=public.training_recipes.updated_at
          WHERE public.training_recipes.request_hash=EXCLUDED.request_hash
        RETURNING id, module_code, name, settings, starts_at, expires_at, is_active, created_at
      `;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && String(error.code) === '23505') {
        const concurrentReplay = await sql`SELECT id, module_code, name, settings, starts_at, expires_at, is_active, created_at FROM public.training_recipes WHERE academy_id=${link.academy_id}::uuid AND assigned_by=${link.educator_user_id}::uuid AND client_request_id=${clientRequestId}::uuid AND request_hash=${hash} LIMIT 1`;
        if (concurrentReplay.length) rows = concurrentReplay;
        else return json({ ok: false, error: 'active_assignment_exists' }, 409);
      } else return json({ ok: false, error: 'assignment_create_failed' }, 503);
    }
    if (!rows.length) return json({ ok: false, error: 'idempotency_conflict' }, 409);
    return json({
      ok: true,
      assignment: rows[0],
      source: {
        assessmentSessionId,
        recommendationId: recommendation.id,
        priority: recommendation.priority,
        sourceSkills: recommendation.sourceSkills,
        reason: recommendation.reason,
      },
    }, 201);
  }

  if (action === 'create') {
    const moduleCode = typeof input.moduleCode === 'string' ? input.moduleCode.trim() : '';
    if (!isAssignableModule(moduleCode)) return json({ ok: false, error: 'invalid_module' }, 400);
    const clientRequestId = typeof input.clientRequestId === 'string' ? input.clientRequestId.trim() : '';
    if (!UUID_PATTERN.test(clientRequestId)) return json({ ok: false, error: 'invalid_idempotency_key' }, 400);
    let settings;
    let title: string | null;
    let instructions: string | null;
    let startsAt: string;
    let requestedStartsAt: string | null;
    let expiresAt: string | null;
    try {
      const rawSettings = input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings)
        ? input.settings as Record<string, unknown> : {};
      settings = Object.keys(rawSettings).length
        ? recipeSettingsFromRecommendation(moduleCode, rawSettings)
        : defaultRecipeSettings(moduleCode);
      title = optionalText(input.title, 180);
      instructions = optionalText(input.instructions, 1000);
      requestedStartsAt = optionalTimestamp(input.startsAt);
      startsAt = requestedStartsAt || new Date().toISOString();
      expiresAt = optionalTimestamp(input.expiresAt);
    } catch {
      return json({ ok: false, error: 'invalid_assignment_input' }, 400);
    }
    const resolvedTitle = title || `${assignableModules[moduleCode].label} · Atanan çalışma`;
    const hash = requestHash({ studentId, moduleCode, title: resolvedTitle, instructions, settings, startsAt: requestedStartsAt, expiresAt });

    const replay = await sql`
      SELECT id, request_hash FROM public.training_recipes
      WHERE academy_id=${link.academy_id}::uuid
        AND assigned_by=${link.educator_user_id}::uuid
        AND client_request_id=${clientRequestId}::uuid
      LIMIT 1
    `;
    if (replay.length) {
      if (replay[0].request_hash !== hash) return json({ ok: false, error: 'idempotency_conflict' }, 409);
      return json({ ok: true, assignment: replay[0], replayed: true }, 200);
    }
    if (expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      return json({ ok: false, error: 'invalid_assignment_dates' }, 400);
    }

    const existing = await sql`
      SELECT id
      FROM public.training_recipes
      WHERE student_id = ${studentId}::uuid
        AND academy_id = ${link.academy_id}::uuid
        AND module_code = ${moduleCode}
        AND source = 'teacher_assignment'
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND NOT EXISTS (
          SELECT 1 FROM public.training_sessions ts
          WHERE ts.recipe_id = training_recipes.id AND ts.status = 'completed'
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing.length) return json({ ok: false, error: 'active_assignment_exists' }, 409);

    let rows;
    try {
      rows = await sql`
        INSERT INTO public.training_recipes (
          academy_id, student_id, module_code, assigned_by, source, name, instructions, settings,
          is_active, starts_at, expires_at, client_request_id, request_hash
        ) VALUES (
          ${link.academy_id}::uuid, ${studentId}::uuid, ${moduleCode},
          ${link.educator_user_id}::uuid, 'teacher_assignment', ${resolvedTitle}, ${instructions},
          ${JSON.stringify(settings)}::jsonb, true, ${startsAt}::timestamptz,
          ${expiresAt}::timestamptz, ${clientRequestId}::uuid, ${hash}
        )
        ON CONFLICT (academy_id, assigned_by, client_request_id)
          WHERE client_request_id IS NOT NULL
        DO UPDATE SET updated_at=public.training_recipes.updated_at
          WHERE public.training_recipes.request_hash=EXCLUDED.request_hash
        RETURNING id, module_code, name, instructions, settings, starts_at, expires_at,
                  is_active, cancelled_at, created_at
      `;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && String(error.code) === '23505') {
        const concurrentReplay = await sql`SELECT id, module_code, name, instructions, settings, starts_at, expires_at, is_active, cancelled_at, created_at FROM public.training_recipes WHERE academy_id=${link.academy_id}::uuid AND assigned_by=${link.educator_user_id}::uuid AND client_request_id=${clientRequestId}::uuid AND request_hash=${hash} LIMIT 1`;
        if (concurrentReplay.length) return json({ ok: true, assignment: concurrentReplay[0], replayed: true });
        return json({ ok: false, error: 'active_assignment_exists' }, 409);
      }
      return json({ ok: false, error: 'assignment_create_failed' }, 503);
    }
    if (!rows.length) return json({ ok: false, error: 'idempotency_conflict' }, 409);
    return json({ ok: true, assignment: rows[0] }, 201);
  }

  if (action === 'update') {
    const assignmentId = typeof input.assignmentId === 'string' ? input.assignmentId.trim() : '';
    if (!UUID_PATTERN.test(assignmentId)) return json({ ok: false, error: 'invalid_assignment_id' }, 400);
    let title: string | null; let instructions: string | null; let startsAt: string | null; let expiresAt: string | null;
    try {
      title = optionalText(input.title, 180);
      instructions = optionalText(input.instructions, 1000);
      startsAt = optionalTimestamp(input.startsAt);
      expiresAt = optionalTimestamp(input.expiresAt);
    } catch { return json({ ok: false, error: 'invalid_assignment_input' }, 400); }
    if (!title || (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt))) {
      return json({ ok: false, error: 'invalid_assignment_input' }, 400);
    }
    const rows = await sql`
      UPDATE public.training_recipes
      SET name=${title}, instructions=${instructions}, starts_at=${startsAt}::timestamptz,
          expires_at=${expiresAt}::timestamptz, updated_at=now()
      WHERE id=${assignmentId}::uuid AND student_id=${studentId}::uuid
        AND academy_id=${link.academy_id}::uuid AND assigned_by=${link.educator_user_id}::uuid
        AND source='teacher_assignment' AND cancelled_at IS NULL
      RETURNING id, module_code, name, instructions, starts_at, expires_at, is_active
    `;
    if (!rows.length) return json({ ok: false, error: 'assignment_not_found' }, 404);
    return json({ ok: true, assignment: rows[0] });
  }

  if (action === 'cancel' || action === 'deactivate') {
    const assignmentId = typeof input.assignmentId === 'string' ? input.assignmentId.trim() : '';
    if (!UUID_PATTERN.test(assignmentId)) return json({ ok: false, error: 'invalid_assignment_id' }, 400);
    const rows = await sql`
      WITH target AS (
        SELECT id, cancelled_at, updated_at
        FROM public.training_recipes
        WHERE id = ${assignmentId}::uuid
          AND student_id = ${studentId}::uuid
          AND academy_id = ${link.academy_id}::uuid
          AND assigned_by = ${link.educator_user_id}::uuid
          AND source = 'teacher_assignment'
        FOR UPDATE
      )
      UPDATE public.training_recipes AS recipe
      SET is_active = false,
          cancelled_at = COALESCE(recipe.cancelled_at, now()),
          cancelled_by = COALESCE(recipe.cancelled_by, ${link.educator_user_id}::uuid),
          updated_at = CASE WHEN recipe.cancelled_at IS NULL THEN now() ELSE recipe.updated_at END
      FROM target
      WHERE recipe.id = target.id
      RETURNING recipe.id, recipe.cancelled_at,
                (target.cancelled_at IS NOT NULL) AS replayed
    `;
    if (!rows.length) return json({ ok: false, error: 'assignment_not_found' }, 404);
    return json({ ok: true, replayed: rows[0].replayed === true });
  }

  return json({ ok: false, error: 'invalid_action' }, 400);
}
