import { createHash } from 'node:crypto';
import { CoreRequestError, readBoundedJson } from '@/lib/core-request-security';
import {
  allowAccountRequest,
  allowRequest,
  rateLimited,
} from '@/lib/request-guard';
import {
  assertFastReadingConfiguration,
  answerComprehensionQuestion,
  authorizeRequestedLevel,
  FastReadingSessionError,
  finishReadingTrial,
  issuePreviewIdentity,
  startPreparedReadingTrial,
  startTachistoscopeSession,
  verifyPreviewIdentity,
} from '@/lib/fast-reading-session-server';
import {
  classifyFastReadingTelemetry,
  FastReadingTelemetryError,
} from '@/lib/fast-reading-telemetry-server';
import { authenticatedStudent, readRequestCookie } from '@/lib/student-session';
import type {
  FastReadingExerciseId,
  FastReadingLevelId,
} from '@/lib/fast-reading-core';

const FAST_READING_TELEMETRY_MAX_BYTES = 16 * 1024;
const PREVIEW_COOKIE = 'cza_fast_reading_preview';
const ACTIONS = new Set([
  'start',
  'phrase-start',
  'read',
  'answer',
  'classify',
]);
const EXERCISES = new Set(['focus_expansion', 'schulte_scan', 'tachistoscope']);
const LEVELS = new Set(['starter', 'explorer', 'accelerator']);

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

function fail(code: string, status = 400): never {
  throw new FastReadingSessionError(code, status);
}

function plainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(
  value: PlainObject,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    fail('fast_reading_request_invalid');
  }
}

function stringValue(value: unknown, maximum: number) {
  if (typeof value !== 'string' || !value || value.length > maximum) {
    fail('fast_reading_request_invalid');
  }
  return value;
}

function requestAction(value: unknown) {
  if (!plainObject(value)) fail('fast_reading_request_invalid');
  const action = stringValue(value.action, 32);
  if (!ACTIONS.has(action)) fail('fast_reading_request_invalid');
  return { action, value };
}

function startInput(value: PlainObject) {
  exactFields(value, ['action', 'exerciseId', 'levelId'], ['progressionToken']);
  const exerciseId = stringValue(value.exerciseId, 40);
  const levelId = stringValue(value.levelId, 24);
  if (!EXERCISES.has(exerciseId) || !LEVELS.has(levelId)) {
    fail('fast_reading_request_invalid');
  }
  const progressionToken =
    value.progressionToken === undefined || value.progressionToken === null
      ? null
      : stringValue(value.progressionToken, 4096);
  return {
    exerciseId: exerciseId as FastReadingExerciseId,
    levelId: levelId as FastReadingLevelId,
    progressionToken,
  };
}

function sessionTokenInput(value: PlainObject, answer = false) {
  exactFields(
    value,
    answer
      ? ['action', 'sessionToken', 'selectedOptionIndex']
      : ['action', 'sessionToken'],
  );
  const sessionToken = stringValue(value.sessionToken, 4096);
  if (
    answer &&
    (!Number.isInteger(value.selectedOptionIndex) ||
      (value.selectedOptionIndex as number) < 0 ||
      (value.selectedOptionIndex as number) > 2)
  ) {
    fail('fast_reading_request_invalid');
  }
  return {
    sessionToken,
    selectedOptionIndex: answer ? (value.selectedOptionIndex as number) : null,
  };
}

function prepareTokenInput(value: PlainObject) {
  exactFields(value, ['action', 'prepareToken']);
  return stringValue(value.prepareToken, 4096);
}

