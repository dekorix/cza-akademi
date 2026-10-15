import { neon } from '@neondatabase/serverless';
import {
  authenticateBrokerRequest,
  BrokerError,
  BROKER_MAX_BYTES,
  BROKER_NONCE_TTL_MS,
  type BrokerReadInput,
  type NonceLedger,
} from '../../lib/qa-educator-broker-protocol';

type NonceObjectId = { toString(): string };
type NonceNamespace = {
  idFromName(name: string): NonceObjectId;
  get(id: NonceObjectId): { fetch(input: RequestInfo, init?: RequestInit): Promise<Response> };
};
export type BrokerEnv = {
  BROKER_DATABASE_URL?: string;
  QA_BROKER_STUDENT_ID?: string;
  QA_BROKER_ACADEMY_ID?: string;
  QA_BROKER_PROJECT_ID?: string;
  QA_BROKER_BRANCH_ID?: string;
  QA_BROKER_DATABASE?: string;
  QA_BROKER_ROLE?: string;
  QA_BROKER_REQUEST_HMAC_SECRET?: string;
  BROKER_NONCE_LEDGER?: NonceNamespace;
};

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export class BrokerNonceLedger implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/consume') return new Response(null, { status: 404 });
    let payload: unknown;
    try { payload = await request.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
    const body = payload as { nonce?: unknown; expireAtMs?: unknown };
    const now = Date.now();
    if (typeof body.nonce !== 'string' || !/^[0-9a-f]{64}$/.test(body.nonce)) return Response.json({ ok: false }, { status: 400 });
    if (typeof body.expireAtMs !== 'number' || !Number.isSafeInteger(body.expireAtMs) || body.expireAtMs <= now || body.expireAtMs > now + BROKER_NONCE_TTL_MS * 2) {
      return Response.json({ ok: false }, { status: 400 });
    }
    const expireAtMs = body.expireAtMs;
    const key = `n:${body.nonce}`;
    // A Durable Object runs one request at a time, so get-then-put is the consume-once critical section.
    const existing = await this.state.storage.get<number>(key);
    if (typeof existing === 'number' && existing > now) return Response.json({ ok: false });
    await this.state.storage.put(key, expireAtMs);
    const alarm = await this.state.storage.getAlarm();
    if (alarm === null || expireAtMs < alarm) await this.state.storage.setAlarm(expireAtMs);
    return Response.json({ ok: true });
  }
  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.state.storage.list<number>({ prefix: 'n:' });
    const stale: string[] = [];
    let next = Number.POSITIVE_INFINITY;
    for (const [key, exp] of entries) {
      if (typeof exp !== 'number' || exp <= now) stale.push(key);
      else if (exp < next) next = exp;
    }
    if (stale.length) await this.state.storage.delete(stale);
    if (Number.isFinite(next)) await this.state.storage.setAlarm(next);
  }
}

function nonceLedger(env: BrokerEnv): NonceLedger {
  const namespace = env.BROKER_NONCE_LEDGER;
  if (!namespace) throw new BrokerError(503);
  return {
    async consume(nonce, expireAtMs) {
      let response: Response;
      try {
        response = await namespace.get(namespace.idFromName('qa-broker-request-nonces')).fetch('https://broker-nonce.invalid/consume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nonce, expireAtMs }),
        });
      } catch { throw new BrokerError(503); }
      if (!response.ok) throw new BrokerError(503);
      let data: unknown;
      try { data = await response.json(); } catch { throw new BrokerError(503); }
      if (!data || typeof data !== 'object' || !('ok' in data) || typeof (data as { ok?: unknown }).ok !== 'boolean') throw new BrokerError(503);
      return (data as { ok: boolean }).ok;
    },
  };
}

async function readRows(input: BrokerReadInput, env: BrokerEnv) {
  if (!env.BROKER_DATABASE_URL || !env.QA_BROKER_STUDENT_ID || !env.QA_BROKER_ACADEMY_ID || !env.QA_BROKER_PROJECT_ID || !env.QA_BROKER_BRANCH_ID || !env.QA_BROKER_DATABASE || !env.QA_BROKER_ROLE) throw new BrokerError(503);
  const sql = neon(env.BROKER_DATABASE_URL);
  // Separate credential; no general-runtime or student fallback. HTTP driver only.
  const [rows] = await sql.transaction([
    sql.query('SELECT qa_broker_private.educator_history($1::text,$2::uuid,$3::jsonb,$4::jsonb,$5::int) AS result',
      [input.subject, input.studentId, JSON.stringify(input.filters), input.cursor ? JSON.stringify(input.cursor) : null, input.limit]),
  ], { readOnly: true });
  const result = rows[0]?.result as { scope?: Record<string, unknown>; rows?: unknown } | undefined;
  const s = result?.scope;
  if (!s || s.database !== env.QA_BROKER_DATABASE || s.project !== env.QA_BROKER_PROJECT_ID || s.branch !== env.QA_BROKER_BRANCH_ID || s.role !== env.QA_BROKER_ROLE || s.studentId !== env.QA_BROKER_STUDENT_ID || s.academyId !== env.QA_BROKER_ACADEMY_ID || !Array.isArray(result?.rows)) throw new BrokerError(503);
  if (result.rows.some((row: unknown) => !row || typeof row !== 'object' || !('student_id' in row) || row.student_id !== env.QA_BROKER_STUDENT_ID)) throw new BrokerError(503);
  return result.rows;
}

const brokerWorker = {
  async fetch(request: Request, env: BrokerEnv): Promise<Response> {
    // Private Service Binding only. Public routes stay disabled in the non-deployed template.
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/history') return reply({ error: 'not_found' }, 404);
    try {
      if (!env.QA_BROKER_STUDENT_ID || !env.QA_BROKER_ACADEMY_ID || !env.QA_BROKER_REQUEST_HMAC_SECRET || !env.BROKER_NONCE_LEDGER) throw new BrokerError(503);
      if (request.headers.has('cookie') || request.headers.has('authorization')) throw new BrokerError(403);
      const contentLength = request.headers.get('content-length');
      if (contentLength && Number(contentLength) > BROKER_MAX_BYTES) throw new BrokerError(400);
      const reader = request.body?.getReader(); if (!reader) throw new BrokerError(400);
      const parts: Uint8Array[] = []; let bytes = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > BROKER_MAX_BYTES) { await reader.cancel(); throw new BrokerError(400); } parts.push(value); }
      const raw = new Uint8Array(bytes); let offset = 0; for (const part of parts) { raw.set(part, offset); offset += part.byteLength; }
      let value: unknown; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { throw new BrokerError(400); }
      const input = await authenticateBrokerRequest(
        env.QA_BROKER_REQUEST_HMAC_SECRET,
        value,
        { method: request.method, path: new URL(request.url).pathname },
        { studentId: env.QA_BROKER_STUDENT_ID, academyId: env.QA_BROKER_ACADEMY_ID },
        nonceLedger(env),
      );
      return reply({ rows: await readRows(input, env) });
    } catch (error) {
      const status = error instanceof BrokerError ? error.status : error && typeof error === 'object' && 'code' in error && error.code === '42501' ? 403 : 503;
      return reply({ error: 'broker_read_failed' }, status);
    }
  },
};

export default brokerWorker;
