import { neon } from '@neondatabase/serverless';
import { authenticatedGuardian } from '@/lib/guardian-auth';
import { resolveGuardianStudent,GuardianAccessError } from '@/lib/guardian-access';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function guardianContext(request:Request,{studentRequired=true}:{studentRequired?:boolean}={}){
  const guardian=await authenticatedGuardian(request);
  if(!guardian)return {error:'guardian_session_required',status:401} as const;
  if(!process.env.DATABASE_URL)return {error:'database_unavailable',status:503} as const;
  const sql=neon(process.env.DATABASE_URL);
  if(!studentRequired)return {guardian,sql} as const;
  const studentId=new URL(request.url).searchParams.get('studentId')?.trim()||'';
  if(!UUID.test(studentId))return {error:'invalid_student_id',status:400} as const;
  try{
    const student=await resolveGuardianStudent(sql,guardian,studentId);
    return {guardian,sql,student} as const;
  }catch(error){
    if(error instanceof GuardianAccessError)return {error:error.code,status:error.status} as const;
    throw error;
  }
}
