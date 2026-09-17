import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedStudent } from '@/lib/student-session';
import type {
  StudentDashboardActivity,
  StudentDashboardAssignment,
  StudentDashboardData,
  StudentDashboardSkill,
} from '@/lib/student-dashboard-contract';
import {
  assignedEnginePath,
  freePracticePath,
  type WorkAssignmentState,
} from '@/lib/work-center';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function boundedPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function timestamp(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function expectedCount(settings: unknown) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings))
    return 1;
  const record = settings as Record<string, unknown>;
  const exercise =
    record.exercise &&
    typeof record.exercise === 'object' &&
    !Array.isArray(record.exercise)
      ? (record.exercise as Record<string, unknown>)
      : null;
  const value = record.rounds ?? record.questionCount ?? exercise?.rounds;
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}

function assignmentState(item: Record<string, unknown>): WorkAssignmentState {
  const now = Date.now();
  const startsAt = timestamp(item.starts_at);
  const expiresAt = timestamp(item.expires_at);
  if (item.is_active !== true) return 'closed';
  if (expiresAt && Date.parse(expiresAt) <= now) return 'expired';
  if (item.completed_session_id) return 'completed';
  if (item.active_session_id) return 'in_progress';
  if (startsAt && Date.parse(startsAt) > now) return 'assigned';
  return 'available';
}

