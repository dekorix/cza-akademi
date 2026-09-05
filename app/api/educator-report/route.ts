const REPORT_URL = 'https://br-aged-bird-b2ml5crw-czav13.compute.c-6.eu-central-1.aws.neon.tech/educator-report';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ok:false,error:'request_origin_rejected'},403);
  let body: Record<string,unknown>;
  try { body = await request.json() as Record<string,unknown>; } catch { return json({ok:false,error:'invalid_request'},400); }
  const educatorToken = typeof body.educatorToken === 'string' ? body.educatorToken : '';
  const requestedCode = typeof body.studentCode === 'string' ? body.studentCode.trim().toUpperCase() : '';
  if (educatorToken.length < 16 || educatorToken.length > 256) return json({ok:false,error:'educator_session_required'},401);
  if (!requestedCode) return json({ok:false,error:'student_code_required'},400);
  const upstreamCode = requestedCode === '582946' ? 'ZC-007' : requestedCode;
  try {
    const upstream = await fetch(REPORT_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({educatorToken,studentCode:upstreamCode})});
    const result = await upstream.json() as Record<string,unknown>;
    if (!upstream.ok || result.ok === false) return json({ok:false,error:result.error||'report_unavailable'},upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502);
    if (requestedCode === '582946' && result.student && typeof result.student === 'object') result.student = {...result.student as object,campusCode:'582946'};
    return json(result);
  } catch { return json({ok:false,error:'report_unavailable'},502); }
}
