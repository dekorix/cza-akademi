import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../app/api/educator-students/route.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function route({ user = null, rows = [], fail = false } = {}) {
  const queries = [];
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', js)(id => {
    if (id.includes('educator-auth')) return { authenticatedEducator: async () => user };
    if (id.includes('request-guard')) return { allowRequest: () => ({ allowed: true }) };
    if (id === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
      queries.push({ sql: strings.join('?'), values });
      if (fail) throw new Error('database internal details');
      return rows;
    } };
    throw new Error(id);
  }, module, module.exports, { env: { DATABASE_URL: 'test-only' } });
  return { get: module.exports.GET, queries };
}
test('anonymous list access is rejected before querying data', async () => {
  const api = route();
  assert.equal((await api.get(new Request('https://cza.test/api/educator-students'))).status, 401);
  assert.equal(api.queries.length, 0);
});
test('listing uses authenticated educator identity and caps each page', async t => {
  const api = route({ user: { id: 'teacher-a' }, rows: Array.from({ length: 51 }, (_, id) => ({ id })) });
  const response = await api.get(new Request('https://cza.test/api/educator-students?page=2&teacherId=other'));
  const data = await response.json();
  assert.equal(data.students.length, 50); assert.equal(data.hasMore, true);
  assert.deepEqual(api.queries[0].values, ['teacher-a', 100]);
  assert.match(api.queries[0].sql, /l.can_view = true/);
  assert.match(api.queries[0].sql, /t.is_active = true/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('invalid page does not query and database failure does not expose internals', async t => {
  const api = route({ user: { id: 'teacher-a' }, fail: true });
  assert.equal((await api.get(new Request('https://cza.test/api/educator-students?page=-1'))).status, 400);
  assert.equal(api.queries.length, 0);
  const response = await api.get(new Request('https://cza.test/api/educator-students'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'student_list_unavailable' });
});
