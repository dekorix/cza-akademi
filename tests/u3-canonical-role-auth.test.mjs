/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function loadRoute(relativePath) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const queries = [];
  const commonJsModule = { exports: {} };
  // A canonical student role is rejected by authenticatedEducator before route data access.
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route harness
  new Function('require', 'module', 'exports', 'process', js)(
    (id) => {
      if (id.includes('educator-auth')) return { authenticatedEducator: async () => null };
      if (id.includes('request-guard')) return { allowRequest: async () => ({ allowed: true }) };
      if (id === '@neondatabase/serverless') {
        return {
          neon: () => async (strings, ...values) => {
            queries.push({ sql: strings.join('?'), values });
            return [{ id: 'must-not-be-returned' }];
          },
        };
      }
      throw new Error(`unexpected import: ${id}`);
    },
    commonJsModule,
    commonJsModule.exports,
    { env: { DATABASE_URL: 'test-only' } },
  );
  return { get: commonJsModule.exports.GET, queries };
}

test('student role with an existing teacher link cannot read educator routes', async () => {
  const list = loadRoute('../app/api/educator-students/route.ts');
  const detail = loadRoute('../app/api/educator-student-detail/route.ts');

  const listResponse = await list.get(new Request('https://cza.test/api/educator-students'));
  const detailResponse = await detail.get(new Request(
    'https://cza.test/api/educator-student-detail?studentId=d3000000-0000-4000-8000-000000000006',
  ));

  assert.equal(listResponse.status, 401);
  assert.equal(detailResponse.status, 401);
  assert.deepEqual(await listResponse.json(), { ok: false, error: 'educator_session_required' });
  assert.deepEqual(await detailResponse.json(), { ok: false, error: 'educator_session_required' });
  assert.equal(list.queries.length, 0);
  assert.equal(detail.queries.length, 0);
});
