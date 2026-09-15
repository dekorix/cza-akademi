import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const BOOK_PREPARATION_PREVIEW_COOKIE =
  '__Host-cza_book_preparation_educator_preview';
const SESSION_VERSION = 'cza-book-preparation-preview-session-v2';
const SESSION_AUDIENCE = 'book-preparation';
const EXCHANGE_VERSION = 'cza-book-preparation-bootstrap-hmac-v2';
const EXCHANGE_AUDIENCE = 'book-preparation-bootstrap';
const SESSION_TTL_MS = 30 * 60_000;
const EXCHANGE_TTL_MS = 2 * 60_000;
const SUBJECT_PATTERN =
  /^(?:educator:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|educator-preview:[a-z0-9](?:[a-z0-9-]{0,63}))$/;
const NONCE_PATTERN = /^[0-9a-f]{64}$/;

type PreviewEducatorSession = {
  version: typeof SESSION_VERSION;
  audience: typeof SESSION_AUDIENCE;
  role: 'educator';
  subject: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

type PreviewBootstrapTicket = {
  version: typeof EXCHANGE_VERSION;
  audience: typeof EXCHANGE_AUDIENCE;
  role: 'educator';
  subject: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

type PreviewState = {
  activeSessions: Map<string, { subject: string; expiresAt: number }>;
  consumedTickets: Map<string, number>;
};

type PreviewGlobal = typeof globalThis & {
  __czaBookPreparationPreviewState?: PreviewState;
};

function state() {
  const root = globalThis as PreviewGlobal;
  root.__czaBookPreparationPreviewState ??= {
    activeSessions: new Map(),
    consumedTickets: new Map(),
  };
  return root.__czaBookPreparationPreviewState;
}

function configuredSecret(environment: NodeJS.ProcessEnv) {
  const secret = environment.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET || '';
  return Buffer.byteLength(secret, 'utf8') >= 32 ? secret : null;
}

export function bookPreparationPreviewEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW === 'true' &&
    configuredSecret(environment) !== null
  );
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64url');
}

function seal(value: object, secret: string) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString(
    'base64url',
  );
  return `${payload}.${signature(payload, secret)}`;
}

function unseal<T>(token: string, secret: string): Partial<T> | null {
  if (typeof token !== 'string' || token.length > 2_048) return null;
  const parts = token.split('.');
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !/^[a-zA-Z0-9_-]{43}$/.test(parts[1])
  ) {
    return null;
  }
  const expected = Buffer.from(signature(parts[0], secret), 'base64url');
  const supplied = Buffer.from(parts[1], 'base64url');
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return null;
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf8'),
    );
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? (decoded as Partial<T>)
      : null;
  } catch {
    return null;
  }
}

