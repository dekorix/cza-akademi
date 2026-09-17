import { createHmac, timingSafeEqual } from 'node:crypto';

export type ReportProvenance = 'SERVER_AUTHORITATIVE' | 'CLIENT_REPORTED' | 'MIXED';
export type ReportFilters = {
  from: string | null;
  to: string | null;
  moduleCode: string | null;
  assignmentStatus: 'active' | 'upcoming' | 'completed' | 'cancelled' | null;
  sessionStatus: 'active' | 'completed' | 'aborted' | null;
  provenance: ReportProvenance | null;
};

type QueryClient = { query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };
type Cursor = { v: 1; occurredAt: string; sessionId: string; scope: string };
const MODULE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSIGNMENT_STATUSES = new Set(['active', 'upcoming', 'completed', 'cancelled']);
const SESSION_STATUSES = new Set(['active', 'completed', 'aborted']);
const PROVENANCE = new Set<ReportProvenance>(['SERVER_AUTHORITATIVE', 'CLIENT_REPORTED', 'MIXED']);
const LEGACY_CLIENT_DERIVED_AUTHORITIES = new Set(['work_center_completion:v1']);
const TRUSTED_SERVER_AUTHORITIES = new Set(['canonical_server_evaluator:v1']);
export const MAX_REPORT_PAGE_SIZE = 50;

export class ReportInputError extends Error {
  constructor(public readonly code: string) { super(code); }
}

function optionalDate(value: string | null, code: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new ReportInputError(code);
  return new Date(parsed).toISOString();
}

export function parseEducatorReportRequest(url: URL) {
  const from = optionalDate(url.searchParams.get('from'), 'invalid_from');
  const to = optionalDate(url.searchParams.get('to'), 'invalid_to');
  if (from && to && from > to) throw new ReportInputError('invalid_date_range');
  const moduleCode = url.searchParams.get('module')?.trim() || null;
  if (moduleCode && !MODULE.test(moduleCode)) throw new ReportInputError('invalid_module');
  const assignmentStatus = url.searchParams.get('assignmentStatus')?.trim() || null;
  if (assignmentStatus && !ASSIGNMENT_STATUSES.has(assignmentStatus)) throw new ReportInputError('invalid_assignment_status');
  const sessionStatus = url.searchParams.get('sessionStatus')?.trim() || null;
  if (sessionStatus && !SESSION_STATUSES.has(sessionStatus)) throw new ReportInputError('invalid_session_status');
  const provenance = url.searchParams.get('provenance')?.trim() || null;
  if (provenance && !PROVENANCE.has(provenance as ReportProvenance)) throw new ReportInputError('invalid_provenance');
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new ReportInputError('invalid_limit');
  return {
    filters: { from, to, moduleCode, assignmentStatus, sessionStatus, provenance } as ReportFilters,
    limit: Math.min(limit, MAX_REPORT_PAGE_SIZE),
    cursor: url.searchParams.get('cursor') || null,
  };
}

function cursorSecret() {
  const secret = process.env.CZA_TIMELINE_CURSOR_SECRET || process.env.CZA_TRUSTED_PROXY_HMAC_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new ReportInputError('report_cursor_unavailable');
  return secret;
}

function scope(educatorId: string, studentId: string, filters: ReportFilters) {
  return JSON.stringify([educatorId, studentId, filters.from, filters.to, filters.moduleCode,
    filters.assignmentStatus, filters.sessionStatus, filters.provenance]);
}

function sign(value: string) {
  return createHmac('sha256', cursorSecret()).update(value).digest('base64url');
}

