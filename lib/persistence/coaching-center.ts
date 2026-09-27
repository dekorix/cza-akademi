import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { defaultRecipeSettings,isAssignableModule } from '@/lib/training-recipes';

export type CoachingSql = { query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };
export type CoachingActor = { userId: string; academyId: string; studentId: string; canCoach: boolean };
export class CoachingError extends Error { constructor(public code: string, public status = 400) { super(code); } }
async function conflictAwareQuery(sql:CoachingSql,statement:string,params:unknown[],code:string){try{return await sql.query(statement,params);}catch(error){if(['23505','23P01','P0001'].includes(String((error as {code?:unknown}).code)))throw new CoachingError(code,409);throw error;}}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const text=(value:unknown,max:number,required=true)=>{if(typeof value!=='string'||(required&&!value.trim())||value.trim().length>max)throw new CoachingError('invalid_text');return value.trim();};
const uuid=(value:unknown,code='invalid_id')=>{if(typeof value!=='string'||!UUID.test(value))throw new CoachingError(code);return value;};
const integer=(value:unknown,min:number,max:number,nullable=false)=>{if(nullable&&(value===null||value===undefined||value===''))return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw new CoachingError('invalid_number');return n;};
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const json=(value:unknown)=>JSON.stringify(value);
const dateOnly=(value:unknown)=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
const recordOrNull=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const isoDate=(value:unknown)=>{const result=text(value,10),parsed=Date.parse(`${result}T00:00:00.000Z`);if(!ISO_DATE.test(result)||Number.isNaN(parsed)||new Date(parsed).toISOString().slice(0,10)!==result)throw new CoachingError('invalid_date');return result;};
const instant=(value:unknown)=>{const result=text(value,40);if(Number.isNaN(Date.parse(result)))throw new CoachingError('invalid_timestamp');return new Date(result).toISOString();};
function validateGoalTarget(programType:'LGS'|'YKS',value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new CoachingError('invalid_target');
  const target=value as Record<string,unknown>;if(JSON.stringify(target).length>8192||target.guarantee===true)throw new CoachingError('invalid_target');
  const optional=(key:string,max:number)=>{if(target[key]!==undefined&&target[key]!==null)text(target[key],max);};
  optional('statement',500);optional('school',180);optional('university',180);optional('department',180);optional('field',40);
  if(target.score!==undefined&&target.score!==null){const score=Number(target.score);if(!Number.isFinite(score)||score<0||score>1000)throw new CoachingError('invalid_target');}
  if(target.ranking!==undefined&&target.ranking!==null)integer(target.ranking,1,10_000_000);
  if(target.netTargets!==undefined){if(!target.netTargets||typeof target.netTargets!=='object'||Array.isArray(target.netTargets))throw new CoachingError('invalid_target');for(const [code,raw] of Object.entries(target.netTargets as Record<string,unknown>)){text(code,40);const net=Number(raw);if(!Number.isFinite(net)||net<-500||net>500)throw new CoachingError('invalid_target');}}
  const described=typeof target.statement==='string'&&target.statement.trim()||programType==='LGS'&&typeof target.school==='string'&&target.school.trim()||programType==='YKS'&&((typeof target.department==='string'&&target.department.trim())||(typeof target.university==='string'&&target.university.trim()));
  if(!described)throw new CoachingError('invalid_target');return target;
}
const pageSecret=()=>{const value=process.env.CZA_TIMELINE_CURSOR_SECRET||process.env.CZA_TRUSTED_PROXY_HMAC_SECRET||'';if(Buffer.byteLength(value)<32)throw new CoachingError('coaching_cursor_unavailable',503);return value;};
type CoachingCursor={v:1;academyId:string;studentId:string;studentView:boolean;periodStart:string;id:string};
function encodeCursor(value:CoachingCursor){const body=Buffer.from(JSON.stringify(value)).toString('base64url');return `${body}.${createHmac('sha256',pageSecret()).update(body).digest('base64url')}`;}
function decodeCursor(value:string,actor:CoachingActor,studentView:boolean){if(value.length>1024)throw new CoachingError('invalid_cursor');const [body,signature,extra]=value.split('.');if(!body||!signature||extra!==undefined)throw new CoachingError('invalid_cursor');const expected=createHmac('sha256',pageSecret()).update(body).digest('base64url');const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw new CoachingError('invalid_cursor');let parsed:CoachingCursor;try{parsed=JSON.parse(Buffer.from(body,'base64url').toString()) as CoachingCursor;}catch{throw new CoachingError('invalid_cursor');}if(parsed.v!==1||parsed.academyId!==actor.academyId||parsed.studentId!==actor.studentId||parsed.studentView!==studentView||!UUID.test(parsed.id)||Number.isNaN(Date.parse(parsed.periodStart)))throw new CoachingError('invalid_cursor');return parsed;}

export async function resolveEducatorCoachingActor(sql:CoachingSql,authUserId:string,studentId:string,write:boolean):Promise<CoachingActor>{
  const rows=await sql.query(`SELECT educator.id user_id,educator.academy_id,student.id student_id,link.can_coach
    FROM public.users educator JOIN public.teacher_student_links link
      ON link.teacher_id=educator.id AND link.academy_id=educator.academy_id AND link.can_view=true
    JOIN public.students student ON student.id=link.student_id AND student.academy_id=educator.academy_id
    WHERE educator.auth_user_id=$1 AND educator.role::text='educator' AND educator.is_active=true
      AND student.id=$2::uuid AND student.status='active' AND ($3::boolean=false OR link.can_coach=true) LIMIT 1`,[authUserId,studentId,write]);
  if(!rows.length)throw new CoachingError(write?'coaching_write_not_authorized':'student_not_authorized',403);
  return{userId:String(rows[0].user_id),academyId:String(rows[0].academy_id),studentId:String(rows[0].student_id),canCoach:rows[0].can_coach===true};
}

