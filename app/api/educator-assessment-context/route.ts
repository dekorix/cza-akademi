import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  assessmentBridgeCatalog,
  isAssessmentPurpose,
  resolveAssessmentBridge,
} from '@/lib/assessment-bridge';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body:unknown,status=200){
  return Response.json(body,{status,headers:{'cache-control':'no-store'}});
}

export async function POST(request:Request){
  const gate=allowRequest(request,'educator-assessment-context',60,10*60_000);
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
  const profileCode=typeof input.profileCode==='string'?input.profileCode.trim():'';
  const purpose=typeof input.purpose==='string'?input.purpose.trim():'GENERAL';

  if(!UUID.test(studentId)) return json({ok:false,error:'invalid_student_id'},400);
  if(!isAssessmentPurpose(purpose)) return json({ok:false,error:'invalid_assessment_purpose'},400);

  const target=resolveAssessmentBridge(profileCode,purpose);
  if(!target) return json({ok:false,error:'invalid_profile_code'},400);

  const sql=neon(process.env.DATABASE_URL);
  const rows=await sql`
    SELECT
      s.id,
      s.academy_id,
      concat_ws(' ',s.first_name,s.last_name) AS name,
      s.birth_date,
      i.identifier_value AS code,
      u.username
    FROM public.students s
    LEFT JOIN public.users u ON u.id=s.user_id
    LEFT JOIN public.student_external_identifiers i
      ON i.student_id=s.id
      AND i.identifier_type='campus_student_code'
    WHERE s.id=${studentId}::uuid
      AND s.status='active'
      AND EXISTS(
        SELECT 1
        FROM public.teacher_student_links l
        JOIN public.users t ON t.id=l.teacher_id
        WHERE l.student_id=s.id
          AND l.academy_id=s.academy_id
          AND l.can_view=true
          AND t.auth_user_id=${educator.id}
          AND t.is_active=true
      )
    LIMIT 1
  `;

  if(!rows.length) return json({ok:false,error:'student_not_linked_to_educator'},403);

  const student=rows[0] as {
    id:string;
    academy_id:string;
    name:string|null;
    birth_date:string|null;
    code:string|null;
    username:string|null;
  };

  const displayName=(student.name||student.username||'Öğrenci').trim();
  const centralReady=target.status==='CENTRAL_READY'&&Boolean(target.centralRoute);

  return json({
    ok:true,
    bridgeVersion:1,
    educator:{id:educator.id,email:educator.email||null,name:educator.name||null},
    student:{
      id:student.id,
      academyId:student.academy_id,
      name:displayName,
      birthDate:student.birth_date||null,
      code:student.code||null,
      username:student.username||null,
    },
    selection:{profileCode,purpose},
    target,
    canStartCentralAssessment:centralReady,
    catalog:input.includeCatalog===true?assessmentBridgeCatalog():undefined,
  });
}
