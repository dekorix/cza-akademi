import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const STUDENT_COOKIE = 'cza_student_session';

export function readRequestCookie(request: Request, name: string) {
  const pair = (request.headers.get('cookie') || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}

export async function authenticatedStudent(request: Request) {
  const token = readRequestCookie(request, STUDENT_COOKIE);
  if (!token || !process.env.DATABASE_URL) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT ss.student_id, ss.academy_id, ss.student_user_id
    FROM public.student_sessions ss
    JOIN public.students s ON s.id = ss.student_id
    JOIN public.users u ON u.id = ss.student_user_id
    WHERE ss.token_hash = ${tokenHash}
      AND ss.revoked_at IS NULL
      AND ss.expires_at > now()
      AND s.status = 'active'
      AND u.is_active = true
      AND u.role = 'student'
    LIMIT 1
  `;
  if (!rows.length) return null;
  await sql`UPDATE public.student_sessions SET last_seen_at = now() WHERE token_hash = ${tokenHash}`;
  return rows[0] as { student_id: string; academy_id: string; student_user_id: string };
}
