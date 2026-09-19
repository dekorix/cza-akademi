import type { GuardianIdentity } from '@/lib/guardian-auth';

export type GuardianSql={query:(text:string,params?:unknown[])=>Promise<Record<string,unknown>[]>};

export class GuardianAccessError extends Error{
  constructor(public readonly code:string,public readonly status=403){super(code);}
}

export async function listGuardianStudents(sql:GuardianSql,guardian:GuardianIdentity){
  return sql.query(`
    SELECT student.id,student.academy_id,
      concat_ws(' ',student.first_name,student.last_name) AS name,
      ''::text AS campus_code
    FROM public.guardian_student_links link
    JOIN public.users guardian_user
      ON guardian_user.id=link.guardian_user_id
      AND guardian_user.academy_id=link.academy_id
      AND guardian_user.role::text='guardian'
      AND guardian_user.is_active=true
    JOIN public.students student
      ON student.id=link.student_id
      AND student.academy_id=link.academy_id
      AND student.status='active'
    WHERE link.guardian_user_id=$1::uuid
      AND link.academy_id=$2::uuid
      AND link.can_view=true
    ORDER BY student.first_name NULLS LAST,student.last_name NULLS LAST,student.id
    LIMIT 20
  `,[guardian.guardianUserId,guardian.academyId]);
}

export async function resolveGuardianStudent(sql:GuardianSql,guardian:GuardianIdentity,studentId:string){
  const rows=await sql.query(`
    SELECT student.id student_id,student.academy_id,
      concat_ws(' ',student.first_name,student.last_name) AS student_name
    FROM public.guardian_student_links link
    JOIN public.users guardian_user
      ON guardian_user.id=link.guardian_user_id
      AND guardian_user.academy_id=link.academy_id
    JOIN public.students student
      ON student.id=link.student_id
      AND student.academy_id=link.academy_id
    WHERE guardian_user.id=$1::uuid
      AND guardian_user.auth_user_id=$2::uuid
      AND guardian_user.role::text='guardian'
      AND guardian_user.is_active=true
      AND link.can_view=true
      AND student.status='active'
      AND student.id=$3::uuid
      AND student.academy_id=$4::uuid
    LIMIT 1
  `,[guardian.guardianUserId,guardian.authUserId,studentId,guardian.academyId]);
  if(!rows.length)throw new GuardianAccessError('student_not_authorized',403);
  const row=rows[0];
  return {studentId:String(row.student_id),academyId:String(row.academy_id),studentName:typeof row.student_name==='string'&&row.student_name.trim()?row.student_name:'Öğrenci'};
}
