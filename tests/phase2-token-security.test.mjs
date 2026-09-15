/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

const previousEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  attentionPreview: process.env.CZA_ATTENTION_ISOLATED_PREVIEW,
  attentionSecret: process.env.CZA_ATTENTION_SESSION_SECRET,
  readingPreview: process.env.CZA_FAST_READING_ISOLATED_PREVIEW,
  readingSecret: process.env.CZA_FAST_READING_SESSION_SECRET,
  bookPreview: process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW,
  bookSecret: process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET,
};

const environment = {
  NODE_ENV: 'test',
  CZA_ATTENTION_ISOLATED_PREVIEW: 'true',
  CZA_ATTENTION_SESSION_SECRET: '1'.repeat(64),
  CZA_FAST_READING_ISOLATED_PREVIEW: 'true',
  CZA_FAST_READING_SESSION_SECRET: '2'.repeat(64),
  CZA_BOOK_PREPARATION_ISOLATED_PREVIEW: 'true',
  CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET: '3'.repeat(64),
};

let attention;
let attentionRoute;
let fastReading;
let bookAuth;
let vite;
let addressSequence = 0;

function mutateSegment(token, index) {
  const parts = token.split('.');
  assert.ok(parts[index]);
  const first = parts[index][0];
  parts[index] = `${first === 'A' ? 'B' : 'A'}${parts[index].slice(1)}`;
  return parts.join('.');
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

async function postAttention(body, cookie = '') {
  addressSequence += 1;
  const headers = new Headers({
    origin: 'http://phase2.test',
    'content-type': 'application/json',
    'x-real-ip': `203.0.113.${(addressSequence % 200) + 1}`,
  });
  if (cookie) headers.set('cookie', cookie);
  const response = await attentionRoute.POST(
    new Request('http://phase2.test/api/attention/session', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

before(async () => {
  process.env.NODE_ENV = environment.NODE_ENV;
  process.env.CZA_ATTENTION_ISOLATED_PREVIEW =
    environment.CZA_ATTENTION_ISOLATED_PREVIEW;
  process.env.CZA_ATTENTION_SESSION_SECRET =
    environment.CZA_ATTENTION_SESSION_SECRET;
  process.env.CZA_FAST_READING_ISOLATED_PREVIEW =
    environment.CZA_FAST_READING_ISOLATED_PREVIEW;
  process.env.CZA_FAST_READING_SESSION_SECRET =
    environment.CZA_FAST_READING_SESSION_SECRET;
  process.env.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW =
    environment.CZA_BOOK_PREPARATION_ISOLATED_PREVIEW;
  process.env.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET =
    environment.CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET;
  delete process.env.DATABASE_URL;

  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': process.cwd() } },
  });
  [attention, attentionRoute, fastReading, bookAuth] = await Promise.all([
    vite.ssrLoadModule('/lib/attention-session-server.ts'),
    vite.ssrLoadModule('/app/api/attention/session/route.ts'),
    vite.ssrLoadModule('/lib/fast-reading-session-server.ts'),
    vite.ssrLoadModule('/lib/book-preparation-preview-auth.ts'),
  ]);
});

after(async () => {
  await vite.close();
  for (const [name, value] of [
    ['NODE_ENV', previousEnvironment.nodeEnv],
    ['DATABASE_URL', previousEnvironment.databaseUrl],
    ['CZA_ATTENTION_ISOLATED_PREVIEW', previousEnvironment.attentionPreview],
    ['CZA_ATTENTION_SESSION_SECRET', previousEnvironment.attentionSecret],
    ['CZA_FAST_READING_ISOLATED_PREVIEW', previousEnvironment.readingPreview],
    ['CZA_FAST_READING_SESSION_SECRET', previousEnvironment.readingSecret],
    [
      'CZA_BOOK_PREPARATION_ISOLATED_PREVIEW',
      previousEnvironment.bookPreview,
    ],
    [
      'CZA_BOOK_PREPARATION_PREVIEW_HMAC_SECRET',
      previousEnvironment.bookSecret,
    ],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('attention response tokens are single-use at the real route boundary', async () => {
  const started = await postAttention({
    action: 'start',
    exerciseId: 'stroop_conflict',
    levelId: 'foundation',
  });
  const cookie = cookieFrom(started.response);
  const rendered = await postAttention(
    { action: 'render', prepareToken: started.body.prepareToken },
    cookie,
  );
  await new Promise((resolveWait) => setTimeout(resolveWait, 130));
  const responseBody = {
    action: 'response',
    responseToken: rendered.body.responseToken,
    answer: rendered.body.stimulus.ink,
  };
  const accepted = await postAttention(responseBody, cookie);
  assert.equal(accepted.response.status, 200);

  const replay = await postAttention(responseBody, cookie);
  assert.equal(replay.response.status, 429);
  assert.equal(replay.body.error, 'rate_limited');
});

test('AES-GCM tag and ciphertext mutations are rejected before scoring', () => {
  const subject = 'attention-preview:gcm-test';
  const started = attention.startAttentionSession(
    subject,
    'stroop_conflict',
    'foundation',
    10_000,
    environment,
  );
  for (const segment of [1, 2]) {
    assert.throws(
      () =>
        attention.renderAttentionTrial(
          mutateSegment(started.prepareToken, segment),
          subject,
          11_000,
          environment,
        ),
      (error) =>
        error.code === 'attention_session_invalid' && error.status === 401,
    );
  }

  const rendered = attention.renderAttentionTrial(
    started.prepareToken,
    subject,
    11_000,
    environment,
  );
  for (const segment of [1, 2]) {
    assert.throws(
      () =>
        attention.submitAttentionResponse(
          mutateSegment(rendered.responseToken, segment),
          subject,
          rendered.stimulus.ink,
          11_120,
          environment,
        ),
      (error) =>
        error.code === 'attention_session_invalid' && error.status === 401,
    );
  }
});

test('an identity from another browser cannot spend a leaked attention token', async () => {
  const owner = await postAttention({
    action: 'start',
    exerciseId: 'stroop_conflict',
    levelId: 'foundation',
  });
  const stranger = await postAttention({
    action: 'start',
    exerciseId: 'stroop_conflict',
    levelId: 'foundation',
  });
  const stolen = await postAttention(
    { action: 'render', prepareToken: owner.body.prepareToken },
    cookieFrom(stranger.response),
  );
  assert.equal(stolen.response.status, 401);
  assert.equal(stolen.body.error, 'attention_session_invalid');
});

test('Fast Reading encrypted state is also tamper-evident and subject-bound', () => {
  const owner = 'preview:11111111111111111111111111111111';
  const started = fastReading.startTachistoscopeSession(
    owner,
    'starter',
    null,
    10_000,
    environment,
  );
  assert.throws(
    () =>
      fastReading.finishReadingTrial(
        mutateSegment(started.sessionToken, 1),
        owner,
        11_200,
        environment,
      ),
    (error) =>
      error.code === 'fast_reading_session_invalid' && error.status === 401,
  );
  assert.throws(
    () =>
      fastReading.finishReadingTrial(
        started.sessionToken,
        'preview:22222222222222222222222222222222',
        11_200,
        environment,
      ),
    (error) =>
      error.code === 'fast_reading_session_invalid' && error.status === 401,
  );
});

test('preview credentials cannot cross module or ticket/session audiences', () => {
  const bookSession = bookAuth.issueBookPreparationPreviewIdentity(
    'educator-preview:phase2-owner',
    100_000,
    environment,
  );
  const bookTicket = bookAuth.issueBookPreparationBootstrapTicket(
    'educator-preview:phase2-owner',
    100_000,
    environment,
  );
  const attentionIdentity = attention.issueAttentionPreviewIdentity(
    100_000,
    environment,
  );
  const readingIdentity = fastReading.issuePreviewIdentity(100_000, environment);

  assert.equal(
    bookAuth.verifyBookPreparationPreviewIdentity(
      bookTicket,
      100_100,
      environment,
    ),
    null,
  );
  assert.equal(
    bookAuth.consumeBookPreparationBootstrapTicket(
      bookSession,
      100_100,
      environment,
    ),
    null,
  );
  assert.equal(
    attention.verifyAttentionPreviewIdentity(
      bookSession,
      100_100,
      environment,
    ),
    null,
  );
  assert.equal(
    bookAuth.verifyBookPreparationPreviewIdentity(
      attentionIdentity,
      100_100,
      environment,
    ),
    null,
  );
  assert.equal(
    attention.verifyAttentionPreviewIdentity(
      readingIdentity,
      100_100,
      environment,
    ),
    null,
  );
});
