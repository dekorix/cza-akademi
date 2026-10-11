import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { qaStudentReads } from '@/lib/qa-student-read-contract';
import { isolatedQaDatabaseAllowed, isolatedQaEnabled, QA_EDUCATOR_ORIGIN } from '@/lib/isolated-qa-auth';
import { readRequestCookie, STUDENT_COOKIE } from '@/lib/student-session';

export async function studentReadSql(request: Request) {
  const sql = neon(process.env.DATABASE_URL!);
  if (!isolatedQaEnabled()) return sql;
  if (new URL(request.url).origin !== QA_EDUCATOR_ORIGIN || !await isolatedQaDatabaseAllowed()) {
    throw new Error('v03_qa_target_rejected');
  }
  const token = readRequestCookie(request, STUDENT_COOKIE);
  if (!token) throw new Error('v03_qa_session_required');
  const hash = createHash('sha256').update(token).digest('hex');
  const query = async (text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
    const key = createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
    const read = qaStudentReads[key];
    if (!read) throw new Error('v03_qa_projection_rejected');
    const recipe = read.recipeIndex >= 0 ? params[read.recipeIndex] : null;
    const at = read.timeIndex >= 0 ? params[read.timeIndex] : new Date().toISOString();
    // Student and academy parameters are intentionally never sent to the function.
    const rows = await sql`SELECT public.cza_v03_qa_student_read(${hash}::text,${read.id}::text,${recipe}::uuid,${at}::timestamptz) AS rows`;
    const result = rows[0]?.rows;
    if (!Array.isArray(result)) throw new Error('v03_qa_invalid_projection');
    return result as Record<string, unknown>[];
  };
  const tag = (strings: TemplateStringsArray, ...params: unknown[]) => {
    const text = strings.reduce((value, part, i) => value + (i ? `$${i}` : '') + part, '');
    return query(text, params);
  };
  // Preserve Neon query/tag call contracts; this adapter cannot run arbitrary SQL.
  return Object.assign(tag, { query });
}

export async function isolatedQaStudentLogin(request: Request, username: string, pin: string) {
  if (!isolatedQaEnabled()) return null;
  if (new URL(request.url).origin !== QA_EDUCATOR_ORIGIN || !await isolatedQaDatabaseAllowed()) {
    throw new Error('v03_qa_target_rejected');
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT public.cza_v03_qa_student_login(${username}::text,${pin}::text,${request.headers.get('user-agent')}::text) AS result`;
  return rows[0]?.result as Record<string, unknown>;
}
