/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLOWED_ORIGIN,
  assertCredentialFreeEnvironment,
  assertLocalTestRequest,
  createChildEnvironment,
  startStudioServer,
} from './k3a-studio-harness.mjs';

test('child environment uses an explicit credential-free allowlist', () => {
  const environment = createChildEnvironment({
    PATH:'/safe/bin', TMPDIR:'/safe/tmp', DATABASE_URL:'postgres://production',
    VERCEL_TOKEN:'token', OPENAI_API_KEY:'key', APP_SECRET:'secret', PASSWORD:'password',
  });
  assert.deepEqual(environment, {
    NODE_ENV:'test', NO_PROXY:'127.0.0.1,localhost', PATH:'/safe/bin', TMPDIR:'/safe/tmp',
  });
  assert.throws(() => assertCredentialFreeEnvironment({ PATH:'/safe/bin', API_KEY:'forbidden' }), /K3A_FORBIDDEN_CHILD_ENV:API_KEY/);
});

test('network policy permits only the exact localhost test origin', () => {
  assert.equal(assertLocalTestRequest(`${ALLOWED_ORIGIN}/studio`).origin, ALLOWED_ORIGIN);
  assert.equal(assertLocalTestRequest(`${ALLOWED_ORIGIN}/api/core`).pathname, '/api/core');
  for (const url of ['http://example.com', 'https://example.com', 'http://localhost:4213', 'http://127.0.0.1:4214']) {
    assert.throws(() => assertLocalTestRequest(url), /K3A_EXTERNAL_NETWORK_DENIED/);
  }
});

test('startup timeout terminates the child process before rejecting', async () => {
  let child;
  await assert.rejects(
    startStudioServer({
      args:['-e', 'setInterval(() => {}, 1000)'], timeoutMs:50, onSpawn:spawned => { child = spawned; },
    }),
    /K3A_STUDIO_SERVER_TIMEOUT/,
  );
  assert.ok(child);
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'timed-out child must be terminated');
});
