import { createHmac, timingSafeEqual } from 'node:crypto';

export const TIMELINE_EVENT_TYPES = [
  'ASSIGNMENT_AVAILABLE',
  'WORK_STARTED',
  'WORK_RESUMED',
  'WORK_COMPLETED',
  'LEARNING_RESULT',
  'ERROR_OBSERVED',
  'SKILL_EVIDENCE',
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
export type TimelineVerification = 'client_reported' | 'legacy_client_reported' | 'server_verified';

export type LearningTimelineEvent = {
  eventId: string;
  studentId: string;
  occurredAt: string;
  eventType: TimelineEventType;
  assignmentLifecycle: 'ASSIGNMENT_CREATED' | 'ASSIGNMENT_STARTED' | 'ASSIGNMENT_COMPLETED' | 'ASSIGNMENT_CANCELLED' | null;
  moduleCode: string;
  assignmentId: string | null;
  trainingSessionId: string | null;
  learningRecordId: string | null;
  title: string;
  status: string;
  resultSummary: Record<string, unknown> | null;
  errorSummary: Record<string, unknown> | null;
  skillSummary: Record<string, unknown> | null;
  supportLevel: string | null;
  provenance: string;
  verificationStatus: TimelineVerification;
  sourceReference: string;
};

export type TimelineFilters = {
  from: string | null;
  to: string | null;
  moduleCode: string | null;
  eventType: TimelineEventType | null;
  verificationStatus: TimelineVerification | null;
};

type TimelineCursor = { v: 1; occurredAt: string; eventId: string; scope: string };
type TimelineQueryClient = {
  query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
};

export class TimelineInputError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const EVENT_TYPES = new Set<string>(TIMELINE_EVENT_TYPES);
const VERIFICATION_STATUSES = new Set<string>([
  'client_reported', 'legacy_client_reported', 'server_verified',
]);
const MODULE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const EVENT_ID_PATTERN = /^(assignment|session|record|error|evidence):[0-9a-f-]{36}$/;
const DEFAULT_LIMIT = 20;
export const MAX_TIMELINE_PAGE_SIZE = 50;

function cursorSecret() {
  const secret = process.env.CZA_TIMELINE_CURSOR_SECRET || process.env.CZA_TRUSTED_PROXY_HMAC_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new TimelineInputError('timeline_cursor_unavailable');
  return secret;
}

function signature(value: string) {
  return createHmac('sha256', cursorSecret()).update(value).digest('base64url');
}

function stableFilterScope(studentId: string, filters: TimelineFilters) {
  return JSON.stringify([studentId, filters.from, filters.to, filters.moduleCode, filters.eventType, filters.verificationStatus]);
}

export function encodeTimelineCursor(event: LearningTimelineEvent, studentId: string, filters: TimelineFilters) {
  const payload: TimelineCursor = {
    v: 1,
    occurredAt: event.occurredAt,
    eventId: event.eventId,
    scope: stableFilterScope(studentId, filters),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

export function decodeTimelineCursor(value: string, studentId: string, filters: TimelineFilters) {
  if (!value || value.length > 1024) throw new TimelineInputError('invalid_cursor');
  const [encoded, supplied, extra] = value.split('.');
  if (!encoded || !supplied || extra !== undefined) throw new TimelineInputError('invalid_cursor');
  const expected = signature(encoded);
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    throw new TimelineInputError('invalid_cursor');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new TimelineInputError('invalid_cursor');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TimelineInputError('invalid_cursor');
  const cursor = parsed as Partial<TimelineCursor>;
  if (
    cursor.v !== 1 || typeof cursor.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(cursor.occurredAt)) || typeof cursor.eventId !== 'string' ||
    !EVENT_ID_PATTERN.test(cursor.eventId) || cursor.scope !== stableFilterScope(studentId, filters)
  ) throw new TimelineInputError('invalid_cursor');
  return { occurredAt: cursor.occurredAt, eventId: cursor.eventId };
}

function optionalDate(value: string | null, code: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new TimelineInputError(code);
  return new Date(timestamp).toISOString();
}

export function parseTimelineRequest(url: URL) {
  const requestedLimit = url.searchParams.get('limit');
  const limit = requestedLimit === null ? DEFAULT_LIMIT : Number(requestedLimit);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TimelineInputError('invalid_limit');
  const from = optionalDate(url.searchParams.get('from'), 'invalid_from');
  const to = optionalDate(url.searchParams.get('to'), 'invalid_to');
  if (from && to && from > to) throw new TimelineInputError('invalid_date_range');
  const moduleCode = url.searchParams.get('module')?.trim() || null;
  if (moduleCode && !MODULE_PATTERN.test(moduleCode)) throw new TimelineInputError('invalid_module');
  const rawEventType = url.searchParams.get('eventType')?.trim() || null;
  if (rawEventType && !EVENT_TYPES.has(rawEventType)) throw new TimelineInputError('invalid_event_type');
  const rawVerification = url.searchParams.get('verificationStatus')?.trim() || null;
  if (rawVerification && !VERIFICATION_STATUSES.has(rawVerification)) {
    throw new TimelineInputError('invalid_verification_status');
  }
  return {
    limit: Math.min(limit, MAX_TIMELINE_PAGE_SIZE),
    cursor: url.searchParams.get('cursor') || null,
    filters: {
      from, to, moduleCode,
      eventType: rawEventType as TimelineEventType | null,
      verificationStatus: rawVerification as TimelineVerification | null,
    } satisfies TimelineFilters,
  };
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asTimestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  throw new Error('timeline_corrupt_timestamp');
}

export async function readLearningTimeline({
  sql, academyId, studentId, limit, cursor, filters,
}: {
  sql: TimelineQueryClient;
  academyId: string;
  studentId: string;
  limit: number;
  cursor: string | null;
  filters: TimelineFilters;
}) {
  const decoded = cursor ? decodeTimelineCursor(cursor, studentId, filters) : null;
  const params: unknown[] = [academyId, studentId];
  const conditions: string[] = [];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  if (filters.from) conditions.push(`occurred_at >= ${bind(filters.from)}::timestamptz`);
  if (filters.to) conditions.push(`occurred_at <= ${bind(filters.to)}::timestamptz`);
  if (filters.moduleCode) conditions.push(`module_code = ${bind(filters.moduleCode)}::text`);
  if (filters.eventType) conditions.push(`event_type = ${bind(filters.eventType)}::text`);
  if (filters.verificationStatus) conditions.push(`verification_status = ${bind(filters.verificationStatus)}::text`);
  if (decoded) {
    const time = bind(decoded.occurredAt);
    const id = bind(decoded.eventId);
    conditions.push(`(occurred_at, event_id) < (${time}::timestamptz, ${id}::text)`);
  }
  const fetchLimit = bind(limit + 1);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await sql.query(`
    WITH timeline AS (
      SELECT 'assignment:' || recipe.id::text AS event_id, recipe.student_id,
             COALESCE(recipe.cancelled_at, recipe.created_at) AS occurred_at, 'ASSIGNMENT_AVAILABLE'::text AS event_type,
             CASE WHEN recipe.cancelled_at IS NOT NULL THEN 'ASSIGNMENT_CANCELLED' ELSE 'ASSIGNMENT_CREATED' END::text AS assignment_lifecycle,
             recipe.module_code, recipe.id AS assignment_id, NULL::uuid AS training_session_id,
             NULL::uuid AS learning_record_id, recipe.name AS title,
             CASE WHEN recipe.cancelled_at IS NOT NULL THEN 'cancelled' WHEN recipe.is_active THEN 'available' ELSE 'closed' END AS status,
             NULL::jsonb AS result_summary, NULL::jsonb AS error_summary,
             NULL::jsonb AS skill_summary, NULL::text AS support_level,
             'server_authoritative'::text AS provenance, 'server_verified'::text AS verification_status,
             'training_recipes'::text AS source_reference
      FROM public.training_recipes recipe
      WHERE recipe.academy_id=$1::uuid AND recipe.student_id=$2::uuid

      UNION ALL
      SELECT 'session:' || session.id::text, session.student_id,
             COALESCE(session.completed_at, session.last_activity_at, session.started_at),
             CASE WHEN session.status='completed' THEN 'WORK_COMPLETED'
                  WHEN session.last_activity_at > session.started_at THEN 'WORK_RESUMED'
                  ELSE 'WORK_STARTED' END,
             CASE WHEN session.recipe_id IS NULL THEN NULL
                  WHEN session.status='completed' THEN 'ASSIGNMENT_COMPLETED'
                  ELSE 'ASSIGNMENT_STARTED' END::text,
             session.module_code, session.recipe_id, session.id, NULL::uuid,
             COALESCE(recipe.name, module.name), session.status::text,
             NULL::jsonb,
             NULL::jsonb, NULL::jsonb, NULL::text,
             'server_authoritative', 'server_verified', 'training_sessions'
      FROM public.training_sessions session
      JOIN public.modules module ON module.code=session.module_code
      LEFT JOIN public.training_recipes recipe
        ON recipe.id=session.recipe_id AND recipe.academy_id=session.academy_id AND recipe.student_id=session.student_id
      WHERE session.academy_id=$1::uuid AND session.student_id=$2::uuid

      UNION ALL
      SELECT 'record:' || record.id::text, record.student_id, record.completed_at,
             'LEARNING_RESULT', NULL::text, record.module_code, session.recipe_id, record.training_session_id, record.id,
             module.name, 'completed', record.performance, NULL::jsonb,
             jsonb_build_object('skills',record.skills), record.support_level,
             record.record_origin, record.verification_status, 'learning_records'
      FROM public.learning_records record
      JOIN public.modules module ON module.code=record.module_code
      JOIN public.training_sessions session
        ON session.id=record.training_session_id AND session.academy_id=record.academy_id AND session.student_id=record.student_id
      WHERE record.academy_id=$1::uuid AND record.student_id=$2::uuid

      UNION ALL
      SELECT 'error:' || attempt.id::text, attempt.student_id, attempt.created_at,
             'ERROR_OBSERVED', NULL::text, attempt.module_code, session.recipe_id, attempt.training_session_id, NULL::uuid,
             module.name, 'observed',
             jsonb_build_object('isCorrect',attempt.is_correct,'responseTimeMs',attempt.total_response_time_ms),
             jsonb_build_object('errorType',attempt.error_type,'detail',attempt.error_detail),
             NULL::jsonb, NULL::text, 'client_reported', 'client_reported', 'question_attempts'
      FROM public.question_attempts attempt
      JOIN public.modules module ON module.code=attempt.module_code
      JOIN public.training_sessions session
        ON session.id=attempt.training_session_id AND session.academy_id=attempt.academy_id AND session.student_id=attempt.student_id
      WHERE attempt.academy_id=$1::uuid AND attempt.student_id=$2::uuid AND NOT attempt.is_correct

      UNION ALL
      SELECT 'evidence:' || evidence.id::text, evidence.student_id, evidence.observed_at,
             'SKILL_EVIDENCE', NULL::text, record.module_code, session.recipe_id, record.training_session_id, record.id,
             module.name, 'observed', evidence.payload, NULL::jsonb,
             jsonb_build_object('skillCode',evidence.skill_code,'evidenceType',evidence.evidence_type),
             evidence.support_level,
             CASE WHEN evidence.verification_status='server_verified' THEN 'server_authoritative' ELSE 'legacy_client_reported' END,
             evidence.verification_status, 'learning_evidence'
      FROM public.learning_evidence evidence
      JOIN public.learning_records record
        ON record.id=evidence.learning_record_id AND record.academy_id=evidence.academy_id AND record.student_id=evidence.student_id
      JOIN public.training_sessions session
        ON session.id=record.training_session_id AND session.academy_id=record.academy_id AND session.student_id=record.student_id
      JOIN public.modules module ON module.code=record.module_code
      WHERE evidence.academy_id=$1::uuid AND evidence.student_id=$2::uuid
    )
    SELECT * FROM timeline ${where}
    ORDER BY occurred_at DESC, event_id DESC
    LIMIT ${fetchLimit}::int
  `, params);

  const events = rows.slice(0, limit).map((row): LearningTimelineEvent => ({
    eventId: String(row.event_id), studentId: String(row.student_id), occurredAt: asTimestamp(row.occurred_at),
    eventType: String(row.event_type) as TimelineEventType, moduleCode: String(row.module_code),
    assignmentLifecycle: typeof row.assignment_lifecycle === 'string' ? row.assignment_lifecycle as LearningTimelineEvent['assignmentLifecycle'] : null,
    assignmentId: typeof row.assignment_id === 'string' ? row.assignment_id : null,
    trainingSessionId: typeof row.training_session_id === 'string' ? row.training_session_id : null,
    learningRecordId: typeof row.learning_record_id === 'string' ? row.learning_record_id : null,
    title: String(row.title), status: String(row.status), resultSummary: asObject(row.result_summary),
    errorSummary: asObject(row.error_summary), skillSummary: asObject(row.skill_summary),
    supportLevel: typeof row.support_level === 'string' ? row.support_level : null,
    provenance: String(row.provenance), verificationStatus: String(row.verification_status) as TimelineVerification,
    sourceReference: String(row.source_reference),
  }));
  const hasMore = rows.length > limit;
  return {
    events,
    hasMore,
    nextCursor: hasMore && events.length ? encodeTimelineCursor(events.at(-1)!, studentId, filters) : null,
  };
}
