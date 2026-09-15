import { webcrypto } from 'node:crypto';

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
const pct = /^[0-9a-fA-F]{2}$/;
const unreservedByte = byte => (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39) || byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x7e;
const tokenByte = byte => (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || "!#$%&'*+-.^_`|~".includes(String.fromCharCode(byte));

export class OriginCanonicalError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const reject = code => { throw new OriginCanonicalError(code); };

function ows(value) {
  let left = 0;
  let right = value.length;
  while (left < right) { const code = value.charCodeAt(left); if (code !== 0x20 && code !== 0x09) break; left += 1; }
  while (right > left) { const code = value.charCodeAt(right - 1); if (code !== 0x20 && code !== 0x09) break; right -= 1; }
  return value.substring(left, right);
}

function ascii(value, code) {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c > 126 || c < 32) reject(code);
  }
}

function token(value) {
  if (!value) return false;
  for (const byte of encoder.encode(value)) if (!tokenByte(byte)) return false;
  return true;
}

function semicolonParts(value) {
  const out = [];
  let from = 0;
  let quote = false;
  let slash = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (slash) {
      if (ch !== '"' && ch !== '\\') reject('CONTENT_TYPE_MALFORMED');
      slash = false;
    } else if (quote && ch === '\\') slash = true;
    else if (ch === '"') quote = !quote;
    else if (ch === ';' && !quote) { out.push(value.substring(from, i)); from = i + 1; }
  }
  if (quote || slash) reject('CONTENT_TYPE_MALFORMED');
  out.push(value.substring(from));
  return out;
}

function parameterValue(value) {
  const compact = ows(value);
  if (compact[0] !== '"') {
    if (!token(compact)) reject('CONTENT_TYPE_MALFORMED');
    return compact;
  }
  if (compact.length < 2 || compact[compact.length - 1] !== '"') reject('CONTENT_TYPE_MALFORMED');
  let out = '';
  for (let i = 1; i < compact.length - 1; i += 1) {
    const code = compact.charCodeAt(i);
    const ch = compact[i];
    if (ch === '\\') {
      i += 1;
      const next = compact[i];
      if (next !== '"' && next !== '\\') reject('CONTENT_TYPE_MALFORMED');
      out += next;
    } else {
      if (ch === '"' || code < 32 || code >= 127) reject('CONTENT_TYPE_MALFORMED');
      out += ch;
    }
  }
  return out;
}

export function originContentType(profile, values, bodyLength) {
  if (!Array.isArray(values) || values.length > 1) reject('DUPLICATE_CONTENT_TYPE');
  if (profile === 'body-forbidden') {
    if (values.length || bodyLength !== 0) reject('CONTENT_TYPE_FORBIDDEN');
    return '';
  }
  if (profile !== 'json-required') reject('CONTENT_TYPE_PROFILE_INVALID');
  if (!values.length) reject('CONTENT_TYPE_REQUIRED');
  const source = values[0];
  ascii(source, 'CONTENT_TYPE_MALFORMED');
  if (source.indexOf(',') >= 0 || source.indexOf('\ufeff') >= 0) reject('CONTENT_TYPE_MALFORMED');
  const parts = semicolonParts(source);
  const media = ows(parts.shift()).toLowerCase();
  if (!media) reject('CONTENT_TYPE_EMPTY');
  if (media !== 'application/json') reject('UNSUPPORTED_MEDIA_TYPE');
  const params = Object.create(null);
  for (const part of parts) {
    const at = part.indexOf('=');
    if (at <= 0) reject('CONTENT_TYPE_MALFORMED');
    const name = ows(part.substring(0, at)).toLowerCase();
    if (!token(name) || Object.hasOwn(params, name)) reject('CONTENT_TYPE_MALFORMED');
    params[name] = parameterValue(part.substring(at + 1)).toLowerCase();
  }
  const names = Object.keys(params);
  if (!names.length) return 'application/json';
  if (names.length !== 1 || params.charset !== 'utf-8') reject('UNSUPPORTED_MEDIA_TYPE');
  return 'application/json;charset=utf-8';
}

