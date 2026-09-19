import { allowRequest,rateLimited } from '@/lib/request-guard';
import { guardianContext } from '@/lib/guardian-context';
import { parseTimelineRequest,readLearningTimeline,TimelineInputError } from '@/lib/persistence/learning-timeline';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store'}});}

export async function GET(request:Request){
  try{
    const ctx=await guardianContext(request);
    if('error'in ctx)return json({ok:false,error:ctx.error},ctx.status);
    if(!('student'in ctx)||!ctx.student)return json({ok:false,error:'student_not_authorized'},403);
    const gate=await allowRequest(request,'guardian-history',40,60_000,ctx.guardian.guardianUserId);
    if(!gate.allowed)return rateLimited(gate);
    const input=parseTimelineRequest(new URL(request.url));
    const timeline=await readLearningTimeline({
      sql:ctx.sql,academyId:ctx.student.academyId,studentId:ctx.student.studentId,...input,
    });
    return json({ok:true,timeline:{
      events:timeline.events.map(event=>({
        eventId:event.eventId,
        occurredAt:event.occurredAt,
        eventType:event.eventType,
        assignmentLifecycle:event.assignmentLifecycle,
        moduleCode:event.moduleCode,
        assignmentId:event.assignmentId,
        title:event.title,
        status:event.status,
        resultSummary:event.resultSummary,
        errorSummary:event.errorSummary?{errorType:event.errorSummary.errorType??null}:null,
        skillSummary:event.skillSummary?{
          skillCode:event.skillSummary.skillCode??null,
          evidenceType:event.skillSummary.evidenceType??null,
        }:null,
        supportLevel:event.supportLevel,
        provenance:event.provenance,
      })),
      hasMore:timeline.hasMore,
      nextCursor:timeline.nextCursor,
    }});
  }catch(error){
    if(error instanceof TimelineInputError)return json({ok:false,error:error.code},400);
    return json({ok:false,error:'guardian_history_unavailable'},503);
  }
}
