import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('the hand asset is exactly the user-approved September 5 PNG', () => {
  const asset = readFileSync(new URL('../public/assets/approved-reference.png', import.meta.url));
  assert.equal(createHash('sha256').update(asset).digest('hex'), '42119f3930ee0b1d7a7754b24af417510a55f446aa3ca5800adcd287c41c232a');
});
