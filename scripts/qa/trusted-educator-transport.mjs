import { createHash, createHmac, randomBytes } from 'node:crypto';

// CI keeps the signing key in its Node process, never in browser JavaScript.
export function trustedEducatorHeaders(method, input, body = '') {
  const url = new URL(input);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port)
    throw new Error('qa_transport_requires_isolated_loopback_origin');
  const secret = process.env.CZA_TRUSTED_PROXY_HMAC_SECRET || '';
  if (Buffer.byteLength(secret) < 32) throw new Error('qa_transport_secret_required');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(24).toString('hex');
  const email = 'habipcann65@gmail.com';
  const payload = ['cza-educator-proxy-v2', timestamp, nonce, method.toUpperCase(),
    url.pathname + url.search, createHash('sha256').update(body).digest('hex'), email].join('\n');
  return { origin: url.origin, 'oai-authenticated-user-email': email,
    'x-cza-proxy-timestamp': timestamp, 'x-cza-proxy-nonce': nonce,
    'x-cza-proxy-signature': createHmac('sha256', secret).update(payload).digest('hex') };
}

export async function installTrustedEducatorTransport(cdp) {
  await cdp.send('Fetch.enable', { patterns: [
    { urlPattern: '*://127.0.0.1:*/api/educator*', requestStage: 'Request' },
  ] });
  cdp.on('Fetch.requestPaused', async ({ requestId, request, networkId }) => {
    try {
      let body = request.postData || '';
      if (request.hasPostData && !request.postData) {
        body = (await cdp.send('Network.getRequestPostData', { requestId: networkId })).postData;
      }
      const signed = trustedEducatorHeaders(request.method, request.url, body);
      const headers = Object.entries({ ...request.headers, ...signed }).map(([name, value]) => ({ name, value: String(value) }));
      await cdp.send('Fetch.continueRequest', { requestId, headers });
    } catch {
      await cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    }
  });
}

// Read-only preflight: expose a missing deployment prerequisite without weakening auth.
export async function verifyTrustedEducatorBackend(sql) {
  const educators = await sql`SELECT role::text AS role, is_active, academy_id IS NOT NULL AS has_academy FROM public.users WHERE auth_user_id = '47c90485-e057-4ebe-a25c-9d7f236c5bd6' LIMIT 2`;
  if (educators.length !== 1) throw new Error('qa_canonical_educator_mapping_missing_or_ambiguous');
  if (!['admin', 'teacher', 'educator'].includes(educators[0].role)) throw new Error('qa_canonical_educator_role_mismatch');
  if (educators[0].is_active !== true || educators[0].has_academy !== true) throw new Error('qa_canonical_educator_inactive_or_unscoped');
  const rows = await sql`SELECT to_regprocedure('public.cza_consume_trusted_proxy_nonce(text,timestamp with time zone)')::text AS nonce_function`;
  if (!rows[0]?.nonce_function) throw new Error('qa_proxy_nonce_function_missing_in_staging');
  const permissions = await sql`SELECT has_function_privilege(current_user,'public.cza_consume_trusted_proxy_nonce(text,timestamp with time zone)','EXECUTE') AS can_execute`;
  if (permissions[0]?.can_execute !== true) throw new Error('qa_proxy_nonce_execution_not_allowed');
}
