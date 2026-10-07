import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { trustedEducatorHeaders } from '../scripts/qa/trusted-educator-transport.mjs';

test('isolated QA transport satisfies real proxy verification; body tamper and replay remain denied', async () => {
  const prior = process.env.CZA_TRUSTED_PROXY_HMAC_SECRET;
  const secret = crypto.randomBytes(48).toString('hex');
  process.env.CZA_TRUSTED_PROXY_HMAC_SECRET = secret;
  try {
    const consumed = new Set();
    const source = readFileSync(new URL('../lib/educator-auth.ts', import.meta.url), 'utf8');
    const exports = {};
    const logs = [];
    const environment = { CZA_TRUSTED_PROXY_HMAC_SECRET: secret, DATABASE_URL: 'isolated' };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, process: { env: environment }, console: { error: (...args) => logs.push(args) },
      Buffer, Request, Headers, URL, AbortController, setTimeout, clearTimeout,
      require: id => {
        if (id === 'node:crypto') return crypto;
        if (id === '@neondatabase/serverless') return { neon: () => async (_parts, nonceHash) => {
          const allowed = !consumed.has(nonceHash); consumed.add(nonceHash);
          return [{ consumed: allowed }];
        } };
        if (id.endsWith('educator-request-security')) return { requestBodySha256: async request => crypto.createHash('sha256').update(await request.clone().text()).digest('hex') };
        if (id.endsWith('educator-neon-ingress')) return {};
        throw new Error('unexpected production dependency');
      },
    });
    const url = 'http://127.0.0.1:8787/api/educator-report';
    const body = JSON.stringify({ studentId: 'isolated-student' });
    const headers = trustedEducatorHeaders('POST', url, body);
    assert.match(headers['x-real-ip'], /^127\.\d+\.\d+\.\d+$/);
    assert.equal(trustedEducatorHeaders('POST',url,body)['x-real-ip'],headers['x-real-ip']);
    const request = payload => new Request(url, { method: 'POST', headers, body: payload });
    assert.equal(await exports.trustedEducatorProxy(request(body + ' ')), null);
    assert.equal(consumed.size, 0);
    assert.ok(await exports.trustedEducatorProxy(request(body)));
    assert.equal(await exports.trustedEducatorProxy(request(body)), null);
    assert.equal(logs.length, 0);
    environment.CZA_QA_PROXY_DIAGNOSTICS = '1';
    assert.equal(await exports.trustedEducatorProxy(request(body)), null);
    assert.deepEqual(logs, [['CZA_QA_PROXY_DENY=nonce_rejected']]);
    assert.equal(JSON.stringify(logs).includes(secret), false);
    await exports.trustedEducatorProxy(new Request('https://cza.example.invalid/api/educator-report', { method: 'POST', headers, body: body + ' ' }));
    assert.equal(logs.length, 1);
    assert.throws(() => trustedEducatorHeaders('GET', 'https://cza-akademi-staging.cza-staging-habip.workers.dev/api/educator-auth'), /isolated_loopback/);
    assert.throws(() => trustedEducatorHeaders('GET', 'http://localhost:8787/api/educator-auth'), /isolated_loopback/);
  } finally {
    if (prior === undefined) delete process.env.CZA_TRUSTED_PROXY_HMAC_SECRET;
    else process.env.CZA_TRUSTED_PROXY_HMAC_SECRET = prior;
  }
});

test('staging preflight rejects unmapped, wrong-role and inactive identities before writes', async () => {
  const { verifyTrustedEducatorBackend } = await import('../scripts/qa/trusted-educator-transport.mjs');
  for (const [rows, reason] of [
    [[], 'mapping_missing_or_ambiguous'],
    [[{ role: 'student', is_active: true, has_academy: true }], 'role_mismatch'],
    [[{ role: 'educator', is_active: false, has_academy: true }], 'inactive_or_unscoped'],
  ]) {
    let calls = 0;
    await assert.rejects(verifyTrustedEducatorBackend(async () => { calls++; return rows; }), new RegExp(reason));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await verifyTrustedEducatorBackend(async () => [
    [{ role: 'educator', is_active: true, has_academy: true }],
    [{ nonce_function: 'installed' }], [{ can_execute: true }],
  ][calls++]);
  assert.equal(calls, 3);
});
