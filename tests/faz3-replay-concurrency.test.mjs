import assert from 'node:assert/strict';
import test from 'node:test';
import { checkTimestamp, REPLAY_POLICY, validateReplayPolicy } from '../security/faz3/replay/replay-policy.mjs';

test('replay windows and exact boundaries are normative', () => {
  const policy = REPLAY_POLICY.staging;
  assert.equal(validateReplayPolicy(policy), true);
  assert.equal(checkTimestamp(1_000, 940, policy), 'ACCEPTABLE');
  assert.equal(checkTimestamp(1_000, 939, policy), 'SIGNATURE_TIME_INVALID');
  assert.equal(checkTimestamp(1_000, 1_005, policy), 'ACCEPTABLE');
  assert.equal(checkTimestamp(1_000, 1_006, policy), 'SIGNATURE_TIME_INVALID');
  assert.equal(checkTimestamp(1_081, 1_000, policy), 'SIGNATURE_TIME_INVALID');
});

test('concurrent atomic nonce consume admits exactly one request', async () => {
  const consumed = new Set();
  const atomicConsume = async nonce => {
    await new Promise(resolve => setImmediate(resolve));
    if (consumed.has(nonce)) return false;
    consumed.add(nonce);
    return true;
  };
  const results = await Promise.all(Array.from({ length: 64 }, () => atomicConsume('same-nonce')));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter(value => !value).length, 63);
});
