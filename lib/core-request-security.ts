const MODULE_CODE_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CORE_ACTIONS = [
  'login',
  'me',
  'start',
  'finish',
  'interaction',
  'attempt',
  'module_record',
  'logout',
] as const;

export type CoreAction = (typeof CORE_ACTIONS)[number];
export type CoreRequest = Record<string, unknown> & { action: CoreAction };

export class CoreRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'CoreRequestError';
  }
}

function fail(code: string, status = 400): never {
  throw new CoreRequestError(code, status);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('invalid_request_schema');
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('invalid_request_schema');
  }
}

function stringField(value: unknown, maxLength: number, pattern?: RegExp) {
  if (typeof value !== 'string') fail('invalid_request_schema');
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    (pattern && !pattern.test(normalized))
  ) {
    fail('invalid_request_schema');
  }
  return normalized;
}

function uuidField(value: unknown) {
  return stringField(value, 100, UUID_PATTERN);
}

function integerField(value: unknown, maximum = 1_000_000, optional = false) {
  if (value === undefined && optional) return;
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > maximum
  ) {
    fail('invalid_request_schema');
  }
}

function assertSafeJson(value: unknown, state = { nodes: 0 }, depth = 0): void {
  state.nodes += 1;
  if (state.nodes > 1200 || depth > 10) fail('invalid_request_schema');

  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('invalid_request_schema');
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 4000) fail('invalid_request_schema');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) fail('invalid_request_schema');
    value.forEach((item) => assertSafeJson(item, state, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > 200) fail('invalid_request_schema');
    for (const [key, item] of entries) {
      if (
        !key ||
        key.length > 120 ||
        key === '__proto__' ||
        key === 'prototype' ||
        key === 'constructor'
      ) {
        fail('invalid_request_schema');
      }
      assertSafeJson(item, state, depth + 1);
    }
    return;
  }
  fail('invalid_request_schema');
}

function objectField(value: unknown) {
  if (!isPlainObject(value)) fail('invalid_request_schema');
  assertSafeJson(value);
  return value;
}

export function parseCoreRequest(value: unknown): CoreRequest {
  if (!isPlainObject(value)) fail('invalid_request');

  const action = typeof value.action === 'string' ? value.action : '';
  if (!CORE_ACTIONS.includes(action as CoreAction)) fail('invalid_action');

  if (action === 'login') {
    exactFields(value, ['action', 'username', 'pin']);
    return {
      action,
      username: stringField(value.username, 128),
      pin: stringField(value.pin, 64),
    };
  }

  if (action === 'me' || action === 'logout') {
    exactFields(value, ['action']);
    return { action };
  }

  if (action === 'start') {
    exactFields(
      value,
      ['action', 'moduleCode', 'source', 'clientSessionId', 'settings'],
      ['recipeId'],
    );
    const source = stringField(value.source, 40, MODULE_CODE_PATTERN);
    if (source !== 'free_practice' && source !== 'teacher_assignment') {
      fail('invalid_request_schema');
    }
    const recipeId =
      value.recipeId === null || value.recipeId === undefined
        ? null
        : uuidField(value.recipeId);
    return {
      action,
      moduleCode: stringField(value.moduleCode, 80, MODULE_CODE_PATTERN),
      source,
      clientSessionId: uuidField(value.clientSessionId),
      recipeId,
      settings: objectField(value.settings),
    };
  }

  if (action === 'finish') {
    exactFields(
      value,
      ['action', 'sessionId'],
      [
        'activeDurationMs',
        'questionCount',
        'correctCount',
        'timeoutCount',
        'aborted',
      ],
    );
    integerField(value.activeDurationMs, 86_400_000, true);
    integerField(value.questionCount, 10_000, true);
    integerField(value.correctCount, 10_000, true);
    integerField(value.timeoutCount, 10_000, true);
    if (value.aborted !== undefined && typeof value.aborted !== 'boolean') {
      fail('invalid_request_schema');
    }
    return { ...value, action, sessionId: uuidField(value.sessionId) };
  }

  if (action === 'interaction') {
    exactFields(value, [
      'action',
      'sessionId',
      'clientEventId',
      'questionIndex',
      'sequenceNo',
      'eventType',
      'screenArea',
      'elapsedMs',
      'payload',
    ]);
    integerField(value.questionIndex, 10_000);
    integerField(value.sequenceNo, 1_000_000);
    integerField(value.elapsedMs, 86_400_000);
    return {
      action,
      sessionId: uuidField(value.sessionId),
      clientEventId: uuidField(value.clientEventId),
      questionIndex: value.questionIndex,
      sequenceNo: value.sequenceNo,
      eventType: stringField(value.eventType, 80, MODULE_CODE_PATTERN),
      screenArea: stringField(value.screenArea, 80, MODULE_CODE_PATTERN),
      elapsedMs: value.elapsedMs,
      payload: objectField(value.payload),
    };
  }

  if (action === 'attempt') {
    exactFields(value, ['action', 'sessionId', 'payload']);
    return {
      action,
      sessionId: uuidField(value.sessionId),
      payload: objectField(value.payload),
    };
  }

  exactFields(value, ['action', 'record']);
  return { action: 'module_record', record: objectField(value.record) };
}

export async function readBoundedJson(
  request: Pick<Request, 'headers' | 'body'>,
  maximumBytes: number,
): Promise<unknown> {
  const contentType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') fail('unsupported_media_type', 415);

  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) fail('invalid_content_length');
    if (Number(declared) > maximumBytes) fail('request_too_large', 413);
  }

  if (!request.body) fail('invalid_request');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let received = 0;
  let body = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel('request_too_large');
        fail('request_too_large', 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof CoreRequestError) throw error;
    fail('invalid_request');
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    fail('invalid_request');
  }
}

export function configuredCoreUrl(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const rawUrl = environment.CZA_CORE_API_URL?.trim();
  const allowedHosts = environment.CZA_CORE_API_ALLOWED_HOSTS?.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!rawUrl || !allowedHosts?.length) {
    throw new CoreRequestError('core_configuration_unavailable', 503);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CoreRequestError('core_configuration_unavailable', 503);
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    throw new CoreRequestError('core_configuration_unavailable', 503);
  }

  return url.toString();
}
