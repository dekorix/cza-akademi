import { canonicalEdgeRequest, serializeHmacMessage, sha256Hex } from './canonical-edge.mjs';

const ROUTES = [
  '/phase2',
  '/speed-reading',
  '/attention',
  '/book-preparation',
  '/api/fast-reading/',
  '/api/attention/',
  '/api/book-preparation/',
];
const FORWARDED = ['x-forwarded-for', 'x-real-ip', 'true-client-ip', 'cf-connecting-ip', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto'];
const MAX_BODY_BYTES = 64 * 1024;

const response = (status, code) => new Response(JSON.stringify({ ok: false, error: code }), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function allowedRoute(pathname) {
  return ROUTES.some(route => route.endsWith('/') ? pathname.startsWith(route) : pathname === route || pathname.startsWith(`${route}/`));
}

async function readLimitedBody(request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function webHmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    try {
      const incoming = new URL(request.url);
      if (incoming.protocol !== 'https:' || incoming.host !== env.PUBLIC_AUTHORITY) return response(404, 'NOT_FOUND');
      if (!allowedRoute(incoming.pathname)) return response(404, 'NOT_FOUND');
      if (request.headers.get('x-cza-edge-policy-version') !== 'CZA-EDGE-POLICY-V4') return response(403, 'EDGE_POLICY_REQUIRED');
      if (request.headers.get('x-cza-edge-header-state') !== 'complete') return response(403, 'EDGE_HEADER_STATE_REQUIRED');
      const rawTarget = request.headers.get('x-cza-edge-raw-target');
      if (!rawTarget) return response(400, 'RAW_TARGET_REQUIRED');
      const body = await readLimitedBody(request);
      const contentTypeValues = request.headers.has('content-type') ? [request.headers.get('content-type')] : [];
      const profile = request.method === 'GET' || request.method === 'HEAD' ? 'body-forbidden' : 'json-required';
      const canonical = canonicalEdgeRequest({
        method: request.method,
        publicAuthority: incoming.host,
        expectedPublicAuthority: env.PUBLIC_AUTHORITY,
        rawTarget,
        profile,
        contentTypeValues,
        bodyLength: body.byteLength,
      });
      const transport = new URL(`https://${env.TRANSPORT_AUTHORITY}/api/faz3-origin`);
      if (transport.host === env.PUBLIC_AUTHORITY) return response(500, 'SELF_RECURSION_BLOCKED');
      if (transport.host === env.ORIGIN_SERVICE_AUTHORITY) return response(500, 'INTERNAL_AUTHORITY_BLOCKED');
      if (transport.host !== env.TRANSPORT_AUTHORITY) return response(500, 'CROSS_HOST_REJECTED');

      const accessJwt = request.headers.get('cf-access-jwt-assertion') || '';
      if (!accessJwt) return response(404, 'NOT_FOUND');
      const clientIp = request.headers.get('cf-connecting-ip') || '';
      if (!clientIp) return response(403, 'CLIENT_ADDRESS_REQUIRED');
      const nonce = crypto.randomUUID().replaceAll('-', '');
      const requestId = crypto.randomUUID();
      const fields = {
        v: '2', kid: env.HMAC_KEY_ID, ts: `${Math.floor(Date.now() / 1000)}`, nonce,
        method: canonical.method, 'public-authority': canonical.authority, 'raw-target': rawTarget, target: canonical.target,
        'route-id': 'phase2-staging-v1', 'origin-service-authority': env.ORIGIN_SERVICE_AUTHORITY,
        'content-type': canonical.contentType, 'body-sha256': sha256Hex(body),
        'access-jwt-sha256': sha256Hex(new TextEncoder().encode(accessJwt)), audience: env.ACCESS_AUDIENCE,
        'subject-hash': 'edge-authn-only', 'role-metadata': 'edge-authn-only',
        'client-ip-hash': await webHmacHex(env.IP_HASH_KEY, clientIp), 'request-id': requestId,
      };
      const headers = new Headers(request.headers);
      for (const name of FORWARDED) headers.delete(name);
      for (const name of [...headers.keys()]) if (name.startsWith('x-cza-')) headers.delete(name);
      headers.set('host', env.ORIGIN_SERVICE_AUTHORITY);
      for (const [name, value] of Object.entries(fields)) headers.set(`x-cza-${name}`, value);
      headers.set('x-cza-signature', await webHmacHex(env.HMAC_SECRET, serializeHmacMessage(fields)));
      headers.set('cf-access-jwt-assertion', accessJwt);

      return fetch(transport.toString(), {
        method: canonical.method,
        headers,
        body: body.byteLength ? body : undefined,
        redirect: 'manual',
      });
    } catch (error) {
      const code = error?.code || error?.message || 'EDGE_REJECTED';
      const status = code === 'REQUEST_TOO_LARGE' ? 413 : 400;
      return response(status, code);
    }
  },
};
