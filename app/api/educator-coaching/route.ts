import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { cancelPlan,CoachingError,createGoal,createMeeting,createMistakeRevision,publishPlan,readCoachingCenter,recordExam,recordStudy,resolveEducatorCoachingActor,updateTopicStatus } from '@/lib/persistence/coaching-center';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
async function context(request:Request,write:boolean){
  const identity=await authenticatedEducator(request);if(!identity)throw new CoachingError('educator_session_required',401);
  const gate=await allowRequest(request,'educator-coaching',write?30:60,60_000,identity.id);if(!gate.allowed)return{limited:rateLimited(gate)};
  if(!process.env.DATABASE_URL)throw new CoachingError('database_unavailable',503);
  const studentId=(write?(await request.clone().json() as Record<string,unknown>).studentId:new URL(request.url).searchParams.get('studentId'));
  if(typeof studentId!=='string'||!UUID.test(studentId))throw new CoachingError('invalid_student_id');
  const sql=neon(process.env.DATABASE_URL);const actor=await resolveEducatorCoachingActor(sql,identity.id,studentId,write);return{sql,actor,studentId};
}
export async function GET(request:Request){try{const ctx=await context(request,false);if('limited'in ctx)return ctx.limited;const url=new URL(request.url);const limit=Number(url.searchParams.get('limit')||20);return json({ok:true,coaching:await readCoachingCenter(ctx.sql,ctx.actor,{includePrivate:true,limit,cursor:url.searchParams.get('cursor')})});}catch(error){const e=error instanceof CoachingError?error:new CoachingError('coaching_unavailable',503);return json({ok:false,error:e.code},e.status);}}
export async function POST(request:Request){
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({ok:false,error:'request_origin_rejected'},403);
  try{const input=await request.clone().json() as Record<string,unknown>;const ctx=await context(request,true);if('limited'in ctx)return ctx.limited;const action=typeof input.action==='string'?input.action:'';let result;
    if(action==='goal')result=await createGoal(ctx.sql,ctx.actor,input);
    else if(action==='publish_plan')result=await publishPlan(ctx.sql,ctx.actor,input);
    else if(action==='study_log')result=await recordStudy(ctx.sql,ctx.actor,input);
    else if(action==='exam')result=await recordExam(ctx.sql,ctx.actor,input);
    else if(action==='mistake_revision')result=await createMistakeRevision(ctx.sql,ctx.actor,input);
    else if(action==='meeting')result=await createMeeting(ctx.sql,ctx.actor,input);
    else if(action==='topic_status')result=await updateTopicStatus(ctx.sql,ctx.actor,input);
    else if(action==='cancel_plan')result=await cancelPlan(ctx.sql,ctx.actor,input);
    else throw new CoachingError('invalid_action');return json({ok:true,result},201);
  }catch(error){const e=error instanceof CoachingError?error:new CoachingError('coaching_write_failed',503);return json({ok:false,error:e.code},e.status);}
}