export async function readCoachingCenter(sql:CoachingSql,actor:CoachingActor,{includePrivate=false,studentView=false,limit=20,cursor=null}:{includePrivate?:boolean;studentView?:boolean;limit?:number;cursor?:string|null}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new CoachingError('invalid_limit');const decoded=cursor?decodeCursor(cursor,actor,studentView):null;
  const p=[actor.academyId,actor.studentId];
  const [programs,goals,topics,plans,studyLogs,exams,mistakes,meetings,templates]=await Promise.all([
    sql.query(`SELECT id,program_type,exam_year,period_label,field_code,status,version,created_at FROM public.coaching_programs WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 20`,p),
    sql.query(`SELECT id,program_id,revision,target,provenance,supersedes_id,created_at FROM public.coaching_goals WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 30`,p),
    sql.query(`SELECT id,program_id,subject_code,topic_code,achievement_code,status,source,version,updated_at FROM public.coaching_topic_status WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY updated_at DESC,id DESC LIMIT 50`,p),
    sql.query(`SELECT plan.id,plan.program_id,plan.title,plan.period_start::text AS period_start,plan.period_end::text AS period_end,plan.monthly_focus,plan.status,plan.version,plan.published_at,plan.cancelled_at,
      COALESCE(jsonb_agg(jsonb_build_object('itemId',item.id,'recipeId',recipe.id,'scheduledFor',item.scheduled_for::text,'taskKind',recipe.task_kind,'moduleCode',recipe.module_code,'subject',recipe.academic_subject,'topic',recipe.academic_topic,'name',recipe.name,'instructions',recipe.instructions,'purpose',recipe.task_purpose,'active',recipe.is_active,'cancelledAt',recipe.cancelled_at) ORDER BY item.scheduled_for,item.id) FILTER(WHERE item.id IS NOT NULL),'[]') items
      FROM public.coaching_plans plan LEFT JOIN public.coaching_plan_items item ON item.plan_id=plan.id
      LEFT JOIN public.training_recipes recipe ON recipe.id=item.recipe_id
      WHERE plan.academy_id=$1::uuid AND plan.student_id=$2::uuid AND ($3::boolean=false OR plan.status IN ('published','cancelled'))
        AND ($4::date IS NULL OR (plan.period_start,plan.id)<($4::date,$5::uuid))
      GROUP BY plan.id ORDER BY plan.period_start DESC,plan.id DESC LIMIT $6`,[...p,studentView,decoded?.periodStart??null,decoded?.id??null,limit+1]),
    sql.query(`SELECT id,recipe_id,question_count,correct_count,wrong_count,blank_count,duration_minutes,student_feedback,provenance,created_at FROM public.coaching_study_logs WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 50`,p),
    sql.query(`SELECT result.id,result.program_id,template.code template_code,template.stage,template.source_label,template.is_demo,result.exam_date::text AS exam_date,result.sections,result.total_net,result.duration_minutes,result.is_partial,result.provenance,result.revision,result.supersedes_id,result.created_at FROM public.coaching_exam_results result JOIN public.coaching_exam_templates template ON template.id=result.template_id WHERE result.academy_id=$1::uuid AND result.student_id=$2::uuid ORDER BY result.exam_date DESC,result.id DESC LIMIT 40`,p),
    sql.query(`SELECT id,program_id,exam_result_id,study_log_id,subject_code,topic_code,reason_code,explanation,provenance,created_at FROM public.coaching_mistakes WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 50`,p),
    sql.query(`SELECT id,program_id,coach_id,meeting_at,CASE WHEN $3::boolean AND coach_id=$4::uuid THEN private_note ELSE NULL::text END private_note,shared_summary,next_week_focus,follow_up_recipe_id,student_feedback,version,created_at FROM public.coaching_meetings WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY meeting_at DESC,id DESC LIMIT 30`,[...p,includePrivate,actor.userId]),
    sql.query(`SELECT id,code,version,program_type,stage,rules,source_label,is_demo FROM public.coaching_exam_templates WHERE is_active=true ORDER BY program_type,stage,version DESC LIMIT 20`),
  ]);
  const hasMore=plans.length>limit;const visiblePlans=plans.slice(0,limit);const last=visiblePlans.at(-1);const nextCursor=hasMore&&last?encodeCursor({v:1,academyId:actor.academyId,studentId:actor.studentId,studentView,periodStart:dateOnly(last.period_start),id:String(last.id)}):null;
  return{programs,goals,topics,plans:visiblePlans,studyLogs,exams,mistakes,meetings,templates,page:{hasMore,nextCursor,limit},provenance:'CLIENT_REPORTED' as const};
}

export async function readCoachingProfileBridge(sql:CoachingSql,academyId:string,studentId:string){
  const rows=await sql.query(`SELECT
    (SELECT count(*)::int FROM public.coaching_programs WHERE academy_id=$1::uuid AND student_id=$2::uuid AND status='active') active_programs,
    (SELECT count(*)::int FROM public.coaching_plans WHERE academy_id=$1::uuid AND student_id=$2::uuid AND status='published') published_plans,
    (SELECT count(*)::int FROM public.coaching_study_logs WHERE academy_id=$1::uuid AND student_id=$2::uuid) study_logs,
    (SELECT count(*)::int FROM public.coaching_exam_results WHERE academy_id=$1::uuid AND student_id=$2::uuid) exam_results,
    (SELECT count(*)::int FROM public.coaching_meetings WHERE academy_id=$1::uuid AND student_id=$2::uuid) meetings,
    (SELECT jsonb_build_object('id',id,'programId',program_id,'revision',revision,'target',target,'provenance',provenance,'createdAt',created_at) FROM public.coaching_goals WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 1) latest_goal,
    (SELECT jsonb_build_object('id',id,'programId',program_id,'title',title,'periodStart',period_start::text,'periodEnd',period_end::text,'version',version) FROM public.coaching_plans WHERE academy_id=$1::uuid AND student_id=$2::uuid AND status='published' ORDER BY period_start DESC,id DESC LIMIT 1) latest_plan,
    (SELECT jsonb_build_object('id',result.id,'programId',result.program_id,'templateId',result.template_id,'examDate',result.exam_date::text,'totalNet',result.total_net,'provenance',result.provenance) FROM public.coaching_exam_results result WHERE result.academy_id=$1::uuid AND result.student_id=$2::uuid ORDER BY result.exam_date DESC,result.id DESC LIMIT 1) latest_exam,
    (SELECT jsonb_build_object('itemId',item.id,'recipeId',item.recipe_id,'planId',item.plan_id) FROM public.coaching_plan_items item JOIN public.coaching_plans plan ON plan.id=item.plan_id AND plan.academy_id=item.academy_id AND plan.student_id=item.student_id WHERE item.academy_id=$1::uuid AND item.student_id=$2::uuid AND plan.status='published' ORDER BY item.scheduled_for DESC,item.id DESC LIMIT 1) latest_task`,[academyId,studentId]);
  const row=rows[0]||{};return{activePrograms:Number(row.active_programs)||0,publishedPlans:Number(row.published_plans)||0,studyLogs:Number(row.study_logs)||0,examResults:Number(row.exam_results)||0,meetings:Number(row.meetings)||0,latestGoal:recordOrNull(row.latest_goal),latestPlan:recordOrNull(row.latest_plan),latestExam:recordOrNull(row.latest_exam),latestTask:recordOrNull(row.latest_task),performanceProvenance:'CLIENT_REPORTED' as const,sourceReference:'coaching-center'};
}

