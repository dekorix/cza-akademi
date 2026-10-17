import type { TimelineFilters } from './persistence/learning-timeline';

export type BrokerReadInput = {
  subject: string;
  studentId: string;
  verifiedAt: number;
  filters: TimelineFilters;
  cursor: { occurredAt: string; eventId: string } | null;
  limit: number;
};
export type PrivateBrokerBinding = { fetch(request: Request): Promise<Response> };
export type NonceLedger = {
  /** Returns false when this nonce was already consumed and is still inside its TTL. */
  consume(nonce: string, expireAtMs: number): Promise<boolean>;
};
export const BROKER_INTERNAL_URL = 'https://broker.invalid/history';
export const BROKER_METHOD = 'POST';
export const BROKER_PATH = '/history';
export const BROKER_MAC_CONTEXT = 'CZA-BROKER-REQ-v1';
export const BROKER_MAX_BYTES = 8192;
export const BROKER_MAX_CLOCK_SKEW_MS = 1000;
export const BROKER_MAX_VERIFICATION_AGE_MS = 5000;
export const BROKER_NONCE_TTL_MS = 60_000;
export const HMAC_SECRET_MIN_BYTES = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^[0-9a-f]{64}$/;
const SIG = /^[A-Za-z0-9_-]{43}$/;
const TYPES = new Set(['ASSIGNMENT_AVAILABLE','WORK_STARTED','WORK_RESUMED','WORK_COMPLETED','LEARNING_RESULT','ERROR_OBSERVED','SKILL_EVIDENCE']);
const VERIFICATIONS = new Set(['client_reported','legacy_client_reported','server_verified']);
const ENVELOPE_KEYS = 'academyId,nonce,read,sig,studentId,subject,ts,v';
const READ_KEYS = 'cursor,filters,limit,studentId';
const FILTER_KEYS = 'eventType,from,moduleCode,to,verificationStatus';

export class BrokerError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 503) { super('broker_request_failed'); }
}

type ReadCursor = { occurredAt: string; eventId: string };
type CanonicalRead = {
  studentId: string;
  filters: TimelineFilters;
  cursor: ReadCursor | null;
  limit: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BrokerError(400);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: string) {
  if (Object.keys(value).sort().join(',') !== expected) throw new BrokerError(400);
}
function prefixed(value: string) {
  return `${new TextEncoder().encode(value).byteLength}.${value}`;
}
function bytesToHex(bytes: Uint8Array) {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
function encodeBase64Url(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeBase64Url(value: string) {
  if (!SIG.test(value)) return null;
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}
async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  const raw = new TextEncoder().encode(secret);
  if (raw.byteLength < HMAC_SECRET_MIN_BYTES) throw new BrokerError(503);
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export function canonicalReadBody(read: CanonicalRead) {
  return JSON.stringify({
    cursor: read.cursor === null ? null : { eventId: read.cursor.eventId, occurredAt: read.cursor.occurredAt },
    filters: {
      eventType: read.filters.eventType,
      from: read.filters.from,
      moduleCode: read.filters.moduleCode,
      to: read.filters.to,
      verificationStatus: read.filters.verificationStatus,
    },
    limit: read.limit,
    studentId: read.studentId,
  });
}

export function brokerMacMessage(input: {
  method: string;
  path: string;
  bodyHashHex: string;
  ts: number;
  nonce: string;
  subject: string;
  studentId: string;
  academyId: string;
}) {
  return [
    BROKER_MAC_CONTEXT,
    prefixed(input.method),
    prefixed(input.path),
    prefixed(String(input.ts)),
    prefixed(input.nonce),
    prefixed(input.subject),
    prefixed(input.studentId),
    prefixed(input.academyId),
    prefixed(input.bodyHashHex),
  ].join('\n');
}

function validateFilters(value: unknown): TimelineFilters {
  const filters = record(value);
  exactKeys(filters, FILTER_KEYS);
  for (const date of [filters.from, filters.to]) {
    if (date !== null && (typeof date !== 'string' || date.length > 40 || Number.isNaN(Date.parse(date)))) throw new BrokerError(400);
  }
  if (typeof filters.from === 'string' && typeof filters.to === 'string' && filters.from > filters.to) throw new BrokerError(400);
  if (filters.moduleCode !== null && (typeof filters.moduleCode !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(filters.moduleCode))) throw new BrokerError(400);
  if (filters.eventType !== null && (typeof filters.eventType !== 'string' || !TYPES.has(filters.eventType))) throw new BrokerError(400);
  if (filters.verificationStatus !== null && (typeof filters.verificationStatus !== 'string' || !VERIFICATIONS.has(filters.verificationStatus))) throw new BrokerError(400);
  return {
    from: filters.from as string | null,
    to: filters.to as string | null,
    moduleCode: filters.moduleCode as string | null,
    eventType: filters.eventType as TimelineFilters['eventType'],
    verificationStatus: filters.verificationStatus as TimelineFilters['verificationStatus'],
  };
}

function validateCursor(value: unknown): ReadCursor | null {
  if (value === null) return null;
  const cursor = record(value);
  if (Object.keys(cursor).sort().join(',') !== 'eventId,occurredAt' ||
    typeof cursor.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|[+-]\d{2}:\d{2})$/.test(cursor.occurredAt) || Number.isNaN(Date.parse(cursor.occurredAt)) ||
    typeof cursor.eventId !== 'string' || !/^(assignment|session|record|error|evidence):[0-9a-f-]{36}$/.test(cursor.eventId)) throw new BrokerError(400);
  return { occurredAt: cursor.occurredAt, eventId: cursor.eventId };
}

function validateRead(value: unknown): CanonicalRead {
  const read = record(value);
  exactKeys(read, READ_KEYS);
  if (typeof read.studentId !== 'string' || !UUID.test(read.studentId)) throw new BrokerError(400);
  if (!Number.isSafeInteger(read.limit) || (read.limit as number) < 1 || (read.limit as number) > 50) throw new BrokerError(400);
  return {
    studentId: read.studentId,
    filters: validateFilters(read.filters),
    cursor: validateCursor(read.cursor),
    limit: read.limit as number,
  };
}

export function createMemoryNonceLedger(now: () => number = Date.now): NonceLedger {
  const seen = new Map<string, number>();
  return {
    async consume(nonce, expireAtMs) {
      const clock = now();
      for (const [key, exp] of seen) if (exp <= clock) seen.delete(key);
      const current = seen.get(nonce);
      if (current !== undefined && current > clock) return false;
      seen.set(nonce, expireAtMs);
      return true;
    },
  };
}

export async function sealBrokerRequest(secret: string, input: {
  subject: string;
  studentId: string;
  academyId: string;
  ts: number;
  nonce?: string;
  filters: TimelineFilters;
  cursor: ReadCursor | null;
  limit: number;
  readStudentId?: string;
}) {
  const read = validateRead({
    studentId: input.readStudentId ?? input.studentId,
    filters: input.filters,
    cursor: input.cursor,
    limit: input.limit,
  });
  if (typeof input.subject !== 'string' || !input.subject || input.subject.length > 256 || !UUID.test(input.studentId) || !UUID.test(input.academyId)) throw new BrokerError(400);
  if (!Number.isSafeInteger(input.ts)) throw new BrokerError(400);
  const nonce = input.nonce ?? bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  if (!NONCE.test(nonce)) throw new BrokerError(400);
  const bodyHashHex = await sha256Hex(canonicalReadBody(read));
  const message = brokerMacMessage({
    method: BROKER_METHOD,
    path: BROKER_PATH,
    bodyHashHex,
    ts: input.ts,
    nonce,
    subject: input.subject,
    studentId: input.studentId,
    academyId: input.academyId,
  });
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(message));
  return JSON.stringify({
    v: 1,
    ts: input.ts,
    nonce,
    subject: input.subject,
    studentId: input.studentId,
    academyId: input.academyId,
    read: {
      studentId: read.studentId,
      filters: read.filters,
      cursor: read.cursor,
      limit: read.limit,
    },
    sig: encodeBase64Url(signature),
  });
}

