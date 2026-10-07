import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { buildSpecialLearningProfile } from '@/lib/special-learning-profile';
import { buildParentFriendlySpecialReport } from '@/lib/special-parent-report';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body:unknown,status=200){
  return Response.json(body,{status,headers:{'cache-control':'no-store'}});
}

export async function POST(request:Request){
  const gate=await allowRequest(request,'educator-special-family-report',30,10*60_000);
  if(!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin){
    return json({ok:false,error:'request_origin_rejected'},403);
  }

  const educator=await authenticatedEducator(request);
  if(!educator?.id) return json({ok:false,error:'educator_session_required'},401);
  if(!process.env.DATABASE_URL) return json({ok:false,error:'database_unavailable'},503);

  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>;}
  catch{return json({ok:false,error:'invalid_request'},400);}

  const studentId=typeof input.studentId==='string'?input.studentId.trim():'';
  const educatorNote=typeof input.educatorNote==='string'?input.educatorNote.trim().slice(0,1000):'';
  if(!UUID.test(studentId)) return json({ok:false,error:'invalid_student_id'},400);

  const sql=neon(process.env.DATABASE_URL);
  const linked=await sql`
    SELECT s.id,s.academy_id,s.first_name,s.last_name
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id=t.id
      AND l.can_view=true
    JOIN public.students s
      ON s.id=l.student_id
      AND s.academy_id=t.academy_id
    WHERE t.auth_user_id=${educator.id}
      AND t.is_active=true
      AND s.status='active'
      AND s.id=${studentId}::uuid
    LIMIT 1
  `;
  if(!linked.length) return json({ok:false,error:'student_not_linked_to_educator'},403);
  const student=linked[0] as {id:string;academy_id:string;first_name:string|null;last_name:string|null};

  const sessions=await sql`
    SELECT id,template_code,completed_at,metadata
    FROM public.assessment_sessions
    WHERE student_id=${studentId}::uuid
      AND status='completed'
      AND template_code LIKE 'CZA_SPECIAL_V1_%'
    ORDER BY completed_at DESC NULLS LAST,started_at DESC
    LIMIT 1
  `;
  if(!sessions.length) return json({ok:false,error:'special_assessment_not_found'},404);
  const session=sessions[0] as {id:string;template_code:string;completed_at:string|null;metadata:unknown};

  const [attempts,observations]=await Promise.all([
    sql`
      SELECT task_code,answer_payload,support_level
      FROM public.assessment_attempts
      WHERE session_id=${session.id}::uuid
      ORDER BY created_at ASC
    `,
    sql`
      SELECT task_code,observation_codes
      FROM public.assessment_observations
      WHERE session_id=${session.id}::uuid
      ORDER BY created_at ASC
    `,
  ]);

  const profile=buildSpecialLearningProfile({session,attempts,observations});
  if(!profile) return json({ok:false,error:'special_profile_unavailable'},409);

  let program:null|{
    id:string;
    status:string;
    completedSessions:number;
    totalSessions:number;
    progress:number;
    currentWeek:number;
  }=null;
  let reassessment:null|{
    overallOutcome?:string;
    areas?:{key:string;label:string;outcome:string;nextStep:string}[];
  }=null;

  try{
    const programs=await sql`
      SELECT p.id,p.status,p.duration_weeks,p.sessions_per_week,
             (
               SELECT count(*)::int
               FROM public.special_education_program_sessions x
               WHERE x.program_id=p.id AND x.status='completed'
             ) AS completed_sessions
      FROM public.special_education_programs p
      WHERE p.student_id=${studentId}::uuid
        AND p.academy_id=${student.academy_id}::uuid
        AND p.profile_code=${profile.profileCode}
        AND p.status IN ('active','completed')
      ORDER BY CASE WHEN p.status='active' THEN 0 ELSE 1 END,p.created_at DESC
      LIMIT 1
    `;
    if(programs.length){
      const row=programs[0] as Record<string,unknown>;
      const total=Number(row.duration_weeks||4)*Number(row.sessions_per_week||1);
      const completed=Number(row.completed_sessions||0);
      program={
        id:String(row.id),
        status:String(row.status||'active'),
        completedSessions:completed,
        totalSessions:total,
        progress:total?Math.min(100,Math.round((completed/total)*100)):0,
        currentWeek:String(row.status)==='completed'
          ? Number(row.duration_weeks||4)
          : Math.min(Number(row.duration_weeks||4),Math.max(1,Math.floor(completed/Number(row.sessions_per_week||1))+1)),
      };

      const reassessments=await sql`
        SELECT comparison
        FROM public.special_education_reassessments
        WHERE program_id=${program.id}::uuid
          AND student_id=${studentId}::uuid
          AND academy_id=${student.academy_id}::uuid
          AND status='completed'
        LIMIT 1
      `;
      if(reassessments.length){
        const value=reassessments[0].comparison;
        if(value&&typeof value==='object'&&!Array.isArray(value)){
          const comparison=value as Record<string,unknown>;
          reassessment={
            overallOutcome:typeof comparison.overallOutcome==='string'?comparison.overallOutcome:undefined,
            areas:Array.isArray(comparison.areas)
              ? comparison.areas.map(item=>{
                  const area=item&&typeof item==='object'&&!Array.isArray(item)?item as Record<string,unknown>:{};
                  return {
                    key:String(area.key||''),
                    label:String(area.label||''),
                    outcome:String(area.outcome||'INSUFFICIENT'),
                    nextStep:String(area.nextStep||''),
                  };
                }).filter(area=>area.key&&area.label).slice(0,8)
              : [],
          };
        }
      }
    }
  }catch{
    program=null;
    reassessment=null;
  }

  const displayName=[student.first_name,student.last_name].filter(Boolean).join(' ').trim()||'Öğrenci';
  const report=buildParentFriendlySpecialReport({
    studentDisplayName:displayName,
    profile,
    program,
    reassessment,
    educatorNote,
  });

  return json({
    ok:true,
    report,
    generatedAt:new Date().toISOString(),
    privacy:{
      rawAssessmentEvidenceIncluded:false,
      technicalScoresIncluded:false,
      educatorInternalNotesIncluded:false,
      externalPublicLink:false,
    },
  });
}