function previewCookie(value: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  return [
    `${PREVIEW_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/api/fast-reading',
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
    'Max-Age=3600',
  ].join('; ');
}

async function authenticatedSubject(
  request: Request,
  allowPreviewIssue: boolean,
) {
  const existingPreview = verifyPreviewIdentity(
    readRequestCookie(request, PREVIEW_COOKIE),
  );
  if (existingPreview) return { subject: existingPreview, cookie: null };

  if (
    allowPreviewIssue &&
    process.env.NODE_ENV !== 'production' &&
    process.env.CZA_FAST_READING_ISOLATED_PREVIEW === 'true'
  ) {
    const token = issuePreviewIdentity();
    const subject = verifyPreviewIdentity(token);
    if (!subject) fail('fast_reading_auth_unavailable', 503);
    return { subject, cookie: previewCookie(token, request) };
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    fail('fast_reading_auth_unavailable', 503);
  }
  try {
    const student = await authenticatedStudent(request);
    if (!student) fail('fast_reading_auth_required', 401);
    return { subject: `student:${student.student_id}`, cookie: null };
  } catch (error) {
    if (error instanceof FastReadingSessionError) throw error;
    fail('fast_reading_auth_unavailable', 503);
  }
}

async function consumeSingleUseToken(sessionToken: string) {
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const gate = await allowAccountRequest(
    'fast-reading-step',
    1,
    15 * 60_000,
    tokenHash,
  );
  if (!gate.allowed) throw rateLimited(gate);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'request_origin_rejected' }, 403);
  }

  const addressGate = await allowRequest(
    request,
    'fast-reading-endpoint',
    120,
    60_000,
  );
  if (!addressGate.allowed) return rateLimited(addressGate);

  try {
    assertFastReadingConfiguration();
    const input = requestAction(
      await readBoundedJson(request, FAST_READING_TELEMETRY_MAX_BYTES),
    );
    const auth = await authenticatedSubject(request, input.action === 'start');
    const subjectGate = await allowAccountRequest(
      'fast-reading-subject',
      120,
      10 * 60_000,
      auth.subject,
    );
    if (!subjectGate.allowed) return rateLimited(subjectGate);
    const responseHeaders = auth.cookie
      ? { 'set-cookie': auth.cookie }
      : undefined;

    if (input.action === 'start') {
      const start = startInput(input.value);
      const highestUnlockedLevel = authorizeRequestedLevel(
        auth.subject,
        start.levelId,
        start.progressionToken,
      );
      if (start.exerciseId !== 'tachistoscope') {
        return json(
          { ok: true, authorized: true, highestUnlockedLevel },
          200,
          responseHeaders,
        );
      }
      return json(
        {
          ok: true,
          ...startTachistoscopeSession(
            auth.subject,
            start.levelId,
            start.progressionToken,
          ),
        },
        200,
        responseHeaders,
      );
    }

    if (input.action === 'read') {
      const step = sessionTokenInput(input.value);
      await consumeSingleUseToken(step.sessionToken);
      return json({
        ok: true,
        ...finishReadingTrial(step.sessionToken, auth.subject),
      });
    }

    if (input.action === 'phrase-start') {
      const prepareToken = prepareTokenInput(input.value);
      await consumeSingleUseToken(prepareToken);
      return json({
        ok: true,
        ...startPreparedReadingTrial(prepareToken, auth.subject),
      });
    }

    if (input.action === 'answer') {
      const step = sessionTokenInput(input.value, true);
      await consumeSingleUseToken(step.sessionToken);
      return json({
        ok: true,
        ...answerComprehensionQuestion(
          step.sessionToken,
          auth.subject,
          step.selectedOptionIndex as number,
        ),
      });
    }

    const progressionToken =
      typeof input.value.progressionToken === 'string'
        ? input.value.progressionToken
        : null;
    const receipt = classifyFastReadingTelemetry(input.value);
    if (receipt.telemetry.exerciseId === 'tachistoscope') {
      fail('fast_reading_tachistoscope_session_required');
    }
    authorizeRequestedLevel(
      auth.subject,
      receipt.telemetry.levelId,
      progressionToken,
    );
    return json({ ok: true, receipt });
  } catch (error) {
    if (error instanceof Response) return error;
    if (
      error instanceof CoreRequestError ||
      error instanceof FastReadingTelemetryError ||
      error instanceof FastReadingSessionError
    ) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: 'fast_reading_unavailable' }, 503);
  }
}
