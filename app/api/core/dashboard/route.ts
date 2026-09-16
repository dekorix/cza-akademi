import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedStudent } from '@/lib/student-session';
import type {
  StudentDashboardActivity,
  StudentDashboardAssignment,
  StudentDashboardData,
  StudentDashboardSkill,
} from '@/lib/student-dashboard-contract';

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
          SELECT tr.id, tr.module_code, tr.name, tr.starts_at, tr.expires_at,
                 m.name AS module_name,
                 count(ts.id)::int AS session_count,
                 count(ts.id) FILTER (WHERE ts.status = 'completed')::int AS completed_count
          FROM public.training_recipes tr
          JOIN public.modules m ON m.code = tr.module_code AND m.is_active = true
          LEFT JOIN public.training_sessions ts
            ON ts.recipe_id = tr.id
           AND ts.student_id = ${student.student_id}::uuid
           AND ts.academy_id = ${student.academy_id}::uuid
          WHERE tr.student_id = ${student.student_id}::uuid
            AND tr.academy_id = ${student.academy_id}::uuid
            AND tr.source = 'teacher_assignment'
            AND tr.is_active = true
            AND (tr.starts_at IS NULL OR tr.starts_at <= now())
            AND (tr.expires_at IS NULL OR tr.expires_at > now())
          GROUP BY tr.id, tr.module_code, tr.name, tr.starts_at, tr.expires_at, m.name
          ORDER BY tr.created_at DESC, tr.id DESC
          LIMIT 20
        `,
        sql`
          SELECT
            (SELECT count(*)::int
             FROM public.training_recipes tr
             WHERE tr.student_id = ${student.student_id}::uuid
               AND tr.academy_id = ${student.academy_id}::uuid
               AND tr.source = 'teacher_assignment'
               AND tr.is_active = true
               AND (tr.starts_at IS NULL OR tr.starts_at <= now())
               AND (tr.expires_at IS NULL OR tr.expires_at > now())) AS active_assignments,
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
        `,
        sql`
          SELECT ts.id, ts.module_code, m.name AS module_name, ts.status,
                 ts.started_at, ts.completed_at
          FROM public.training_sessions ts
          JOIN public.modules m ON m.code = ts.module_code
          WHERE ts.student_id = ${student.student_id}::uuid
            AND ts.academy_id = ${student.academy_id}::uuid
          ORDER BY COALESCE(ts.completed_at, ts.started_at) DESC, ts.id DESC
          LIMIT 8
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
    const totals = summary[0] as Record<string, unknown> | undefined;
    const dashboard: StudentDashboardData = {
      profile: {
        id: profile.id,
        name: profile.display_name?.trim() || profile.username || 'Öğrenci',
        username: profile.username,
      },
      summary: {
        activeAssignments: integer(totals?.active_assignments),
        completedSessions: integer(totals?.completed_sessions),
        totalAttempts: integer(totals?.total_attempts),
        correctAttempts: integer(totals?.correct_attempts),
        accuracy: boundedPercent(totals?.accuracy),
      },
      assignments: assignments.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: String(item.id),
          moduleCode: String(item.module_code),
          moduleName: String(item.module_name),
          title: String(item.name),
          startsAt: timestamp(item.starts_at),
          expiresAt: timestamp(item.expires_at),
          sessionCount: integer(item.session_count),
          completedCount: integer(item.completed_count),
        } satisfies StudentDashboardAssignment;
      }),
      recentActivity: activity.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: String(item.id),
          moduleCode: String(item.module_code),
          moduleName: String(item.module_name),
          status: String(item.status) as StudentDashboardActivity['status'],
          startedAt: timestamp(item.started_at) || '',
          completedAt: timestamp(item.completed_at),
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