export async function createGoal(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programType=input.programType==='LGS'?'LGS':input.programType==='YKS'?'YKS':null;if(!programType)throw new CoachingError('invalid_program');
  const examYear=integer(input.examYear,2020,2100) as number;const fieldCode=programType==='YKS'?text(input.fieldCode,40):null;
  const periodLabel=input.periodLabel?text(input.periodLabel,80):`${examYear-1}-${examYear}`;const target=validateGoalTarget(programType,input.target);
  const expectedRevision=integer(input.expectedRevision,0,100000,true)??0;
  const requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const requestHash=hash({programType,examYear,periodLabel,fieldCode,target,expectedRevision});
  const rows=await conflictAwareQuery(sql,`WITH existing_request AS (
      SELECT id,program_id,revision,target,provenance,created_at,request_hash FROM public.coaching_goals
      WHERE academy_id=$1::uuid AND coach_id=$3::uuid AND client_request_id=$8::uuid
    ), existing_program AS (
      SELECT id,coach_id FROM public.coaching_programs WHERE academy_id=$1::uuid AND student_id=$2::uuid
        AND program_type=$4 AND exam_year=$5 AND status='active' FOR UPDATE
    ), inserted_program AS (
      INSERT INTO public.coaching_programs(academy_id,student_id,coach_id,program_type,exam_year,period_label,field_code,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::uuid,$9 WHERE NOT EXISTS(SELECT 1 FROM existing_request)
      ON CONFLICT(student_id,program_type,exam_year) WHERE status='active'
      DO UPDATE SET updated_at=public.coaching_programs.updated_at WHERE public.coaching_programs.coach_id=EXCLUDED.coach_id
      RETURNING id,coach_id
    ), program AS (
      SELECT id,coach_id FROM existing_program UNION ALL
      SELECT id,coach_id FROM inserted_program WHERE NOT EXISTS(SELECT 1 FROM existing_program)
    ), latest AS (
      SELECT id,revision FROM public.coaching_goals WHERE program_id=(SELECT id FROM program LIMIT 1)
      ORDER BY revision DESC,id DESC LIMIT 1 FOR UPDATE
    ), inserted AS (
      INSERT INTO public.coaching_goals(academy_id,student_id,program_id,coach_id,revision,target,supersedes_id,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,program.id,$3::uuid,$10+1,$11::jsonb,latest.id,$8::uuid,$9
      FROM program LEFT JOIN latest ON true
      WHERE program.coach_id=$3::uuid AND COALESCE(latest.revision,0)=$10 AND NOT EXISTS(SELECT 1 FROM existing_request)
      RETURNING id,program_id,revision,target,provenance,created_at
    ), replay AS (
      SELECT id,program_id,revision,target,provenance,created_at FROM existing_request WHERE request_hash=$9
    ), outcome AS (
      SELECT id,program_id,revision,target,provenance,created_at,false replayed FROM inserted
      UNION ALL
      SELECT id,program_id,revision,target,provenance,created_at,true FROM replay
    ), guard AS MATERIALIZED (
      SELECT public.cza_u8_require_atomic(EXISTS(SELECT 1 FROM outcome),'goal_version_owner_or_idempotency_conflict') ok
    )
    SELECT outcome.* FROM guard LEFT JOIN outcome ON true WHERE guard.ok AND outcome.id IS NOT NULL`,
    [actor.academyId,actor.studentId,actor.userId,programType,examYear,periodLabel,fieldCode,requestId,requestHash,expectedRevision,json(target)],'goal_version_owner_or_idempotency_conflict');
  if(!rows.length)throw new CoachingError('goal_version_owner_or_idempotency_conflict',409);return rows[0];
}

export async function createPlanDraft(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programId=uuid(input.programId),title=text(input.title,180),start=isoDate(input.periodStart),end=isoDate(input.periodEnd);if(start>end)throw new CoachingError('invalid_plan_period');
  const monthlyFocus=input.monthlyFocus?text(input.monthlyFocus,1000):null,requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const requestHash=hash({programId,title,start,end,monthlyFocus});
  const rows=await conflictAwareQuery(sql,`INSERT INTO public.coaching_plans(academy_id,student_id,program_id,coach_id,title,period_start,period_end,monthly_focus,status,version,client_request_id,request_hash)
    SELECT $1::uuid,$2::uuid,program.id,$3::uuid,$5,$6::date,$7::date,$8,'draft',1,$9::uuid,$10
    FROM public.coaching_programs program WHERE program.id=$4::uuid AND program.academy_id=$1::uuid AND program.student_id=$2::uuid AND program.coach_id=$3::uuid AND program.status='active'
    ON CONFLICT(academy_id,coach_id,client_request_id) DO UPDATE SET updated_at=public.coaching_plans.updated_at WHERE public.coaching_plans.request_hash=EXCLUDED.request_hash
    RETURNING id,academy_id,student_id,program_id,coach_id,title,period_start::text AS period_start,period_end::text AS period_end,monthly_focus,status,version,client_request_id,request_hash,published_at,cancelled_at,created_at,updated_at`,[actor.academyId,actor.studentId,actor.userId,programId,title,start,end,monthlyFocus,requestId,requestHash],'plan_owner_or_idempotency_conflict');
  if(!rows.length)throw new CoachingError('plan_owner_or_idempotency_conflict',409);return rows[0];
}