export async function GET(request: Request) {
  try {
    const student = await authenticatedStudent(request);
    if (!student) return json({ ok: false, error: 'session_required' }, 401);

    const gate = await allowRequest(
      request,
      'student-dashboard',
      60,
      60 * 1000,
      student.student_id,
    );
    if (!gate.allowed) return rateLimited(gate);
    if (!process.env.DATABASE_URL) {
      return json({ ok: false, error: 'database_unavailable' }, 503);
    }

    const sql = neon(process.env.DATABASE_URL);
    const [profiles, assignments, summary, activity, skills] =
      await Promise.all([
        sql`
          SELECT s.id, u.username,
                 concat_ws(' ', s.first_name, s.last_name) AS display_name
          FROM public.students s
          JOIN public.users u ON u.id = s.user_id
          WHERE s.id = ${student.student_id}::uuid
            AND s.academy_id = ${student.academy_id}::uuid
            AND s.user_id = ${student.student_user_id}::uuid
            AND s.status = 'active'
            AND u.is_active = true
            AND u.role = 'student'
          LIMIT 1
        `,
        sql`
          SELECT tr.id, tr.module_code, tr.name, tr.settings, tr.starts_at,
                 tr.expires_at, tr.is_active, m.name AS module_name,
                 (SELECT count(*)::int FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = ${student.academy_id}::uuid
                    AND ts.student_id = ${student.student_id}::uuid) AS session_count,
                 (SELECT count(*)::int FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = ${student.academy_id}::uuid
                    AND ts.student_id = ${student.student_id}::uuid
                    AND ts.status = 'completed') AS completed_count,
                 (SELECT id FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = ${student.academy_id}::uuid
                    AND ts.student_id = ${student.student_id}::uuid
                    AND ts.status = 'active'
                  ORDER BY ts.last_activity_at DESC, ts.id DESC LIMIT 1) AS active_session_id,
                 (SELECT id FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = ${student.academy_id}::uuid
                    AND ts.student_id = ${student.student_id}::uuid
                    AND ts.status = 'completed'
                  ORDER BY ts.completed_at DESC, ts.id DESC LIMIT 1) AS completed_session_id,
                 (SELECT max(ts.last_activity_at) FROM public.training_sessions ts
                  WHERE ts.recipe_id = tr.id
                    AND ts.academy_id = ${student.academy_id}::uuid
                    AND ts.student_id = ${student.student_id}::uuid) AS last_activity_at,
                 (SELECT count(*)::int
                  FROM public.question_attempts qa
                  JOIN public.training_sessions ts ON ts.id = qa.training_session_id
                  WHERE ts.recipe_id = tr.id
                    AND qa.academy_id = ${student.academy_id}::uuid
                    AND qa.student_id = ${student.student_id}::uuid
                    AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS attempt_count,
                 (SELECT count(*)::int
                  FROM public.question_attempts qa
                  JOIN public.training_sessions ts ON ts.id = qa.training_session_id
                  WHERE ts.recipe_id = tr.id
                    AND qa.academy_id = ${student.academy_id}::uuid
                    AND qa.student_id = ${student.student_id}::uuid
                    AND qa.is_correct
                    AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK') AS correct_count
          FROM public.training_recipes tr
          JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
          WHERE tr.student_id = ${student.student_id}::uuid
            AND tr.academy_id = ${student.academy_id}::uuid
            AND tr.source = 'teacher_assignment'
          ORDER BY tr.created_at DESC, tr.id DESC
          LIMIT 50
        `,
        sql`
          SELECT
            (SELECT count(*)::int
             FROM public.training_sessions ts
             WHERE ts.student_id = ${student.student_id}::uuid
               AND ts.academy_id = ${student.academy_id}::uuid
               AND ts.status = 'completed') AS completed_sessions,
            count(*)::int AS total_attempts,
            count(*) FILTER (WHERE qa.is_correct)::int AS correct_attempts,
            COALESCE(round(
              100.0 * count(*) FILTER (WHERE qa.is_correct) / NULLIF(count(*), 0)
            ), 0)::int AS accuracy
          FROM public.question_attempts qa
          WHERE qa.student_id = ${student.student_id}::uuid
            AND qa.academy_id = ${student.academy_id}::uuid
        `,
        sql`
          SELECT ts.id, ts.module_code, m.name AS module_name, ts.status,
                 ts.started_at, ts.completed_at, ts.recipe_id,
                 tr.name AS assignment_name,
                 count(qa.id) FILTER (
                   WHERE COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
                 )::int AS attempt_count,
                 count(qa.id) FILTER (
                   WHERE qa.is_correct
                     AND COALESCE(qa.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
                 )::int AS correct_count
          FROM public.training_sessions ts
          JOIN public.modules m ON m.code = ts.module_code
          LEFT JOIN public.training_recipes tr
            ON tr.id = ts.recipe_id
           AND tr.academy_id = ${student.academy_id}::uuid
           AND tr.student_id = ${student.student_id}::uuid
          LEFT JOIN public.question_attempts qa
            ON qa.training_session_id = ts.id
           AND qa.academy_id = ${student.academy_id}::uuid
           AND qa.student_id = ${student.student_id}::uuid
          WHERE ts.student_id = ${student.student_id}::uuid
            AND ts.academy_id = ${student.academy_id}::uuid
          GROUP BY ts.id, m.name, tr.name
          ORDER BY COALESCE(ts.completed_at, ts.started_at) DESC, ts.id DESC
          LIMIT 12
        `,
        sql`
          SELECT qa.module_code, m.name AS module_name,
                 count(*)::int AS total,
                 count(*) FILTER (WHERE qa.is_correct)::int AS correct,
                 COALESCE(round(
                   100.0 * count(*) FILTER (WHERE qa.is_correct) / NULLIF(count(*), 0)
                 ), 0)::int AS accuracy
          FROM public.question_attempts qa
          JOIN public.modules m ON m.code = qa.module_code
          WHERE qa.student_id = ${student.student_id}::uuid
            AND qa.academy_id = ${student.academy_id}::uuid
          GROUP BY qa.module_code, m.name
          ORDER BY max(qa.created_at) DESC, qa.module_code ASC
          LIMIT 12
        `,
      ]);

    if (!profiles.length) {
      return json({ ok: false, error: 'student_profile_not_found' }, 404);
    }

    const profile = profiles[0] as {
      id: string;
      username: string;
      display_name: string | null;
    };
    const mappedAssignments = assignments.map((row) => {
      const item = row as Record<string, unknown>;
      const status = assignmentState(item);
      const attempts = integer(item.attempt_count);
      const correct = integer(item.correct_count);
      const expected = expectedCount(item.settings);
      const moduleCode = String(item.module_code);
      const id = String(item.id);
      return {
        id,
        moduleCode,
        moduleName: String(item.module_name),
        title: String(item.name),
        startsAt: timestamp(item.starts_at),
        expiresAt: timestamp(item.expires_at),
        sessionCount: integer(item.session_count),
        completedCount: integer(item.completed_count),
        status,
        launchPath:
          status === 'available' || status === 'in_progress'
            ? assignedEnginePath(moduleCode, id)
            : null,
        freePracticePath: freePracticePath(moduleCode),
        activeSessionId:
          typeof item.active_session_id === 'string'
            ? item.active_session_id
            : null,
        lastActivityAt: timestamp(item.last_activity_at),
        attemptCount: attempts,
        correctCount: correct,
        expectedCount: expected,
        progressPercent:
          status === 'completed'
            ? 100
            : Math.min(99, Math.round((100 * attempts) / expected)),
      } satisfies StudentDashboardAssignment;
    });
    const totals = summary[0] as Record<string, unknown> | undefined;
    const dashboard: StudentDashboardData = {
      profile: {
        id: profile.id,
        name: profile.display_name?.trim() || profile.username || 'Öğrenci',
        username: profile.username,
      },
      summary: {
        activeAssignments: mappedAssignments.filter((item) =>
          ['available', 'in_progress'].includes(item.status),
        ).length,
        completedSessions: integer(totals?.completed_sessions),
        totalAttempts: integer(totals?.total_attempts),
        correctAttempts: integer(totals?.correct_attempts),
        accuracy: boundedPercent(totals?.accuracy),
        availableAssignments: mappedAssignments.filter(
          (item) => item.status === 'available',
        ).length,
        inProgressAssignments: mappedAssignments.filter(
          (item) => item.status === 'in_progress',
        ).length,
        completedAssignments: mappedAssignments.filter(
          (item) => item.status === 'completed',
        ).length,
      },
      assignments: mappedAssignments,
      recentActivity: activity.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: String(item.id),
          moduleCode: String(item.module_code),
          moduleName: String(item.module_name),
          status: String(item.status) as StudentDashboardActivity['status'],
          startedAt: timestamp(item.started_at) || '',
          completedAt: timestamp(item.completed_at),
          assignmentId:
            typeof item.recipe_id === 'string' ? item.recipe_id : null,
          assignmentTitle:
            typeof item.assignment_name === 'string'
              ? item.assignment_name
              : null,
          attemptCount: integer(item.attempt_count),
          correctCount: integer(item.correct_count),
          accuracy: boundedPercent(
            integer(item.attempt_count)
              ? (100 * integer(item.correct_count)) /
                  integer(item.attempt_count)
              : 0,
          ),
        } satisfies StudentDashboardActivity;
      }),
      skillProfile: skills.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          moduleCode: String(item.module_code),
          moduleName: String(item.module_name),
          total: integer(item.total),
          correct: integer(item.correct),
          accuracy: boundedPercent(item.accuracy),
        } satisfies StudentDashboardSkill;
      }),
    };

    return json({ ok: true, dashboard });
  } catch {
    return json({ ok: false, error: 'student_dashboard_unavailable' }, 503);
  }
}
