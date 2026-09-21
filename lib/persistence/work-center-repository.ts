import { neon } from '@neondatabase/serverless';
import type { EngineReference } from '@/lib/engine-contract';
import { engineDefinition } from '../engine-registry';
import {
  numericResponse,
  validateCanonicalResponse,
} from '../response-contract';

export type WorkStudent = {
  academy_id: string;
  student_id: string;
  session_id: string;
};

type SessionRow = {
  id: string;
  recipe_id: string | null;
  module_code: string;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | Date;
  completed_at: string | Date | null;
  attempt_count: number;
  correct_count: number;
};

export class WorkCenterPersistenceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'WorkCenterPersistenceError';
  }
}

function database() {
  if (!process.env.DATABASE_URL) {
    throw new WorkCenterPersistenceError('database_unavailable', 503);
  }
  return neon(process.env.DATABASE_URL);
}

function timestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mappedError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
    return new WorkCenterPersistenceError('IDEMPOTENCY_KEY_REUSED', 409);
  }
  if (message.includes('CZA_WORK_INCOMPLETE')) {
    return new WorkCenterPersistenceError('work_incomplete', 409);
  }
  if (message.includes('CZA_WORK_SESSION_CLOSED')) {
    return new WorkCenterPersistenceError('work_session_closed', 409);
  }
  if (message.includes('CZA_WORK_ASSIGNMENT_CLOSED')) {
    return new WorkCenterPersistenceError('work_assignment_closed', 409);
  }
  if (
    message.includes('CZA_WORK_SESSION_NOT_FOUND') ||
    message.includes('CZA_WORK_ASSIGNMENT_NOT_FOUND')
  ) {
    return new WorkCenterPersistenceError('work_not_found', 404);
  }
  if (message.includes('CZA_WORK_ATTEMPT_INVALID')) {
    return new WorkCenterPersistenceError('invalid_attempt', 400);
  }
  if (
    message.includes('CZA_ENGINE_PROVENANCE_INVALID') ||
    message.includes('CZA_ENGINE_PROVENANCE_CONFLICT') ||
    message.includes('CZA_GENERIC_RESPONSE_INVALID')
  ) {
    return new WorkCenterPersistenceError('invalid_engine_record', 400);
  }
  return new WorkCenterPersistenceError('work_persistence_unavailable', 503);
}

export function resolvePersistenceEngine(engine: EngineReference | null) {
  return engine
    ? engineDefinition(engine.engineId, engine.engineVersion)
    : null;
}

export function validatePersistenceResponse(payload: Record<string, unknown>) {
  const metadata =
    payload.metadata && typeof payload.metadata === 'object'
      ? (payload.metadata as Record<string, unknown>)
      : {};
  const hasType = Object.hasOwn(metadata, 'responseType');
  const hasPayload = Object.hasOwn(metadata, 'responsePayload');
  if (hasType || hasPayload) {
    return validateCanonicalResponse({
      type: metadata.responseType,
      payload: metadata.responsePayload,
    });
  }
  return numericResponse(payload.studentNumericAnswer as number);
}

export async function assignedSessionForRecipe(
  student: WorkStudent,
  recipeId: string,
) {
  const sql = database();
  const rows = await sql`
    SELECT sessions.id, sessions.recipe_id, sessions.module_code,
           sessions.status, sessions.started_at, sessions.completed_at,
           count(attempts.id) FILTER (
             WHERE COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
           )::int AS attempt_count,
           count(attempts.id) FILTER (
             WHERE attempts.is_correct
               AND COALESCE(attempts.metadata->>'attemptType', 'PRIMARY') <> 'RETRY_AFTER_FEEDBACK'
           )::int AS correct_count
    FROM public.training_sessions sessions
    LEFT JOIN public.question_attempts attempts
      ON attempts.training_session_id = sessions.id
     AND attempts.academy_id = ${student.academy_id}::uuid
     AND attempts.student_id = ${student.student_id}::uuid
    WHERE sessions.recipe_id = ${recipeId}::uuid
      AND sessions.academy_id = ${student.academy_id}::uuid
      AND sessions.student_id = ${student.student_id}::uuid
      AND sessions.status IN ('active', 'completed')
    GROUP BY sessions.id
    ORDER BY CASE WHEN sessions.status = 'completed' THEN 0 ELSE 1 END,
             sessions.last_activity_at DESC, sessions.id DESC
    LIMIT 1
  `;
  const row = rows[0] as SessionRow | undefined;
  if (!row) return null;
  return {
    sessionId: row.id,
    recipeId: row.recipe_id,
    moduleCode: row.module_code,
    status: row.status,
    startedAt: timestamp(row.started_at),
    completedAt: row.completed_at ? timestamp(row.completed_at) : null,
    attemptCount: Number(row.attempt_count) || 0,
    correctCount: Number(row.correct_count) || 0,
  };
}

