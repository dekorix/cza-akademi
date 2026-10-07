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