export async function publishDraftPlan(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const planId=uuid(input.planId),expectedVersion=integer(input.expectedVersion,1,100000),requestId=uuid(input.clientRequestId,'invalid_idempotency_key');
  const taskKind=input.taskKind==='cza_module'?'cza_module':input.taskKind==='academic'?'academic':null;if(!taskKind)throw new CoachingError('invalid_task_kind');
  const moduleCode=taskKind==='cza_module'&&typeof input.moduleCode==='string'&&isAssignableModule(input.moduleCode)?input.moduleCode:null;if(taskKind==='cza_module'&&!moduleCode)throw new CoachingError('invalid_module');
  const subject=taskKind==='academic'?text(input.subject,80):null,topic=taskKind==='academic'&&input.topic?text(input.topic,180):null,settings=moduleCode?defaultRecipeSettings(moduleCode):{};
  const instructions=input.instructions?text(input.instructions,1000):null,scheduled=isoDate(input.scheduledFor),targetQuestions=integer(input.targetQuestions,1,10000,true),targetMinutes=integer(input.targetMinutes,1,1440,true);
  const requestHash=hash({planId,expectedVersion,taskKind,moduleCode,subject,topic,instructions,scheduled,targetQuestions,targetMinutes,settings});
  const rows=await conflictAwareQuery(sql,`WITH locked_student AS (
      SELECT id FROM public.students WHERE id=$2::uuid AND academy_id=$1::uuid AND status='active' FOR UPDATE
    ), target AS (
      SELECT plan.* FROM public.coaching_plans plan JOIN locked_student student ON student.id=plan.student_id
      WHERE plan.id=$4::uuid AND plan.academy_id=$1::uuid AND plan.student_id=$2::uuid AND plan.coach_id=$3::uuid
        AND ((plan.status='draft' AND plan.version=$5) OR (plan.status='published' AND plan.version=$5+1))
        AND $12::date BETWEEN plan.period_start AND plan.period_end FOR UPDATE OF plan
    ), overlap AS (
      SELECT other.id FROM public.coaching_plans other,target WHERE target.status='draft' AND other.student_id=$2::uuid AND other.status='published' AND other.id<>target.id
        AND daterange(other.period_start,other.period_end,'[]')&&daterange(target.period_start,target.period_end,'[]') FOR UPDATE OF other
    ), updated AS (
      UPDATE public.coaching_plans plan SET status='published',published_at=now(),version=plan.version+1,updated_at=now()
      FROM target WHERE target.status='draft' AND plan.id=target.id AND NOT EXISTS(SELECT 1 FROM overlap)
      RETURNING plan.id,plan.title,plan.period_end,plan.version
    ), replay AS (
      SELECT target.id,target.title,target.period_end,target.version FROM target WHERE target.status='published' AND EXISTS(
        SELECT 1 FROM public.coaching_plan_items item JOIN public.training_recipes recipe ON recipe.id=item.recipe_id
        WHERE item.plan_id=target.id AND recipe.academy_id=$1::uuid AND recipe.student_id=$2::uuid AND recipe.assigned_by=$3::uuid
          AND recipe.client_request_id=$6::uuid AND recipe.request_hash=$7
      )
    ), ready AS (
      SELECT * FROM updated UNION ALL SELECT * FROM replay
    ), recipe AS (
      INSERT INTO public.training_recipes(academy_id,student_id,module_code,assigned_by,source,name,instructions,settings,is_active,starts_at,expires_at,client_request_id,request_hash,task_kind,academic_subject,academic_topic,target_questions,target_minutes,task_purpose)
      SELECT $1::uuid,$2::uuid,$8,$3::uuid,'teacher_assignment',ready.title,$11,$14::jsonb,true,$12::date,ready.period_end+interval '1 day',$6::uuid,$7,$9,$10,$13,$15,$16,'practice' FROM ready
      ON CONFLICT(academy_id,assigned_by,client_request_id) WHERE client_request_id IS NOT NULL DO UPDATE SET updated_at=public.training_recipes.updated_at WHERE public.training_recipes.request_hash=EXCLUDED.request_hash RETURNING id
    ), item AS (
      INSERT INTO public.coaching_plan_items(academy_id,student_id,plan_id,recipe_id,scheduled_for) SELECT $1::uuid,$2::uuid,ready.id,recipe.id,$12::date FROM ready,recipe
      ON CONFLICT(plan_id,recipe_id) DO UPDATE SET scheduled_for=public.coaching_plan_items.scheduled_for RETURNING plan_id,recipe_id
    ), outcome AS (SELECT item.plan_id,item.recipe_id,ready.version FROM item JOIN ready ON ready.id=item.plan_id), guard AS MATERIALIZED (SELECT public.cza_u8_require_atomic(EXISTS(SELECT 1 FROM outcome),'plan_publish_version_overlap_or_idempotency_conflict') ok) SELECT outcome.* FROM guard LEFT JOIN outcome ON true WHERE guard.ok AND outcome.plan_id IS NOT NULL`,
    [actor.academyId,actor.studentId,actor.userId,planId,expectedVersion,requestId,requestHash,moduleCode,taskKind,subject,instructions,scheduled,topic,json(settings),targetQuestions,targetMinutes],'plan_publish_version_overlap_or_idempotency_conflict');
  if(!rows.length)throw new CoachingError('plan_publish_version_overlap_or_idempotency_conflict',409);return rows[0];
}

