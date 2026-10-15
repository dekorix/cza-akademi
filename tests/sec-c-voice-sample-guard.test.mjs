import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('SEC-C voice sample guard suite', () => {
  const env = { ...process.env };
  // The parent runner sets NODE_TEST_CONTEXT. A nested `node --test` then
  // skips its files and exits 0, so CI would report this suite as passed
  // without executing it.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--test',
    'tests/helpers/sec-c-voice-sample-guard.suite.mjs',
  ], { encoding: 'utf8', env });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
  }
  assert.equal(result.status, 0);
});
