import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL('../lib/request-guard.ts', import.meta.url),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function loadGuard(databaseCalls) {
  const commonJsModule = { exports: {} };
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require', 'module', 'exports', js)(
    (id) => {
      if (id === 'node:crypto') return crypto;
      if (id === '@neondatabase/serverless') {
        return {
          neon: () => async (_strings, ...values) => {
            databaseCalls.push(values);
            return [{ allowed: true, retry_after_seconds: 0 }];
          },
        };
      }
      if (id.includes('trusted-client-address')) {
        return { trustedRequestAddress: () => '203.0.113.10' };
      }
      throw new Error(`unexpected import: ${id}`);
    },
    commonJsModule,
    commonJsModule.exports,
  );
  return commonJsModule.exports;
}

async function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('account limiter uses one global normalized key without an IP dimension', async () => {
  await withEnvironment(
    {
      DATABASE_URL: 'postgresql://test.invalid/cza',
      NODE_ENV: 'production',
    },
    async () => {
      const databaseCalls = [];
      const guard = loadGuard(databaseCalls);
      const first = await guard.allowAccountRequest(
        'educator-reset-request-account',
        3,
        30 * 60 * 1000,
        ' ACCOUNT-ID ',
      );
      const second = await guard.allowAccountRequest(
        'educator-reset-request-account',
        3,
        30 * 60 * 1000,
        'account-id',
      );
      const otherAccount = await guard.allowAccountRequest(
        'educator-reset-request-account',
        3,
        30 * 60 * 1000,
        'other-account',
      );

      assert.equal(first.allowed, true);
      assert.equal(second.allowed, true);
      assert.equal(otherAccount.allowed, true);
      assert.equal(databaseCalls.length, 3);
      assert.equal(databaseCalls[0][1], databaseCalls[1][1]);
      assert.notEqual(databaseCalls[0][1], databaseCalls[2][1]);
      assert.match(databaseCalls[0][1], /^[0-9a-f]{64}$/);
      assert.deepEqual(
        databaseCalls.map((values) => values[0]),
        Array(3).fill('educator-reset-request-account'),
      );
    },
  );
});

test('account limiter fails closed in production without central storage', async () => {
  await withEnvironment(
    { DATABASE_URL: undefined, NODE_ENV: 'production' },
    async () => {
      const guard = loadGuard([]);
      assert.deepEqual(
        await guard.allowAccountRequest(
          'educator-reset-request-account',
          3,
          30 * 60 * 1000,
          'account-id',
        ),
        {
          allowed: false,
          retryAfterSeconds: 30,
          unavailable: true,
        },
      );
    },
  );
});
