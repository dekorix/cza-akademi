const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODULE_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const ACTIONS = new Set(['login', 'me', 'start', 'attempt', 'interaction', 'finish']);

export class StagingCoreRequestError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'StagingCoreRequestError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new StagingCoreRequestError(code, status);
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_request');
  return value;
}

function exact(value, required, optional = []) {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail('invalid_request_schema');
  if (required.some((key) => !Object.hasOwn(value, key))) fail('invalid_request_schema');
}

function text(value, maximum, pattern) {
  if (typeof value !== 'string') fail('invalid_request_schema');
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || (pattern && !pattern.test(normalized))) {
    fail('invalid_request_schema');
  }
  return normalized;
}

function uuid(value) {
  return text(value, 36, UUID_PATTERN);
}

function integer(value, maximum, optional = false) {
  if (value === undefined && optional) return;
  if (!Number.isInteger(value) || value < 0 || value > maximum) fail('invalid_request_schema');
}

function safeJson(value, state = { nodes: 0 }, depth = 0) {
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
    value.forEach((item) => safeJson(item, state, depth + 1));
    return;
  }
  const item = object(value);
  const entries = Object.entries(item);
  if (entries.length > 200) fail('invalid_request_schema');
  for (const [key, entry] of entries) {
    if (!key || key.length > 120 || ['__proto__', 'prototype', 'constructor'].includes(key)) {
      fail('invalid_request_schema');
    }
    safeJson(entry, state, depth + 1);
  }
}

function jsonObject(value) {
  const result = object(value);
  safeJson(result);
  return result;
}

function session(value) {
  return text(value, 512);
}

export function parseStagingCoreRequest(input) {
  const value = object(input);
  const action = typeof value.action === 'string' ? value.action : '';
  if (!ACTIONS.has(action)) fail('invalid_action');

  if (action === 'login') {
    exact(value, ['action', 'username', 'pin']);
    return { action, username: text(value.username, 128), pin: text(value.pin, 64) };
  }
  if (action === 'me') {
    exact(value, ['action', 'sessionToken']);
    return { action, sessionToken: session(value.sessionToken) };
  }
  if (action === 'start') {
    exact(value, ['action', 'moduleCode', 'source', 'clientSessionId', 'recipeId', 'settings', 'sessionToken']);
    const source = text(value.source, 40, MODULE_PATTERN);
    if (source !== 'free_practice' && source !== 'teacher_assignment') fail('invalid_request_schema');
    return {
      action,
      moduleCode: text(value.moduleCode, 80, MODULE_PATTERN),
      source,
      clientSessionId: uuid(value.clientSessionId),
      recipeId: value.recipeId === null ? null : uuid(value.recipeId),
      settings: jsonObject(value.settings),
      sessionToken: session(value.sessionToken),
    };
  }
  if (action === 'attempt') {
    exact(value, ['action', 'sessionId', 'payload', 'sessionToken']);
    return {
      action,
      sessionId: uuid(value.sessionId),
      payload: jsonObject(value.payload),
      sessionToken: session(value.sessionToken),
    };
  }
  if (action === 'interaction') {
    exact(value, [
      'action', 'sessionId', 'clientEventId', 'questionIndex', 'sequenceNo',
      'eventType', 'screenArea', 'elapsedMs', 'payload', 'sessionToken',
    ]);
    integer(value.questionIndex, 10_000);
    integer(value.sequenceNo, 1_000_000);
    integer(value.elapsedMs, 86_400_000);
    return {
      action,
      sessionId: uuid(value.sessionId),
      clientEventId: uuid(value.clientEventId),
      questionIndex: value.questionIndex,
      sequenceNo: value.sequenceNo,
      eventType: text(value.eventType, 80, MODULE_PATTERN),
      screenArea: text(value.screenArea, 80, MODULE_PATTERN),
      elapsedMs: value.elapsedMs,
      payload: jsonObject(value.payload),
      sessionToken: session(value.sessionToken),
    };
  }

  exact(
    value,
    ['action', 'sessionId', 'sessionToken'],
    ['activeDurationMs', 'questionCount', 'correctCount', 'timeoutCount', 'aborted'],
  );
  integer(value.activeDurationMs, 86_400_000, true);
  integer(value.questionCount, 10_000, true);
  integer(value.correctCount, 10_000, true);
  integer(value.timeoutCount, 10_000, true);
  if (value.aborted !== undefined && typeof value.aborted !== 'boolean') fail('invalid_request_schema');
  return { ...value, action, sessionId: uuid(value.sessionId), sessionToken: session(value.sessionToken) };
}

export async function readBoundedJson(request, maximumBytes = 64 * 1024) {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') fail('unsupported_media_type', 415);
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)) {
    fail(Number(declared) > maximumBytes ? 'request_too_large' : 'invalid_content_length', Number(declared) > maximumBytes ? 413 : 400);
  }
  if (!request.body) fail('invalid_request');
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        fail('request_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(merged));
  } catch {
    fail('invalid_request');
  }
}
