import { Readable } from 'node:stream';

import { createStudentHandler } from '../lib/handler.js';

export const POST = createStudentHandler();

function requestHeaders(headers = {}) {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, String(value));
    }
  }
  return result;
}

function requestUrl(request, headers) {
  const forwarded = headers.get('x-forwarded-proto')?.split(',', 1)[0].trim();
  const protocol = forwarded === 'http' ? 'http' : 'https';
  const host = headers.get('host') || 'cza-learning-core-staging.invalid';
  return new URL(request.url || '/', `${protocol}://${host}`);
}

function writeResponseHeaders(response, nodeResponse) {
  for (const [name, value] of response.headers) {
    nodeResponse.setHeader(name, value);
  }
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) nodeResponse.setHeader('set-cookie', cookies);
}

function requestBody(nodeRequest) {
  if (nodeRequest.body === undefined) return Readable.toWeb(nodeRequest);
  if (typeof nodeRequest.body === 'string') return nodeRequest.body;
  if (Buffer.isBuffer(nodeRequest.body) || nodeRequest.body instanceof Uint8Array) {
    return nodeRequest.body;
  }
  if (nodeRequest.body !== null && typeof nodeRequest.body === 'object') {
    return JSON.stringify(nodeRequest.body);
  }
  return '';
}

export function createVercelNodeHandler(webHandler = POST) {
  return async function vercelNodeHandler(nodeRequest, nodeResponse) {
    const headers = requestHeaders(nodeRequest.headers);
    const method = nodeRequest.method || 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const request = new Request(requestUrl(nodeRequest, headers), {
      method,
      headers,
      body: hasBody ? requestBody(nodeRequest) : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
    });
    const response = await webHandler(request);

    nodeResponse.statusCode = response.status;
    writeResponseHeaders(response, nodeResponse);
    nodeResponse.end(Buffer.from(await response.arrayBuffer()));
  };
}

export default createVercelNodeHandler();
