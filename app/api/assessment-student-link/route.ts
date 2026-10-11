import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { isolatedQaEnabled, isolatedQaDatabaseAllowed } from '@/lib/isolated-qa-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:Request){
  // V02 pilot is available only in the approved isolated QA environment.
  if(!isolatedQaEnabled())return json({ok:false,error:'v02_qa_only'},503);
  try{
    if(!(await isolatedQaDatabaseAllowed()))return json({ok:false,error:'qa_database_target_rejected'},503);
    if(request.headers.get('origin')!==new URL(request.url).origin)return json({ok:false,error:'request_origin_rejected'},403);
    const gate=await allowRequest(request,'assessment-student-link',60,60_000);
    if(!gate.allowed)return rateLimited(gate.retryAfterSeconds);
    const educator=await authenticatedEducator(request);
    if(!educator)return json({ok:false,error:'educator_session_required'},401);
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>8192)return json({ok:false,error:'request_too_large'},413);
    let input:Record<string,unknown>;
    try{input=JSON.parse(raw);if(!input||Array.isArray(input)||typeof input!=='object')throw Error();}
    catch{return json({ok:false,error:'invalid_request'},400);}
    const sessionId=String(input.sessionId||'');
    if(!UUID.test(sessionId))return json({ok:false,error:'session_id_invalid'},400);
    const sql=neon(process.env.DATABASE_URL!);
    // Opening a picker also requires ownership of the exact candidate session.
    const source=await sql.query(`SELECT a.id FROM public.assessment_sessions a
      JOIN public.users u ON u.auth_user_id=$1 AND u.is_active=true AND u.role::text='educator'
      WHERE a.id=$2::uuid AND a.metadata->>'academyId'=u.academy_id::text
        AND a.metadata->>'createdByEducatorId'=$1
        AND a.metadata->>'source'='EDUCATOR_PRE_ENROLLMENT'
        AND a.template_code LIKE 'CZA_SPECIAL_V1_%' AND a.status IN ('active','completed')`,[educator.id,sessionId]);
    if(!source.length)return json({ok:false,error:'candidate_not_authorized'},403);
    if(input.action==='students')return json({ok:true,students:await sql.query('SELECT * FROM public.cza_v02_eligible_students($1,$2::boolean)',[educator.id,true])});
    if(input.action==='history'){
      const studentId=String(input.studentId||'');
      if(!UUID.test(studentId))return json({ok:false,error:'student_id_invalid'},400);
      const eligible=await sql.query('SELECT * FROM public.cza_v02_eligible_students($1,$2::boolean)',[educator.id,true]);
      if(!eligible.some(s=>s.id===studentId))return json({ok:false,error:'student_not_authorized'},403);
      const sessions=await sql.query('SELECT * FROM public.cza_v02_student_history($1,$2::uuid)',[educator.id,studentId]);
      return json({ok:true,student:eligible.find(s=>s.id===studentId),sessions});
    }
    if(input.action!=='bind')return json({ok:false,error:'invalid_action'},400);
    const studentId=String(input.studentId||'');
    if(!UUID.test(studentId))return json({ok:false,error:'student_id_invalid'},400);
    if(input.confirmStudentId!==studentId)return json({ok:false,error:'explicit_confirmation_required'},400);
    const rows=await sql.query('SELECT * FROM public.cza_v02_bind_assessment($1,$2::uuid,$3::uuid,$4::boolean)',[educator.id,sessionId,studentId,true]);
    if(!rows.length)return json({ok:false,error:'link_not_authorized'},403);
    const result=rows[0];
    if(result.outcome==='conflict')return json({ok:false,error:'assessment_already_linked'},409);
    // A concurrent idempotent request can acquire the updated session after its
    // statement snapshot; read the committed audit in a fresh statement.
    const audit=await sql.query(`SELECT session_id,student_id,educator_id,academy_id,candidate_id,cycle_id,linked_at
      FROM public.assessment_student_link_audit WHERE session_id=$1::uuid`,[sessionId]);
    if(!audit.length)return json({ok:false,error:'link_audit_unavailable'},503);
    return json({ok:true,resumed:result.outcome==='already_linked',link:audit[0]});
  }catch{return json({ok:false,error:'student_link_unavailable'},503);}
}