export async function revisePlan(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const planId=uuid(input.planId),expectedVersion=integer(input.expectedVersion,1,100000),title=text(input.title,180),start=isoDate(input.periodStart),end=isoDate(input.periodEnd);if(start>end)throw new CoachingError('invalid_plan_period');
  const monthlyFocus=input.monthlyFocus?text(input.monthlyFocus,1000):null,requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const requestHash=hash({planId,expectedVersion,title,start,end,monthlyFocus});
  const rows=await conflictAwareQuery(sql,`WITH existing AS (
      SELECT plan_id,revision,title,period_start,period_end,monthly_focus,status,request_hash FROM public.coaching_plan_revisions
      WHERE academy_id=$1::uuid AND coach_id=$3::uuid AND client_request_id=$9::uuid
    ), locked_student AS (
      SELECT id FROM public.students WHERE id=$2::uuid AND academy_id=$1::uuid AND status='active' FOR UPDATE
    ), target AS (
      SELECT plan.* FROM public.coaching_plans plan JOIN locked_student student ON student.id=plan.student_id
      WHERE plan.id=$4::uuid AND plan.academy_id=$1::uuid AND plan.student_id=$2::uuid AND plan.coach_id=$3::uuid
        AND plan.status IN ('draft','published') AND plan.version=$5 FOR UPDATE OF plan
    ), overlap AS (
      SELECT other.id FROM public.coaching_plans other,target WHERE target.status='published' AND other.student_id=$2::uuid AND other.status='published' AND other.id<>target.id
        AND daterange(other.period_start,other.period_end,'[]')&&daterange($7::date,$8::date,'[]') FOR UPDATE OF other
    ), revision AS (
      INSERT INTO public.coaching_plan_revisions(academy_id,student_id,plan_id,coach_id,revision,title,period_start,period_end,monthly_focus,status,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,target.id,$3::uuid,target.version+1,$6,$7::date,$8::date,$11,target.status,$9::uuid,$10 FROM target
      WHERE NOT EXISTS(SELECT 1 FROM existing) AND NOT EXISTS(SELECT 1 FROM overlap)
        AND NOT EXISTS(SELECT 1 FROM public.coaching_plan_items item WHERE item.plan_id=target.id AND (item.scheduled_for<$7::date OR item.scheduled_for>$8::date))
      RETURNING plan_id,revision,title,period_start,period_end,monthly_focus,status,request_hash
    ), updated AS (
      UPDATE public.coaching_plans plan SET title=revision.title,period_start=revision.period_start,period_end=revision.period_end,monthly_focus=revision.monthly_focus,version=revision.revision,updated_at=now()
      FROM revision WHERE plan.id=revision.plan_id AND plan.version=$5 RETURNING plan.id,plan.version,plan.title,plan.period_start,plan.period_end,plan.monthly_focus,plan.status
    )
    SELECT id,version,title,period_start::text AS period_start,period_end::text AS period_end,monthly_focus,status,false replayed FROM updated
    UNION ALL
    SELECT plan_id,revision,title,period_start::text,period_end::text,monthly_focus,status,true FROM existing WHERE request_hash=$10`,
    [actor.academyId,actor.studentId,actor.userId,planId,expectedVersion,title,start,end,requestId,requestHash,monthlyFocus],'plan_revision_version_overlap_or_idempotency_conflict');
  if(!rows.length)throw new CoachingError('plan_revision_version_overlap_or_idempotency_conflict',409);return rows[0];
}

export async function publishPlan(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programId=uuid(input.programId);const requestId=uuid(input.clientRequestId,'invalid_idempotency_key');
  const title=text(input.title,180);const taskKind=input.taskKind==='cza_module'?'cza_module':input.taskKind==='academic'?'academic':null;if(!taskKind)throw new CoachingError('invalid_task_kind');
  const moduleCode=taskKind==='cza_module'&&typeof input.moduleCode==='string'&&isAssignableModule(input.moduleCode)?input.moduleCode:null;if(taskKind==='cza_module'&&!moduleCode)throw new CoachingError('invalid_module');
  const subject=taskKind==='academic'?text(input.subject,80):null;const topic=taskKind==='academic'&&input.topic?text(input.topic,180):null;const settings=moduleCode?defaultRecipeSettings(moduleCode):{};
  const instructions=input.instructions?text(input.instructions,1000):null;const monthlyFocus=input.monthlyFocus?text(input.monthlyFocus,1000):null;const start=isoDate(input.periodStart);const end=isoDate(input.periodEnd);const scheduled=isoDate(input.scheduledFor);if(start>end||scheduled<start||scheduled>end)throw new CoachingError('invalid_plan_period');
  const targetQuestions=integer(input.targetQuestions,1,10000,true);const targetMinutes=integer(input.targetMinutes,1,1440,true);
  const requestHash=hash({programId,title,monthlyFocus,taskKind,moduleCode,subject,topic,instructions,start,end,scheduled,targetQuestions,targetMinutes,settings});
  const rows=await conflictAwareQuery(sql,`WITH locked_student AS (SELECT id FROM public.students WHERE id=$2::uuid AND academy_id=$1::uuid AND status='active' FOR UPDATE),
    owned_program AS (SELECT program.id FROM public.coaching_programs program JOIN locked_student student ON student.id=program.student_id WHERE program.id=$4::uuid AND program.academy_id=$1::uuid AND program.student_id=$2::uuid AND program.coach_id=$3::uuid AND program.status='active' FOR UPDATE OF program),
    overlap AS (SELECT id FROM public.coaching_plans WHERE student_id=$2::uuid AND status='published' AND client_request_id<>$6::uuid AND daterange(period_start,period_end,'[]')&&daterange($9::date,$10::date,'[]') FOR UPDATE),
    plan AS (INSERT INTO public.coaching_plans(academy_id,student_id,program_id,coach_id,title,period_start,period_end,monthly_focus,status,version,client_request_id,request_hash,published_at)
      SELECT $1::uuid,$2::uuid,id,$3::uuid,$5,$9::date,$10::date,$19,'published',1,$6::uuid,$7,now() FROM owned_program WHERE NOT EXISTS(SELECT 1 FROM overlap)
      ON CONFLICT(academy_id,coach_id,client_request_id) DO UPDATE SET updated_at=public.coaching_plans.updated_at WHERE public.coaching_plans.request_hash=EXCLUDED.request_hash RETURNING id),
    recipe AS (INSERT INTO public.training_recipes(academy_id,student_id,module_code,assigned_by,source,name,instructions,settings,is_active,starts_at,expires_at,client_request_id,request_hash,task_kind,academic_subject,academic_topic,target_questions,target_minutes,task_purpose)
      SELECT $1::uuid,$2::uuid,$12,$3::uuid,'teacher_assignment',$5,$8,$16::jsonb,true,$11::date,$10::date+interval '1 day',$6::uuid,$7,$13,$14,$15,$17,$18,'practice' FROM plan
      ON CONFLICT(academy_id,assigned_by,client_request_id) WHERE client_request_id IS NOT NULL DO UPDATE SET updated_at=public.training_recipes.updated_at WHERE public.training_recipes.request_hash=EXCLUDED.request_hash RETURNING id),
    item AS (INSERT INTO public.coaching_plan_items(academy_id,student_id,plan_id,recipe_id,scheduled_for) SELECT $1::uuid,$2::uuid,plan.id,recipe.id,$11::date FROM plan,recipe ON CONFLICT(plan_id,recipe_id) DO UPDATE SET scheduled_for=EXCLUDED.scheduled_for RETURNING recipe_id),
    outcome AS (SELECT plan.id plan_id,item.recipe_id FROM plan,item),
    guard AS MATERIALIZED (SELECT public.cza_u8_require_atomic(EXISTS(SELECT 1 FROM outcome),'plan_overlap_or_idempotency_conflict') ok)
    SELECT outcome.* FROM guard LEFT JOIN outcome ON true WHERE guard.ok AND outcome.plan_id IS NOT NULL`,[actor.academyId,actor.studentId,actor.userId,programId,title,requestId,requestHash,instructions,start,end,scheduled,moduleCode,taskKind,subject,topic,json(settings),targetQuestions,targetMinutes,monthlyFocus],'plan_overlap_or_idempotency_conflict');
  if(!rows.length)throw new CoachingError('plan_overlap_or_idempotency_conflict',409);return rows[0];
}