function tokenHash(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function pruneExpired(now: number) {
  const current = state();
  for (const [key, session] of current.activeSessions) {
    if (session.expiresAt <= now) current.activeSessions.delete(key);
  }
  for (const [key, expiresAt] of current.consumedTickets) {
    if (expiresAt <= now) current.consumedTickets.delete(key);
  }
}

export function issueBookPreparationBootstrapTicket(
  subject: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const secret = configuredSecret(environment);
  if (
    !bookPreparationPreviewEnabled(environment) ||
    !secret ||
    !SUBJECT_PATTERN.test(subject) ||
    !Number.isSafeInteger(now)
  ) {
    throw new Error('book_preview_identity_configuration_invalid');
  }
  return seal(
    {
      version: EXCHANGE_VERSION,
      audience: EXCHANGE_AUDIENCE,
      role: 'educator',
      subject,
      nonce: randomBytes(32).toString('hex'),
      issuedAt: now,
      expiresAt: now + EXCHANGE_TTL_MS,
    } satisfies PreviewBootstrapTicket,
    secret,
  );
}

export function consumeBookPreparationBootstrapTicket(
  token: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const secret = configuredSecret(environment);
  if (!bookPreparationPreviewEnabled(environment) || !secret) return null;
  const ticket = unseal<PreviewBootstrapTicket>(token, secret);
  if (
    ticket?.version !== EXCHANGE_VERSION ||
    ticket.audience !== EXCHANGE_AUDIENCE ||
    ticket.role !== 'educator' ||
    typeof ticket.subject !== 'string' ||
    !SUBJECT_PATTERN.test(ticket.subject) ||
    typeof ticket.nonce !== 'string' ||
    !NONCE_PATTERN.test(ticket.nonce) ||
    !Number.isSafeInteger(ticket.issuedAt) ||
    !Number.isSafeInteger(ticket.expiresAt) ||
    (ticket.issuedAt as number) > now + 5_000 ||
    (ticket.expiresAt as number) <= now ||
    (ticket.expiresAt as number) - (ticket.issuedAt as number) !==
      EXCHANGE_TTL_MS
  ) {
    return null;
  }
  pruneExpired(now);
  const hash = tokenHash(token);
  const current = state();
  if (current.consumedTickets.has(hash)) return null;
  current.consumedTickets.set(hash, ticket.expiresAt as number);
  return { subject: ticket.subject, role: ticket.role } as const;
}

export function issueBookPreparationPreviewIdentity(
  subject: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const secret = configuredSecret(environment);
  if (
    !bookPreparationPreviewEnabled(environment) ||
    !secret ||
    !SUBJECT_PATTERN.test(subject) ||
    !Number.isSafeInteger(now)
  ) {
    throw new Error('book_preview_identity_configuration_invalid');
  }
  pruneExpired(now);
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = now + SESSION_TTL_MS;
  state().activeSessions.set(tokenHash(sessionId), { subject, expiresAt });
  return seal(
    {
      version: SESSION_VERSION,
      audience: SESSION_AUDIENCE,
      role: 'educator',
      subject,
      sessionId,
      issuedAt: now,
      expiresAt,
    } satisfies PreviewEducatorSession,
    secret,
  );
}

function verifiedSession(
  token: string,
  now: number,
  environment: NodeJS.ProcessEnv,
) {
  const secret = configuredSecret(environment);
  if (!bookPreparationPreviewEnabled(environment) || !secret) return null;
  const identity = unseal<PreviewEducatorSession>(token, secret);
  if (
    identity?.version !== SESSION_VERSION ||
    identity.audience !== SESSION_AUDIENCE ||
    identity.role !== 'educator' ||
    typeof identity.subject !== 'string' ||
    !SUBJECT_PATTERN.test(identity.subject) ||
    typeof identity.sessionId !== 'string' ||
    !NONCE_PATTERN.test(identity.sessionId) ||
    !Number.isSafeInteger(identity.issuedAt) ||
    !Number.isSafeInteger(identity.expiresAt) ||
    (identity.issuedAt as number) > now + 5_000 ||
    (identity.expiresAt as number) <= now ||
    (identity.expiresAt as number) - (identity.issuedAt as number) !==
      SESSION_TTL_MS
  ) {
    return null;
  }
  pruneExpired(now);
  const record = state().activeSessions.get(tokenHash(identity.sessionId));
  if (
    !record ||
    record.subject !== identity.subject ||
    record.expiresAt !== identity.expiresAt
  ) {
    return null;
  }
  return identity as PreviewEducatorSession;
}

export function verifyBookPreparationPreviewIdentity(
  token: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const identity = verifiedSession(token, now, environment);
  return identity
    ? ({ subject: identity.subject, role: identity.role } as const)
    : null;
}

export function revokeBookPreparationPreviewIdentity(
  token: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const identity = verifiedSession(token, now, environment);
  if (!identity) return false;
  return state().activeSessions.delete(tokenHash(identity.sessionId));
}

export function readBookPreparationPreviewCookie(request: Request) {
  const pair = (request.headers.get('cookie') || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${BOOK_PREPARATION_PREVIEW_COOKIE}=`));
  if (!pair) return '';
  const encoded = pair.slice(BOOK_PREPARATION_PREVIEW_COOKIE.length + 1);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return '';
  }
}

export function bookPreparationPreviewCookie(value: string, maxAge: number) {
  return [
    `${BOOK_PREPARATION_PREVIEW_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(maxAge === 0 ? ['Expires=Thu, 01 Jan 1970 00:00:00 GMT'] : []),
  ].join('; ');
}
