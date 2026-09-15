import { createHash, createHmac } from 'node:crypto';

const UNRESERVED = /^[A-Za-z0-9._~-]$/;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HEX = /^[0-9A-Fa-f]{2}$/;
const UTF8_FATAL = new TextDecoder('utf-8', { fatal: true });

export class EdgeCanonicalError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new EdgeCanonicalError(code);
}

function stripAsciiOws(value) {
  let start = 0;
  let end = value.length;
  while (start < end && (value.charCodeAt(start) === 0x20 || value.charCodeAt(start) === 0x09)) start += 1;
  while (end > start && (value.charCodeAt(end - 1) === 0x20 || value.charCodeAt(end - 1) === 0x09)) end -= 1;
  return value.slice(start, end);
}

function assertAscii(value, code) {
  for (let index = 0; index < value.length; index += 1) {
    const byte = value.charCodeAt(index);
    if (byte > 0x7e || byte < 0x20) fail(code);
  }
}

function splitQuoted(value, separator) {
  const parts = [];
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
    } else if (char === separator && !quoted) {
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

function parseParameterValue(raw) {
  const value = stripAsciiOws(raw);
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) fail('CONTENT_TYPE_MALFORMED');
    let result = '';
    for (let index = 1; index < value.length - 1; index += 1) {
      const char = value[index];
      const byte = value.charCodeAt(index);
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
  if (!TOKEN.test(value)) fail('CONTENT_TYPE_MALFORMED');
  return value;
}

export function canonicalContentType({ profile, values = [], bodyLength = 0 }) {
  if (!Array.isArray(values) || values.length > 1) fail('DUPLICATE_CONTENT_TYPE');
  if (profile === 'body-forbidden') {
    if (values.length !== 0 || bodyLength !== 0) fail('CONTENT_TYPE_FORBIDDEN');
    return '';
  }
  if (profile !== 'json-required') fail('CONTENT_TYPE_PROFILE_INVALID');
  if (values.length === 0) fail('CONTENT_TYPE_REQUIRED');
  const raw = values[0];
  assertAscii(raw, 'CONTENT_TYPE_MALFORMED');
  if (raw.includes(',') || raw.includes('\ufeff')) fail('CONTENT_TYPE_MALFORMED');
  const pieces = splitQuoted(raw, ';');
  const mediaType = stripAsciiOws(pieces.shift() || '').toLowerCase();
  if (!mediaType) fail('CONTENT_TYPE_EMPTY');
  if (mediaType !== 'application/json') fail('UNSUPPORTED_MEDIA_TYPE');
  const parameters = new Map();
  for (const piece of pieces) {
    const equals = piece.indexOf('=');
    if (equals <= 0) fail('CONTENT_TYPE_MALFORMED');
    const name = stripAsciiOws(piece.slice(0, equals)).toLowerCase();
    if (!TOKEN.test(name) || parameters.has(name)) fail('CONTENT_TYPE_MALFORMED');
    parameters.set(name, parseParameterValue(piece.slice(equals + 1)).toLowerCase());
  }
  if (parameters.size === 0) return 'application/json';
  if (parameters.size !== 1 || parameters.get('charset') !== 'utf-8') fail('UNSUPPORTED_MEDIA_TYPE');
  return 'application/json;charset=utf-8';
}

function decodeComponentOnce(raw) {
  if (raw.includes('+')) fail('LITERAL_PLUS_REJECTED');
  const bytes = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const code = raw.charCodeAt(index);
    if (char === '%') {
      const pair = raw.slice(index + 1, index + 3);
      if (!HEX.test(pair)) fail('INVALID_PERCENT_ENCODING');
      bytes.push(Number.parseInt(pair, 16));
      index += 2;
    } else {
      if (code > 0x7e || code < 0x20) fail('RAW_TARGET_INVALID');
      bytes.push(code);
    }
  }
  let decoded;
  try {
    decoded = UTF8_FATAL.decode(Uint8Array.from(bytes)).normalize('NFC');
  } catch {
    fail('INVALID_UTF8');
  }
  for (const char of decoded) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || codePoint < 0x20 || codePoint === 0x7f) fail('DECODED_CONTROL_REJECTED');
  }
  if (decoded === '.' || decoded === '..') fail('DOT_SEGMENT_REJECTED');
  return decoded;
}

function encodeComponent(value) {
  let result = '';
  for (const byte of new TextEncoder().encode(value)) {
    const char = String.fromCharCode(byte);
    result += UNRESERVED.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return result;
}

export function canonicalTarget(rawTarget) {
  if (typeof rawTarget !== 'string' || !rawTarget.startsWith('/')) fail('RAW_TARGET_INVALID');
  assertAscii(rawTarget, 'RAW_TARGET_INVALID');
  if (rawTarget.includes('\\') || /%2f|%5c/i.test(rawTarget)) fail('ENCODED_SEPARATOR_REJECTED');
  const question = rawTarget.indexOf('?');
  const hasQuery = question !== -1;
  const rawPath = hasQuery ? rawTarget.slice(0, question) : rawTarget;
  const rawQuery = hasQuery ? rawTarget.slice(question + 1) : '';
  if (rawPath.length === 0 || (rawPath !== '/' && rawPath.includes('//'))) fail('EMPTY_PATH_SEGMENT');
  const path = rawPath.split('/').map((segment, index) => index === 0 ? '' : encodeComponent(decodeComponentOnce(segment))).join('/');
  if (!hasQuery) return path;
  if (rawQuery === '') return `${path}?`;
  const pairs = rawQuery.split('&').map((part, ordinal) => {
    if (part === '') fail('EMPTY_QUERY_MEMBER');
    const equals = part.indexOf('=');
    const rawName = equals === -1 ? part : part.slice(0, equals);
    const rawValue = equals === -1 ? '' : part.slice(equals + 1);
    return {
      name: encodeComponent(decodeComponentOnce(rawName)),
      value: encodeComponent(decodeComponentOnce(rawValue)),
      ordinal,
    };
  });
  pairs.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : left.value < right.value ? -1 : left.value > right.value ? 1 : left.ordinal - right.ordinal);
  return `${path}?${pairs.map(({ name, value }) => `${name}=${value}`).join('&')}`;
}

export function canonicalEdgeRequest(input) {
  if (input.headersTruncated === true) fail('HEADERS_TRUNCATED');
  if (input.publicAuthority !== input.expectedPublicAuthority || !/^[a-z0-9.-]+$/.test(input.publicAuthority)) fail('AUTHORITY_REJECTED');
  const method = String(input.method || '').toUpperCase();
  if (!/^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(method)) fail('METHOD_REJECTED');
  const contentType = canonicalContentType({ profile: input.profile, values: input.contentTypeValues, bodyLength: input.bodyLength || 0 });
  return { method, authority: input.publicAuthority, target: canonicalTarget(input.rawTarget), contentType };
}

export function serializeHmacMessage(fields) {
  const order = ['v', 'kid', 'ts', 'nonce', 'method', 'public-authority', 'raw-target', 'target', 'route-id', 'origin-service-authority', 'content-type', 'body-sha256', 'access-jwt-sha256', 'audience', 'subject-hash', 'role-metadata', 'client-ip-hash', 'request-id'];
  let message = 'CZA-HMAC-V2\n';
  for (const name of order) {
    const value = String(fields[name] ?? '');
    message += `${name}:${Buffer.byteLength(value, 'utf8')}:${value}\n`;
  }
  return message;
}

export function signEdgeHmac(secret, fields) {
  return createHmac('sha256', secret).update(serializeHmacMessage(fields), 'utf8').digest('hex');
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
