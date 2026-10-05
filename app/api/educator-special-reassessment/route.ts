import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { buildSpecialLearningProfile } from '@/lib/special-learning-profile';
import { buildSpecialReassessmentPlan, compareSpecialReassessment } from '@/lib/special-reassessment';
import type { SpecialEducationProgramDraft } from '@/lib/special-education-program';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERDICTS=new Set(['MATCH','PARTIAL','DIFFERENT','NO_RESPONSE']);
const SUPPORTS=new Set(['INDEPENDENT','VERBAL_PROMPT','VISUAL_PROMPT','MODELED','PHYSICAL_ASSIST']);

function json(body:unknown,status=200){
  return Response.json(body,{status,headers:{'cache-control':'no-store'}});
}
function sanitizeFlags(value:unknown){
  if(!Array.isArray(value)) return [] as string[];
  return value.map(String).map(v=>v.trim().slice(0,80)).filter(Boolean).slice(0,10);
}
function normalizeAreas(value:unknown){
  if(!Array.isArray(value)) return [] as {
    key:string;label:string;probes:{verdict:'MATCH'|'PARTIAL'|'DIFFERENT'|'NO_RESPONSE';support:'INDEPENDENT'|'VERBAL_PROMPT'|'VISUAL_PROMPT'|'MODELED'|'PHYSICAL_ASSIST';flags:string[]}[]
  };
  return value.slice(0,8).map(area=>{
    const row=area&&typeof area==='object'&&!Array.isArray(area)?area as Record<string,unknown>:{};
    const probes=Array.isArray(row.probes)?row.probes.slice(0,3).map(item=>{
      const probe=item&&typeof item==='object'&&!Array.isArray(item)?item as Record<string,unknown>:{};
      const verdict=typeof probe.verdict==='string'&&VERDICTS.has(probe.verdict)?probe.verdict:'NO_RESPONSE';
      const support=typeof probe.support==='string'&&SUPPORTS.has(probe.support)?probe.support:'PHYSICAL_ASSIST';
      return {verdict,support,flags:sanitizeFlags(probe.flags)};
    }):[];
    return {
      key:typeof row.key==='string'?row.key.trim().slice(0,80):'',
      label:typeof row.label==='string'?row.label.trim().slice(0,160):'',
      probes,
    };
  }).filter(area=>area.key);
}

