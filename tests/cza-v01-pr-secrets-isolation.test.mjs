import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL('../.github/workflows/'+name, import.meta.url), 'utf8');
// Comments may explain held credentials; only active workflow YAML counts.
const active = (name) => read(name).split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');

const SECURE_HOLD_WORKFLOWS = [
  'cza-t5-staging-index-readonly.yml',
  'cza-v01-active-db-version-attest-readonly.yml',
  'cza-vertical01-worker-provenance-readonly.yml',
  'cza-v01-staging-endpoint-probe-version-only.yml',
];

test('V01 untrusted pull request builds never receive staging secrets or publish a Worker', () => {
  const source = read('cza-v01-integrated-platform-preview.yml');
  assert.match(source, /pull_request:/);
  assert.match(source, /unprivileged-full-build:/);
  assert.doesNotMatch(source, /secrets\./);
  assert.doesNotMatch(source, /CLOUDFLARE_API_TOKEN|CZA_STAGING_DATABASE_URL/);
  assert.doesNotMatch(source, /wrangler versions (upload|deploy)/);
  assert.doesNotMatch(source, /environment:\s*CZA-STAGING-SECURITY/);
  assert.match(source, /tests\/u9-guardian-api-ui\.test\.mjs/);
});

test('V01 and T5 former privileged PR workflows are disabled', () => {
  for (const path of SECURE_HOLD_WORKFLOWS) {
    const source = active(path);
    assert.doesNotMatch(source, /pull_request:/, path);
    assert.match(source, /if:\s*false/, path);
    assert.doesNotMatch(source, /secrets\./, path);
    assert.doesNotMatch(source, /wrangler versions (upload|deploy)/, path);
  }
});

test('P1 QA-secret isolation: the T5 pre-enrollment manual path is a secrets-free secure hold', () => {
  const source = active('special-education-staging-db-readback.yml');
  // The held job must exist by name and be permanently disabled.
  assert.match(source, /t5-pre-enroll:/);
  assert.match(source, /if:\s*false/);
  assert.match(source, /BLOCKED_PENDING_TRUSTED_ISOLATED_ACCEPTANCE/);
  // No manual dispatch surface may re-open the T5 action set.
  assert.doesNotMatch(source, /t5_action/);
  assert.doesNotMatch(source, /preflight|ui_readback|ui_two_candidates/);
  // The held job must not be able to reach credentials, SQL, migrations or a mutable checkout.
  const held = source.slice(source.indexOf('t5-pre-enroll:'), source.indexOf('staging-db-readback:'));
  assert.doesNotMatch(held, /secrets\./);
  assert.doesNotMatch(held, /CZA_STAGING_DATABASE_URL/);
  assert.doesNotMatch(held, /psql|ON_ERROR_STOP|db\/migrations/);
  assert.doesNotMatch(held, /actions\/checkout/);
  assert.doesNotMatch(held, /wrangler versions (upload|deploy)/);
  assert.doesNotMatch(held, /environment:\s*CZA-STAGING-SECURITY/);
  assert.doesNotMatch(held, /run:.*node /);
  // A mutable (non-SHA-pinned) checkout anywhere in the file is not allowed.
  assert.doesNotMatch(source, /actions\/checkout@v\d/);
});

test('P1 QA-secret isolation: unrelated legacy special education staging jobs are preserved', () => {
  const source = active('special-education-staging-db-readback.yml');
  assert.match(source, /staging-db-readback:/);
  assert.match(source, /special-program-staging-proof:/);
  assert.match(source, /special-program-staging-proof\.mjs/);
  assert.match(source, /20261005_special_education_programs_v1\.sql/);
});

test('P1 QA-secret isolation: the isolation gate trigger scope cannot be reduced', () => {
  const source = read('cza-v01-integrated-platform-preview.yml');
  const trigger = source.slice(source.indexOf('paths:'), source.indexOf('permissions:'));
  // A protected security workflow change alone must still run the no-secrets gate.
  assert.match(trigger, /\.github\/workflows\/special-education-staging-db-readback\.yml/);
  // The isolation test itself must be a trigger path.
  assert.match(trigger, /tests\/cza-v01-pr-secrets-isolation\.test\.mjs/);
  // Every secure-hold workflow stays inside the trigger scope.
  for (const path of SECURE_HOLD_WORKFLOWS) {
    assert.ok(trigger.includes(`.github/workflows/${path}`), `${path} missing from isolation gate trigger`);
  }
  // The gate job itself must keep running the isolation test.
  assert.match(source, /tests\/cza-v01-pr-secrets-isolation\.test\.mjs/);
});
