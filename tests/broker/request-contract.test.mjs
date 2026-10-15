import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../../lib/qa-educator-broker-protocol.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const holder = { exports: {} };
// oxlint-disable-next-line typescript/no-implied-eval -- isolated protocol harness, no remote import
new Function('require', 'module', 'exports', js)((id) => { throw new Error(id); }, holder, holder.exports);
const protocol = holder.exports;

const student = '60000000-0000-4000-8000-000000000002';
const other = '60000000-0000-4000-8000-000000000099';
const academy = '60000000-0000-4000-8000-000000000001';
const educator = '60000000-0000-4000-8000-000000000200';
const filters = { from: null, to: null, moduleCode: null, eventType: null, verificationStatus: null };
const secret = crypto.randomBytes(32).toString('base64url');
const expected = { studentId: student, academyId: academy };
const observed = { method: 'POST', path: '/history' };

function seal(overrides = {}) {
  return protocol.sealBrokerRequest(secret, {
    subject: educator, studentId: student, academyId: academy, ts: Date.now(),
    filters, cursor: null, limit: 20, ...overrides,
  }).then((body) => JSON.parse(body));
}
function countingLedger() {
  const inner = protocol.createMemoryNonceLedger();
  const calls = [];
  return {
    calls,
    ledger: { consume: async (nonce, expireAtMs) => { calls.push(nonce); return inner.consume(nonce, expireAtMs); } },
  };
}
async function fails(body, status) {
  const seen = countingLedger();
  await assert.rejects(
    () => protocol.authenticateBrokerRequest(secret, body, observed, expected, seen.ledger),
    (error) => error instanceof protocol.BrokerError && error.status === status && error.message === 'broker_request_failed',
  );
  return seen.calls.length;
}

test('signed ingress request returns only the signed subject and student', async () => {
  const seen = countingLedger();
  const read = await protocol.authenticateBrokerRequest(secret, await seal(), observed, expected, seen.ledger);
  assert.equal(read.subject, educator);
  assert.equal(read.studentId, student);
  assert.equal(read.filters.moduleCode, null);
  assert.equal(seen.calls.length, 1);
});

test('negative invalid signature', async () => {
  const body = await seal();
  body.sig = (body.sig[0] === 'A' ? 'B' : 'A') + body.sig.slice(1);
  assert.equal(await fails(body, 401), 0);
});

test('negative stale timestamp', async () => {
  assert.equal(await fails(await seal({ ts: Date.now() - 6000 }), 401), 0);
});

test('negative future timestamp', async () => {
  assert.equal(await fails(await seal({ ts: Date.now() + 5000 }), 401), 0);
});

test('negative reused nonce', async () => {
  const seen = countingLedger();
  const body = await seal();
  const read = await protocol.authenticateBrokerRequest(secret, body, observed, expected, seen.ledger);
  assert.equal(read.studentId, student);
  await assert.rejects(
    () => protocol.authenticateBrokerRequest(secret, body, observed, expected, seen.ledger),
    (error) => error instanceof protocol.BrokerError && error.status === 401,
  );
  assert.equal(seen.calls.length, 2);
});

test('negative different studentId than the signed claim', async () => {
  assert.equal(await fails(await seal({ readStudentId: other }), 403), 0);
});

test('negative tampered subject', async () => {
  const body = await seal();
  body.subject = '60000000-0000-4000-8000-000000000201';
  assert.equal(await fails(body, 401), 0);
});

test('negative tampered body', async () => {
  const body = await seal();
  body.read.filters.moduleCode = 'other';
  assert.equal(await fails(body, 401), 0);
});

test('negative signed student outside the broker binding', async () => {
  assert.equal(await fails(await seal({ studentId: other, readStudentId: other }), 403), 0);
});

test('short hmac material fails closed before a read', async () => {
  await assert.rejects(
    () => protocol.sealBrokerRequest('REVIEW_PLACEHOLDER', {
      subject: educator, studentId: student, academyId: academy, ts: Date.now(), filters, cursor: null, limit: 20,
    }),
    (error) => error instanceof protocol.BrokerError && error.status === 503,
  );
});
