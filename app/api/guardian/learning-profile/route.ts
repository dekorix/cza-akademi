import { allowRequest,rateLimited } from '@/lib/request-guard';
import { guardianContext } from '@/lib/guardian-context';
import { readStudentLearningProfile } from '@/lib/persistence/student-learning-profile';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store'}});}

export async function GET(request:Request){
  try{
    const ctx=await guardianContext(request);
    if('error'in ctx)return json({ok:false,error:ctx.error},ctx.status);
    if(!('student'in ctx)||!ctx.student)return json({ok:false,error:'student_not_authorized'},403);
    const gate=await allowRequest(request,'guardian-learning-profile',30,60_000,ctx.guardian.guardianUserId);
    if(!gate.allowed)return rateLimited(gate);
    const profile=await readStudentLearningProfile({sql:ctx.sql,academyId:ctx.student.academyId,studentId:ctx.student.studentId});
    if(!profile)return json({ok:false,error:'student_profile_not_found'},404);
    return json({ok:true,profile:{
      student:profile.student,
      calculatedAt:profile.calculatedAt,
      dataThrough:profile.dataThrough,
      coverage:profile.coverage,
      studyPattern:profile.studyPattern,
      modules:profile.modules.map(item=>({
        moduleCode:item.moduleCode,moduleName:item.moduleName,assignments:item.assignments,
        sessions:item.sessions,records:item.records,attempts:item.attempts,
        clientReportedAccuracy:item.clientReportedAccuracy,provenance:item.provenance,
      })),
      skills:profile.skills.map(item=>({
        skillCode:item.skillCode,moduleCode:item.moduleCode,recordCount:item.recordCount,provenance:item.provenance,
      })),
      errors:profile.errors.map(item=>({errorType:item.errorType,count:item.count,provenance:item.provenance})),
      process:{supportLevels:profile.process.supportLevels,insufficiencyReason:profile.process.insufficiencyReason},
      periods:profile.periods,
    }});
  }catch{return json({ok:false,error:'guardian_profile_unavailable'},503);}
}
