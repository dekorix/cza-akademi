import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { createSourceAssessmentContextHandler, type SourceAssessmentStudent } from '@/lib/source-assessment-context';

function database() {
  if (!process.env.DATABASE_URL) throw new Error('database_unavailable');
  return neon(process.env.DATABASE_URL);
}

function studentFromRow(row: Record<string, unknown> | undefined): SourceAssessmentStudent | null {
  if (!row) return null;
  return {
    id: String(row.id),
    academyId: String(row.academy_id),
    name: String(row.name || 'Öğrenci'),
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
  };
}

const handle = createSourceAssessmentContextHandler({
  authenticateStudent: authenticatedStudent,
  async authenticateEducator(request) {
    const educator = await authenticatedEducator(request);
    return educator?.id ? { id: educator.id } : null;
  },
  async findStudent(studentId, academyId) {
    const sql = database();
    const rows = await sql`
      SELECT s.id, s.academy_id, concat_ws(' ', s.first_name, s.last_name) AS name, s.birth_date
      FROM public.students s
      WHERE s.id=${studentId}::uuid AND s.academy_id=${academyId}::uuid AND s.status='active'
      LIMIT 1
    `;
    return studentFromRow(rows[0]);
  },
  async findLinkedStudent(studentId, educatorId) {
    const sql = database();
    const rows = await sql`
      SELECT s.id, s.academy_id, concat_ws(' ', s.first_name, s.last_name) AS name, s.birth_date
      FROM public.students s
      WHERE s.id=${studentId}::uuid AND s.status='active'
        AND EXISTS (
          SELECT 1 FROM public.teacher_student_links l
          JOIN public.users t ON t.id=l.teacher_id
          WHERE l.student_id=s.id AND l.academy_id=s.academy_id
            AND t.academy_id=s.academy_id AND l.can_view=true
            AND t.auth_user_id=${educatorId} AND t.is_active=true
        )
      LIMIT 1
    `;
    return studentFromRow(rows[0]);
  },
});

export async function GET(request: Request) {
  const gate = allowRequest(request, 'source-assessment-context', 60, 10 * 60_000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  return handle(request);
}
