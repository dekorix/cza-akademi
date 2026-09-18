import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { defaultRecipeSettings,isAssignableModule } from '@/lib/training-recipes';

export type CoachingSql = { query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };
export type CoachingActor = { userId: string; academyId: string; studentId: string; canCoach: boolean };
export class CoachingError extends Error { constructor(public code: string, public status = 400) { super(code); } }

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value:unknown,max:number,required=true)=>{if(typeof value!=='string'||(required&&!value.trim())||value.trim().length>max)throw new CoachingError('invalid_text');return value.trim();};
const uuid=(value:unknown,code='invalid_id')=>{if(typeof value!=='string'||!UUID.test(value))throw new CoachingError(code);return value;};
const integer=(value:unknown,min:number,max:number,nullable=false)=>{if(nullable&&(value===null||value===undefined||value===''))return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw new CoachingError('invalid_number');return n;};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json=(value:unknown)=>JSON.stringify(value);
const dateOnly=(value:unknown)=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
const pageSecret=()=>{const value=process.env.CZA_TIMELINE_CURSOR_SECRET||process.env.CZA_TRUSTED_PROXY_HMAC_SECRET||'';if(Buffer.byteLength(value)<32)throw new CoachingError('coaching_cursor_unavailable',503);return value;};
type CoachingCursor={v:1;academyId:string;studentId:string;studentView:boolean;periodStart:string;id:string};
function encodeCursor(value:CoachingCursor){const body=Buffer.from(JSON.stringify(value)).toString('base64url');return `${body}.${createHmac('sha256',pageSecret()).update(body).digest('base64url')}`;}
function decodeCursor(value:string,actor:CoachingActor,studentView:boolean){if(value.length>1024)throw new CoachingError('invalid_cursor');const [body,signature,extra]=value.split('.');if(!body||!signature||extra!==undefined)throw new CoachingError('invalid_cursor');const expected=createHmac('sha256',pageSecret()).update(body).digest('base64url');const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw new CoachingError('invalid_cursor');let parsed:CoachingCursor;try{parsed=JSON.parse(Buffer.from(body,'base64url').toString()) as CoachingCursor;}catch{throw new CoachingError('invalid_cursor');}if(parsed.v!==1||parsed.academyId!==actor.academyId||parsed.studentId!==actor.studentId||parsed.studentView!==studentView||!UUID.test(parsed.id)||Number.isNaN(Date.parse(parsed.periodStart)))throw new CoachingError('invalid_cursor');return parsed;}

export async function resolveEducatorCoachingActor(sql:CoachingSql,authUserId:string,studentId:string,write:boolean):Promise<CoachingActor>{
  const rows=await sql.query(`SELECT educator.id user_id,educator.academy_id,student.id student_id,link.can_coach
    FROM public.users educator JOIN public.teacher_student_links link
      ON link.teacher_id=educator.id AND link.academy_id=educator.academy_id AND link.can_view=true
    JOIN public.students student ON student.id=link.student_id AND student.academy_id=educator.academy_id
    WHERE educator.auth_user_id=$1::uuid AND educator.role::text='educator' AND educator.is_active=true
      AND student.id=$2::uuid AND student.status='active' AND ($3::boolean=false OR link.can_coach=true) LIMIT 1`,[authUserId,studentId,write]);
  if(!rows.length)throw new CoachingError(write?'coaching_write_not_authorized':'student_not_authorized',403);
  return{userId:String(rows[0].user_id),academyId:String(rows[0].academy_id),studentId:String(rows[0].student_id),canCoach:rows[0].can_coach===true};
}

