/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const previousEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  preview: process.env.CZA_FAST_READING_ISOLATED_PREVIEW,
  secret: process.env.CZA_FAST_READING_SESSION_SECRET,
};

let route;
let vite;
let requestSequence = 0;

before(async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.DATABASE_URL;
  process.env.CZA_FAST_READING_ISOLATED_PREVIEW = 'true';
  process.env.CZA_FAST_READING_SESSION_SECRET = 'b'.repeat(64);
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: {
      alias: { '@': process.cwd() },
      dedupe: ['react', 'react-dom'],
    },
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  });
  route = await vite.ssrLoadModule('/app/api/fast-reading/telemetry/route.ts');
});

after(async () => {
  await vite.close();
  for (const [name, value] of [
    ['NODE_ENV', previousEnvironment.nodeEnv],
    ['DATABASE_URL', previousEnvironment.databaseUrl],
    ['CZA_FAST_READING_ISOLATED_PREVIEW', previousEnvironment.preview],
    ['CZA_FAST_READING_SESSION_SECRET', previousEnvironment.secret],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function post(
  body,
  { cookie = '', includeOrigin = true, address = '' } = {},
) {
  requestSequence += 1;
  const headers = new Headers({
    'content-type': 'application/json',
    'x-real-ip': address || `198.51.100.${(requestSequence % 200) + 1}`,
  });
  if (includeOrigin) headers.set('origin', 'http://preview.test');
  if (cookie) headers.set('cookie', cookie);
  const response = await route.POST(
    new Request('http://preview.test/api/fast-reading/telemetry', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

async function start(exerciseId = 'tachistoscope') {
  const result = await post({
    action: 'start',
    exerciseId,
    levelId: 'starter',
    progressionToken: null,
  });
  assert.equal(result.response.status, 200);
  const cookie = cookieFrom(result.response);
  assert.match(cookie, /^cza_fast_reading_preview=/);
  return { ...result, cookie };
}

test('rendered setup disables both levels above the initial unlocked level', async () => {
  const { FastReadingWorkspace } = await vite.ssrLoadModule(
    '/components/fast-reading-workspace.tsx',
  );
  const html = renderToStaticMarkup(React.createElement(FastReadingWorkspace));
  const disabledLevels = [...html.matchAll(/<button[^>]+disabled=""[^>]*>/g)];
  assert.equal(disabledLevels.length, 2);
  assert.match(disabledLevels[0][0], /aria-label="Keşif — kilitli"/);
  assert.match(disabledLevels[1][0], /aria-label="Hızlanma — kilitli"/);
});

test('route requires same-origin and authenticated preview identity', async () => {
  const noOrigin = await post(
    { action: 'start', exerciseId: 'tachistoscope', levelId: 'starter' },
    { includeOrigin: false },
  );
  assert.equal(noOrigin.response.status, 403);
  assert.equal(noOrigin.body.error, 'request_origin_rejected');

  const unauthenticatedStep = await post({
    action: 'read',
    sessionToken: 'x'.repeat(80),
  });
  assert.equal(unauthenticatedStep.response.status, 401);
  assert.equal(unauthenticatedStep.body.error, 'fast_reading_auth_required');
});

test('route starts a signed session and rejects a replayed step token', async () => {
  const started = await start();
  assert.equal(typeof started.body.trial.phrase, 'string');
  assert.equal(typeof started.body.sessionToken, 'string');
  await new Promise((resolve) => setTimeout(resolve, 1_210));

  const read = await post(
    { action: 'read', sessionToken: started.body.sessionToken },
    { cookie: started.cookie },
  );
  assert.equal(read.response.status, 200);
  assert.equal(read.body.question.options.length, 3);

  const replay = await post(
    { action: 'read', sessionToken: started.body.sessionToken },
    { cookie: started.cookie },
  );
  assert.equal(replay.response.status, 429);
  assert.equal(replay.body.error, 'rate_limited');
});

test('server denies forged level access and classification shortcut', async () => {
  const forgedLevel = await post({
    action: 'start',
    exerciseId: 'tachistoscope',
    levelId: 'explorer',
    progressionToken: null,
  });
  assert.equal(forgedLevel.response.status, 403);
  assert.equal(forgedLevel.body.error, 'fast_reading_level_locked');

  const focus = await start('focus_expansion');
  const shortcut = await post(
    {
      action: 'classify',
      moduleId: 'fast_reading_core',
      moduleVersion: '0.5.0-preview',
      exerciseId: 'tachistoscope',
      levelId: 'starter',
      progressionToken: null,
      metrics: {
        durationMs: 5_000,
        correctResponses: 5,
        incorrectResponses: 0,
        totalResponses: 5,
        comprehensionPercent: 100,
      },
    },
    { cookie: focus.cookie },
  );
  assert.equal(shortcut.response.status, 400);
  assert.equal(
    shortcut.body.error,
    'fast_reading_tachistoscope_session_required',
  );
});

test('route starts the next phrase lazily and rejects an immediate read', async () => {
  const started = await start();
  await new Promise((resolve) => setTimeout(resolve, 1_210));
  const read = await post(
    { action: 'read', sessionToken: started.body.sessionToken },
    { cookie: started.cookie },
  );
  assert.equal(read.response.status, 200);
  const answer = await post(
    {
      action: 'answer',
      sessionToken: read.body.sessionToken,
      selectedOptionIndex: 0,
    },
    { cookie: started.cookie },
  );
  assert.equal(answer.response.status, 200);
  assert.equal(typeof answer.body.prepareToken, 'string');
  assert.equal(Object.hasOwn(answer.body, 'nextTrial'), false);
  assert.equal(Object.hasOwn(answer.body, 'sessionToken'), false);

  const phraseStart = await post(
    { action: 'phrase-start', prepareToken: answer.body.prepareToken },
    { cookie: started.cookie },
  );
  assert.equal(phraseStart.response.status, 200);
  assert.equal(phraseStart.body.trial.position, 2);

  const prepareReplay = await post(
    { action: 'phrase-start', prepareToken: answer.body.prepareToken },
    { cookie: started.cookie },
  );
  assert.equal(prepareReplay.response.status, 429);
  assert.equal(prepareReplay.body.error, 'rate_limited');

  const earlyRead = await post(
    { action: 'read', sessionToken: phraseStart.body.sessionToken },
    { cookie: started.cookie },
  );
  assert.equal(earlyRead.response.status, 400);
  assert.equal(earlyRead.body.error, 'fast_reading_duration_invalid');
});

test('route rejects extra root fields and oversized streamed JSON', async () => {
  const strictRoot = await post({
    action: 'start',
    exerciseId: 'tachistoscope',
    levelId: 'starter',
    admin: true,
  });
  assert.equal(strictRoot.response.status, 400);
  assert.equal(strictRoot.body.error, 'fast_reading_request_invalid');

  const oversized = await post(
    JSON.stringify({
      action: 'start',
      exerciseId: 'tachistoscope',
      levelId: 'starter',
      padding: 'x'.repeat(17 * 1024),
    }),
  );
  assert.equal(oversized.response.status, 413);
  assert.equal(oversized.body.error, 'request_too_large');
});

test('endpoint rate limit rejects the 121st request from one address', async () => {
  const address = '203.0.113.250';
  for (let index = 0; index < 120; index += 1) {
    const allowed = await post(
      {
        action: 'start',
        exerciseId: 'focus_expansion',
        levelId: 'starter',
      },
      { address },
    );
    assert.equal(allowed.response.status, 200);
  }
  const rejected = await post(
    {
      action: 'start',
      exerciseId: 'focus_expansion',
      levelId: 'starter',
    },
    { address },
  );
  assert.equal(rejected.response.status, 429);
  assert.equal(rejected.body.error, 'rate_limited');
});

test('production endpoint fails closed without trusted edge and central limiter', async () => {
  process.env.NODE_ENV = 'production';
  try {
    const rejected = await post({
      action: 'start',
      exerciseId: 'focus_expansion',
      levelId: 'starter',
    });
    assert.equal(rejected.response.status, 503);
    assert.equal(rejected.body.error, 'rate_limit_unavailable');
  } finally {
    process.env.NODE_ENV = 'test';
  }
});
