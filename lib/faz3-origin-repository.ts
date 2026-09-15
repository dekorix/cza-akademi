import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export type Faz3Principal = Readonly<{
  academyId: string;
  educatorId: string;
  role: 'educator' | 'reviewer' | 'publisher';
}>;

function sqlClient() {
  const url = process.env.CZA_FAZ3_STAGING_DATABASE_URL || '';
  if (!url) throw new Error('FAZ3_DATABASE_UNAVAILABLE');
  return neon(url);
}

export async function resolveFaz3Principal(subjectHash: string, jwtIdHash: string | null): Promise<Faz3Principal | null> {
  const sql = sqlClient();
  const rows = await sql`
    SELECT academy_id, educator_id, role
    FROM public.cza_faz3_resolve_principal(${subjectHash}, ${jwtIdHash})
  `;
  if (!rows.length) return null;
  const row = rows[0] as { academy_id: string; educator_id: string; role: Faz3Principal['role'] };
  if (!['educator', 'reviewer', 'publisher'].includes(row.role)) return null;
  return Object.freeze({ academyId: row.academy_id, educatorId: row.educator_id, role: row.role });
}

export async function consumeFaz3Nonce(nonce: string, requestId: string, subjectHash: string, expiresAtSeconds: number) {
  const sql = sqlClient();
  const nonceHash = createHash('sha256').update(nonce).digest('hex');
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  const rows = await sql`
    SELECT public.cza_faz3_consume_nonce(
      ${nonceHash}, ${requestId}::uuid, ${subjectHash}, ${expiresAt}::timestamptz
    ) AS consumed
  `;
  return rows[0]?.consumed === true;
}
