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
export const BROKER_INTERNAL_URL = 'https://broker.invalid/history';
export const BROKER_MAX_BYTES = 8192;
export const BROKER_MAX_VERIFICATION_AGE_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TYPES = new Set(['ASSIGNMENT_AVAILABLE','WORK_STARTED','WORK_RESUMED','WORK_COMPLETED','LEARNING_RESULT','ERROR_OBSERVED','SKILL_EVIDENCE']);
const VERIFICATIONS = new Set(['client_reported','legacy_client_reported','server_verified']);
export class BrokerError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 503) { super('broker_request_failed'); }
}
export function validateBrokerInput(value: unknown, expectedStudent: string, now = Date.now()): BrokerReadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BrokerError(400);
  const input = value as BrokerReadInput;
  if (Object.keys(input).sort().join(',') !== 'cursor,filters,limit,studentId,subject,verifiedAt') throw new BrokerError(400);
  if (typeof input.subject !== 'string' || !input.subject || input.subject.length > 256 || !UUID.test(input.studentId)) throw new BrokerError(400);
  if (input.studentId !== expectedStudent) throw new BrokerError(403);
  if (!Number.isSafeInteger(input.verifiedAt) || input.verifiedAt > now + 1000 || now - input.verifiedAt > BROKER_MAX_VERIFICATION_AGE_MS) throw new BrokerError(403);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50) throw new BrokerError(400);
  const f = input.filters;
  if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).sort().join(',') !== 'eventType,from,moduleCode,to,verificationStatus') throw new BrokerError(400);
  for (const date of [f.from,f.to]) if (date !== null && (typeof date !== 'string' || date.length > 40 || Number.isNaN(Date.parse(date)))) throw new BrokerError(400);
  if (f.from && f.to && f.from > f.to) throw new BrokerError(400);
  if (f.moduleCode !== null && (typeof f.moduleCode !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(f.moduleCode))) throw new BrokerError(400);
  if (f.eventType !== null && !TYPES.has(f.eventType)) throw new BrokerError(400);
  if (f.verificationStatus !== null && !VERIFICATIONS.has(f.verificationStatus)) throw new BrokerError(400);
  if (input.cursor !== null) {
    const c = input.cursor;
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).sort().join(',') !== 'eventId,occurredAt' ||
        typeof c.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|[+-]\d{2}:\d{2})$/.test(c.occurredAt) || Number.isNaN(Date.parse(c.occurredAt)) ||
        typeof c.eventId !== 'string' || !/^(assignment|session|record|error|evidence):[0-9a-f-]{36}$/.test(c.eventId)) throw new BrokerError(400);
  }
  return input;
}
