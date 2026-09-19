import { allowRequest,rateLimited } from '@/lib/request-guard';
import { guardianContext } from '@/lib/guardian-context';
import { parseEducatorReportRequest,readEducatorAnalytics,ReportInputError } from '@/lib/persistence/educator-analytics';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store'}});}

export async function GET(request:Request){
  try{
    const ctx=await guardianContext(request);
    if('error'in ctx)return json({ok:false,error:ctx.error},ctx.status);
    if(!('student'in ctx)||!ctx.student)return json({ok:false,error:'student_not_authorized'},403);
    const gate=await allowRequest(request,'guardian-report',30,60_000,ctx.guardian.guardianUserId);
    if(!gate.allowed)return rateLimited(gate);
    const input=parseEducatorReportRequest(new URL(request.url));
    const report=await readEducatorAnalytics({
      sql:ctx.sql,educatorId:ctx.guardian.guardianUserId,academyId:ctx.student.academyId,
      studentId:ctx.student.studentId,...input,
    });
    return json({ok:true,student:{id:ctx.student.studentId,name:ctx.student.studentName},filters:input.filters,report:{
      summary:report.summary,
      modules:report.modules,
      errors:report.errors,
      trend:report.trend,
      sessions:report.sessions,
      evidence:report.evidence.map(item=>({
        id:item.id,type:item.type,moduleCode:item.moduleCode,skillCode:item.skillCode,
        observedAt:item.observedAt,provenance:item.provenance,
      })),
      nextCursor:report.nextCursor,
    }});
  }catch(error){
    if(error instanceof ReportInputError)return json({ok:false,error:error.code},400);
    return json({ok:false,error:'guardian_report_unavailable'},503);
  }
}
