import { isolatedQaEnabled, QA_EDUCATOR_ORIGIN } from './isolated-qa-auth';
import { readLearningTimeline, parseTimelineRequest } from './persistence/learning-timeline';
import { BROKER_INTERNAL_URL, BrokerError, sealBrokerRequest, type PrivateBrokerBinding } from './qa-educator-broker-protocol';

type Bindings = {
  QA_EDUCATOR_HISTORY_BROKER?: PrivateBrokerBinding;
  QA_BROKER_STUDENT_ID?: string;
  QA_BROKER_ACADEMY_ID?: string;
  QA_BROKER_REQUEST_HMAC_SECRET?: string;
};
async function workerBindings(): Promise<Bindings> {
  try { const { env } = await import('cloudflare:workers'); return env as Bindings; }
  catch { throw new BrokerError(503); }
}
// subject comes from authenticatedEducator. The signed student and academy are the
// ingress bindings; a query string cannot select a different student or educator.
export async function readQaEducatorTimeline(request: Request, identity: { subject: string; studentId: string; verifiedAt: number }) {
  if (!isolatedQaEnabled() || new URL(request.url).origin !== QA_EDUCATOR_ORIGIN || request.method !== 'GET') throw new BrokerError(403);
  const url = new URL(request.url);
  for (const name of ['educatorId','authUserId','academyId']) if (url.searchParams.has(name)) throw new BrokerError(403);
  const bindings = await workerBindings();
  const broker = bindings.QA_EDUCATOR_HISTORY_BROKER;
  const studentId = bindings.QA_BROKER_STUDENT_ID;
  const academyId = bindings.QA_BROKER_ACADEMY_ID;
  const secret = bindings.QA_BROKER_REQUEST_HMAC_SECRET;
  if (!broker || !studentId || !academyId || !secret) throw new BrokerError(503);
  if (!identity.subject || identity.studentId !== studentId) throw new BrokerError(403);
  const parsed = parseTimelineRequest(url);
  return readLearningTimeline({
    sql: { query: async () => { throw new BrokerError(503); } },
    academyId, studentId, ...parsed,
    readRows: async ({filters,cursor,limit}) => {
      const body = await sealBrokerRequest(secret, {
        subject: identity.subject, studentId, academyId, ts: identity.verifiedAt, filters, cursor, limit,
      });
      const response = await broker.fetch(new Request(BROKER_INTERNAL_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body, signal: AbortSignal.timeout(5000),
      }));
      if (!response.ok) throw new BrokerError([400,401,403].includes(response.status) ? response.status as 400|401|403 : 503);
      const data = await response.json() as { rows?: unknown };
      if (!Array.isArray(data.rows)) throw new BrokerError(503);
      return data.rows as Record<string, unknown>[];
    },
  });
}