export async function recordStudy(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  const recipeId=uuid(input.recipeId);const requestId=uuid(input.clientRequestId,'invalid_idempotency_key');
  const questionCount=integer(input.questionCount,0,10000,true),correct=integer(input.correctCount,0,10000,true),wrong=integer(input.wrongCount,0,10000,true),blank=integer(input.blankCount,0,10000,true),duration=integer(input.durationMinutes,0,1440,true);
  if(questionCount!==null&&(correct??0)+(wrong??0)+(blank??0)>questionCount)throw new CoachingError('invalid_question_totals');
  const feedback=input.feedback?text(input.feedback,1000):null;const requestHash=hash({recipeId,questionCount,correct,wrong,blank,duration,feedback});
  const rows=await sql.query(`WITH target AS (SELECT id FROM public.training_recipes WHERE id=$4::uuid AND academy_id=$1::uuid AND student_id=$2::uuid AND task_kind='academic' AND is_active=true AND cancelled_at IS NULL AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE),
    inserted AS (INSERT INTO public.coaching_study_logs(academy_id,student_id,recipe_id,reported_by,question_count,correct_count,wrong_count,blank_count,duration_minutes,student_feedback,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,id,$3::uuid,$5,$6,$7,$8,$9,$10,$11::uuid,$12 FROM target
      ON CONFLICT(academy_id,student_id,client_request_id) DO UPDATE SET created_at=public.coaching_study_logs.created_at WHERE public.coaching_study_logs.request_hash=EXCLUDED.request_hash RETURNING *) SELECT * FROM inserted`,[actor.academyId,actor.studentId,actor.userId,recipeId,questionCount,correct,wrong,blank,duration,feedback,requestId,requestHash]);
  if(!rows.length)throw new CoachingError('assignment_cancelled_or_idempotency_conflict',409);return rows[0];
}

export async function recordExam(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  const programId=uuid(input.programId),templateId=uuid(input.templateId),requestId=uuid(input.clientRequestId,'invalid_idempotency_key');
  const templates=await sql.query(`SELECT rules,program_type FROM public.coaching_exam_templates WHERE id=$1::uuid AND is_active=true`,[templateId]);if(!templates.length)throw new CoachingError('exam_template_not_found',404);
  const rules=templates[0].rules as {netPenaltyDivisor?:unknown;sections?:Array<{code?:unknown;questions?:unknown}>};const divisor=integer(rules.netPenaltyDivisor,1,10) as number;
  if(!Array.isArray(input.sections)||!input.sections.length||!Array.isArray(rules.sections))throw new CoachingError('invalid_exam_sections');
  const allowed=new Map(rules.sections.map(s=>[text(s.code,40),integer(s.questions,1,500)]));let partial=false,totalNet=0;const seen=new Set<string>();
  const sections=input.sections.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new CoachingError('invalid_exam_sections');const row=raw as Record<string,unknown>;const code=text(row.code,40),limit=allowed.get(code);if(!limit||seen.has(code))throw new CoachingError('invalid_exam_section');seen.add(code);const correct=integer(row.correct,0,limit) as number,wrong=integer(row.wrong,0,limit) as number,blank=integer(row.blank,0,limit) as number;const total=correct+wrong+blank;if(total>limit)throw new CoachingError('invalid_exam_totals');if(total<limit)partial=true;const net=Math.round((correct-wrong/divisor)*100)/100;totalNet+=net;return{code,correct,wrong,blank,net};});
  if(seen.size!==allowed.size)partial=true;totalNet=Math.round(totalNet*100)/100;const examDate=isoDate(input.examDate),duration=integer(input.durationMinutes,0,1440,true),supersedesId=input.supersedesId?uuid(input.supersedesId):null,expectedRevision=integer(input.expectedRevision,0,100000,true)??0;const requestHash=hash({programId,templateId,examDate,sections,duration,supersedesId,expectedRevision});
  let rows:Record<string,unknown>[];
  try{rows=await sql.query(`WITH existing_request AS (
      SELECT * FROM public.coaching_exam_results WHERE academy_id=$1::uuid AND reported_by=$3::uuid AND client_request_id=$10::uuid
    ), program AS (
      SELECT p.id,p.program_type,p.coach_id FROM public.coaching_programs p WHERE p.id=$12::uuid AND p.academy_id=$1::uuid AND p.student_id=$2::uuid AND p.status='active'
        AND ($15::boolean=false OR p.coach_id=$3::uuid) FOR UPDATE
    ), prior AS (
      SELECT result.id,result.revision,result.reported_by FROM public.coaching_exam_results result,program
      WHERE result.id=$13::uuid AND result.program_id=program.id AND result.academy_id=$1::uuid AND result.student_id=$2::uuid
        AND ($15::boolean=true OR result.reported_by=$3::uuid)
        AND NOT EXISTS(SELECT 1 FROM public.coaching_exam_results child WHERE child.supersedes_id=result.id)
      FOR UPDATE OF result
    ), inserted AS (
      INSERT INTO public.coaching_exam_results(academy_id,student_id,program_id,template_id,reported_by,exam_date,sections,total_net,duration_minutes,is_partial,revision,supersedes_id,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,program.id,template.id,$3::uuid,$5::date,$6::jsonb,$7,$9,$8,CASE WHEN $13::uuid IS NULL THEN 1 ELSE prior.revision+1 END,$13::uuid,$10::uuid,$11
      FROM program JOIN public.coaching_exam_templates template ON template.id=$4::uuid AND template.is_active=true AND template.program_type=program.program_type
      LEFT JOIN prior ON true
      WHERE NOT EXISTS(SELECT 1 FROM existing_request)
        AND (($13::uuid IS NULL AND $14=0) OR ($13::uuid IS NOT NULL AND prior.revision=$14))
      RETURNING *
    ) SELECT id,academy_id,student_id,program_id,template_id,reported_by,exam_date::text AS exam_date,sections,total_net,duration_minutes,is_partial,provenance,revision,supersedes_id,client_request_id,request_hash,created_at,false replayed FROM inserted
      UNION ALL
      SELECT id,academy_id,student_id,program_id,template_id,reported_by,exam_date::text,sections,total_net,duration_minutes,is_partial,provenance,revision,supersedes_id,client_request_id,request_hash,created_at,true FROM existing_request WHERE request_hash=$11`,[actor.academyId,actor.studentId,actor.userId,templateId,examDate,json(sections),totalNet,partial,duration,requestId,requestHash,programId,supersedesId,expectedRevision,actor.canCoach]);}
  catch(error){if((error as {code?:string}).code==='23505')throw new CoachingError('exam_revision_conflict',409);throw error;}
  if(!rows.length)throw new CoachingError('exam_owner_version_or_idempotency_conflict',409);return rows[0];
}

