/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let integration;
let dashboard;
let vite;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: {
      alias: { '@': process.cwd() },
      dedupe: ['react', 'react-dom'],
    },
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  });
  integration = await vite.ssrLoadModule('/lib/phase2-integration.ts');
  dashboard = await vite.ssrLoadModule('/components/phase2-dashboard.tsx');
});

after(async () => {
  await vite.close();
});

test('consolidated manifest is deeply frozen and links exactly three sealed modules', () => {
  assert.equal(Object.isFrozen(integration.PHASE2_MODULES), true);
  assert.equal(
    integration.PHASE2_MODULES.every((module) => Object.isFrozen(module)),
    true,
  );
  assert.deepEqual(
    integration.PHASE2_MODULES.map(({ id, audience, href }) => ({
      id,
      audience,
      href,
    })),
    [
      {
        id: 'fast-reading',
        audience: 'student',
        href: '/speed-reading',
      },
      {
        id: 'attention',
        audience: 'student',
        href: '/attention',
      },
      {
        id: 'book-preparation',
        audience: 'educator',
        href: '/book-preparation/access',
      },
    ],
  );
  assert.equal(
    integration.PHASE2_MODULES.every(
      (module) => module.persistence === 'disabled',
    ),
    true,
  );
});

test('integration shell and every module fail closed in production', () => {
  assert.equal(
    integration.phase2IntegrationEnabled({
      NODE_ENV: 'production',
      CZA_PHASE2_INTEGRATION_PREVIEW: 'true',
    }),
    false,
  );
  assert.equal(
    integration.phase2IntegrationEnabled({
      NODE_ENV: 'test',
      CZA_PHASE2_INTEGRATION_PREVIEW: 'true',
    }),
    true,
  );
  assert.equal(integration.PHASE2_TRUST_BOUNDARY.productionEligible, false);
  assert.equal(integration.PHASE2_TRUST_BOUNDARY.sharedModuleToken, false);
  assert.equal(integration.PHASE2_TRUST_BOUNDARY.database, 'not_connected');
});

test('dashboard preserves honest measurement labels and initial student routing', () => {
  const html = renderToStaticMarkup(
    React.createElement(dashboard.Phase2Dashboard),
  );
  assert.match(html, /server_observed_approximation/);
  assert.match(html, /synthetic_attention/);
  assert.match(html, /href="\/speed-reading"/);
  assert.match(html, /href="\/attention"/);
  assert.doesNotMatch(html, /href="\/book-preparation\/access"/);
  assert.match(html, /Ledger ve persistence kapalı/);
});
