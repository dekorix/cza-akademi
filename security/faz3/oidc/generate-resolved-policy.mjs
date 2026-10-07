#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const workflowSha = options['--workflow-sha'];
const jobWorkflowSha = options['--job-workflow-sha'];
const output = options['--out'];
if (!/^[0-9a-f]{40}$/.test(workflowSha || '') || !/^[0-9a-f]{40}$/.test(jobWorkflowSha || '') || !output) throw new Error('RESOLVED_OIDC_IDENTITY_REQUIRED');
const policy = {
  schemaVersion: 'CZA-OIDC-TRUST-V4', issuer: 'https://token.actions.githubusercontent.com', matchingMode: 'EXACT_ALL', onAnyMismatch: 'DENY',
  claims: {
    aud: 'urn:cza:staging:credential-broker:v1', repository_id: '1359513274', repository_owner_id: '219684352',
    environment: 'CZA-STAGING-SECURITY', event_name: 'workflow_dispatch', ref: 'refs/heads/feature/faz3-gate1b-v4',
    head_ref: '', base_ref: '', workflow_sha: workflowSha,
    job_workflow_ref: `dekorix/cza-akademi/.github/workflows/faz3-p1-provision-reusable.yml@${jobWorkflowSha}`,
    job_workflow_sha: jobWorkflowSha,
    sub: 'repo:dekorix@219684352/cza-akademi@1359513274:environment:CZA-STAGING-SECURITY',
  },
  credential: { maxTtlSeconds: 900, scopes: ['staging:create', 'staging:inspect', 'staging:delete'], productionScopeForbidden: true },
};
await writeFile(output, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o644 });
