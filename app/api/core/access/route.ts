import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  const student = await authenticatedStudent(request);
  if (!student) return json({ ok: false, error: 'session_required' }, 401);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);

  const sql = neon(process.env.DATABASE_URL);

  try {
    const [enrollments, entitlements] = await Promise.all([
      sql`
        SELECT id, package_code, package_label, price_snapshot_try, currency,
               activation_basis, status, starts_at, ends_at, created_at
        FROM public.student_package_enrollments
        WHERE academy_id = ${student.academy_id}::uuid
          AND student_id = ${student.student_id}::uuid
          AND status = 'active'
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY created_at DESC
        LIMIT 1
      `,
      sql`
        SELECT e.access_code, e.granted_at
        FROM public.student_access_entitlements e
        JOIN public.student_package_enrollments p
          ON p.id = e.enrollment_id
         AND p.status = 'active'
        WHERE e.academy_id = ${student.academy_id}::uuid
          AND e.student_id = ${student.student_id}::uuid
          AND e.status = 'active'
          AND p.starts_at <= now()
          AND (p.ends_at IS NULL OR p.ends_at > now())
        ORDER BY e.access_code
      `,
    ]);

    return json({
      ok: true,
      package: enrollments[0] || null,
      accessCodes: entitlements.map(row => String(row.access_code)),
    });
  } catch {
    return json({ ok: false, error: 'package_schema_unavailable' }, 503);
  }
}
