import { allowRequest, rateLimited } from '@/lib/request-guard';
import { authenticatedEducator, authUrl, educatorCookie } from '@/lib/educator-auth';

function json(body:unknown,status=200,headers?:HeadersInit){const h=new Headers(headers);h.set('content-type','application/json; charset=utf-8');h.set('cache-control','no-store');return new Response(JSON.stringify(body),{status,headers:h});}

export async function POST(request:Request){
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({ok:false,error:'request_origin_rejected'},403);
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return json({ok:false,error:'invalid_request'},400);}
  const action=typeof body.action==='string'?body.action:'';const secure=new URL(request.url).protocol==='https:';
  if(action==='me'){const user=await authenticatedEducator(request);return user?json({ok:true,user}):json({ok:false,error:'educator_session_required'},401);}
  if(action==='logout'){return json({ok:true},200,{'set-cookie':educatorCookie('',0,secure)});}
  const gate=allowRequest(request,'educator-login',6,10*60*1000);if(!gate.allowed)return rateLimited(gate.retryAfterSeconds);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(email!=='celikzihin.akademisi@gmail.com')return json({ok:false,error:'invalid_credentials'},401);
  if(action==='request-reset'){
    const redirectTo=`${new URL(request.url).origin}/educator/reset-password`;
    const upstream=await fetch(authUrl('/request-password-reset'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,redirectTo})});
    return upstream.ok?json({ok:true}):json({ok:false,error:'reset_unavailable'},502);
  }
  if(action==='reset'){
    const token=typeof body.token==='string'?body.token:'';const newPassword=typeof body.newPassword==='string'?body.newPassword:'';
    if(!token||newPassword.length<8)return json({ok:false,error:'invalid_reset'},400);
    const upstream=await fetch(authUrl('/reset-password'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,newPassword})});
    return upstream.ok?json({ok:true}):json({ok:false,error:'invalid_reset'},400);
  }
  if(action!=='login')return json({ok:false,error:'invalid_action'},400);
  const password=typeof body.password==='string'?body.password:'';if(password.length<8)return json({ok:false,error:'invalid_credentials'},401);
  const upstream=await fetch(authUrl('/sign-in/email'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,rememberMe:false})});
  const result=await upstream.json().catch(()=>({})) as Record<string,unknown>;if(!upstream.ok)return json({ok:false,error:'invalid_credentials'},401);
  const setCookie=upstream.headers.get('set-cookie')||'';const pair=setCookie.split(';',1)[0];if(!pair.includes('='))return json({ok:false,error:'session_not_created'},502);
  return json({ok:true,user:result.user},200,{'set-cookie':educatorCookie(pair,60*60*8,secure)});
}
