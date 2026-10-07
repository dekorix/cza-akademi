import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const MAX_REQUEST_BYTES = 64 * 1024;
const SIGNATURE_VERSION = 'cza-educator-proxy-v2';
const PROTECTED_HEADERS = Object.freeze([
  'oai-authenticated-user-email',
  'x-cza-proxy-timestamp',
  'x-cza-proxy-nonce',
  'x-cza-proxy-signature',
]);

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing-environment:${name}`);
  return value;
}

const origin = new URL(requiredEnvironment('CZA_PROXY_E2E_ORIGIN_URL'));
const secret = requiredEnvironment('CZA_PROXY_E2E_HMAC_SECRET');
const accessToken = requiredEnvironment('CZA_PROXY_E2E_ACCESS_TOKEN');
const educatorEmail = requiredEnvironment('CZA_PROXY_E2E_OWNER_EMAIL')
  .toLowerCase();
const logFile = requiredEnvironment('CZA_PROXY_E2E_PROXY_LOG');
if (
  origin.protocol !== 'http:' ||
  origin.hostname !== '127.0.0.1' ||
  origin.port !== '8787' ||
  Buffer.byteLength(secret, 'utf8') < 32
) {
  throw new Error('trusted-proxy-configuration-invalid');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function appendEvent(event) {
  fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`, { mode: 0o600 });
}

function accessAllowed(request) {
  const supplied = String(request.headers.authorization || '');
  const expected = `Bearer ${accessToken}`;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

async function readBody(request) {
  const declaredLength = Number(request.headers['content-length'] || '0');
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BYTES
  ) {
    throw new Error('request-too-large');
  }
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of request) {
    byteLength += chunk.byteLength;
    if (byteLength > MAX_REQUEST_BYTES) throw new Error('request-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function signaturePayload({ timestamp, nonce, method, path, bodyHash }) {
  return [
    SIGNATURE_VERSION,
    timestamp,
    nonce,
    method,
    path,
    bodyHash,
    educatorEmail,
  ].join('\n');
}

const server = http.createServer(async (request, response) => {
  const method = (request.method || 'GET').toUpperCase();
  const path = request.url || '/';
  const pathname = new URL(path, 'http://proxy.invalid').pathname;
  const incomingIdentity = String(
    request.headers['oai-authenticated-user-email'] || '',
  );
  const protectedHeadersPresent = PROTECTED_HEADERS.filter(
    (name) => request.headers[name] !== undefined,
  );

  if (path === '/__health') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!accessAllowed(request)) {
    appendEvent({
      event: 'request_rejected',
      reason: 'preview_access_required',
      method,
      pathSha256: sha256(path),
    });
    response.writeHead(401, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    });
    response.end(
      JSON.stringify({ ok: false, error: 'preview_access_required' }),
    );
    return;
  }

  if (pathname !== '/api/educator-auth') {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: 'not_found' }));
    return;
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    appendEvent({
      event: 'request_rejected',
      reason: 'request_too_large',
      method,
      pathSha256: sha256(path),
    });
    response.writeHead(413, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    });
    response.end(JSON.stringify({ ok: false, error: 'request_too_large' }));
    return;
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(32).toString('hex');
  const bodyHash = sha256(body);
  const signature = createHmac('sha256', secret)
    .update(signaturePayload({ timestamp, nonce, method, path, bodyHash }))
    .digest('hex');
  const headers = new Headers();
  for (const name of [
    'accept',
    'accept-language',
    'content-type',
    'cookie',
    'user-agent',
  ]) {
    const value = request.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  headers.set('origin', origin.origin);
  headers.set('oai-authenticated-user-email', educatorEmail);
  headers.set('x-cza-proxy-timestamp', timestamp);
  headers.set('x-cza-proxy-nonce', nonce);
  headers.set('x-cza-proxy-signature', signature);

  try {
    const upstream = await fetch(new URL(path, origin), {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      redirect: 'manual',
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    const responseHeaders = {
      'cache-control': upstream.headers.get('cache-control') || 'no-store',
      'content-type':
        upstream.headers.get('content-type') || 'application/octet-stream',
      'x-cza-proxy-e2e': 'signed-boundary',
    };
    const setCookies = upstream.headers.getSetCookie();
    if (setCookies.length > 0) responseHeaders['set-cookie'] = setCookies;
    response.writeHead(upstream.status, responseHeaders);
    response.end(responseBody);
    appendEvent({
      event: 'request_forwarded',
      method,
      pathSha256: sha256(path),
      bodySha256: bodyHash,
      nonceSha256: sha256(nonce),
      incomingIdentitySha256: sha256(incomingIdentity.toLowerCase()),
      forwardedIdentitySha256: sha256(educatorEmail),
      protectedHeadersPresent,
      protectedHeadersOverwritten: protectedHeadersPresent.length > 0,
      signatureVersion: SIGNATURE_VERSION,
      upstreamStatus: upstream.status,
    });
  } catch {
    appendEvent({
      event: 'upstream_failed',
      method,
      pathSha256: sha256(path),
    });
    response.writeHead(502, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    });
    response.end(JSON.stringify({ ok: false, error: 'origin_unavailable' }));
  }
});

server.listen(8790, '127.0.0.1', () => {
  process.stdout.write(
    `${JSON.stringify({
      ready: true,
      binding: '127.0.0.1:8790',
      originBinding: '127.0.0.1:8787',
      signatureVersion: SIGNATURE_VERSION,
    })}\n`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
