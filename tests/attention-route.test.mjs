/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

const previousEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  preview: process.env.CZA_ATTENTION_ISOLATED_PREVIEW,
  secret: process.env.CZA_ATTENTION_SESSION_SECRET,
  databaseUrl: process.env.DATABASE_URL,
};

let route;
let vite;
let sequence = 0;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CZA_ATTENTION_ISOLATED_PREVIEW = 'true';
  process.env.CZA_ATTENTION_SESSION_SECRET = 'd'.repeat(64);
  delete process.env.DATABASE_URL;
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': process.cwd() } },
  });
  route = await vite.ssrLoadModule('/app/api/attention/session/route.ts');
});

after(async () => {
  await vite.close();
  for (const [name, value] of [
    ['NODE_ENV', previousEnvironment.nodeEnv],
    ['CZA_ATTENTION_ISOLATED_PREVIEW', previousEnvironment.preview],
    ['CZA_ATTENTION_SESSION_SECRET', previousEnvironment.secret],
    ['DATABASE_URL', previousEnvironment.databaseUrl],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function post(
  body,
  { cookie = '', includeOrigin = true } = {},
) {
  sequence += 1;
  const headers = new Headers({
    'content-type': 'application/json',
    'x-real-ip': `198.51.100.${(sequence % 200) + 1}`,
  });
  if (includeOrigin) headers.set('origin', 'http://attention.test');
  if (cookie) headers.set('cookie', cookie);
  const response = await route.POST(
    new Request('http://attention.test/api/attention/session', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

function responseCookie(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

test('route is hidden when preview is disabled or origin proof is missing', async () => {
  process.env.CZA_ATTENTION_ISOLATED_PREVIEW = 'false';
  const disabled = await post({
    action: 'start',
    exerciseId: 'stroop_conflict',
    levelId: 'foundation',
  });
  assert.equal(disabled.response.status, 404);
  assert.equal(disabled.body.error, 'not_found');
  process.env.CZA_ATTENTION_ISOLATED_PREVIEW = 'true';

  const noOrigin = await post(
    {
      action: 'start',
      exerciseId: 'stroop_conflict',
      levelId: 'foundation',
    },
    { includeOrigin: false },
  );
  assert.equal(noOrigin.response.status, 404);
});

test('strict root schema and streamed 16 KiB request limit reject unsafe input', async () => {
  const extraField = await post({
    action: 'start',
    exerciseId: 'stroop_conflict',
    levelId: 'foundation',
    serverVerified: true,
  });
  assert.equal(extraField.response.status, 400);
  assert.equal(extraField.body.error, 'attention_request_invalid');

  const oversized = await post(
    JSON.stringify({ action: 'start', padding: 'x'.repeat(17 * 1024) }),
  );
  assert.equal(oversized.response.status, 413);
});

test('start exchanges an isolated identity cookie and steps require it', async () => {
  const started = await post({
    action: 'start',
    exerciseId: 'stroop_conflict',
    levelId: 'foundation',
  });
  assert.equal(started.response.status, 200);
  assert.equal(typeof started.body.prepareToken, 'string');
  const cookie = responseCookie(started.response);
  assert.match(cookie, /^cza_attention_preview=/);
  assert.match(started.response.headers.get('set-cookie') || '', /HttpOnly/);
  assert.match(started.response.headers.get('set-cookie') || '', /SameSite=Strict/);

  const missingIdentity = await post({
    action: 'render',
    prepareToken: started.body.prepareToken,
  });
  assert.equal(missingIdentity.response.status, 401);
  assert.equal(missingIdentity.body.error, 'attention_auth_required');

  const rendered = await post(
    { action: 'render', prepareToken: started.body.prepareToken },
    { cookie },
  );
  assert.equal(rendered.response.status, 200);
  assert.equal(typeof rendered.body.responseToken, 'string');
});

test('prepare and response tokens are single-use at the HTTP boundary', async () => {
  const started = await post({
    action: 'start',
    exerciseId: 'visual_memory_matrix',
    levelId: 'foundation',
  });
  const cookie = responseCookie(started.response);
  const first = await post(
    { action: 'render', prepareToken: started.body.prepareToken },
    { cookie },
  );
  assert.equal(first.response.status, 200);

  const replay = await post(
    { action: 'render', prepareToken: started.body.prepareToken },
    { cookie },
  );
  assert.equal(replay.response.status, 429);
  assert.equal(replay.body.error, 'rate_limited');
});
