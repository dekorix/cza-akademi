import { createHash } from 'node:crypto';

export const EDUCATOR_MAX_REQUEST_BYTES = 64 * 1024;

export type EducatorAuthRequest =
  | { action: 'me' }
  | { action: 'logout' }
  | { action: 'request-reset'; email: string }
  | { action: 'reset'; token: string; newPassword: string }
  | { action: 'login'; email: string; password: string };

export class EducatorRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'EducatorRequestError';
  }
}

function fail(code: string, status = 400): never {
  throw new EducatorRequestError(code, status);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(
  value: Record<string, unknown>,
  required: readonly string[],
) {
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('invalid_request_schema');
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('invalid_request_schema');
  }
}

function text(value: unknown, maximum: number, trim = true) {
  if (typeof value !== 'string' || value.length > maximum) {
    fail('invalid_request_schema');
  }
  const normalized = trim ? value.trim() : value;
  if (
    normalized.includes(String.fromCharCode(0)) ||
    normalized.includes('\r') ||
    normalized.includes('\n')
  ) {
    fail('invalid_request_schema');
  }
  return normalized;
}

export function parseEducatorAuthRequest(value: unknown): EducatorAuthRequest {
  if (!isPlainObject(value)) fail('invalid_request');
  const action = typeof value.action === 'string' ? value.action : '';

  if (action === 'me' || action === 'logout') {
    exactFields(value, ['action']);
    return { action };
  }
  if (action === 'request-reset') {
    exactFields(value, ['action', 'email']);
    return {
      action,
      email: text(value.email, 254).toLowerCase(),
    };
  }
  if (action === 'reset') {
    exactFields(value, ['action', 'token', 'newPassword']);
    return {
      action,
      token: text(value.token, 2048),
      newPassword: text(value.newPassword, 128, false),
    };
  }
  if (action === 'login') {
    exactFields(value, ['action', 'email', 'password']);
    return {
      action,
      email: text(value.email, 254).toLowerCase(),
      password: text(value.password, 128, false),
    };
  }
  fail('invalid_action');
}

async function readBoundedBytes(
  request: Pick<Request, 'headers' | 'body'>,
  maximumBytes: number,
) {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) fail('invalid_content_length');
    const declaredBytes = Number(declared);
    if (!Number.isSafeInteger(declaredBytes)) fail('invalid_content_length');
    if (declaredBytes > maximumBytes) fail('request_too_large', 413);
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel('request_too_large');
        fail('request_too_large', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (
      error instanceof EducatorRequestError ||
      (error instanceof Error && error.name === 'EducatorRequestError')
    ) {
      throw error;
    }
    fail('invalid_request');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function requestBodySha256(
  request: Request,
  maximumBytes = EDUCATOR_MAX_REQUEST_BYTES,
) {
  try {
    const bytes = await readBoundedBytes(request.clone(), maximumBytes);
    return createHash('sha256').update(bytes).digest('hex');
  } catch (error) {
    if (
      error instanceof EducatorRequestError ||
      (error instanceof Error && error.name === 'EducatorRequestError')
    ) {
      throw error;
    }
    fail('invalid_request');
  }
}

export async function readEducatorAuthRequest(request: Request) {
  const contentType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') fail('unsupported_media_type', 415);

  const bytes = await readBoundedBytes(request, EDUCATOR_MAX_REQUEST_BYTES);
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('invalid_request');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    fail('invalid_request');
  }

  return {
    input: parseEducatorAuthRequest(parsed),
    bodySha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
