/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.resolve('wrangler/package.json'));
const { Miniflare } = require('miniflare');
const origin = 'https://cza-akademi-staging.cza-staging-habip.workers.dev';

test('actual ingress runs in Workers: login, session validation, redirect rejection and logout', async () => {
  const result = await build({
    stdin: {
      contents: `import {handleNeonEducatorAuth,verifiedNeonIdentity} from './lib/educator-neon-ingress.ts';
      export default {async fetch(r){return handleNeonEducatorAuth(r,await r.clone().json(),async request=>await verifiedNeonIdentity(request)?{id:'test-educator',email:'test@example.invalid',name:'Test'}:null)}}`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    define: {
      'process.env.CZA_EDUCATOR_AUTH_MODE': '"neon"',
      'process.env.CZA_NEON_AUTH_BASE_URL':
        '"https://ep-falling-resonance-b2qnvtwf.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth"',
    },
    plugins: [
      {
        name: 'isolated-rate-limit',
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/request-guard$/ }, () => ({
            path: 'guard',
            namespace: 'fixture',
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents:
              'export const allowRequest=async()=>({allowed:true}); export const allowAccountRequest=allowRequest; export const rateLimited=()=>new Response(null,{status:429});',
          }));
        },
      },
    ],
  });
  let redirect = false;
  const paths = [];
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'],
    script: result.outputFiles[0].text,
    outboundService: async (request) => {
      const path = new URL(request.url).pathname;
      paths.push(path);
      if (redirect)
        return new Response(null, {
          status: 307,
          headers: { location: 'https://must-not-follow.invalid/' },
        });
      if (path.endsWith('/sign-in/email'))
        return Response.json(
          { ok: true },
          {
            headers: {
              'set-cookie':
                '__Secure-neon-auth.session_token=test.signature; Secure; HttpOnly',
            },
          },
        );
      assert.equal(
        request.headers.get('cookie'),
        '__Secure-neon-auth.session_token=test.signature',
      );
      if (path.endsWith('/sign-out')) return Response.json({ ok: true });
      return Response.json({
        user: { id: 'test-educator' },
        session: {
          userId: 'test-educator',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      });
    },
  });
  try {
    const send = (action, cookie = '') =>
      mf.dispatchFetch(origin + '/api/educator-auth', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          action,
          email: 'test@example.invalid',
          password: 'isolated-test-password',
        }),
      });
    const login = await send('login');
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.id, 'test-educator');
    assert.match(login.headers.get('set-cookie'), /^__Host-cza_neon_educator=/);
    const logout = await send(
      'logout',
      '__Host-cza_neon_educator=test.signature',
    );
    assert.equal(logout.status, 200);
    redirect = true;
    const count = paths.length;
    const rejected = await send('login');
    assert.equal(rejected.status, 503);
    assert.equal((await rejected.json()).error, 'auth_unavailable');
    assert.equal(
      paths.length,
      count + 1,
      'redirect destination must never be fetched',
    );
  } finally {
    await mf.dispose();
  }
});

test('acceptance capture supports native and Puppeteer status without retaining secrets', async () => {
  const { safeAuthResponse } =
    await import('./helpers/f4-auth-response-evidence.mjs');
  const body = {
    ok: false,
    error: 'auth_unavailable',
    password: 'never-retain',
    token: 'never-retain',
  };
  for (const response of [
    Response.json(body, { status: 503 }),
    { status: () => 503, json: async () => body },
  ]) {
    assert.deepEqual(await safeAuthResponse(response), {
      status: 503,
      ok: false,
      error: 'auth_unavailable',
    });
  }
  assert.deepEqual(
    await safeAuthResponse(
      Response.json({ error: 'raw token=private' }, { status: 503 }),
    ),
    { status: 503, ok: false, error: null },
  );
});
