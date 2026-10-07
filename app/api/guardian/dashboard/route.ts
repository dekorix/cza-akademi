import { allowRequest,rateLimited } from '@/lib/request-guard';
import { guardianContext } from '@/lib/guardian-context';
import { readGuardianDashboard } from '@/lib/persistence/guardian-dashboard';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store'}});}

export async function GET(request:Request){
  try{
    const ctx=await guardianContext(request);
    if('error'in ctx)return json({ok:false,error:ctx.error},ctx.status);
    if(!('student'in ctx)||!ctx.student)return json({ok:false,error:'student_not_authorized'},403);
    const gate=await allowRequest(request,'guardian-dashboard',40,60_000,ctx.guardian.guardianUserId);
    if(!gate.allowed)return rateLimited(gate);
    const dashboard=await readGuardianDashboard({
      sql:ctx.sql,
      guardianUserId:ctx.guardian.guardianUserId,
      academyId:ctx.student.academyId,
      studentId:ctx.student.studentId,
    });
    if(!dashboard)return json({ok:false,error:'student_not_found'},404);
    return json({ok:true,dashboard});
  }catch{return json({ok:false,error:'guardian_dashboard_unavailable'},503);}
}