export async function readCoachingCenter(sql:CoachingSql,actor:CoachingActor,{includePrivate=false,studentView=false,limit=20,cursor=null}:{includePrivate?:boolean;studentView?:boolean;limit?:number;cursor?:string|null}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new CoachingError('invalid_limit');const decoded=cursor?decodeCursor(cursor,actor,studentView):null;
  const p=[actor.academyId,actor.studentId];
  const [programs,goals,topics,plans,studyLogs,exams,mistakes,meetings,templates]=await Promise.all([
    sql.query(`SELECT id,program_type,exam_year,field_code,status,version,created_at FROM public.coaching_programs WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 20`,p),
    sql.query(`SELECT id,program_id,revision,target,provenance,supersedes_id,created_at FROM public.coaching_goals WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 30`,p),
    sql.query(`SELECT id,program_id,subject_code,topic_code,achievement_code,status,source,version,updated_at FROM public.coaching_topic_status WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY updated_at DESC,id DESC LIMIT 50`,p),
    sql.query(`SELECT plan.id,plan.program_id,plan.title,plan.period_start,plan.period_end,plan.monthly_focus,plan.status,plan.version,plan.published_at,plan.cancelled_at,
      COALESCE(jsonb_agg(jsonb_build_object('itemId',item.id,'recipeId',recipe.id,'scheduledFor',item.scheduled_for,'taskKind',recipe.task_kind,'moduleCode',recipe.module_code,'subject',recipe.academic_subject,'topic',recipe.academic_topic,'name',recipe.name,'instructions',recipe.instructions,'purpose',recipe.task_purpose,'active',recipe.is_active,'cancelledAt',recipe.cancelled_at) ORDER BY item.scheduled_for,item.id) FILTER(WHERE item.id IS NOT NULL),'[]') items
      FROM public.coaching_plans plan LEFT JOIN public.coaching_plan_items item ON item.plan_id=plan.id
      LEFT JOIN public.training_recipes recipe ON recipe.id=item.recipe_id
      WHERE plan.academy_id=$1::uuid AND plan.student_id=$2::uuid AND ($3::boolean=false OR plan.status IN ('published','cancelled'))
        AND ($4::date IS NULL OR (plan.period_start,plan.id)<($4::date,$5::uuid))
      GROUP BY plan.id ORDER BY plan.period_start DESC,plan.id DESC LIMIT $6`,[...p,studentView,decoded?.periodStart??null,decoded?.id??null,limit+1]),
    sql.query(`SELECT id,recipe_id,question_count,correct_count,wrong_count,blank_count,duration_minutes,student_feedback,provenance,created_at FROM public.coaching_study_logs WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 50`,p),
    sql.query(`SELECT result.id,result.program_id,template.code template_code,template.stage,template.source_label,template.is_demo,result.exam_date,result.sections,result.total_net,result.is_partial,result.provenance,result.revision,result.supersedes_id,result.created_at FROM public.coaching_exam_results result JOIN public.coaching_exam_templates template ON template.id=result.template_id WHERE result.academy_id=$1::uuid AND result.student_id=$2::uuid ORDER BY result.exam_date DESC,result.id DESC LIMIT 40`,p),
    sql.query(`SELECT id,program_id,exam_result_id,study_log_id,subject_code,topic_code,reason_code,explanation,provenance,created_at FROM public.coaching_mistakes WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 50`,p),
    sql.query(`SELECT id,program_id,meeting_at,${includePrivate?'private_note':'NULL::text private_note'},shared_summary,next_week_focus,student_feedback,version,created_at FROM public.coaching_meetings WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY meeting_at DESC,id DESC LIMIT 30`,p),
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
    (SELECT target FROM public.coaching_goals WHERE academy_id=$1::uuid AND student_id=$2::uuid ORDER BY created_at DESC,id DESC LIMIT 1) latest_goal`,[academyId,studentId]);
  const row=rows[0]||{};return{activePrograms:Number(row.active_programs)||0,publishedPlans:Number(row.published_plans)||0,studyLogs:Number(row.study_logs)||0,examResults:Number(row.exam_results)||0,meetings:Number(row.meetings)||0,latestGoal:row.latest_goal??null,performanceProvenance:'CLIENT_REPORTED' as const,sourceReference:'coaching-center'};
}

export async function createGoal(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programType=input.programType==='LGS'?'LGS':input.programType==='YKS'?'YKS':null;if(!programType)throw new CoachingError('invalid_program');
  const examYear=integer(input.examYear,2020,2100);const fieldCode=input.fieldCode?text(input.fieldCode,40):null;
  const target=input.target;if(!target||typeof target!=='object'||Array.isArray(target))throw new CoachingError('invalid_target');
  const requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const requestHash=hash({programType,examYear,fieldCode,target});
  const rows=await sql.query(`WITH program AS (
      INSERT INTO public.coaching_programs(academy_id,student_id,coach_id,program_type,exam_year,field_code,client_request_id,request_hash)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::uuid,$8)
      ON CONFLICT(student_id,program_type,exam_year) WHERE status='active' DO UPDATE SET updated_at=public.coaching_programs.updated_at RETURNING id
    ), existing AS (SELECT id,program_id,revision,target,provenance,created_at,request_hash FROM public.coaching_goals WHERE academy_id=$1::uuid AND coach_id=$3::uuid AND client_request_id=$7::uuid),
    inserted AS (INSERT INTO public.coaching_goals(academy_id,student_id,program_id,coach_id,revision,target,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,program.id,$3::uuid,COALESCE((SELECT max(revision)+1 FROM public.coaching_goals WHERE program_id=program.id),1),$9::jsonb,$7::uuid,$8 FROM program WHERE NOT EXISTS(SELECT 1 FROM existing) RETURNING *)
    SELECT id,program_id,revision,target,provenance,created_at,false replayed FROM inserted UNION ALL SELECT id,program_id,revision,target,provenance,created_at,true FROM existing WHERE request_hash=$8`,
    [actor.academyId,actor.studentId,actor.userId,programType,examYear,fieldCode,requestId,requestHash,json(target)]);
  if(!rows.length)throw new CoachingError('idempotency_conflict',409);return rows[0];
}

export async function publishPlan(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programId=uuid(input.programId);const requestId=uuid(input.clientRequestId,'invalid_idempotency_key');
  const title=text(input.title,180);const taskKind=input.taskKind==='cza_module'?'cza_module':'academic';
  const moduleCode=taskKind==='cza_module'&&typeof input.moduleCode==='string'&&isAssignableModule(input.moduleCode)?input.moduleCode:null;if(taskKind==='cza_module'&&!moduleCode)throw new CoachingError('invalid_module');
  const subject=taskKind==='academic'?text(input.subject,80):null;const topic=taskKind==='academic'&&input.topic?text(input.topic,180):null;const settings=moduleCode?defaultRecipeSettings(moduleCode):{};
  const instructions=input.instructions?text(input.instructions,1000):null;const start=text(input.periodStart,10);const end=text(input.periodEnd,10);const scheduled=text(input.scheduledFor,10);
  const targetQuestions=integer(input.targetQuestions,1,10000,true);const targetMinutes=integer(input.targetMinutes,1,1440,true);
  const requestHash=hash({programId,title,taskKind,moduleCode,subject,topic,instructions,start,end,scheduled,targetQuestions,targetMinutes,settings});
  const rows=await sql.query(`WITH locked_student AS (SELECT id FROM public.students WHERE id=$2::uuid AND academy_id=$1::uuid AND status='active' FOR UPDATE),
    owned_program AS (SELECT program.id FROM public.coaching_programs program JOIN locked_student student ON student.id=program.student_id WHERE program.id=$4::uuid AND program.academy_id=$1::uuid AND program.student_id=$2::uuid AND program.coach_id=$3::uuid AND program.status='active' FOR UPDATE OF program),
    overlap AS (SELECT id FROM public.coaching_plans WHERE student_id=$2::uuid AND status='published' AND client_request_id<>$6::uuid AND daterange(period_start,period_end,'[]')&&daterange($9::date,$10::date,'[]') FOR UPDATE),
    plan AS (INSERT INTO public.coaching_plans(academy_id,student_id,program_id,coach_id,title,period_start,period_end,status,version,client_request_id,request_hash,published_at)
      SELECT $1::uuid,$2::uuid,id,$3::uuid,$5,$9::date,$10::date,'published',1,$6::uuid,$7,now() FROM owned_program WHERE NOT EXISTS(SELECT 1 FROM overlap)
      ON CONFLICT(academy_id,coach_id,client_request_id) DO UPDATE SET updated_at=public.coaching_plans.updated_at WHERE public.coaching_plans.request_hash=EXCLUDED.request_hash RETURNING id),
    recipe AS (INSERT INTO public.training_recipes(academy_id,student_id,module_code,assigned_by,source,name,instructions,settings,is_active,starts_at,expires_at,client_request_id,request_hash,task_kind,academic_subject,academic_topic,target_questions,target_minutes,task_purpose)
      SELECT $1::uuid,$2::uuid,$12,$3::uuid,'teacher_assignment',$5,$8,$16::jsonb,true,$11::date,$10::date+interval '1 day',$6::uuid,$7,$13,$14,$15,$17,$18,'practice' FROM plan
      ON CONFLICT(academy_id,assigned_by,client_request_id) WHERE client_request_id IS NOT NULL DO UPDATE SET updated_at=public.training_recipes.updated_at WHERE public.training_recipes.request_hash=EXCLUDED.request_hash RETURNING id),
    item AS (INSERT INTO public.coaching_plan_items(academy_id,student_id,plan_id,recipe_id,scheduled_for) SELECT $1::uuid,$2::uuid,plan.id,recipe.id,$11::date FROM plan,recipe ON CONFLICT(plan_id,recipe_id) DO UPDATE SET scheduled_for=EXCLUDED.scheduled_for RETURNING recipe_id)
    SELECT plan.id plan_id,item.recipe_id FROM plan,item`,[actor.academyId,actor.studentId,actor.userId,programId,title,requestId,requestHash,instructions,start,end,scheduled,moduleCode,taskKind,subject,topic,json(settings),targetQuestions,targetMinutes]);
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
  if(!Array.isArray(input.sections)||!Array.isArray(rules.sections))throw new CoachingError('invalid_exam_sections');
  const allowed=new Map(rules.sections.map(s=>[String(s.code),integer(s.questions,1,500)]));let partial=false,totalNet=0;
  const sections=input.sections.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new CoachingError('invalid_exam_sections');const row=raw as Record<string,unknown>;const code=text(row.code,40),limit=allowed.get(code);if(!limit)throw new CoachingError('invalid_exam_section');const correct=integer(row.correct,0,limit) as number,wrong=integer(row.wrong,0,limit) as number,blank=integer(row.blank,0,limit) as number;const total=correct+wrong+blank;if(total>limit)throw new CoachingError('invalid_exam_totals');if(total<limit)partial=true;const net=Math.round((correct-wrong/divisor)*100)/100;totalNet+=net;return{code,correct,wrong,blank,net};});
  if(sections.length!==allowed.size)partial=true;totalNet=Math.round(totalNet*100)/100;const examDate=text(input.examDate,10);const supersedesId=input.supersedesId?uuid(input.supersedesId):null;const requestHash=hash({programId,templateId,examDate,sections,supersedesId});
  const rows=await sql.query(`WITH prior AS (SELECT revision FROM public.coaching_exam_results WHERE id=$12::uuid AND program_id=$11::uuid AND academy_id=$1::uuid AND student_id=$2::uuid)
    INSERT INTO public.coaching_exam_results(academy_id,student_id,program_id,template_id,reported_by,exam_date,sections,total_net,is_partial,revision,supersedes_id,client_request_id,request_hash)
    SELECT $1::uuid,$2::uuid,p.id,template.id,$3::uuid,$5::date,$6::jsonb,$7,$8,COALESCE((SELECT revision+1 FROM prior),1),$12::uuid,$9::uuid,$10
      FROM public.coaching_programs p JOIN public.coaching_exam_templates template ON template.id=$4::uuid AND template.is_active=true AND template.program_type=p.program_type
      WHERE p.id=$11::uuid AND p.academy_id=$1::uuid AND p.student_id=$2::uuid AND p.status='active' AND ($12::uuid IS NULL OR EXISTS(SELECT 1 FROM prior))
    ON CONFLICT(academy_id,reported_by,client_request_id) DO UPDATE SET created_at=public.coaching_exam_results.created_at WHERE public.coaching_exam_results.request_hash=EXCLUDED.request_hash RETURNING *`,[actor.academyId,actor.studentId,actor.userId,templateId,examDate,json(sections),totalNet,partial,requestId,requestHash,programId,supersedesId]);
  if(!rows.length)throw new CoachingError('idempotency_conflict',409);return rows[0];
}

export async function createMistakeRevision(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);
  const programId=uuid(input.programId),examResultId=input.examResultId?uuid(input.examResultId):null,studyLogId=input.studyLogId?uuid(input.studyLogId):null;if((examResultId?1:0)+(studyLogId?1:0)!==1)throw new CoachingError('invalid_mistake_source');
  const subject=text(input.subject,80),topic=input.topic?text(input.topic,180):null,reason=text(input.reason,80),explanation=input.explanation?text(input.explanation,1000):null,requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const requestHash=hash({programId,examResultId,studyLogId,subject,topic,reason,explanation});
  const rows=await sql.query(`WITH source_ok AS (SELECT program.id FROM public.coaching_programs program
      WHERE program.id=$4::uuid AND program.academy_id=$1::uuid AND program.student_id=$2::uuid AND program.coach_id=$3::uuid AND program.status='active'
        AND (($5::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM public.coaching_exam_results result WHERE result.id=$5::uuid AND result.academy_id=$1::uuid AND result.student_id=$2::uuid AND result.program_id=program.id))
          OR ($6::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM public.coaching_study_logs study JOIN public.training_recipes recipe ON recipe.id=study.recipe_id AND recipe.academy_id=study.academy_id AND recipe.student_id=study.student_id WHERE study.id=$6::uuid AND study.academy_id=$1::uuid AND study.student_id=$2::uuid)))),
    active_plan AS (SELECT plan.id FROM public.coaching_plans plan,source_ok WHERE plan.program_id=source_ok.id AND plan.academy_id=$1::uuid AND plan.student_id=$2::uuid AND plan.coach_id=$3::uuid AND plan.status='published' ORDER BY plan.period_start DESC,plan.id DESC LIMIT 1 FOR UPDATE OF plan),
    mistake AS (INSERT INTO public.coaching_mistakes(academy_id,student_id,program_id,exam_result_id,study_log_id,subject_code,topic_code,reason_code,explanation,created_by,client_request_id,request_hash)
      SELECT $1::uuid,$2::uuid,source_ok.id,$5::uuid,$6::uuid,$7,$8,$9,$10,$3::uuid,$11::uuid,$12 FROM source_ok,active_plan
      ON CONFLICT(academy_id,created_by,client_request_id) DO UPDATE SET created_at=public.coaching_mistakes.created_at WHERE public.coaching_mistakes.request_hash=EXCLUDED.request_hash RETURNING id),
    recipe AS (INSERT INTO public.training_recipes(academy_id,student_id,module_code,assigned_by,source,name,instructions,settings,is_active,starts_at,client_request_id,request_hash,task_kind,academic_subject,academic_topic,task_purpose)
      SELECT $1::uuid,$2::uuid,NULL,$3::uuid,'teacher_assignment','Tekrar · '||$7,$10,'{}',true,now(),$11::uuid,$12,'academic',$7,$8,'revision' FROM mistake
      ON CONFLICT(academy_id,assigned_by,client_request_id) WHERE client_request_id IS NOT NULL DO UPDATE SET updated_at=public.training_recipes.updated_at WHERE public.training_recipes.request_hash=EXCLUDED.request_hash RETURNING id),
    item AS (INSERT INTO public.coaching_plan_items(academy_id,student_id,plan_id,recipe_id,scheduled_for) SELECT $1::uuid,$2::uuid,active_plan.id,recipe.id,current_date FROM active_plan,recipe ON CONFLICT(plan_id,recipe_id) DO UPDATE SET scheduled_for=public.coaching_plan_items.scheduled_for RETURNING recipe_id)
    SELECT mistake.id mistake_id,item.recipe_id FROM mistake,item`,[actor.academyId,actor.studentId,actor.userId,programId,examResultId,studyLogId,subject,topic,reason,explanation,requestId,requestHash]);
  if(!rows.length)throw new CoachingError('idempotency_conflict',409);return rows[0];
}

export async function createMeeting(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const programId=uuid(input.programId),requestId=uuid(input.clientRequestId,'invalid_idempotency_key');const meetingAt=text(input.meetingAt,40),privateNote=input.privateNote?text(input.privateNote,4000):null,shared=input.sharedSummary?text(input.sharedSummary,2000):null,focus=input.nextWeekFocus?text(input.nextWeekFocus,1000):null;const requestHash=hash({programId,meetingAt,privateNote,shared,focus});
  const rows=await sql.query(`INSERT INTO public.coaching_meetings(academy_id,student_id,program_id,coach_id,meeting_at,private_note,shared_summary,next_week_focus,client_request_id,request_hash)
    SELECT $1::uuid,$2::uuid,p.id,$3::uuid,$5::timestamptz,$6,$7,$8,$9::uuid,$10 FROM public.coaching_programs p WHERE p.id=$4::uuid AND p.academy_id=$1::uuid AND p.student_id=$2::uuid AND p.coach_id=$3::uuid AND p.status='active'
    ON CONFLICT(academy_id,coach_id,client_request_id) DO UPDATE SET updated_at=public.coaching_meetings.updated_at WHERE public.coaching_meetings.request_hash=EXCLUDED.request_hash RETURNING *`,[actor.academyId,actor.studentId,actor.userId,programId,meetingAt,privateNote,shared,focus,requestId,requestHash]);if(!rows.length)throw new CoachingError('idempotency_conflict',409);return rows[0];
}

export async function updateTopicStatus(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const programId=uuid(input.programId),subject=text(input.subject,80),topic=text(input.topic,180),achievement=input.achievement?text(input.achievement,180):'';const status=['not_started','in_progress','review','completed'].includes(String(input.status))?String(input.status):null;if(!status)throw new CoachingError('invalid_topic_status');const expected=integer(input.expectedVersion,0,100000);
  const rows=await sql.query(`INSERT INTO public.coaching_topic_status(academy_id,student_id,program_id,subject_code,topic_code,achievement_code,status,source,updated_by,version)
    SELECT $1::uuid,$2::uuid,p.id,$5,$6,$7,$8,'coach_observation',$3::uuid,1 FROM public.coaching_programs p WHERE p.id=$4::uuid AND p.academy_id=$1::uuid AND p.student_id=$2::uuid AND p.coach_id=$3::uuid
    ON CONFLICT(program_id,subject_code,topic_code,achievement_code) DO UPDATE SET status=EXCLUDED.status,updated_by=EXCLUDED.updated_by,version=public.coaching_topic_status.version+1,updated_at=now() WHERE public.coaching_topic_status.version=$9 RETURNING *`,[actor.academyId,actor.studentId,actor.userId,programId,subject,topic,achievement,status,expected]);if(!rows.length)throw new CoachingError('version_conflict',409);return rows[0];
}

export async function cancelPlan(sql:CoachingSql,actor:CoachingActor,input:Record<string,unknown>){
  if(!actor.canCoach)throw new CoachingError('coaching_write_not_authorized',403);const planId=uuid(input.planId),expected=integer(input.expectedVersion,1,100000);
  const rows=await sql.query(`WITH target AS (SELECT id,status,version FROM public.coaching_plans WHERE id=$4::uuid AND academy_id=$1::uuid AND student_id=$2::uuid AND coach_id=$3::uuid AND ((version=$5 AND status<>'cancelled') OR (version=$5+1 AND status='cancelled')) FOR UPDATE),
    cancelled_recipes AS (UPDATE public.training_recipes r SET is_active=false,cancelled_at=COALESCE(r.cancelled_at,now()),cancelled_by=COALESCE(r.cancelled_by,$3::uuid),updated_at=now() FROM public.coaching_plan_items i,target WHERE target.status<>'cancelled' AND i.plan_id=target.id AND r.id=i.recipe_id RETURNING r.id),
    cancelled_plan AS (UPDATE public.coaching_plans p SET status='cancelled',cancelled_at=now(),version=p.version+1,updated_at=now() FROM target WHERE target.status<>'cancelled' AND p.id=target.id RETURNING p.*)
    SELECT * FROM cancelled_plan UNION ALL SELECT p.* FROM public.coaching_plans p JOIN target ON target.id=p.id WHERE target.status='cancelled'`,[actor.academyId,actor.studentId,actor.userId,planId,expected]);if(!rows.length)throw new CoachingError('version_conflict_or_plan_not_found',409);return rows[0];
}
