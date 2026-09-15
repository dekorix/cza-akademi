const UNRESERVED = /^[A-Za-z0-9._~-]$/;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HEX = /^[0-9A-Fa-f]{2}$/;
const UTF8_FATAL = new TextDecoder('utf-8', { fatal: true });

export class Faz3CanonicalError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'Faz3CanonicalError';
  }
}

function fail(code: string): never {
  throw new Faz3CanonicalError(code);
}

function asciiOws(value: string) {
  let left = 0;
  let right = value.length;
  while (left < right && (value.charCodeAt(left) === 0x20 || value.charCodeAt(left) === 0x09)) left += 1;
  while (right > left && (value.charCodeAt(right - 1) === 0x20 || value.charCodeAt(right - 1) === 0x09)) right -= 1;
  return value.slice(left, right);
}

function assertVisibleAscii(value: string, code: string) {
  for (let index = 0; index < value.length; index += 1) {
    const byte = value.charCodeAt(index);
    if (byte < 0x20 || byte > 0x7e) fail(code);
  }
}

function splitQuoted(value: string) {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      if (char !== '"' && char !== '\\') fail('CONTENT_TYPE_MALFORMED');
      current += char;
      escaped = false;
    } else if (quoted && char === '\\') {
      current += char;
      escaped = true;
    } else if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (char === ';' && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (quoted || escaped) fail('CONTENT_TYPE_MALFORMED');
  parts.push(current);
  return parts;
}

function parameterValue(raw: string) {
  const value = asciiOws(raw);
  if (!value.startsWith('"')) {
    if (!TOKEN.test(value)) fail('CONTENT_TYPE_MALFORMED');
    return value;
  }
  if (value.length < 2 || !value.endsWith('"')) fail('CONTENT_TYPE_MALFORMED');
  let result = '';
  for (let index = 1; index < value.length - 1; index += 1) {
    const byte = value.charCodeAt(index);
    const char = value[index];
    if (char === '\\') {
      index += 1;
      const escaped = value[index];
      if (escaped !== '"' && escaped !== '\\') fail('CONTENT_TYPE_MALFORMED');
      result += escaped;
    } else {
      if (char === '"' || byte < 0x20 || byte >= 0x7f) fail('CONTENT_TYPE_MALFORMED');
      result += char;
    }
  }
  return result;
}

export function originCanonicalContentType(profile: string, values: string[], bodyLength: number) {
  if (!Array.isArray(values) || values.length > 1) fail('DUPLICATE_CONTENT_TYPE');
  if (profile === 'body-forbidden') {
    if (values.length !== 0 || bodyLength !== 0) fail('CONTENT_TYPE_FORBIDDEN');
    return '';
  }
  if (profile !== 'json-required') fail('CONTENT_TYPE_PROFILE_INVALID');
  if (values.length === 0) fail('CONTENT_TYPE_REQUIRED');
  const raw = values[0];
  assertVisibleAscii(raw, 'CONTENT_TYPE_MALFORMED');
  if (raw.includes(',') || raw.includes('\ufeff')) fail('CONTENT_TYPE_MALFORMED');
  const pieces = splitQuoted(raw);
  const mediaType = asciiOws(pieces.shift() || '').toLowerCase();
  if (!mediaType) fail('CONTENT_TYPE_EMPTY');
  if (mediaType !== 'application/json') fail('UNSUPPORTED_MEDIA_TYPE');
  const parameters = new Map<string, string>();
  for (const piece of pieces) {
    const equals = piece.indexOf('=');
    if (equals <= 0) fail('CONTENT_TYPE_MALFORMED');
    const name = asciiOws(piece.slice(0, equals)).toLowerCase();
    if (!TOKEN.test(name) || parameters.has(name)) fail('CONTENT_TYPE_MALFORMED');
    parameters.set(name, parameterValue(piece.slice(equals + 1)).toLowerCase());
  }
  if (parameters.size === 0) return 'application/json';
  if (parameters.size !== 1 || parameters.get('charset') !== 'utf-8') fail('UNSUPPORTED_MEDIA_TYPE');
  return 'application/json;charset=utf-8';
}

function decodeOnce(raw: string) {
  if (raw.includes('+')) fail('LITERAL_PLUS_REJECTED');
  const bytes: number[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const code = raw.charCodeAt(index);
    if (char === '%') {
      const pair = raw.slice(index + 1, index + 3);
      if (!HEX.test(pair)) fail('INVALID_PERCENT_ENCODING');
      bytes.push(Number.parseInt(pair, 16));
      index += 2;
    } else {
      if (code < 0x20 || code > 0x7e) fail('RAW_TARGET_INVALID');
      bytes.push(code);
    }
  }
  let decoded: string;
  try {
    decoded = UTF8_FATAL.decode(Uint8Array.from(bytes)).normalize('NFC');
  } catch {
    fail('INVALID_UTF8');
  }
  for (const char of decoded) {
    const point = char.codePointAt(0);
    if (point === undefined || point < 0x20 || point === 0x7f) fail('DECODED_CONTROL_REJECTED');
  }
  if (decoded === '.' || decoded === '..') fail('DOT_SEGMENT_REJECTED');
  return decoded;
}

function encodeComponent(value: string) {
  let result = '';
  for (const byte of new TextEncoder().encode(value)) {
    const char = String.fromCharCode(byte);
    result += UNRESERVED.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return result;
}

export function originCanonicalTarget(rawTarget: string) {
  if (typeof rawTarget !== 'string' || !rawTarget.startsWith('/')) fail('RAW_TARGET_INVALID');
  assertVisibleAscii(rawTarget, 'RAW_TARGET_INVALID');
  if (rawTarget.includes('\\') || /%2f|%5c/i.test(rawTarget)) fail('ENCODED_SEPARATOR_REJECTED');
  const question = rawTarget.indexOf('?');
  const hasQuery = question !== -1;
  const rawPath = hasQuery ? rawTarget.slice(0, question) : rawTarget;
  const rawQuery = hasQuery ? rawTarget.slice(question + 1) : '';
  if (!rawPath || (rawPath !== '/' && rawPath.includes('//'))) fail('EMPTY_PATH_SEGMENT');
  const path = rawPath.split('/').map((part, index) => index === 0 ? '' : encodeComponent(decodeOnce(part))).join('/');
  if (!hasQuery) return path;
  if (!rawQuery) return `${path}?`;
  const pairs = rawQuery.split('&').map((part, ordinal) => {
    if (!part) fail('EMPTY_QUERY_MEMBER');
    const equals = part.indexOf('=');
    return {
      name: encodeComponent(decodeOnce(equals < 0 ? part : part.slice(0, equals))),
      value: encodeComponent(decodeOnce(equals < 0 ? '' : part.slice(equals + 1))),
      ordinal,
    };
  });
  pairs.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.value < b.value ? -1 : a.value > b.value ? 1 : a.ordinal - b.ordinal);
  return `${path}?${pairs.map(pair => `${pair.name}=${pair.value}`).join('&')}`;
}

export function originHmacMessage(fields: Record<string, string>) {
  const order = ['v', 'kid', 'ts', 'nonce', 'method', 'public-authority', 'raw-target', 'target', 'route-id', 'origin-service-authority', 'content-type', 'body-sha256', 'access-jwt-sha256', 'audience', 'subject-hash', 'role-metadata', 'client-ip-hash', 'request-id'];
  let message = 'CZA-HMAC-V2\n';
  for (const name of order) {
    const value = String(fields[name] ?? '');
    message += `${name}:${Buffer.byteLength(value, 'utf8')}:${value}\n`;
  }
  return message;
}
