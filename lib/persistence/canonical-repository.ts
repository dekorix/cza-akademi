import { neon } from '@neondatabase/serverless';
import type { CanonicalLearningRecord } from '@/lib/learning-contract-server';

type AuthenticatedStudent = {
  academy_id: string;
  student_id: string;
};

type PersistenceRow = {
  learning_record_id: string;
  replayed: boolean;
  canonical_payload_hash: string;
};

export class CanonicalPersistenceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'CanonicalPersistenceError';
  }
}

function databaseErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
    return new CanonicalPersistenceError('IDEMPOTENCY_KEY_REUSED', 409);
  }
  if (message.includes('CZA_SESSION_OWNERSHIP_INVALID')) {
    return new CanonicalPersistenceError('session_ownership_invalid', 403);
  }
  if (
    message.includes('CZA_CONTRACT_INVALID') ||
    message.includes('CZA_RECORD_TIME_ORDER_INVALID') ||
    message.includes('CZA_RECORD_JSON_INVALID')
  ) {
    return new CanonicalPersistenceError('invalid_learning_record', 400);
  }
  return new CanonicalPersistenceError('learning_persistence_unavailable', 503);
}

export async function persistCanonicalLearningRecord(
  student: AuthenticatedStudent,
  record: CanonicalLearningRecord,
) {
  if (!process.env.DATABASE_URL) {
    throw new CanonicalPersistenceError('database_unavailable', 503);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      SELECT learning_record_id, replayed, canonical_payload_hash
      FROM public.cza_student_record_learning(
        ${student.academy_id}::uuid,
        ${student.student_id}::uuid,
        ${record.trainingSessionId}::uuid,
        ${record.clientRecordId}::uuid,
        ${record.recordType}::text,
        ${record.contractVersion}::text,
        ${record.schemaVersion}::text,
        ${record.moduleId}::text,
        ${record.moduleVersion}::text,
        ${record.activityType}::text,
        ${record.startedAt}::timestamptz,
        ${record.completedAt}::timestamptz,
        ${record.supportLevel}::text,
        ${JSON.stringify(record.performance)}::jsonb,
        ${JSON.stringify(record.skills)}::jsonb,
        ${JSON.stringify(record.metadata)}::jsonb
      )
    `;

    const result = rows[0] as PersistenceRow | undefined;
    if (!result) throw new Error('CZA_PERSISTENCE_RESULT_MISSING');

    return Object.freeze({
      learningRecordId: result.learning_record_id,
      replayed: result.replayed,
      payloadHash: result.canonical_payload_hash,
    });
  } catch (error) {
    if (error instanceof CanonicalPersistenceError) throw error;
    throw databaseErrorCode(error);
  }
}