export async function createMistakeRevision(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programId=uuid(input.programId),examResultId=input.examResultId?uuid(input.examResultId):null,studyLogId=input.studyLogId?uuid(input.studyLogId):null;if((examResultId?1:0)+(studyLogId?1:0)!==1)throw new CoachingError('invalid_mistake_source');
  const subject=text(input.subject,80),topic=input.topic?text(input.topic,180):null,reason=text(input.reason,80),explanation=input.explanation?text(input.explanation,1000):null,requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const requestHash=hash({programId,examResultId,studyLogId,subject,topic,reason,explanation});
  const rows=await conflictAwareQuery(sql,`WITH source_ok AS (SELECT program.id FROM public.coaching_programs program
      WHERE program.id=$4::uuid AND program.academy_id=$1::uuid AND program.student_id=$2::uuid AND program.coach_id=$3::uuid AND program.status='active'
        AND (($5::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM public.coaching_exam_results result WHERE result.id=$5::uuid AND result.academy_id=$1::uuid AND result.student_id=$2::uuid AND result.program_id=program.id))
          OR ($6::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM public.coaching_study_logs study
            JOIN public.training_recipes recipe ON recipe.id=study.recipe_id AND recipe.academy_id=study.academy_id AND recipe.student_id=study.student_id
            JOIN public.coaching_plan_items item ON item.recipe_id=recipe.id AND item.academy_id=recipe.academy_id AND item.student_id=recipe.student_id
            JOIN public.coaching_plans linked_plan ON linked_plan.id=item.plan_id AND linked_plan.program_id=program.id
            WHERE study.id=$6::uuid AND study.academy_id=$1::uuid AND study.student_id=$2::uuid)))),
    active_plan AS (SELECT plan.id FROM public.coaching_plans plan,source_ok WHERE plan.program_id=source_ok.id AND plan.academy_id=$1::uuid AND plan.student_id=$2::uuid AND plan.coach_id=$3::uuid AND plan.status='published' ORDER BY plan.period_start DESC,plan.id DESC LIMIT 1 FOR UPDATE OF plan),
    mistake AS (INSERT INTO public.coaching_mistakes(academy_id,student_id,program_id,exam_result_id,study_log_id,subject_code,topic_code,reason_code,explanation,created_by,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,source_ok.id,$5::uuid,$6::uuid,$7,$8,$9,$10,$3::uuid,$11::uuid,$12 FROM source_ok,active_plan
      ON CONFLICT(academy_id,created_by,client_request_id) DO UPDATE SET created_at=public.coaching_mistakes.created_at WHERE public.coaching_mistakes.request_hash=EXCLUDED.request_hash RETURNING id),
    recipe AS (INSERT INTO public.training_recipes(academy_id,student_id,module_code,assigned_by,source,name,instructions,settings,is_active,starts_at,client_request_id,request_hash,task_kind,academic_subject,academic_topic,task_purpose)
      SELECT $1::uuid,$2::uuid,NULL,$3::uuid,'teacher_assignment','Tekrar · '||$7,$10,'{}',true,now(),$11::uuid,$12,'academic',$7,$8,'revision' FROM mistake
      ON CONFLICT(academy_id,assigned_by,client_request_id) WHERE client_request_id IS NOT NULL DO UPDATE SET updated_at=public.training_recipes.updated_at WHERE public.training_recipes.request_hash=EXCLUDED.request_hash RETURNING id),
    item AS (INSERT INTO public.coaching_plan_items(academy_id,student_id,plan_id,recipe_id,scheduled_for) SELECT $1::uuid,$2::uuid,active_plan.id,recipe.id,current_date FROM active_plan,recipe ON CONFLICT(plan_id,recipe_id) DO UPDATE SET scheduled_for=public.coaching_plan_items.scheduled_for RETURNING recipe_id),
    outcome AS (SELECT mistake.id mistake_id,item.recipe_id FROM mistake,item),
    guard AS MATERIALIZED (SELECT public.cza_u8_require_atomic(EXISTS(SELECT 1 FROM outcome),'mistake_revision_idempotency_conflict') ok)
    SELECT outcome.* FROM guard LEFT JOIN outcome ON true WHERE guard.ok AND outcome.mistake_id IS NOT NULL`,[actor.academyId,actor.studentId,actor.userId,programId,examResultId,studyLogId,subject,topic,reason,explanation,requestId,requestHash],'mistake_revision_idempotency_conflict');
  if(!rows.length)throw new CoachingError('idempotency_conflict',409);return rows[0];
}

export async function createMeeting(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const programId=uuid(input.programId),requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const meetingAt=instant(input.meetingAt),privateNote=input.privateNote?text(input.privateNote,4000):null,shared=input.sharedSummary?text(input.sharedSummary,2000):null,focus=input.nextWeekFocus?text(input.nextWeekFocus,1000):null,studentFeedback=input.studentFeedback?text(input.studentFeedback,2000):null,followUpRecipeId=input.followUpRecipeId?uuid(input.followUpRecipeId):null;const requestHash=hash({programId,meetingAt,privateNote,shared,focus,studentFeedback,followUpRecipeId});
  const rows=await sql.query(`INSERT INTO public.coaching_meetings(academy_id,student_id,program_id,coach_id,meeting_at,private_note,shared_summary,next_week_focus,follow_up_recipe_id,student_feedback,client_request_id,request_hash)
    SELECT $1::uuid,$2::uuid,p.id,$3::uuid,$5::timestamptz,$6,$7,$8,$9::uuid,$10,$11::uuid,$12 FROM public.coaching_programs p WHERE p.id=$4::uuid AND p.academy_id=$1::uuid AND p.student_id=$2::uuid AND p.coach_id=$3::uuid AND p.status='active'
      AND ($9::uuid IS NULL OR EXISTS(SELECT 1 FROM public.training_recipes recipe WHERE recipe.id=$9::uuid AND recipe.academy_id=$1::uuid AND recipe.student_id=$2::uuid AND recipe.assigned_by=$3::uuid))
    ON CONFLICT(academy_id,coach_id,client_request_id) DO UPDATE SET updated_at=public.coaching_meetings.updated_at WHERE public.coaching_meetings.request_hash=EXCLUDED.request_hash RETURNING *`,[actor.academyId,actor.studentId,actor.userId,programId,meetingAt,privateNote,shared,focus,followUpRecipeId,studentFeedback,requestId,requestHash]);if(!rows.length)throw new CoachingError('meeting_owner_follow_up_or_idempotency_conflict',409);return rows[0];
}

