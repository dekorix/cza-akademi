import { createHash } from 'node:crypto';
import { allowRequest,rateLimited } from '@/lib/request-guard';
import { authenticatedGuardian,createGuardianSessionFromTrustedProxy,guardianCookie,revokeGuardianSession } from '@/lib/guardian-auth';

function json(body:unknown,status=200,headers?:HeadersInit){
  const h=new Headers(headers);
  h.set('cache-control','no-store');
  h.set('content-type','application/json; charset=utf-8');
  return new Response(JSON.stringify(body),{status,headers:h});
}

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({ok:false,error:'request_origin_rejected'},403);
  const gate=await allowRequest(request,'guardian-auth',30,60_000);
  if(!gate.allowed)return rateLimited(gate);
  let input:Record<string,unknown>;let bodySha256='';
  try{
    const raw=await request.text();
    if(Buffer.byteLength(raw,'utf8')>4096)return json({ok:false,error:'request_too_large'},413);
    bodySha256=createHash('sha256').update(raw).digest('hex');
    input=JSON.parse(raw) as Record<string,unknown>;
  }catch{return json({ok:false,error:'invalid_request'},400);}
  const action=typeof input.action==='string'?input.action:'';
  const secure=new URL(request.url).protocol==='https:';

  if(action==='me'){
    const existing=await authenticatedGuardian(request);
    if(existing)return json({ok:true,user:{id:existing.authUserId,email:existing.email,name:existing.name}});
    try{
      const created=await createGuardianSessionFromTrustedProxy(request,bodySha256);
      return json({ok:true,user:created.user},200,{'set-cookie':guardianCookie(created.token,60*60*8,secure)});
    }catch(error){
      const code=error instanceof Error?error.message:'guardian_session_required';
      return json({ok:false,error:code==='trusted_proxy_required'?'guardian_session_required':code},code==='database_unavailable'?503:401);
    }
  }

  if(action==='logout'){
    try{
      await revokeGuardianSession(request);
      return json({ok:true,revoked:true},200,{'set-cookie':guardianCookie('',0,secure)});
    }catch{return json({ok:false,error:'logout_revocation_failed'},503);}
  }

  return json({ok:false,error:'invalid_action'},400);
}

export async function GET(request:Request){
  const guardian=await authenticatedGuardian(request);
  if(!guardian)return json({ok:false,error:'guardian_session_required'},401);
  return json({ok:true,user:{id:guardian.authUserId,email:guardian.email,name:guardian.name}});
}
