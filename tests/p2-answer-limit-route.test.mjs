/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { ANSWER_BYTE_LIMIT } from '../apps/assessment-appdeploy/backend/answerIntegrity.ts';
import { issueChildAccess } from '../apps/assessment-appdeploy/backend/childAccess.ts';

register(new URL('./appdeploy-sdk-hook.mjs', import.meta.url), {
  parentURL: import.meta.url,
});

const sdk = await import('./appdeploy-sdk-mock.mjs');
const backend = await import('../apps/assessment-appdeploy/backend/index.ts');

function session() {
  const access = issueChildAccess();
  return {
    authorization: 'Bearer ' + access.secret,
    record: {
      id: 'session-limit',
      studentLabel: 'Sentetik',
      status: 'active',
      startStation: 'FULL',
      currentTaskId: 'W1',
      attempts: [{ taskId: 'kept', title: 'Önceki', answer: 'aynı kayıt', correctness: 'review', responseLatencyMs: null, totalResponseMs: null, supportLevel: 0 }],
      observations: [],
      createdAt: '2026-10-15T00:00:00.000Z',
      profileCode: 'P2',
      childAccessTokenHash: access.childAccessTokenHash,
      childAccessExpiresAt: access.childAccessExpiresAt,
    },
  };
}

function postAnswer(fixture, answer) {
  sdk.db.session = fixture.record;
  return backend.handler({
    method: 'POST',
    path: '/api/session/' + fixture.record.id + '/answer',
    headers: { authorization: fixture.authorization },
    body: { answer },
  });
}

test('POST /api/session/:id/answer returns 413 and does not write when the body exceeds 16 KB', async () => {
  const fixture = session();
  const before = structuredClone(fixture.record);
  sdk.dbCalls.update = 0;
  sdk.dbCalls.records = [];
  const raw = 'ğ'.repeat(ANSWER_BYTE_LIMIT / 2) + 'x';
  assert.equal(Buffer.byteLength(raw), ANSWER_BYTE_LIMIT + 1);
  const response = await postAnswer(fixture, raw);
  assert.equal(response.statusCode, 413);
  assert.match(response.body, /16 KB/);
  assert.equal(sdk.dbCalls.update, 0);
  assert.deepEqual(sdk.dbCalls.records, []);
  assert.deepEqual(fixture.record, before);
});

test('POST /api/session/:id/answer still stores a raw answer on the 16 KB boundary', async () => {
  const fixture = session();
  sdk.dbCalls.update = 0;
  sdk.dbCalls.records = [];
  const raw = 'a'.repeat(ANSWER_BYTE_LIMIT);
  const response = await postAnswer(fixture, raw);
  assert.equal(response.statusCode, 200);
  assert.equal(sdk.dbCalls.update, 1);
  const written = sdk.dbCalls.records[0].rows[0].record;
  assert.equal(written.attempts.at(-1).answer, raw);
  assert.equal(written.attempts[0].answer, 'aynı kayıt');
});
