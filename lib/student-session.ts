import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const STUDENT_COOKIE = 'cza_student_session';

export class StudentSessionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'StudentSessionError';
  }
}

export function readRequestCookie(request: Request, name: string) {
  const pair = (request.headers.get('cookie') || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  if (!pair) return '';
  try {
    const value = decodeURIComponent(pair.slice(name.length + 1));
    return value.length <= 1024 ? value : '';
  } catch {
    return '';
  }
}

export async function authenticatedStudent(request: Request) {
  const token = readRequestCookie(request, STUDENT_COOKIE);
  if (!token || !process.env.DATABASE_URL) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT session_id, student_id, academy_id, student_user_id
    FROM public.cza_touch_authenticated_student(${tokenHash}::text)
  `;
  if (!rows.length) return null;
  return rows[0] as {
    session_id: string;
    student_id: string;
    academy_id: string;
    student_user_id: string;
  };
}

/**
 * Logout is successful only after the server-side token is durably revoked.
 * An absent/already-revoked token is idempotently considered revoked.
 */
export async function revokeStudentSession(request: Request) {
  const token = readRequestCookie(request, STUDENT_COOKIE);
  if (!token) return;
  if (!process.env.DATABASE_URL) {
    throw new StudentSessionError('database_unavailable');
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`
      SELECT public.cza_revoke_student_session(${tokenHash}::text)
    `;
  } catch {
    throw new StudentSessionError('logout_revocation_failed');
  }
}
