import { neon } from '@neondatabase/serverless';
import { BrokerError, validateBrokerInput, BROKER_MAX_BYTES, type BrokerReadInput } from '../../lib/qa-educator-broker-protocol';

export type BrokerEnv = {
  BROKER_DATABASE_URL?: string;
  QA_BROKER_STUDENT_ID?: string;
  QA_BROKER_ACADEMY_ID?: string;
  QA_BROKER_PROJECT_ID?: string;
  QA_BROKER_BRANCH_ID?: string;
  QA_BROKER_DATABASE?: string;
  QA_BROKER_ROLE?: string;
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
async function readRows(input: BrokerReadInput, env: BrokerEnv) {
  if (!env.BROKER_DATABASE_URL || !env.QA_BROKER_STUDENT_ID || !env.QA_BROKER_ACADEMY_ID || !env.QA_BROKER_PROJECT_ID || !env.QA_BROKER_BRANCH_ID || !env.QA_BROKER_DATABASE || !env.QA_BROKER_ROLE) throw new BrokerError(503);
  const sql = neon(env.BROKER_DATABASE_URL);
  // Separate credential; no general-runtime or student fallback. HTTP driver only.
  const [rows] = await sql.transaction([
    sql.query('SELECT qa_broker_private.educator_history($1::text,$2::uuid,$3::jsonb,$4::jsonb,$5::int) AS result',
      [input.subject,input.studentId,JSON.stringify(input.filters),input.cursor ? JSON.stringify(input.cursor) : null,input.limit]),
  ], { readOnly: true });
  const result = rows[0]?.result as { scope?: Record<string, unknown>; rows?: unknown } | undefined;
  const s = result?.scope;
  if (!s || s.database !== env.QA_BROKER_DATABASE || s.project !== env.QA_BROKER_PROJECT_ID || s.branch !== env.QA_BROKER_BRANCH_ID || s.role !== env.QA_BROKER_ROLE || s.studentId !== env.QA_BROKER_STUDENT_ID || s.academyId !== env.QA_BROKER_ACADEMY_ID || !Array.isArray(result?.rows)) throw new BrokerError(503);
  if (result.rows.some((row: unknown) => !row || typeof row !== 'object' || !('student_id' in row) || row.student_id !== env.QA_BROKER_STUDENT_ID)) throw new BrokerError(503);
  return result.rows;
}
const brokerWorker = {
  async fetch(request: Request, env: BrokerEnv): Promise<Response> {
    // This entry is ONLY private Service Binding transport. Public URLs are disabled in the template.
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/history') return reply({ error: 'not_found' }, 404);
    try {
      if (!env.QA_BROKER_STUDENT_ID) throw new BrokerError(503);
      if (request.headers.has('cookie') || request.headers.has('authorization')) throw new BrokerError(403);
      const contentLength = request.headers.get('content-length');
      if (contentLength && Number(contentLength) > BROKER_MAX_BYTES) throw new BrokerError(400);
      const reader = request.body?.getReader(); if (!reader) throw new BrokerError(400);
      const parts: Uint8Array[] = []; let bytes = 0;
      while (true) { const { done,value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > BROKER_MAX_BYTES) { await reader.cancel(); throw new BrokerError(400); } parts.push(value); }
      const raw = new Uint8Array(bytes); let offset = 0; for (const part of parts) { raw.set(part,offset); offset += part.byteLength; }
      let value: unknown; try { value = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)); } catch { throw new BrokerError(400); }
      const input = validateBrokerInput(value,env.QA_BROKER_STUDENT_ID);
      return reply({ rows: await readRows(input,env) });
    } catch (error) {
      const status = error instanceof BrokerError ? error.status : error && typeof error === 'object' && 'code' in error && error.code === '42501' ? 403 : 503;
      return reply({ error: 'broker_read_failed' },status);
    }
  },
};

export default brokerWorker;
