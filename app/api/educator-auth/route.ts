import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  authenticatedEducator,
  authUrl,
  createLocalEducatorSession,
  educatorCookie,
  EDUCATOR_COOKIE,
  EDUCATOR_EMAIL,
  readCookie,
  revokeLocalEducatorSession,
} from '@/lib/educator-auth';

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const h = new Headers(headers);
  h.set('content-type','application/json; charset=utf-8');
  h.set('cache-control','no-store');
  return new Response(JSON.stringify(body),{status,headers:h});
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ok:false,error:'request_origin_rejected'},403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ok:false,error:'invalid_request'},400); }

  const action = typeof body.action === 'string' ? body.action : '';
  const secure = new URL(request.url).protocol === 'https:';

  if (action === 'me') {
    const user = await authenticatedEducator(request);
    if (!user) return json({ok:false,error:'educator_session_required'},401);
    if (!readCookie(request, EDUCATOR_COOKIE) && request.headers.get('oai-authenticated-user-email')) {
      try {
        const local = await createLocalEducatorSession(request);
        return json({ok:true,user:local.user},200,{'set-cookie':educatorCookie(local.cookieValue,60*60*8,secure)});
      } catch {
        return json({ok:true,user});
      }
    }
    return json({ok:true,user});
  }

  if (action === 'logout') {
    await revokeLocalEducatorSession(request).catch(()=>undefined);
    return json({ok:true},200,{'set-cookie':educatorCookie('',0,secure)});
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (action === 'request-reset') {
    if (email !== EDUCATOR_EMAIL) return json({ok:false,error:'invalid_credentials'},401);
    const redirectTo = `${new URL(request.url).origin}/educator/reset-password`;
    try {
      const upstream = await fetch(authUrl('/request-password-reset'), {
        method:'POST',
        headers:{'content-type':'application/json',origin:new URL(request.url).origin},
        body:JSON.stringify({email,redirectTo}),
      });
      if (!upstream.ok) return json({ok:false,error:'reset_unavailable'},502);
      return json({ok:true,delivery:'email'});
    } catch {
      return json({ok:false,error:'reset_unavailable'},502);
    }
  }

  if (action === 'reset') {
    const token = typeof body.token === 'string' ? body.token : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!token || newPassword.length < 8) return json({ok:false,error:'invalid_reset'},400);
    try {
      const upstream = await fetch(authUrl('/reset-password'), {
        method:'POST',
        headers:{'content-type':'application/json',origin:new URL(request.url).origin},
        body:JSON.stringify({token,newPassword}),
      });
      if (upstream.ok) return json({ok:true});
      const failure = await upstream.json().catch(()=>({})) as {code?:string};
      const invalid = ['INVALID_TOKEN','TOKEN_EXPIRED'].includes(failure.code || '');
      return json({ok:false,error:invalid?'invalid_reset':'reset_unavailable'},invalid?400:502);
    } catch {
      return json({ok:false,error:'reset_unavailable'},502);
    }
  }

  const gate = allowRequest(request,'educator-login',6,10*60*1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  if (action !== 'login') return json({ok:false,error:'invalid_action'},400);
  if (email !== EDUCATOR_EMAIL) return json({ok:false,error:'invalid_credentials'},401);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) return json({ok:false,error:'invalid_credentials'},401);

  try {
    const upstream = await fetch(authUrl('/sign-in/email'), {
      method:'POST',
      headers:{'content-type':'application/json',origin:new URL(request.url).origin},
      body:JSON.stringify({email,password,rememberMe:false}),
    });
    if (!upstream.ok) return json({ok:false,error:'invalid_credentials'},401);
    const result = await upstream.json().catch(()=>({})) as { user?: { id?: string; email?: string } };
    const upstreamEmail = (result.user?.email || '').trim().toLowerCase();
    if (upstreamEmail && upstreamEmail !== EDUCATOR_EMAIL) return json({ok:false,error:'invalid_credentials'},401);
    const local = await createLocalEducatorSession(request);
    return json({ok:true,user:local.user},200,{'set-cookie':educatorCookie(local.cookieValue,60*60*8,secure)});
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'database_unavailable' || message === 'educator_mapping_missing') return json({ok:false,error:'session_not_created'},503);
    return json({ok:false,error:'auth_unavailable'},502);
  }
}
