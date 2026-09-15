import { createHash } from 'node:crypto';
import { CoreRequestError, readBoundedJson } from '@/lib/core-request-security';
import { readRequestCookie } from '@/lib/student-session';
import {
  allowAccountRequest,
  allowRequest,
  requestGuardRejected,
} from '@/lib/request-guard';
import {
  assertAttentionConfiguration,
  AttentionSessionError,
  attentionPreviewEnabled,
  issueAttentionPreviewIdentity,
  renderAttentionTrial,
  startAttentionSession,
  submitAttentionResponse,
  verifyAttentionPreviewIdentity,
} from '@/lib/attention-session-server';
import type {
  AttentionExerciseId,
  AttentionLevelId,
} from '@/lib/attention-core';

const MAX_REQUEST_BYTES = 16 * 1024;
const PREVIEW_COOKIE = 'cza_attention_preview';
const ACTIONS = new Set(['start', 'render', 'response']);
const EXERCISES = new Set(['stroop_conflict', 'visual_memory_matrix']);
const LEVELS = new Set(['foundation', 'developing', 'advanced']);

type PlainObject = Record<string, unknown>;

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function hidden() {
  return json({ ok: false, error: 'not_found' }, 404);
}

function fail(code: string, status = 400): never {
  throw new AttentionSessionError(code, status);
}

function plainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(
  value: PlainObject,
  required: readonly string[],
) {
  const allowed = new Set(required);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    fail('attention_request_invalid');
  }
}

function stringValue(value: unknown, maximum: number) {
  if (typeof value !== 'string' || !value || value.length > maximum) {
    fail('attention_request_invalid');
  }
  return value;
}

function parseRequest(value: unknown) {
  if (!plainObject(value)) fail('attention_request_invalid');
  const action = stringValue(value.action, 16);
  if (!ACTIONS.has(action)) fail('attention_request_invalid');

  if (action === 'start') {
    exactFields(value, ['action', 'exerciseId', 'levelId']);
    const exerciseId = stringValue(value.exerciseId, 40);
    const levelId = stringValue(value.levelId, 24);
    if (!EXERCISES.has(exerciseId) || !LEVELS.has(levelId)) {
      fail('attention_request_invalid');
    }
    return {
      action: 'start' as const,
      exerciseId: exerciseId as AttentionExerciseId,
      levelId: levelId as AttentionLevelId,
    };
  }

  if (action === 'render') {
    exactFields(value, ['action', 'prepareToken']);
    return {
      action: 'render' as const,
      token: stringValue(value.prepareToken, 4096),
    };
  }

  exactFields(value, ['action', 'responseToken', 'answer']);
  return {
    action: 'response' as const,
    token: stringValue(value.responseToken, 4096),
    answer: value.answer,
  };
}

function previewCookie(value: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  return [
    `${PREVIEW_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/api/attention',
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
    'Max-Age=3600',
  ].join('; ');
}

function previewSubject(request: Request, allowIssue: boolean) {
  const existing = verifyAttentionPreviewIdentity(
    readRequestCookie(request, PREVIEW_COOKIE),
  );
  if (existing) return { subject: existing, cookie: null };
  if (!allowIssue) fail('attention_auth_required', 401);

  const token = issueAttentionPreviewIdentity();
  const subject = verifyAttentionPreviewIdentity(token);
  if (!subject) fail('attention_auth_unavailable', 503);
  return { subject, cookie: previewCookie(token, request) };
}

async function consumeSingleUseToken(token: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const gate = await allowAccountRequest(
    'attention-step',
    1,
    15 * 60_000,
    tokenHash,
  );
  if (!gate.allowed) throw requestGuardRejected(gate);
}

export async function POST(request: Request) {
  if (!attentionPreviewEnabled()) return hidden();
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return hidden();

  const addressGate = await allowRequest(
    request,
    'attention-preview',
    120,
    60_000,
  );
  if (!addressGate.allowed) return requestGuardRejected(addressGate);

  try {
    assertAttentionConfiguration();
    const input = parseRequest(
      await readBoundedJson(request, MAX_REQUEST_BYTES),
    );
    const identity = previewSubject(request, input.action === 'start');
    const subjectGate = await allowAccountRequest(
      'attention-preview-subject',
      120,
      10 * 60_000,
      identity.subject,
    );
    if (!subjectGate.allowed) return requestGuardRejected(subjectGate);
    const headers = identity.cookie
      ? { 'set-cookie': identity.cookie }
      : undefined;

    if (input.action === 'start') {
      return json(
        {
          ok: true,
          ...startAttentionSession(
            identity.subject,
            input.exerciseId,
            input.levelId,
          ),
        },
        200,
        headers,
      );
    }

    await consumeSingleUseToken(input.token);
    if (input.action === 'render') {
      return json({
        ok: true,
        ...renderAttentionTrial(input.token, identity.subject),
      });
    }

    return json({
      ok: true,
      ...submitAttentionResponse(
        input.token,
        identity.subject,
        input.answer,
      ),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (
      error instanceof CoreRequestError ||
      error instanceof AttentionSessionError
    ) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: 'attention_preview_unavailable' }, 503);
  }
}