function decode(raw) {
  if (raw.indexOf('+') >= 0) reject('LITERAL_PLUS_REJECTED');
  const bytes = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '%') {
      const pair = raw.substring(i + 1, i + 3);
      if (!pct.test(pair)) reject('INVALID_PERCENT_ENCODING');
      bytes.push(parseInt(pair, 16)); i += 2;
    } else {
      const code = raw.charCodeAt(i);
      if (code > 126 || code < 32) reject('RAW_TARGET_INVALID');
      bytes.push(code);
    }
  }
  let value;
  try { value = decoder.decode(new Uint8Array(bytes)).normalize('NFC'); }
  catch { reject('INVALID_UTF8'); }
  for (const ch of value) {
    const point = ch.codePointAt(0);
    if (point === undefined || point < 32 || point === 127) reject('DECODED_CONTROL_REJECTED');
  }
  if (value === '.' || value === '..') reject('DOT_SEGMENT_REJECTED');
  return value;
}

function encode(value) {
  let out = '';
  for (const byte of encoder.encode(value)) out += unreservedByte(byte) ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  return out;
}

export function originCanonicalTarget(rawTarget) {
  if (typeof rawTarget !== 'string' || rawTarget[0] !== '/') reject('RAW_TARGET_INVALID');
  ascii(rawTarget, 'RAW_TARGET_INVALID');
  if (rawTarget.indexOf('\\') >= 0 || /%2f|%5c/i.test(rawTarget)) reject('ENCODED_SEPARATOR_REJECTED');
  const q = rawTarget.indexOf('?');
  const has = q >= 0;
  const p = has ? rawTarget.substring(0, q) : rawTarget;
  const query = has ? rawTarget.substring(q + 1) : '';
  if (!p || (p !== '/' && p.indexOf('//') >= 0)) reject('EMPTY_PATH_SEGMENT');
  const path = p.split('/').map((part, index) => index === 0 ? '' : encode(decode(part))).join('/');
  if (!has) return path;
  if (!query) return `${path}?`;
  const pairs = [];
  for (const [ordinal, part] of query.split('&').entries()) {
    if (!part) reject('EMPTY_QUERY_MEMBER');
    const eq = part.indexOf('=');
    pairs.push({ n: encode(decode(eq < 0 ? part : part.substring(0, eq))), v: encode(decode(eq < 0 ? '' : part.substring(eq + 1))), ordinal });
  }
  pairs.sort((a, b) => a.n < b.n ? -1 : a.n > b.n ? 1 : a.v < b.v ? -1 : a.v > b.v ? 1 : a.ordinal - b.ordinal);
  return `${path}?${pairs.map(pair => `${pair.n}=${pair.v}`).join('&')}`;
}

export function canonicalOriginRequest(input) {
  if (input.headersTruncated === true) reject('HEADERS_TRUNCATED');
  if (input.publicAuthority !== input.expectedPublicAuthority || !/^[a-z0-9.-]+$/.test(input.publicAuthority)) reject('AUTHORITY_REJECTED');
  const method = String(input.method || '').toUpperCase();
  if (!/^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(method)) reject('METHOD_REJECTED');
  return {
    method,
    authority: input.publicAuthority,
    target: originCanonicalTarget(input.rawTarget),
    contentType: originContentType(input.profile, input.contentTypeValues || [], input.bodyLength || 0),
  };
}

export function originHmacMessage(fields) {
  const names = ['v', 'kid', 'ts', 'nonce', 'method', 'public-authority', 'raw-target', 'target', 'route-id', 'origin-service-authority', 'content-type', 'body-sha256', 'access-jwt-sha256', 'audience', 'subject-hash', 'role-metadata', 'client-ip-hash', 'request-id'];
  let result = 'CZA-HMAC-V2\n';
  for (const name of names) {
    const value = `${fields[name] ?? ''}`;
    result += `${name}:${encoder.encode(value).byteLength}:${value}\n`;
  }
  return result;
}

export async function verifyOriginHmacVector(secret, fields) {
  const key = await webcrypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await webcrypto.subtle.sign('HMAC', key, encoder.encode(originHmacMessage(fields)));
  return Buffer.from(signature).toString('hex');
}
