import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyExactClaims } from '../security/faz3/oidc/exact-claims.mjs';

const sha = 'a'.repeat(40);
const claims = {
  iss: 'https://token.actions.githubusercontent.com', aud: 'urn:cza:staging:credential-broker:v1',
  repository_id: '1359513274', repository_owner_id: '219684352', environment: 'CZA-STAGING-SECURITY',
  event_name: 'workflow_dispatch', ref: 'refs/heads/feature/faz3-gate1b-v4', head_ref: '', base_ref: '',
  workflow_sha: sha, job_workflow_ref: `dekorix/cza-akademi/.github/workflows/faz3-p1-provision-reusable.yml@${sha}`,
  job_workflow_sha: sha, sub: 'repo:dekorix@219684352/cza-akademi@1359513274:environment:CZA-STAGING-SECURITY',
};
const policy = { issuer: claims.iss, matchingMode: 'EXACT_ALL', onAnyMismatch: 'DENY', claims: Object.fromEntries(Object.entries(claims).filter(([key]) => key !== 'iss')) };

test('OIDC exact policy admits only the fully bound fixture', () => assert.equal(verifyExactClaims(claims, policy), true));

for (const key of Object.keys(policy.claims)) {
  test(`OIDC mismatch ${key} is denied`, () => assert.equal(verifyExactClaims({ ...claims, [key]: `${claims[key]}-tampered` }, policy), false));
}
