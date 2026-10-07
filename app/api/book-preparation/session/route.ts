import { authenticatedEducator } from '@/lib/educator-auth';
import { CoreRequestError, readBoundedJson } from '@/lib/core-request-security';
import {
  BOOK_PREPARATION_PREVIEW_COOKIE,
  bookPreparationPreviewCookie,
  bookPreparationPreviewEnabled,
  consumeBookPreparationBootstrapTicket,
  issueBookPreparationPreviewIdentity,
  readBookPreparationPreviewCookie,
  revokeBookPreparationPreviewIdentity,
  verifyBookPreparationPreviewIdentity,
} from '@/lib/book-preparation-preview-auth';
import { allowAccountRequest, allowRequest } from '@/lib/request-guard';

const MAX_SESSION_REQUEST_BYTES = 4 * 1024;
const PREVIEW_SESSION_SECONDS = 30 * 60;

type SessionAction = 'bootstrap' | 'logout';
type EducatorAuthenticator = (
  request: Request,
) => Promise<{ id?: string } | null>;

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

function sessionAction(value: unknown): SessionAction | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  return keys.length === 1 &&
    (input.action === 'bootstrap' || input.action === 'logout')
    ? input.action
    : null;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer ([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)$/.exec(authorization);
  return match?.[1] || '';
}

async function bootstrapIdentity(
  request: Request,
  authenticateEducator: EducatorAuthenticator,
) {
  try {
    const educator = await authenticateEducator(request);
    if (educator?.id) return { subject: `educator:${educator.id}` };
  } catch {
    // The isolated signed exchange remains available only outside production.
  }
  return consumeBookPreparationBootstrapTicket(bearerToken(request));
}

export function createBookPreparationSessionPost(
  authenticateEducator: EducatorAuthenticator = authenticatedEducator,
) {
  return async function bookPreparationSessionPost(request: Request) {
    if (!bookPreparationPreviewEnabled()) return hidden();
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return hidden();

    let action: SessionAction | null;
    try {
      action = sessionAction(
        await readBoundedJson(request.clone(), MAX_SESSION_REQUEST_BYTES),
      );
    } catch (error) {
      if (error instanceof CoreRequestError && error.status === 413) {
        return json({ ok: false, error: 'request_too_large' }, 413);
      }
      return hidden();
    }
    if (!action) return hidden();

    if (action === 'logout') {
      const token = readBookPreparationPreviewCookie(request);
      if (
        !verifyBookPreparationPreviewIdentity(token) ||
        !revokeBookPreparationPreviewIdentity(token)
      ) {
        return hidden();
      }
      return json({ ok: true, revoked: true }, 200, {
        'set-cookie': bookPreparationPreviewCookie('', 0),
      });
    }

    const addressGate = await allowRequest(
      request,
      'book-preparation-bootstrap',
      10,
      10 * 60_000,
    );
    if (!addressGate.allowed) return hidden();

    const identity = await bootstrapIdentity(request, authenticateEducator);
    if (!identity) return hidden();
    const accountGate = await allowAccountRequest(
      'book-preparation-bootstrap-account',
      10,
      10 * 60_000,
      identity.subject,
    );
    if (!accountGate.allowed) return hidden();

    const previewToken = issueBookPreparationPreviewIdentity(identity.subject);
    return json(
      {
        ok: true,
        authenticated: true,
        role: 'educator',
        cookie: BOOK_PREPARATION_PREVIEW_COOKIE,
      },
      200,
      {
        'set-cookie': bookPreparationPreviewCookie(
          previewToken,
          PREVIEW_SESSION_SECONDS,
        ),
      },
    );
  };
}

export const POST = createBookPreparationSessionPost();
