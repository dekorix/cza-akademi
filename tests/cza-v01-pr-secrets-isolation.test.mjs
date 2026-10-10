import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL('../.github/workflows/'+name, import.meta.url), 'utf8');

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
  const paths = [
    'cza-t5-staging-index-readonly.yml',
    'cza-v01-active-db-version-attest-readonly.yml',
    'cza-vertical01-worker-provenance-readonly.yml',
    'cza-v01-staging-endpoint-probe-version-only.yml',
  ];
  for (const path of paths) {
    // Comments can explain held credentials; only active workflow YAML counts.
    const source = read(path).split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');
    assert.doesNotMatch(source, /pull_request:/, path);
    assert.match(source, /if:\s*false/, path);
    assert.doesNotMatch(source, /secrets\./, path);
    assert.doesNotMatch(source, /wrangler versions (upload|deploy)/, path);
  }
});
