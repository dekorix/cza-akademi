import { allowRequest,rateLimited } from '@/lib/request-guard';
import { guardianContext } from '@/lib/guardian-context';
import { listGuardianStudents } from '@/lib/guardian-access';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store'}});}

export async function GET(request:Request){
  try{
    const ctx=await guardianContext(request,{studentRequired:false});
    if('error'in ctx)return json({ok:false,error:ctx.error},ctx.status);
    const gate=await allowRequest(request,'guardian-students',40,60_000,ctx.guardian.guardianUserId);
    if(!gate.allowed)return rateLimited(gate);
    const rows=await listGuardianStudents(ctx.sql,ctx.guardian);
    const students=rows.map(row=>({
      id:String(row.id),
      name:typeof row.name==='string'&&row.name.trim()?row.name:'Öğrenci',
      campusCode:typeof row.campus_code==='string'?row.campus_code:'',
    }));
    return json({ok:true,students});
  }catch{return json({ok:false,error:'guardian_students_unavailable'},503);}
}
