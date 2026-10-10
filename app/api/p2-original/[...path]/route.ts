import { neon } from '@neondatabase/serverless';
import { authenticatedStudent } from '@/lib/student-session';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import { handler } from '@/apps/p2-runtime/backend/index';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(error:string,status:number){return Response.json({error},{status,headers:{'cache-control':'no-store'}});}
async function handle(request:Request){
 const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method)){
  const origin=request.headers.get('origin');
  if(origin!==url.origin)return fail('request_origin_rejected',403);

 }
 if(!process.env.DATABASE_URL)return fail('database_unavailable',503);
 const sql=neon(process.env.DATABASE_URL);
 let stage='target';
 try{
  // This candidate is intentionally unable to write to any real/staging project.
  const [target]=await sql`SELECT current_setting('neon.project_id',true) project`;
  if(target.project!=='patient-firefly-51111834')return fail('wrong_synthetic_target',503);
  if(!['GET','HEAD'].includes(request.method)){const gate=await allowRequest(request,'p2-original-write',60,60_000);if(!gate.allowed)return rateLimited(gate);}
  stage='student_auth';const student=await authenticatedStudent(request);
  let actor:{role:'student'|'educator';id:string;studentId:string;academyId:string;label:string;studentSessionId?:string};
  if(student){
   const [s]=await sql`SELECT concat_ws(' ',first_name,last_name) label FROM students WHERE id=${student.student_id}::uuid AND academy_id=${student.academy_id}::uuid AND status::text='active'`;
   if(!s)return fail('student_session_required',401);
   actor={role:'student',id:student.student_user_id,studentId:student.student_id,academyId:student.academy_id,label:s.label,studentSessionId:student.student_session_id};
  }else{
   const educator=await authenticatedEducator(request);if(!educator)return fail('educator_session_required',401);
   let studentId=url.searchParams.get('studentId')||'';
   const session=url.pathname.match(/\/session\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
   if(session){const [a]=await sql`SELECT student_id FROM assessment_sessions WHERE id=${session}::uuid`;studentId=a?.student_id||'';}
   if(!UUID.test(studentId))return fail('student_required',400);
   const [linked]=await sql`SELECT u.id educator_id,u.academy_id,concat_ws(' ',s.first_name,s.last_name) label FROM users u JOIN teacher_student_links l ON l.teacher_id=u.id AND l.academy_id=u.academy_id AND l.can_view JOIN students s ON s.id=l.student_id AND s.academy_id=u.academy_id WHERE u.auth_user_id::text=${educator.id}::text AND u.is_active AND u.role::text IN ('teacher','educator','admin') AND s.id=${studentId}::uuid AND s.status::text='active'`;
   if(!linked)return fail('student_not_linked_to_educator',403);
   actor={role:'educator',id:linked.educator_id,studentId,academyId:linked.academy_id,label:linked.label};
  }
  const backendUrl=new URL(url);backendUrl.pathname=url.pathname.replace(/^\/api\/p2-original\//,'/api/');
  if(backendUrl.pathname==='/api/media'){
   const path=url.searchParams.get('path')||'',id=path.split('/')[1];if(!UUID.test(id||''))return fail('not_found',404);
   const [m]=await sql`SELECT metadata->'originalMedia'->${path} media FROM assessment_sessions WHERE id=${id}::uuid AND student_id=${actor.studentId}::uuid`;
   if(!m?.media)return fail('not_found',404);
   return new Response(Buffer.from(m.media.content.replace(/^data:[^,]+,/,''),'base64'),{headers:{'content-type':m.media.contentType,'cache-control':'private,no-store'}});
  }
  const forwarded=new Request(backendUrl,request);
  stage='original_handler';const result=await handler(forwarded,{DATABASE_URL:process.env.DATABASE_URL},actor);
  return new Response(result.body.replaceAll('/api/media?','/api/p2-original/media?'),{status:result.statusCode,headers:result.headers});
 }catch(cause){const e=cause as {name?:string;code?:string};console.error('p2_original_error',stage, e.name||'Error', /^[A-Za-z0-9_]{1,40}$/.test(e.code||'')?e.code:'unknown');return fail('p2_original_unavailable',503);}
}
export const GET=handle;
export const POST=handle;