export async function POST(request:Request){
  const gate=allowRequest(request,'educator-special-reassessment',30,10*60_000);
  if(!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin) return json({ok:false,error:'request_origin_rejected'},403);

  const educator=await authenticatedEducator(request);
  if(!educator?.id) return json({ok:false,error:'educator_session_required'},401);
  if(!process.env.DATABASE_URL) return json({ok:false,error:'database_unavailable'},503);

  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>;}
  catch{return json({ok:false,error:'invalid_request'},400);}

  const action=typeof input.action==='string'?input.action:'';
  const studentId=typeof input.studentId==='string'?input.studentId.trim():'';
  const programId=typeof input.programId==='string'?input.programId.trim():'';
  if(!UUID.test(studentId)) return json({ok:false,error:'invalid_student_id'},400);
  if(!UUID.test(programId)) return json({ok:false,error:'invalid_program_id'},400);

  const sql=neon(process.env.DATABASE_URL);
  const authorized=await sql`
    SELECT s.id AS student_id,s.academy_id,t.id AS educator_user_id,
           concat_ws(' ',s.first_name,s.last_name) AS student_name
    FROM public.users t
    JOIN public.teacher_student_links l ON l.teacher_id=t.id AND l.can_view=true
    JOIN public.students s ON s.id=l.student_id AND s.academy_id=t.academy_id
    WHERE t.auth_user_id=${educator.id}
      AND t.is_active=true
      AND s.status='active'
      AND s.id=${studentId}::uuid
    LIMIT 1
  `;
  if(!authorized.length) return json({ok:false,error:'student_not_linked_to_educator'},403);
  const link=authorized[0] as {student_id:string;academy_id:string;educator_user_id:string;student_name:string|null};

  const programs=await sql`
    SELECT id,assessment_session_id,profile_code,status,plan,completed_at
    FROM public.special_education_programs
    WHERE id=${programId}::uuid
      AND student_id=${studentId}::uuid
      AND academy_id=${link.academy_id}::uuid
    LIMIT 1
  `;
  if(!programs.length) return json({ok:false,error:'special_program_not_found'},404);
  const program=programs[0] as {
    id:string;assessment_session_id:string;profile_code:string;status:string;plan:SpecialEducationProgramDraft;completed_at:string|null;
  };
  if(program.status!=='completed') return json({ok:false,error:'special_program_not_completed'},409);

  const sessions=await sql`
    SELECT id,template_code,completed_at,metadata
    FROM public.assessment_sessions
    WHERE id=${program.assessment_session_id}::uuid
      AND student_id=${studentId}::uuid
      AND status='completed'
      AND template_code LIKE 'CZA_SPECIAL_V1_%'
    LIMIT 1
  `;
  if(!sessions.length) return json({ok:false,error:'baseline_special_assessment_not_found'},404);

  const [attempts,observations]=await Promise.all([
    sql`
      SELECT task_code,answer_payload,support_level
      FROM public.assessment_attempts
      WHERE session_id=${program.assessment_session_id}::uuid
      ORDER BY created_at ASC
    `,
    sql`
      SELECT task_code,observation_codes
      FROM public.assessment_observations
      WHERE session_id=${program.assessment_session_id}::uuid
      ORDER BY created_at ASC
    `,
  ]);

  const profile=buildSpecialLearningProfile({
    session:sessions[0] as {id:string;template_code:string;completed_at:string|null;metadata:unknown},
    attempts,
    observations,
  });
  if(!profile) return json({ok:false,error:'baseline_profile_unavailable'},409);

  const plan=buildSpecialReassessmentPlan(profile,{id:program.id,plan:program.plan});

  let existing=null;
  try{
    const rows=await sql`
      SELECT id,status,comparison,completed_at
      FROM public.special_education_reassessments
      WHERE program_id=${programId}::uuid
      LIMIT 1
    `;
    existing=rows[0]||null;
  }catch{
    return json({ok:false,error:'special_reassessment_schema_unavailable'},503);
  }

  if(action==='preview'){
    return json({
      ok:true,
      student:{id:studentId,name:link.student_name||'Öğrenci'},
      program:{id:program.id,profileCode:program.profile_code,completedAt:program.completed_at},
      profile,
      plan,
      existing,
    });
  }

  if(action==='complete'){
    if(existing) return json({ok:false,error:'special_reassessment_already_completed'},409);
    const areas=normalizeAreas(input.areas);
    const expectedKeys=plan.areas.map(area=>area.key);
    if(expectedKeys.some(key=>!areas.some(area=>area.key===key&&area.probes.length===3))){
      return json({ok:false,error:'reassessment_evidence_incomplete'},409);
    }
    const comparison=compareSpecialReassessment(profile,{id:program.id,plan:program.plan},areas);
    const rows=await sql`
      INSERT INTO public.special_education_reassessments(
        program_id,academy_id,student_id,baseline_session_id,profile_code,status,
        plan,evidence,comparison,completed_by,completed_at
      ) VALUES(
        ${programId}::uuid,${link.academy_id}::uuid,${studentId}::uuid,
        ${program.assessment_session_id}::uuid,${program.profile_code},'completed',
        ${JSON.stringify(plan)}::jsonb,${JSON.stringify(areas)}::jsonb,
        ${JSON.stringify(comparison)}::jsonb,${link.educator_user_id}::uuid,now()
      )
      RETURNING id,comparison,completed_at
    `;
    return json({ok:true,reassessment:rows[0],comparison},201);
  }

  return json({ok:false,error:'invalid_action'},400);
}
