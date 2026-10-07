import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { originCanonicalContentType, originCanonicalTarget, originHmacMessage } from '@/lib/faz3-origin-canonical';
import { verifyCloudflareAccessJwt } from '@/lib/faz3-access-jwt';
import { consumeFaz3Nonce, resolveFaz3Principal, type Faz3Principal } from '@/lib/faz3-origin-repository';

const MAX_BODY_BYTES = 64 * 1024;
const ACCEPTED_PAST_SECONDS = 60;
const FUTURE_CLOCK_SKEW_SECONDS = 5;
const NONCE_RETENTION_SECONDS = 80;
const ROUTE_ID = 'phase2-staging-v1';
const FIELD_NAMES = ['v', 'kid', 'ts', 'nonce', 'method', 'public-authority', 'raw-target', 'target', 'route-id', 'origin-service-authority', 'content-type', 'body-sha256', 'access-jwt-sha256', 'audience', 'subject-hash', 'role-metadata', 'client-ip-hash', 'request-id'] as const;

export class Faz3OriginVerificationError extends Error {
  constructor(public readonly code: string, public readonly status = 403) {
    super(code);
    this.name = 'Faz3OriginVerificationError';
  }
}

function fail(code: string, status = 403): never {
  throw new Faz3OriginVerificationError(code, status);
}

async function limitedBody(request: Request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) fail('REQUEST_TOO_LARGE', 413);
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

type Faz3VerifierConfig = {
  publicAuthority: string;
  originAuthority: string;
  accessAudience: string;
  accessTeamDomain: string;
  hmacKeyId: string;
  hmacSecret: string;
};

function config(): Faz3VerifierConfig {
  const value = {
    publicAuthority: process.env.CZA_FAZ3_PUBLIC_AUTHORITY || '',
    originAuthority: process.env.CZA_FAZ3_ORIGIN_SERVICE_AUTHORITY || '',
    accessAudience: process.env.CZA_FAZ3_ACCESS_AUDIENCE || '',
    accessTeamDomain: process.env.CZA_FAZ3_ACCESS_TEAM_DOMAIN || '',
    hmacKeyId: process.env.CZA_FAZ3_HMAC_KEY_ID || '',
    hmacSecret: process.env.CZA_FAZ3_HMAC_SECRET || '',
  };
  if (!/^[a-z0-9.-]+$/.test(value.publicAuthority) || !/^[a-z0-9.-]+$/.test(value.originAuthority)) fail('ORIGIN_CONFIGURATION_INVALID', 503);
  if (!value.accessAudience || !value.accessTeamDomain || !value.hmacKeyId || Buffer.byteLength(value.hmacSecret, 'utf8') < 32) fail('ORIGIN_CONFIGURATION_INVALID', 503);
  return value;
}

function readFields(headers: Headers) {
  const fields: Record<string, string> = Object.create(null);
  for (const name of FIELD_NAMES) {
    const value = headers.get(`x-cza-${name}`);
    if (value === null || /[\u0000-\u001f\u007f]/.test(value)) fail('SIGNED_FIELD_INVALID');
    fields[name] = value;
  }
  return fields;
}

function equalHex(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export type Faz3VerifiedRequest = Readonly<{
  principal: Faz3Principal;
  rawTarget: string;
  canonicalTarget: string;
  requestId: string;
  body: Uint8Array;
}>;

export type Faz3VerifierDependencies = {
  config?: Faz3VerifierConfig;
  verifyJwt?: typeof verifyCloudflareAccessJwt;
  resolvePrincipal?: typeof resolveFaz3Principal;
  consumeNonce?: typeof consumeFaz3Nonce;
};

export async function verifyFaz3OriginRequest(request: Request, nowSeconds = Math.floor(Date.now() / 1000), dependencies: Faz3VerifierDependencies = {}): Promise<Faz3VerifiedRequest> {
  const expected = dependencies.config || config();
  const verifyJwt = dependencies.verifyJwt || verifyCloudflareAccessJwt;
  const resolvePrincipal = dependencies.resolvePrincipal || resolveFaz3Principal;
  const consumeNonce = dependencies.consumeNonce || consumeFaz3Nonce;
  const incoming = new URL(request.url);
  if (incoming.host !== expected.originAuthority || incoming.protocol !== 'https:') fail('ORIGIN_AUTHORITY_REJECTED', 404);
  const fields = readFields(request.headers);
  if (fields.v !== '2' || fields.kid !== expected.hmacKeyId || fields['route-id'] !== ROUTE_ID) fail('HMAC_BINDING_INVALID');
  if (fields['public-authority'] !== expected.publicAuthority || fields['origin-service-authority'] !== expected.originAuthority || fields.audience !== expected.accessAudience) fail('HMAC_BINDING_INVALID');
  if (fields['role-metadata'] !== 'edge-authn-only') fail('ROLE_METADATA_INVALID');
  if (!/^[0-9a-f]{32,128}$/.test(fields.nonce) || !/^[0-9a-f-]{36}$/.test(fields['request-id'])) fail('SIGNED_FIELD_INVALID');

  const timestamp = Number(fields.ts);
  if (!Number.isSafeInteger(timestamp) || timestamp > nowSeconds + FUTURE_CLOCK_SKEW_SECONDS || timestamp < nowSeconds - ACCEPTED_PAST_SECONDS) fail('SIGNATURE_TIME_INVALID');
  const method = request.method.toUpperCase();
  if (fields.method !== method || !/^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(method)) fail('METHOD_REJECTED');

  const canonicalTarget = originCanonicalTarget(fields['raw-target']);
  if (canonicalTarget !== fields.target) fail('TARGET_BINDING_INVALID');
  const body = await limitedBody(request);
  const profile = method === 'GET' || method === 'HEAD' ? 'body-forbidden' : 'json-required';
  const contentType = originCanonicalContentType(profile, request.headers.has('content-type') ? [request.headers.get('content-type') || ''] : [], body.byteLength);
  if (contentType !== fields['content-type']) fail('CONTENT_TYPE_BINDING_INVALID');
  const bodyHash = createHash('sha256').update(body).digest('hex');
  if (!equalHex(bodyHash, fields['body-sha256'])) fail('BODY_TAMPERED');

  const accessJwt = request.headers.get('cf-access-jwt-assertion') || '';
  const accessHash = createHash('sha256').update(accessJwt).digest('hex');
  if (!accessJwt || !equalHex(accessHash, fields['access-jwt-sha256'])) fail('ACCESS_JWT_BINDING_INVALID', 404);

  const suppliedSignature = request.headers.get('x-cza-signature') || '';
  const expectedSignature = createHmac('sha256', expected.hmacSecret).update(originHmacMessage(fields)).digest('hex');
  if (!equalHex(suppliedSignature, expectedSignature)) fail('HMAC_INVALID');

  const jwt = await verifyJwt(accessJwt, expected.accessTeamDomain, expected.accessAudience, nowSeconds);
  if (fields['subject-hash'] !== 'edge-authn-only') fail('SUBJECT_METADATA_INVALID');
  const principal = await resolvePrincipal(jwt.subjectHash, jwt.jwtIdHash);
  if (!principal) fail('PRINCIPAL_NOT_AUTHORIZED', 404);

  const consumed = await consumeNonce(fields.nonce, fields['request-id'], jwt.subjectHash, timestamp + NONCE_RETENTION_SECONDS);
  if (!consumed) fail('REPLAY_REJECTED');
  return Object.freeze({ principal, rawTarget: fields['raw-target'], canonicalTarget, requestId: fields['request-id'], body });
}
