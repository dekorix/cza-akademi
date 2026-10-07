import { CoreRequestError, readBoundedJson } from '@/lib/core-request-security';
import {
  bookPreparationPreviewEnabled,
  readBookPreparationPreviewCookie,
  verifyBookPreparationPreviewIdentity,
} from '@/lib/book-preparation-preview-auth';
import { allowRequest, requestGuardRejected } from '@/lib/request-guard';
import {
  BookPreparationError,
  buildServerVerifiedContentSummary,
} from '@/lib/book-preparation-server';

const MAX_PREVIEW_REQUEST_BYTES = 32 * 1024;

type PlainObject = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function hidden() {
  return json({ ok: false, error: 'not_found' }, 404);
}

function plainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requestDraft(value: unknown) {
  if (!plainObject(value))
    throw new BookPreparationError('book_request_invalid');
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    !Object.hasOwn(value, 'action') ||
    !Object.hasOwn(value, 'draft') ||
    value.action !== 'preview'
  ) {
    throw new BookPreparationError('book_request_invalid');
  }
  return value.draft;
}

export async function POST(request: Request) {
  if (!bookPreparationPreviewEnabled()) return hidden();

  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return hidden();

  const identity = verifyBookPreparationPreviewIdentity(
    readBookPreparationPreviewCookie(request),
  );
  if (!identity) return hidden();

  const gate = await allowRequest(
    request,
    'book-preparation-preview',
    30,
    60_000,
    identity.subject,
  );
  if (!gate.allowed) return requestGuardRejected(gate);

  try {
    const draft = requestDraft(
      await readBoundedJson(request, MAX_PREVIEW_REQUEST_BYTES),
    );
    return json({
      ok: true,
      summary: buildServerVerifiedContentSummary(draft),
      identity: {
        role: identity.role,
        authenticated: true,
      },
    });
  } catch (error) {
    if (
      error instanceof CoreRequestError ||
      error instanceof BookPreparationError
    ) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: 'book_preview_unavailable' }, 503);
  }
}