export function encodeReportCursor(row: Record<string, unknown>, educatorId: string, studentId: string, filters: ReportFilters) {
  const payload: Cursor = { v: 1, occurredAt: iso(row.occurred_at), sessionId: String(row.id), scope: scope(educatorId, studentId, filters) };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function decodeReportCursor(value: string, educatorId: string, studentId: string, filters: ReportFilters) {
  if (!value || value.length > 1024) throw new ReportInputError('invalid_cursor');
  const [encoded, supplied, extra] = value.split('.');
  if (!encoded || !supplied || extra !== undefined) throw new ReportInputError('invalid_cursor');
  const expected = sign(encoded);
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ReportInputError('invalid_cursor');
  let parsed: Partial<Cursor>;
  try { parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<Cursor>; }
  catch { throw new ReportInputError('invalid_cursor'); }
  if (parsed.v !== 1 || typeof parsed.occurredAt !== 'string' || Number.isNaN(Date.parse(parsed.occurredAt)) ||
      typeof parsed.sessionId !== 'string' || !UUID.test(parsed.sessionId) || parsed.scope !== scope(educatorId, studentId, filters)) {
    throw new ReportInputError('invalid_cursor');
  }
  return { occurredAt: parsed.occurredAt, sessionId: parsed.sessionId };
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  throw new Error('report_corrupt_timestamp');
}
function integer(value: unknown) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

export function resolveEvidenceProvenance({
  authority, evidenceVerificationStatus, parentRecordOrigin, parentVerificationStatus,
}: {
  authority: unknown; evidenceVerificationStatus: unknown;
  parentRecordOrigin: unknown; parentVerificationStatus: unknown;
}): Exclude<ReportProvenance, 'MIXED'> {
  if (typeof authority !== 'string' || LEGACY_CLIENT_DERIVED_AUTHORITIES.has(authority)) return 'CLIENT_REPORTED';
  if (parentRecordOrigin !== 'server_authoritative' || parentVerificationStatus !== 'server_verified') return 'CLIENT_REPORTED';
  if (evidenceVerificationStatus !== 'server_verified' || !TRUSTED_SERVER_AUTHORITIES.has(authority)) return 'CLIENT_REPORTED';
  return 'SERVER_AUTHORITATIVE';
}

export async function readEducatorAnalytics({ sql, educatorId, academyId, studentId, filters, limit, cursor }: {
  sql: QueryClient; educatorId: string; academyId: string; studentId: string;
  filters: ReportFilters; limit: number; cursor: string | null;
}) {
  const decoded = cursor ? decodeReportCursor(cursor, educatorId, studentId, filters) : null;
  const params: unknown[] = [academyId, studentId, filters.from, filters.to, filters.moduleCode,
    filters.assignmentStatus, filters.sessionStatus];
  const common = `academy_id=$1::uuid AND student_id=$2::uuid`;
  const dates = `( $3::timestamptz IS NULL OR occurred_at >= $3::timestamptz ) AND
                 ( $4::timestamptz IS NULL OR occurred_at <= $4::timestamptz )`;
  const includeServer = filters.provenance !== 'CLIENT_REPORTED';
  const includeClient = filters.provenance !== 'SERVER_AUTHORITATIVE';

  const summaryRows = await sql.query(`
    WITH assignments AS (
      SELECT r.id,r.module_code,r.created_at AS occurred_at,
        CASE WHEN r.cancelled_at IS NOT NULL THEN 'cancelled'
             WHEN EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.recipe_id=r.id AND s.status='completed') THEN 'completed'
             WHEN r.starts_at IS NOT NULL AND r.starts_at>now() THEN 'upcoming'
             ELSE 'active' END status
      FROM public.training_recipes r WHERE r.${common}
    ), sessions AS (
      SELECT s.id,s.module_code,COALESCE(s.completed_at,s.last_activity_at,s.started_at) occurred_at,s.status
      FROM public.training_sessions s WHERE s.${common}
    ), attempts AS (
      SELECT a.id,a.module_code,a.created_at occurred_at,a.is_correct,a.error_type
      FROM public.question_attempts a WHERE a.${common}
    )
    SELECT
      (SELECT count(*)::int FROM assignments WHERE ${dates} AND ($5::text IS NULL OR module_code=$5) AND ($6::text IS NULL OR status=$6)) assignment_total,
      (SELECT count(*)::int FROM assignments WHERE ${dates} AND status='active' AND ($5::text IS NULL OR module_code=$5) AND ($6::text IS NULL OR status=$6)) assignment_active,
      (SELECT count(*)::int FROM assignments WHERE ${dates} AND status='completed' AND ($5::text IS NULL OR module_code=$5) AND ($6::text IS NULL OR status=$6)) assignment_completed,
      (SELECT count(*)::int FROM assignments WHERE ${dates} AND status='cancelled' AND ($5::text IS NULL OR module_code=$5) AND ($6::text IS NULL OR status=$6)) assignment_cancelled,
      (SELECT count(*)::int FROM sessions WHERE ${dates} AND ($5::text IS NULL OR module_code=$5) AND ($7::text IS NULL OR status=$7)) session_total,
      (SELECT count(*)::int FROM sessions WHERE ${dates} AND status='completed' AND ($5::text IS NULL OR module_code=$5) AND ($7::text IS NULL OR status=$7)) session_completed,
      (SELECT max(occurred_at) FROM sessions WHERE ${dates} AND ($5::text IS NULL OR module_code=$5) AND ($7::text IS NULL OR status=$7)) last_activity_at,
      (SELECT count(*)::int FROM attempts WHERE ${dates} AND ($5::text IS NULL OR module_code=$5)) attempt_total,
      (SELECT count(*)::int FROM attempts WHERE ${dates} AND is_correct AND ($5::text IS NULL OR module_code=$5)) correct_total,
      (SELECT count(*)::int FROM attempts WHERE ${dates} AND NOT is_correct AND ($5::text IS NULL OR module_code=$5)) wrong_total
  `, params);
  const row = summaryRows[0] || {};
  const attempts = includeClient ? integer(row.attempt_total) : 0;

  const moduleRows = await sql.query(`
    WITH a AS (SELECT module_code,count(*)::int assignment_count FROM public.training_recipes
      WHERE ${common} AND ($3::timestamptz IS NULL OR created_at >= $3) AND ($4::timestamptz IS NULL OR created_at <= $4)
        AND ($5::text IS NULL OR module_code=$5) GROUP BY module_code),
    s AS (SELECT module_code,count(*)::int session_count,count(*) FILTER(WHERE status='completed')::int completed_count
      FROM public.training_sessions WHERE ${common} AND ($3::timestamptz IS NULL OR started_at >= $3) AND ($4::timestamptz IS NULL OR started_at <= $4)
        AND ($5::text IS NULL OR module_code=$5) AND ($7::text IS NULL OR status=$7) GROUP BY module_code),
    q AS (SELECT module_code,count(*)::int attempt_count,count(*) FILTER(WHERE is_correct)::int correct_count
      FROM public.question_attempts WHERE ${common} AND ($3::timestamptz IS NULL OR created_at >= $3) AND ($4::timestamptz IS NULL OR created_at <= $4)
        AND ($5::text IS NULL OR module_code=$5) GROUP BY module_code)
    SELECT COALESCE(a.module_code,s.module_code,q.module_code) module_code,
      COALESCE(a.assignment_count,0) assignment_count,COALESCE(s.session_count,0) session_count,
      COALESCE(s.completed_count,0) completed_count,COALESCE(q.attempt_count,0) attempt_count,
      COALESCE(q.correct_count,0) correct_count
    FROM a FULL JOIN s USING(module_code) FULL JOIN q USING(module_code) ORDER BY module_code
  `, params);

  const errorRows = includeClient ? await sql.query(`SELECT error_type,count(DISTINCT id)::int count
    FROM public.question_attempts WHERE ${common} AND NOT is_correct
      AND ($3::timestamptz IS NULL OR created_at >= $3) AND ($4::timestamptz IS NULL OR created_at <= $4)
      AND ($5::text IS NULL OR module_code=$5) GROUP BY error_type ORDER BY count DESC,error_type LIMIT 20`, params) : [];
  const trendRows = await sql.query(`
    WITH s AS (SELECT date_trunc('day',started_at) day,count(*)::int sessions,count(*) FILTER(WHERE status='completed')::int completions
      FROM public.training_sessions WHERE ${common} AND ($3::timestamptz IS NULL OR started_at >= $3) AND ($4::timestamptz IS NULL OR started_at <= $4)
      AND ($5::text IS NULL OR module_code=$5) GROUP BY 1),
    q AS (SELECT date_trunc('day',created_at) day,count(*)::int attempts,count(*) FILTER(WHERE is_correct)::int correct
      FROM public.question_attempts WHERE ${common} AND ($3::timestamptz IS NULL OR created_at >= $3) AND ($4::timestamptz IS NULL OR created_at <= $4)
      AND ($5::text IS NULL OR module_code=$5) GROUP BY 1)
    SELECT COALESCE(s.day,q.day) day,COALESCE(s.sessions,0) sessions,COALESCE(s.completions,0) completions,
      COALESCE(q.attempts,0) attempts,COALESCE(q.correct,0) correct FROM s FULL JOIN q USING(day) ORDER BY day DESC LIMIT 90`, params);

  const evidenceRows = await sql.query(`WITH projected AS (
    SELECT e.id,e.evidence_type,e.verification_status,e.verification_authority,
      e.skill_code,e.observed_at,COALESCE(r.module_code,'unknown') module_code,
      r.record_origin parent_record_origin,r.verification_status parent_verification_status,
      CASE WHEN e.verification_authority=ANY($10::text[]) THEN 'CLIENT_REPORTED'
        WHEN r.id IS NULL OR r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified' THEN 'CLIENT_REPORTED'
        WHEN e.verification_status='server_verified' AND e.verification_authority=ANY($9::text[]) THEN 'SERVER_AUTHORITATIVE'
        ELSE 'CLIENT_REPORTED' END final_provenance
    FROM public.learning_evidence e
    LEFT JOIN public.learning_records r ON r.id=e.learning_record_id AND r.academy_id=e.academy_id AND r.student_id=e.student_id
    WHERE e.academy_id=$1::uuid AND e.student_id=$2::uuid
      AND ($3::timestamptz IS NULL OR e.observed_at >= $3) AND ($4::timestamptz IS NULL OR e.observed_at <= $4)
      AND ($5::text IS NULL OR r.module_code=$5)
    ) SELECT * FROM projected WHERE $8::text IS NULL OR $8='MIXED' OR final_provenance=$8
    ORDER BY observed_at DESC,id DESC LIMIT 20`, [...params, filters.provenance,
      [...TRUSTED_SERVER_AUTHORITIES], [...LEGACY_CLIENT_DERIVED_AUTHORITIES]]);

  const pageParams: unknown[] = [...params];
  let cursorSql = '';
  if (decoded) { pageParams.push(decoded.occurredAt, decoded.sessionId); cursorSql = `AND (COALESCE(completed_at,last_activity_at,started_at),id)<($${pageParams.length-1}::timestamptz,$${pageParams.length}::uuid)`; }
  pageParams.push(limit + 1);
  const sessionRows = await sql.query(`SELECT id,recipe_id,module_code,status,started_at,completed_at,last_activity_at,
      COALESCE(completed_at,last_activity_at,started_at) occurred_at
    FROM public.training_sessions WHERE ${common}
      AND ($3::timestamptz IS NULL OR COALESCE(completed_at,last_activity_at,started_at) >= $3)
      AND ($4::timestamptz IS NULL OR COALESCE(completed_at,last_activity_at,started_at) <= $4)
      AND ($5::text IS NULL OR module_code=$5) AND ($7::text IS NULL OR status=$7) ${cursorSql}
    ORDER BY occurred_at DESC,id DESC LIMIT $${pageParams.length}`, pageParams);
  const page = sessionRows.slice(0, limit);

  return {
    summary: {
      assignments: includeServer ? { total: integer(row.assignment_total), active: integer(row.assignment_active), completed: integer(row.assignment_completed), cancelled: integer(row.assignment_cancelled), provenance: 'SERVER_AUTHORITATIVE' as const } : null,
      sessions: includeServer ? { total: integer(row.session_total), completed: integer(row.session_completed), lastActivityAt: row.last_activity_at ? iso(row.last_activity_at) : null, provenance: 'SERVER_AUTHORITATIVE' as const } : null,
      clientPerformance: includeClient ? { attempts, correct: integer(row.correct_total), wrong: integer(row.wrong_total), accuracy: attempts ? Math.round(integer(row.correct_total) * 1000 / attempts) / 10 : null, evidenceStatus: attempts ? 'AVAILABLE' : 'INSUFFICIENT', provenance: 'CLIENT_REPORTED' as const } : null,
    },
    modules: moduleRows.map(m => { const count=integer(m.attempt_count); return { moduleCode:String(m.module_code), assignmentCount:includeServer?integer(m.assignment_count):null, sessionCount:includeServer?integer(m.session_count):null, completedSessions:includeServer?integer(m.completed_count):null, attemptCount:includeClient?count:null, clientReportedAccuracy:includeClient&&count?Math.round(integer(m.correct_count)*1000/count)/10:null, provenance: includeServer&&includeClient?'MIXED':includeServer?'SERVER_AUTHORITATIVE':'CLIENT_REPORTED' }; }),
    errors: errorRows.map(e => ({ errorType:String(e.error_type), count:integer(e.count), provenance:'CLIENT_REPORTED' as const })),
    evidence: evidenceRows.map(e => ({ id:String(e.id), type:String(e.evidence_type), moduleCode:String(e.module_code),
      skillCode:typeof e.skill_code==='string'?e.skill_code:null, observedAt:iso(e.observed_at),
      verificationStatus:String(e.verification_status), verificationAuthority:typeof e.verification_authority==='string'?e.verification_authority:null,
      provenance:resolveEvidenceProvenance({ authority:e.verification_authority,
        evidenceVerificationStatus:e.verification_status,parentRecordOrigin:e.parent_record_origin,
        parentVerificationStatus:e.parent_verification_status }) })),
    trend: trendRows.map(t => { const count=integer(t.attempts); return { day:iso(t.day), sessions:includeServer?integer(t.sessions):null, completions:includeServer?integer(t.completions):null, attempts:includeClient?count:null, clientReportedAccuracy:includeClient&&count?Math.round(integer(t.correct)*1000/count)/10:null, provenance:includeServer&&includeClient?'MIXED':includeServer?'SERVER_AUTHORITATIVE':'CLIENT_REPORTED' }; }),
    sessions: page.map(s => ({ id:String(s.id), assignmentId:typeof s.recipe_id==='string'?s.recipe_id:null, moduleCode:String(s.module_code), status:String(s.status), startedAt:iso(s.started_at), completedAt:s.completed_at?iso(s.completed_at):null, lastActivityAt:iso(s.last_activity_at), provenance:'SERVER_AUTHORITATIVE' as const })),
    nextCursor: sessionRows.length>limit && page.length ? encodeReportCursor(page.at(-1)!,educatorId,studentId,filters) : null,
  };
}
