import { Faz3OriginVerificationError, verifyFaz3OriginRequest } from '@/lib/faz3-origin-verifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function handler(request: Request) {
  if (process.env.CZA_FAZ3_ORIGIN_ENABLED !== 'true') return json({ ok: false, error: 'NOT_FOUND' }, 404);
  try {
    const verified = await verifyFaz3OriginRequest(request);
    return json({
      ok: true,
      requestId: verified.requestId,
      target: verified.canonicalTarget,
      principal: {
        academyId: verified.principal.academyId,
        educatorId: verified.principal.educatorId,
        role: verified.principal.role,
      },
    }, 200);
  } catch (error) {
    if (error instanceof Faz3OriginVerificationError) return json({ ok: false, error: error.code }, error.status);
    return json({ ok: false, error: 'ORIGIN_VERIFICATION_UNAVAILABLE' }, 503);
  }
}

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