export async function ownedSession(
  student: WorkStudent,
  trainingSessionId: string,
) {
  const sql = database();
  const rows = await sql`
    SELECT id, recipe_id, module_code, status, started_at, completed_at,
           0::int AS attempt_count, 0::int AS correct_count
    FROM public.training_sessions
    WHERE id = ${trainingSessionId}::uuid
      AND academy_id = ${student.academy_id}::uuid
      AND student_id = ${student.student_id}::uuid
    LIMIT 1
  `;
  return (rows[0] as SessionRow | undefined) ?? null;
}

export async function bindAssignedSession(
  student: WorkStudent,
  input: {
    recipeId: string;
    clientSessionId: string;
    trainingSessionId: string;
    startedAt: string;
    engine: EngineReference | null;
  },
) {
  const engine = resolvePersistenceEngine(input.engine);
  const sql = database();
  try {
    const rows = await sql`
      SELECT * FROM public.cza_bind_assigned_work_session_k3c(
        ${student.academy_id}::uuid,
        ${student.student_id}::uuid,
        ${input.recipeId}::uuid,
        ${input.clientSessionId}::uuid,
        ${input.trainingSessionId}::uuid,
        ${input.startedAt}::timestamptz,
        ${engine?.engineId ?? null}::text,
        ${engine?.engineVersion ?? null}::text
      )
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('CZA_WORK_SESSION_BIND_FAILED');
    return {
      sessionId: String(row.training_session_id),
      status: String(row.work_status),
      resumed: row.resumed === true,
      startedAt: timestamp(row.started_at as string | Date),
      attemptCount: Number(row.attempt_count) || 0,
      correctCount: Number(row.correct_count) || 0,
      lastActivityAt: timestamp(row.last_activity_at as string | Date),
    };
  } catch (error) {
    throw mappedError(error);
  }
}

export async function recordAssignedAttempt(
  student: WorkStudent,
  trainingSessionId: string,
  payload: Record<string, unknown>,
) {
  try {
    validatePersistenceResponse(payload);
  } catch {
    throw new WorkCenterPersistenceError('invalid_attempt', 400);
  }
  const sql = database();
  try {
    const rows = await sql`
      SELECT * FROM public.cza_record_assigned_work_attempt(
        ${student.academy_id}::uuid,
        ${student.student_id}::uuid,
        ${trainingSessionId}::uuid,
        ${JSON.stringify(payload)}::jsonb
      )
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('CZA_WORK_ATTEMPT_RESULT_MISSING');
    return {
      attemptId: String(row.question_attempt_id),
      replayed: row.replayed === true,
      attemptCount: Number(row.attempt_count) || 0,
      correctCount: Number(row.correct_count) || 0,
      lastQuestionIndex: Number(row.last_question_index) || 0,
      lastActivityAt: timestamp(row.last_activity_at as string | Date),
    };
  } catch (error) {
    throw mappedError(error);
  }
}

export async function completeAssignedSession(
  student: WorkStudent,
  trainingSessionId: string,
  aborted: boolean,
) {
  const sql = database();
  try {
    const rows = await sql`
      SELECT * FROM public.cza_complete_assigned_work(
        ${student.academy_id}::uuid,
        ${student.student_id}::uuid,
        ${student.session_id}::uuid,
        ${trainingSessionId}::uuid,
        ${aborted}::boolean
      )
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('CZA_WORK_COMPLETION_RESULT_MISSING');
    return {
      sessionId: String(row.training_session_id),
      status: String(row.work_status),
      replayed: row.replayed === true,
      learningRecordId:
        typeof row.learning_record_id === 'string'
          ? row.learning_record_id
          : null,
      evidenceId: typeof row.evidence_id === 'string' ? row.evidence_id : null,
      attemptCount: Number(row.attempt_count) || 0,
      correctCount: Number(row.correct_count) || 0,
      timeoutCount: Number(row.timeout_count) || 0,
    };
  } catch (error) {
    throw mappedError(error);
  }
}