export async function authenticateBrokerRequest(
  secret: string,
  value: unknown,
  observed: { method: string; path: string },
  expected: { studentId: string; academyId: string },
  ledger: NonceLedger,
  now = Date.now(),
): Promise<BrokerReadInput> {
  const envelope = record(value);
  exactKeys(envelope, ENVELOPE_KEYS);
  const subject = envelope.subject;
  const studentId = envelope.studentId;
  const academyId = envelope.academyId;
  const ts = envelope.ts;
  const nonce = envelope.nonce;
  const sig = envelope.sig;
  if (envelope.v !== 1) throw new BrokerError(400);
  if (typeof subject !== 'string' || !subject || subject.length > 256) throw new BrokerError(400);
  if (typeof studentId !== 'string' || !UUID.test(studentId)) throw new BrokerError(400);
  if (typeof academyId !== 'string' || !UUID.test(academyId)) throw new BrokerError(400);
  if (typeof ts !== 'number' || !Number.isSafeInteger(ts)) throw new BrokerError(400);
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) throw new BrokerError(400);
  if (typeof sig !== 'string' || !SIG.test(sig)) throw new BrokerError(401);
  const read = validateRead(envelope.read);
  const signature = decodeBase64Url(sig);
  if (!signature) throw new BrokerError(401);
  const bodyHashHex = await sha256Hex(canonicalReadBody(read));
  const message = brokerMacMessage({
    method: observed.method, path: observed.path, bodyHashHex, ts, nonce, subject, studentId, academyId,
  });
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), signature, new TextEncoder().encode(message));
  if (!valid) throw new BrokerError(401);
  if (ts > now + BROKER_MAX_CLOCK_SKEW_MS || now - ts > BROKER_MAX_VERIFICATION_AGE_MS) throw new BrokerError(401);
  if (read.studentId !== studentId) throw new BrokerError(403);
  if (studentId !== expected.studentId || academyId !== expected.academyId) throw new BrokerError(403);
  const expireAtMs = ts + BROKER_NONCE_TTL_MS;
  let fresh = false;
  try { fresh = await ledger.consume(nonce, expireAtMs); }
  catch (error) { if (error instanceof BrokerError) throw error; throw new BrokerError(503); }
  if (!fresh) throw new BrokerError(401);
  return { subject, studentId, verifiedAt: ts, filters: read.filters, cursor: read.cursor, limit: read.limit };
}
