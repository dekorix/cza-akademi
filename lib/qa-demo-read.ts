import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { assertQaStudentTarget } from '@/lib/qa-student-read';
import { readRequestCookie, STUDENT_COOKIE } from '@/lib/student-session';

// Explicit projections only; never accept raw SQL, student or academy from caller.
export async function qaDemoRead(request: Request, projection: 'timeline' | 'completed_results', input: object) {
  await assertQaStudentTarget(request);
  const token = readRequestCookie(request, STUDENT_COOKIE);
  if (!token) throw new Error('demo_read_session_rejected');
  const hash = createHash('sha256').update(token).digest('hex');
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT public.cza_a_demo_02_read(${hash}::text,${projection}::text,${JSON.stringify(input)}::jsonb) AS rows`;
  if (!Array.isArray(rows[0]?.rows)) throw new Error('demo_read_invalid_projection');
  return rows[0].rows as Record<string, unknown>[];
}
export function demoReadDenied(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return message.includes('demo_read_session_rejected') || message.includes('demo_read_scope_rejected');
}
