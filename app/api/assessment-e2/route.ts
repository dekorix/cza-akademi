import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { V7_BANK_SIZE, V7_SECTIONS, V7_TASK_MAP, type V7SectionId } from '@/lib/e2-question-bank';
import {
  E2_SUPPORT_TO_NUMBER,
  E2_TEMPLATE_CODE,
  e2Advance,
  e2FirstIncompleteSection,
  e2NextAdaptiveTask,
  e2NormalizeAdaptiveProfile,
  e2Summary,
  validE2Rating,
  type E2Evidence,
} from '@/lib/e2-assessment';
import type { V7AdaptiveProfile } from '@/lib/e2-adaptive';
import { caregiverQuestionsV4, isCaregiverV4Question, buildCaregiverV4Report, type CaregiverState } from '@/lib/e2-caregiver';

function json(body:unknown,status=200){
  return Response.json(body,{status,headers:{'cache-control':'no-store'}});
}

async function db(){
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('database_unavailable');
  const sql=neon(url);
  await sql`
    CREATE TABLE IF NOT EXISTS public.assessment_sessions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      template_code text NOT NULL,
      student_label text NULL,
      status text NOT NULL DEFAULT 'active',
      current_task_code text NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`ALTER TABLE public.assessment_sessions ADD COLUMN IF NOT EXISTS student_id uuid NULL`;
  await sql`
    CREATE TABLE IF NOT EXISTS public.assessment_attempts(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      task_code text NOT NULL,
      shown_at timestamptz NOT NULL DEFAULT now(),
      first_action_at timestamptz NULL,
      completed_at timestamptz NULL,
      answer_text text NULL,
      answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_changes integer NOT NULL DEFAULT 0,
      support_level integer NOT NULL DEFAULT 0,
      self_corrected boolean NOT NULL DEFAULT false,
      rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      response_latency_ms integer NULL,
      total_response_time_ms integer NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  return sql;
}

async function sessionBundle(sql:any,sessionId:string){
  const sessions=await sql`
    SELECT id,student_id,template_code,student_label,status,current_task_code,
           started_at,completed_at,metadata
    FROM public.assessment_sessions
    WHERE id=${sessionId}::uuid AND template_code=${E2_TEMPLATE_CODE}
    LIMIT 1
  ` as Record<string,unknown>[];
  if(!sessions.length)return null;
  const attempts=await sql`
    SELECT id,task_code,answer_text,answer_payload,support_level,response_latency_ms,
           total_response_time_ms,shown_at,first_action_at,completed_at,created_at
    FROM public.assessment_attempts
    WHERE session_id=${sessionId}::uuid
    ORDER BY created_at ASC
  ` as Record<string,unknown>[];
  return{session:sessions[0],attempts};
}

function metadataOf(session:Record<string,unknown>){
  return session.metadata&&typeof session.metadata==='object'
    ? session.metadata as Record<string,unknown>
    : {};
}

function responsesFromRows(rows:Record<string,unknown>[]):E2Evidence[]{
  return rows.flatMap(row=>{
    const taskCode=String(row.task_code||'');
    if(!V7_TASK_MAP.has(taskCode))return[];
    const payload=row.answer_payload&&typeof row.answer_payload==='object'
      ? row.answer_payload as Record<string,unknown>
      : {};
    const rawMetrics=payload.metrics&&typeof payload.metrics==='object'
      ? payload.metrics as Record<string,unknown>
      : {};
    const metrics:Record<string,number>={};
    for(const [key,value] of Object.entries(rawMetrics)){
      const number=Number(value);
      if(Number.isFinite(number))metrics[key]=number;
    }
    return[{
      itemId:taskCode,
      rating:validE2Rating(payload.rating),
      note:typeof payload.note==='string'?payload.note:undefined,
      metrics,
      recordedAt:typeof row.completed_at==='string'?row.completed_at:undefined,
    }];
  });
}

function caregiverRows(rows:Record<string,unknown>[]) {
  return rows.flatMap(row=>{
    const taskCode=String(row.task_code||'');
    if(!taskCode.startsWith('E2CG_')) return [];
    const payload=row.answer_payload&&typeof row.answer_payload==='object'
      ? row.answer_payload as Record<string,unknown>
      : {};
    const questionId=typeof payload.questionId==='string'?payload.questionId:taskCode.slice(5);
    if(!isCaregiverV4Question(questionId)) return [];
    return [{
      questionId,
      answer:typeof payload.answer==='string'?payload.answer:'',
      note:typeof payload.note==='string'?payload.note:'',
      recordedAt:typeof row.completed_at==='string'?row.completed_at:new Date().toISOString(),
    }];
  });
}

function caregiverStateFromRows(rows:Record<string,unknown>[],completedAt:unknown):CaregiverState {
  return {
    responses:caregiverRows(rows),
    startedAt:new Date().toISOString(),
    completedAt:typeof completedAt==='string'&&completedAt?completedAt:undefined,
  };
}

function caregiverTaskCode(questionId:string){
  return 'E2CG_'+questionId;
}

function numericMetrics(value:unknown){
  if(!value||typeof value!=='object')return{} as Record<string,number>;
  const output:Record<string,number>={};
  for(const [key,raw] of Object.entries(value as Record<string,unknown>).slice(0,40)){
    const number=Number(raw);
    if(Number.isFinite(number))output[key]=Math.max(-1_000_000,Math.min(1_000_000,number));
  }
  return output;
}

export async function POST(request:Request){
  const gate=await allowRequest(request,'assessment-e2',140,10*60_000);
  if(!gate.allowed)return rateLimited(gate.retryAfterSeconds);

  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin) return json({ok:false,error:'request_origin_rejected'},403);

  const educator=await authenticatedEducator(request);
  if(!educator?.id) return json({ok:false,error:'educator_session_required'},401);

  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>;}
  catch{return json({ok:false,error:'invalid_request'},400);}

  const action=typeof input.action==='string'?input.action:'';
  const sessionId=typeof input.sessionId==='string'?input.sessionId.trim():'';
  if(!sessionId)return json({ok:false,error:'session_required'},400);

  try{
    const sql=await db();
    const bundle=await sessionBundle(sql,sessionId);
    if(!bundle)return json({ok:false,error:'e2_session_not_found'},404);

    const centralStudentId=typeof bundle.session.student_id==='string'?bundle.session.student_id:'';
    if(!centralStudentId) return json({ok:false,error:'e2_central_student_required'},409);
    const linked=await sql`
      SELECT 1
      FROM public.teacher_student_links l
      JOIN public.users t
        ON t.id=l.teacher_id
       AND t.academy_id=l.academy_id
      WHERE l.student_id=${centralStudentId}::uuid
        AND l.can_view=true
        AND t.auth_user_id=${educator.id}
        AND t.is_active=true
      LIMIT 1
    `;
    if(!linked.length) return json({ok:false,error:'student_not_linked_to_educator'},403);

    const metadata=metadataOf(bundle.session);
    const ageMonths=Number(metadata.ageMonths);
    if(!Number.isInteger(ageMonths)||ageMonths<24||ageMonths>35){
      return json({ok:false,error:'e2_session_age_invalid'},409);
    }

    const profile=metadata.adaptiveProfile&&typeof metadata.adaptiveProfile==='object'
      ? metadata.adaptiveProfile as V7AdaptiveProfile
      : null;
    const completedSections=Array.isArray(metadata.adaptiveSectionsCompleted)
      ? metadata.adaptiveSectionsCompleted.map(String)
      : [];
    const responses=responsesFromRows(bundle.attempts);

    if(action==='get'){
      const currentTaskCode=typeof bundle.session.current_task_code==='string'
        ? bundle.session.current_task_code
        : null;
      return json({
        ok:true,
        session:bundle.session,
        profile,
        currentTask:currentTaskCode?V7_TASK_MAP.get(currentTaskCode)||null:null,
        sections:V7_SECTIONS,
        bankSize:V7_BANK_SIZE+8,
        responses,
        summary:profile?e2Summary(ageMonths,profile,responses,completedSections):null,
        needsAdaptiveProfile:!profile,
        childPhaseComplete:Boolean(metadata.childCompletedAt),
        caregiverRequired:metadata.caregiverRequired!==false,
        caregiverComplete:Boolean(metadata.caregiverCompletedAt),
        caregiverAnswered:caregiverRows(bundle.attempts).length,
        caregiverTotal:caregiverQuestionsV4.length,
      });
    }

    if(action==='caregiver_questions'){
      const caregiverState=caregiverStateFromRows(bundle.attempts,metadata.caregiverCompletedAt);
      return json({
        ok:true,
        questions:caregiverQuestionsV4,
        caregiver:buildCaregiverV4Report(caregiverState),
      });
    }

    if(action==='caregiver_response'){
      if(bundle.session.status==='completed') return json({ok:false,error:'session_completed'},409);
      const questionId=typeof input.questionId==='string'?input.questionId.trim():'';
      if(!isCaregiverV4Question(questionId)) return json({ok:false,error:'invalid_caregiver_question'},400);
      const answer=typeof input.answer==='string'?input.answer.trim().slice(0,1200):'';
      const note=typeof input.note==='string'?input.note.trim().slice(0,500):'';
      if(!answer) return json({ok:false,error:'caregiver_answer_required'},400);
      const taskCode=caregiverTaskCode(questionId);
      const now=new Date().toISOString();
      await sql`DELETE FROM public.assessment_attempts WHERE session_id=${sessionId}::uuid AND task_code=${taskCode}`;
      await sql`
        INSERT INTO public.assessment_attempts(
          session_id,task_code,shown_at,first_action_at,completed_at,
          answer_text,answer_payload,answer_changes,support_level,self_corrected,
          rubric_scores,response_latency_ms,total_response_time_ms
        ) VALUES(
          ${sessionId}::uuid,${taskCode},${now}::timestamptz,${now}::timestamptz,${now}::timestamptz,
          ${answer},${JSON.stringify({source:'CAREGIVER',questionId,answer,note,diagnosticUse:false})}::jsonb,
          0,0,false,'{}'::jsonb,0,0
        )
      `;
      const refreshed=await sessionBundle(sql,sessionId);
      const caregiverState=caregiverStateFromRows(refreshed?.attempts||[],metadata.caregiverCompletedAt);
      return json({ok:true,caregiver:buildCaregiverV4Report(caregiverState)});
    }

    if(action==='caregiver_finish'){
      const caregiverState=caregiverStateFromRows(bundle.attempts,metadata.caregiverCompletedAt);
      const answered=new Set(caregiverState.responses.map(row=>row.questionId));
      const missing=caregiverQuestionsV4.filter(question=>!answered.has(question.id)).map(question=>question.id);
      if(missing.length) return json({ok:false,error:'caregiver_incomplete',missing},409);
      const caregiverCompletedAt=new Date().toISOString();
      const childComplete=Boolean(metadata.childCompletedAt);
      const nextMetadata={...metadata,caregiverCompletedAt};
      await sql`
        UPDATE public.assessment_sessions
        SET metadata=${JSON.stringify(nextMetadata)}::jsonb,
            status=${childComplete?'completed':'active'},
            completed_at=${childComplete?caregiverCompletedAt:null}::timestamptz
        WHERE id=${sessionId}::uuid
      `;
      return json({
        ok:true,
        caregiverCompletedAt,
        sessionCompleted:childComplete,
        caregiver:buildCaregiverV4Report({...caregiverState,completedAt:caregiverCompletedAt}),
      });
    }

    if(action==='report'){
      if(!profile) return json({ok:false,error:'adaptive_profile_required'},409);
      const caregiverState=caregiverStateFromRows(bundle.attempts,metadata.caregiverCompletedAt);
      const summary=e2Summary(ageMonths,profile,responses,completedSections);
      const caregiver=buildCaregiverV4Report(caregiverState);
      const priorities=[...summary.categoryPerformance]
        .filter(row=>row.assessed>0)
        .sort((a,b)=>(a.independentRate??101)-(b.independentRate??101))
        .slice(0,4)
        .map(row=>`${row.title}: bağımsız performansı farklı oyun ve günlük yaşam örnekleriyle yeniden örnekle; desteği kademeli azalt.`);
      if(!priorities.length) priorities.push('Farklı gün ve bağlamlarda ek örnekler toplayarak profilin kararlılığını doğrula.');
      return json({
        ok:true,
        report:{
          profileCode:'E2',
          title:'CZA 24–36 Ay Adaptif Bütüncül Değerlendirme',
          studentLabel:bundle.session.student_label,
          ageMonths,
          ageBand:metadata.ageBand||summary.ageBand,
          assessmentPurpose:metadata.assessmentPurpose||'GENERAL',
          status:bundle.session.status,
          childCompleted:Boolean(metadata.childCompletedAt),
          caregiverCompleted:Boolean(metadata.caregiverCompletedAt),
          summary,
          caregiver,
          recommendations:priorities,
          interpretationNote:'Bu profil eğitimsel/gelişimsel gözlem aracıdır; standardize norm testi, gelişim yaşı veya klinik tanı değildir.',
        },
      });
    }

    if(action==='configure'){
      if(bundle.session.status==='completed')return json({ok:false,error:'session_completed'},409);
      if(responses.length)return json({ok:false,error:'adaptive_profile_locked_after_evidence'},409);
      const adaptiveProfile=e2NormalizeAdaptiveProfile(input.profile);
      if(!adaptiveProfile)return json({ok:false,error:'invalid_adaptive_profile'},400);

      const firstSection=e2FirstIncompleteSection([]);
      const firstTask=firstSection?e2NextAdaptiveTask(firstSection,ageMonths,adaptiveProfile,[]):null;
      if(!firstTask)return json({ok:false,error:'e2_route_unavailable'},500);

      const nextMetadata={
        ...metadata,
        adaptiveProfile,
        adaptiveSectionsCompleted:[],
        adaptiveConfiguredAt:new Date().toISOString(),
      };
      await sql`
        UPDATE public.assessment_sessions
        SET metadata=${JSON.stringify(nextMetadata)}::jsonb,
            current_task_code=${firstTask.id}
        WHERE id=${sessionId}::uuid
      `;
      return json({
        ok:true,
        profile:adaptiveProfile,
        currentTask:firstTask,
        section:firstSection,
        summary:e2Summary(ageMonths,adaptiveProfile,[],[]),
      });
    }

    if(action==='attempt'){
      if(bundle.session.status==='completed')return json({ok:false,error:'session_completed'},409);
      if(!profile)return json({ok:false,error:'adaptive_profile_required'},409);

      const taskCode=typeof input.taskCode==='string'?input.taskCode.trim():'';
      const task=V7_TASK_MAP.get(taskCode);
      if(!task)return json({ok:false,error:'e2_task_not_found'},404);
      if(bundle.session.current_task_code!==task.id)return json({ok:false,error:'e2_task_out_of_sequence'},409);
      if(task.minAge>ageMonths)return json({ok:false,error:'e2_task_not_age_eligible'},409);
      if(responses.some(response=>response.itemId===task.id))return json({ok:false,error:'e2_task_already_recorded'},409);

      const rating=validE2Rating(input.rating);
      const note=typeof input.note==='string'?input.note.slice(0,1000):'';
      const metrics=numericMetrics(input.metrics);
      const answerText=typeof input.answerText==='string'?input.answerText.slice(0,2000):'';
      const shownAtMs=typeof input.shownAt==='number'?input.shownAt:Date.now();
      const firstActionMs=typeof input.firstActionAt==='number'?input.firstActionAt:null;
      const completedAtMs=typeof input.completedAt==='number'?input.completedAt:Date.now();
      const shownAt=new Date(shownAtMs);
      const firstActionAt=firstActionMs==null?null:new Date(firstActionMs);
      const completedAt=new Date(completedAtMs);
      const responseLatencyMs=firstActionAt?Math.max(0,firstActionAt.getTime()-shownAt.getTime()):null;
      const totalResponseTimeMs=Math.max(0,completedAt.getTime()-shownAt.getTime());

      const payload={
        profileCode:'E2',
        source:'CHILD',
        version:'E2-v7',
        sectionId:task.section,
        kind:task.kind,
        type:task.type,
        difficulty:task.difficulty,
        tier:task.tier,
        theme:task.theme||null,
        rating,
        note,
        metrics,
        diagnosticUse:false,
      };

      await sql`
        INSERT INTO public.assessment_attempts(
          session_id,task_code,shown_at,first_action_at,completed_at,
          answer_text,answer_payload,answer_changes,support_level,self_corrected,
          rubric_scores,response_latency_ms,total_response_time_ms
        ) VALUES(
          ${sessionId}::uuid,${task.id},${shownAt.toISOString()}::timestamptz,
          ${firstActionAt?firstActionAt.toISOString():null}::timestamptz,
          ${completedAt.toISOString()}::timestamptz,${answerText||null},
          ${JSON.stringify(payload)}::jsonb,0,${E2_SUPPORT_TO_NUMBER[rating]},
          ${Boolean(input.selfCorrected)},'{}'::jsonb,${responseLatencyMs},${totalResponseTimeMs}
        )
      `;

      const nextResponses=[...responses,{
        itemId:task.id,
        rating,
        note:note||undefined,
        metrics,
        recordedAt:completedAt.toISOString(),
      }];

      const advanced=e2Advance({
        ageMonths,
        profile,
        responses:nextResponses,
        completedSections,
        currentSection:task.section as V7SectionId,
      });
      const nextMetadata={
        ...metadata,
        adaptiveSectionsCompleted:advanced.completedSections,
      };
      await sql`
        UPDATE public.assessment_sessions
        SET metadata=${JSON.stringify(nextMetadata)}::jsonb,
            current_task_code=${advanced.nextTask?.id||null}
        WHERE id=${sessionId}::uuid
      `;

      return json({
        ok:true,
        nextTask:advanced.nextTask,
        nextSection:advanced.nextSection,
        childRouteComplete:advanced.childPhaseComplete,
        sectionProgress:advanced.sectionProgress,
        summary:e2Summary(ageMonths,profile,nextResponses,advanced.completedSections),
      });
    }

    if(action==='finish_child'){
      if(!profile)return json({ok:false,error:'adaptive_profile_required'},409);
      if(bundle.session.current_task_code)return json({ok:false,error:'e2_child_route_incomplete'},409);
      const allSections=V7_SECTIONS.every(section=>completedSections.includes(section.id));
      if(!allSections)return json({ok:false,error:'e2_sections_incomplete'},409);
      const childCompletedAt=new Date().toISOString();
      const nextMetadata={...metadata,childCompletedAt};
      const caregiverComplete=Boolean(metadata.caregiverCompletedAt);
      await sql`
        UPDATE public.assessment_sessions
        SET metadata=${JSON.stringify(nextMetadata)}::jsonb,
            status=${caregiverComplete?'completed':'active'},
            completed_at=${caregiverComplete?childCompletedAt:null}::timestamptz
        WHERE id=${sessionId}::uuid
      `;
      return json({
        ok:true,
        childCompletedAt,
        caregiverRequired:metadata.caregiverRequired!==false,
        sessionCompleted:caregiverComplete,
        summary:e2Summary(ageMonths,profile,responses,completedSections),
      });
    }

    return json({ok:false,error:'unsupported_action'},400);
  }catch(error){
    return json({ok:false,error:error instanceof Error?error.message:'e2_assessment_unavailable'},500);
  }
}
