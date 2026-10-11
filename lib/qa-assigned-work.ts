import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { isolatedQaEnabled } from '@/lib/isolated-qa-auth';
import { assertQaStudentTarget, studentReadSql } from '@/lib/qa-student-read';
import {
  authenticatedStudent,
  readRequestCookie,
  STUDENT_COOKIE,
} from '@/lib/student-session';
import { allowRequest, rateLimited } from '@/lib/request-guard';

const recipe = '361ee0f6-26e2-4484-b9f9-7a88d14fb9f4';

/** QA-only bounded entry into existing assigned work/ledger functions. */
export async function isolatedQaAssignedAction(
  request: Request,
  input: Record<string, unknown>,
) {
  if (
    !isolatedQaEnabled() ||
    !['me', 'start', 'attempt', 'finish'].includes(String(input.action))
  )
    return null;
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  try {
    await assertQaStudentTarget(request);
    const student = await authenticatedStudent(request);
    if (!student) return reply({ ok: false, error: 'session_required' }, 401);
    if (input.action === 'me') {
      const sql = await studentReadSql(request);
      // Reuse the approved V03 profile projection rather than a new generic read.
      const rows = await sql`
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
        `;
      if (!rows[0]) return reply({ ok: false, error: 'session_required' }, 401);
      return reply({
        ok: true,
        student: {
          id: rows[0].id,
          username: rows[0].username,
          name: rows[0].display_name,
        },
      });
    }
    const gate = await allowRequest(
      request,
      'qa-assigned-work',
      120,
      60_000,
      student.student_id,
    );
    if (!gate.allowed) return rateLimited(gate);
    if (
      input.action === 'start' &&
      (input.recipeId !== recipe ||
        readRequestCookie(request, 'cza_assignment_recipe') !== recipe)
    )
      return reply({ ok: false, error: 'assignment_launch_required' }, 403);
    const hash = createHash('sha256')
      .update(readRequestCookie(request, STUDENT_COOKIE))
      .digest('hex');
    const payload = input.action === 'attempt' ? input.payload : input;
    const session = input.action === 'start' ? null : input.sessionId;
    const [row] = await neon(process.env.DATABASE_URL!)`
      SELECT public.cza_v04_qa_assigned_work(${hash}::text,${input.action}::text,
        ${recipe}::uuid,${session}::uuid,${JSON.stringify(payload)}::jsonb) AS result`;
    if (!row?.result || typeof row.result !== 'object')
      throw new Error('invalid_qa_work_result');
    return reply(
      input.action === 'start'
        ? { ok: true, ...row.result }
        : input.action === 'attempt'
          ? { ok: true, workProgress: row.result }
          : { ok: true, workCompletion: row.result },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const known: Record<string, [string, number]> = {
      v04_qa_session_rejected: ['session_required', 401],
      CZA_WORK_ASSIGNMENT_NOT_FOUND: ['assignment_not_found', 404],
      CZA_WORK_SESSION_NOT_FOUND: ['work_not_found', 404],
      CZA_WORK_SESSION_CLOSED: ['work_session_closed', 409],
      CZA_WORK_INCOMPLETE: ['work_incomplete', 409],
      CZA_WORK_ATTEMPT_INVALID: ['invalid_attempt', 400],
      IDEMPOTENCY_KEY_REUSED: ['IDEMPOTENCY_KEY_REUSED', 409],
      v04_qa_question_conflict: ['work_question_conflict', 409],
      v04_qa_recipe_contract_rejected: ['work_assignment_closed', 403],
    };
    const [code, status] = known[message] ?? [
      'work_persistence_unavailable',
      503,
    ];
    return reply({ ok: false, error: code }, status);
  }
}
