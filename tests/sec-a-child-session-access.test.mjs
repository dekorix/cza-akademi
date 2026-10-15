import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('SEC-A child session access suite', () => {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--test',
    'tests/helpers/sec-a-child-session-access.suite.mjs',
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
  }
  assert.equal(result.status, 0);
});
