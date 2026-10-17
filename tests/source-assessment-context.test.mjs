import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceAssessmentContextHandler } from '../lib/source-assessment-context.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const student = { id, academyId: 'academy-a', name: 'Sentetik öğrenci', birthDate: null };
function handler(overrides = {}) {
  return createSourceAssessmentContextHandler({
    authenticateStudent: async () => ({ student_id: id, academy_id: 'academy-a' }),
    authenticateEducator: async () => ({ id: 'educator-a' }),
    findStudent: async () => student,
    findLinkedStudent: async () => student,
    ...overrides,
  });
}
const request = query => new Request(`https://cza.test/api/source-assessment-context?${query}`);

test('student and linked educator resolve the same canonical identity without starting a replacement engine', async () => {
  const get = handler();
  const a = await get(request('actor=student'));
  const b = await get(request(`actor=educator&studentId=${id}`));
  const x = await a.json(), y = await b.json();
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.deepEqual(x.student, y.student);
  assert.equal(x.sourceAppId, 'cza-degerlendirme-hl4a5d');
  assert.equal(x.capabilities.originalSessionBridgeReady, false);
  assert.equal(a.headers.get('cache-control'), 'no-store');
});
test('student cannot choose another student or tenant', async () => {
  assert.equal((await handler()(request(`actor=student&studentId=${other}`))).status, 403);
  assert.equal((await handler({ findStudent: async () => ({ ...student, academyId: 'academy-b' }) })(request('actor=student'))).status, 403);
});
test('missing student or educator authentication fails closed', async () => {
  assert.equal((await handler({ authenticateStudent: async () => null })(request('actor=student'))).status, 401);
  assert.equal((await handler({ authenticateEducator: async () => null })(request(`actor=educator&studentId=${id}`))).status, 401);
});
test('educator cannot view an unlinked student', async () => {
  assert.equal((await handler({ findLinkedStudent: async () => null })(request(`actor=educator&studentId=${id}`))).status, 403);
});
test('invalid actor and educator target are rejected before database resolution', async () => {
  const get = handler({ findLinkedStudent: async () => { assert.fail('must not query invalid ID'); } });
  assert.equal((await get(request('actor=parent'))).status, 400);
  assert.equal((await get(request('actor=educator&studentId=bad'))).status, 400);
});
test('database/auth failures return a controlled response without leaking details', async () => {
  const response = await handler({ findStudent: async () => { throw new Error('sensitive runtime details'); } })(request('actor=student'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'assessment_identity_unavailable' });
});