export async function updateMeeting(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const meetingId=uuid(input.meetingId),expectedVersion=integer(input.expectedVersion,1,100000),meetingAt=instant(input.meetingAt),privateNote=input.privateNote?text(input.privateNote,4000):null,shared=input.sharedSummary?text(input.sharedSummary,2000):null,focus=input.nextWeekFocus?text(input.nextWeekFocus,1000):null,followUpRecipeId=input.followUpRecipeId?uuid(input.followUpRecipeId):null;
  const rows=await sql.query(`UPDATE public.coaching_meetings meeting SET meeting_at=$6::timestamptz,private_note=$7,shared_summary=$8,next_week_focus=$9,follow_up_recipe_id=$10::uuid,version=meeting.version+1,updated_at=now()
    WHERE meeting.id=$4::uuid AND meeting.academy_id=$1::uuid AND meeting.student_id=$2::uuid AND meeting.coach_id=$3::uuid AND meeting.version=$5
      AND EXISTS(SELECT 1 FROM public.coaching_programs program WHERE program.id=meeting.program_id AND program.status='active' AND program.coach_id=$3::uuid)
      AND ($10::uuid IS NULL OR EXISTS(SELECT 1 FROM public.training_recipes recipe WHERE recipe.id=$10::uuid AND recipe.academy_id=$1::uuid AND recipe.student_id=$2::uuid AND recipe.assigned_by=$3::uuid))
    RETURNING *`,[actor.academyId,actor.studentId,actor.userId,meetingId,expectedVersion,meetingAt,privateNote,shared,focus,followUpRecipeId]);if(!rows.length)throw new CoachingError('meeting_version_owner_or_follow_up_conflict',409);return rows[0];
}

export async function submitMeetingFeedback(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(actor.canCoach)throw new CoachingError('student_action_not_allowed',403);const meetingId=uuid(input.meetingId),expectedVersion=integer(input.expectedVersion,1,100000),feedback=text(input.feedback,2000);
  const rows=await sql.query(`UPDATE public.coaching_meetings SET student_feedback=$5,version=version+1,updated_at=now()
    WHERE id=$4::uuid AND academy_id=$1::uuid AND student_id=$2::uuid AND version=$3 AND shared_summary IS NOT NULL RETURNING id,student_feedback,version`,[actor.academyId,actor.studentId,expectedVersion,meetingId,feedback]);if(!rows.length)throw new CoachingError('meeting_feedback_version_or_scope_conflict',409);return rows[0];
}

export async function updateTopicStatus(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const programId=uuid(input.programId),subject=text(input.subject,80),topic=text(input.topic,180),achievement=input.achievement?text(input.achievement,180):'';const status=['not_started','in_progress','review','completed'].includes(String(input.status))?String(input.status):null;if(!status)throw new CoachingError('invalid_topic_status');const expected=integer(input.expectedVersion,0,100000);
  const rows=await sql.query(`INSERT INTO public.coaching_topic_status(academy_id,student_id,program_id,subject_code,topic_code,achievement_code,status,source,updated_by,version)
    SELECT $1::uuid,$2::uuid,p.id,$5,$6,$7,$8,'coach_observation',$3::uuid,1 FROM public.coaching_programs p WHERE p.id=$4::uuid AND p.academy_id=$1::uuid AND p.student_id=$2::uuid AND p.coach_id=$3::uuid AND p.status='active'
    ON CONFLICT(program_id,subject_code,topic_code,achievement_code) DO UPDATE SET status=EXCLUDED.status,updated_by=EXCLUDED.updated_by,version=public.coaching_topic_status.version+1,updated_at=now() WHERE public.coaching_topic_status.version=$9 RETURNING *`,[actor.academyId,actor.studentId,actor.userId,programId,subject,topic,achievement,status,expected]);if(!rows.length)throw new CoachingError('version_conflict',409);return rows[0];
}

export async function cancelPlan(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const planId=uuid(input.planId),expected=integer(input.expectedVersion,1,100000);
  const rows=await sql.query(`WITH target AS (SELECT id,status,version FROM public.coaching_plans WHERE id=$4::uuid AND academy_id=$1::uuid AND student_id=$2::uuid AND coach_id=$3::uuid AND ((version=$5 AND status<>'cancelled') OR (version=$5+1 AND status='cancelled')) FOR UPDATE),
    cancelled_recipes AS (UPDATE public.training_recipes r SET is_active=false,cancelled_at=COALESCE(r.cancelled_at,now()),cancelled_by=COALESCE(r.cancelled_by,$3::uuid),updated_at=now() FROM public.coaching_plan_items i,target WHERE target.status<>'cancelled' AND i.plan_id=target.id AND r.id=i.recipe_id RETURNING r.id),
    cancelled_plan AS (UPDATE public.coaching_plans p SET status='cancelled',cancelled_at=now(),version=p.version+1,updated_at=now() FROM target WHERE target.status<>'cancelled' AND p.id=target.id RETURNING p.*)
    SELECT id,academy_id,student_id,program_id,coach_id,title,period_start::text AS period_start,period_end::text AS period_end,monthly_focus,status,version,client_request_id,request_hash,published_at,cancelled_at,created_at,updated_at FROM cancelled_plan
    UNION ALL
    SELECT p.id,p.academy_id,p.student_id,p.program_id,p.coach_id,p.title,p.period_start::text,p.period_end::text,p.monthly_focus,p.status,p.version,p.client_request_id,p.request_hash,p.published_at,p.cancelled_at,p.created_at,p.updated_at FROM public.coaching_plans p JOIN target ON target.id=p.id WHERE target.status='cancelled'`,[actor.academyId,actor.studentId,actor.userId,planId,expected]);if(!rows.length)throw new CoachingError('version_conflict_or_plan_not_found',409);return rows[0];
}
