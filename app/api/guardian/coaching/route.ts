import { allowRequest,rateLimited } from '@/lib/request-guard';
import { guardianContext } from '@/lib/guardian-context';
import { readCoachingCenter } from '@/lib/persistence/coaching-center';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store'}});}
function safeItem(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  return {
    itemId:row.itemId,recipeId:row.recipeId,scheduledFor:row.scheduledFor,taskKind:row.taskKind,
    moduleCode:row.moduleCode,subject:row.subject,topic:row.topic,name:row.name,instructions:row.instructions,
    purpose:row.purpose,active:row.active,cancelledAt:row.cancelledAt,
  };
}

export async function GET(request:Request){
  try{
    const ctx=await guardianContext(request);
    if('error'in ctx)return json({ok:false,error:ctx.error},ctx.status);
    if(!('student'in ctx)||!ctx.student)return json({ok:false,error:'student_not_authorized'},403);
    const gate=await allowRequest(request,'guardian-coaching',30,60_000,ctx.guardian.guardianUserId);
    if(!gate.allowed)return rateLimited(gate);
    const data=await readCoachingCenter(ctx.sql,{
      userId:ctx.guardian.guardianUserId,academyId:ctx.student.academyId,
      studentId:ctx.student.studentId,canCoach:false,
    },{studentView:true,includePrivate:false,limit:20});
    return json({ok:true,coaching:{
      programs:data.programs.map(row=>({id:row.id,programType:row.program_type,examYear:row.exam_year,periodLabel:row.period_label,fieldCode:row.field_code,status:row.status})),
      goals:data.goals.map(row=>({id:row.id,programId:row.program_id,revision:row.revision,target:row.target,provenance:row.provenance,createdAt:row.created_at})),
      plans:data.plans.map(row=>({id:row.id,programId:row.program_id,title:row.title,periodStart:row.period_start,periodEnd:row.period_end,monthlyFocus:row.monthly_focus,status:row.status,items:Array.isArray(row.items)?row.items.map(safeItem).filter(Boolean):[]})),
      exams:data.exams.map(row=>({id:row.id,programId:row.program_id,stage:row.stage,sourceLabel:row.source_label,examDate:row.exam_date,totalNet:row.total_net,isPartial:row.is_partial,provenance:row.provenance})),
      meetings:data.meetings.map(row=>({id:row.id,programId:row.program_id,meetingAt:row.meeting_at,sharedSummary:row.shared_summary,nextWeekFocus:row.next_week_focus,studentFeedback:row.student_feedback,version:row.version})),
      page:data.page,
      provenance:data.provenance,
    }});
  }catch{return json({ok:false,error:'guardian_coaching_unavailable'},503);}
}
