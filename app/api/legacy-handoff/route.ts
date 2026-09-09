import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { allowRequest, rateLimited } from '@/lib/request-guard';

const LEGACY_URL = 'https://script.google.com/macros/s/AKfycbwIS-o_6HB8GiA-pLhR-zK4aRZCqo_kz_dpUJFWA94NqMUT2E22tu6tThHPSAT0Ro92/exec';
const COOKIE_NAME = 'cza_student_session';

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  const gate = allowRequest(request, 'legacy-handoff', 10, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'request_origin_rejected' }, 403);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_unavailable' }, 503);
  try {
    const input = await request.json() as { ticket?: unknown };
    const ticket = typeof input.ticket === 'string' ? input.ticket.trim() : '';
    if (!/^[a-f0-9-]{60,80}$/i.test(ticket)) return json({ ok: false, error: 'invalid_ticket' }, 400);
    const upstream = await fetch(LEGACY_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'consumeWorkPanelHandoff', ticket }),
      redirect: 'follow', cache: 'no-store',
    });
    const handoff = await upstream.json() as { ok?: boolean; studentCode?: unknown; error?: unknown };
    if (!upstream.ok || handoff.ok !== true || typeof handoff.studentCode !== 'string') {
      return json({ ok: false, error: handoff.error || 'invalid_ticket' }, 401);
    }
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT s.id AS student_id, s.academy_id, s.user_id AS student_user_id
      FROM public.student_external_identifiers i
      JOIN public.students s ON s.id = i.student_id
      JOIN public.users u ON u.id = s.user_id
      WHERE i.identifier_type IN ('campus_student_code', 'legacy_reference')
        AND upper(i.identifier_value) = upper(${handoff.studentCode})
        AND s.status = 'active' AND u.is_active = true AND u.role = 'student'
      LIMIT 1
    `;
    if (!rows.length) return json({ ok: false, error: 'student_mapping_missing' }, 403);
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const student = rows[0];
    await sql`
      INSERT INTO public.student_sessions
        (academy_id, student_id, student_user_id, token_hash, expires_at, user_agent)
      VALUES
        (${student.academy_id}, ${student.student_id}, ${student.student_user_id}, ${tokenHash}, now() + interval '8 hours', ${request.headers.get('user-agent') || ''})
    `;
    const secure = new URL(request.url).protocol === 'https:';
    const cookie = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`, 'Path=/api/core', 'HttpOnly',
      ...(secure ? ['Secure'] : []), 'SameSite=Lax', 'Max-Age=28800',
    ].join('; ');
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  } catch {
    return json({ ok: false, error: 'handoff_unavailable' }, 502);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get('ticket') || '';
  const exchange = await POST(new Request(request.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': request.headers.get('user-agent') || '',
    },
    body: JSON.stringify({ ticket }),
  }));

  if (!exchange.ok) {
    return Response.redirect(new URL('/work?handoffError=1', url), 303);
  }

  const headers = new Headers({
    location: new URL('/work', url).toString(),
    'cache-control': 'no-store',
  });
  const cookie = exchange.headers.get('set-cookie');
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}
