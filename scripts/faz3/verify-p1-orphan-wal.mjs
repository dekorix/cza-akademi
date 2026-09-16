#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUESTED = /^faz3-p1-neon-wal-requested-([0-9A-HJKMNP-TV-Z]{26})$/;

const matchingStep = (steps, expected) => steps.find(step => step.number === expected.number && step.name === expected.name);
const matchingArtifact = (artifacts, expected) => artifacts.find(artifact => artifact.id === expected.id && artifact.name === expected.name);

export function verifyNoMutationReconciliation({ record, run, jobs, artifacts }) {
  if (record?.schemaVersion !== 'CZA-P1-NO-MUTATION-EVIDENCE-V1' || record?.source !== 'GITHUB_ACTIONS_JOB_API') throw new Error('RECONCILIATION_RECORD_INVALID');
  if (record.terminalState !== 'RECONCILED_NO_MUTATION' || record.providerMutationStarted !== false || record.neonProjectCreated !== false) throw new Error('RECONCILIATION_NOT_TERMINAL');
  if (run.id !== record.workflowRunId || run.head_sha !== record.headSha || run.repository?.id !== record.repositoryId) throw new Error('RECONCILIATION_RUN_MISMATCH');
  const job = jobs.find(item => item.id === record.jobId && item.name === record.jobName);
  if (!job || job.conclusion !== record.jobConclusion) throw new Error('RECONCILIATION_JOB_MISMATCH');
  const exchange = matchingStep(job.steps || [], record.exchangeStep);
  const mutation = matchingStep(job.steps || [], record.providerMutationStep);
  if (exchange?.conclusion !== 'failure' || mutation?.conclusion !== 'skipped') throw new Error('PROVIDER_MUTATION_ABSENCE_UNPROVEN');
  for (const expected of [record.requestedWalArtifact, record.finalWalArtifact]) {
    const artifact = matchingArtifact(artifacts, expected);
    if (!artifact || artifact.digest !== expected.digest || artifact.expired !== false) throw new Error('RECONCILIATION_ARTIFACT_MISMATCH');
    if (artifact.workflow_run?.id !== record.workflowRunId || artifact.workflow_run?.head_sha !== record.headSha) throw new Error('RECONCILIATION_ARTIFACT_RUN_MISMATCH');
  }
  if (record.requestedWalArtifact.name !== `faz3-p1-neon-wal-requested-${record.walRunId}`) throw new Error('RECONCILIATION_WAL_ID_MISMATCH');
  return { walRunId: record.walRunId, terminalState: record.terminalState };
}

export function unresolvedRequestedWals({ artifacts, records }) {
  const active = artifacts.filter(artifact => !artifact.expired && REQUESTED.test(artifact.name));
  return active.filter(artifact => {
    const walRunId = REQUESTED.exec(artifact.name)[1];
    return !records.some(record => record.walRunId === walRunId && record.requestedWalArtifact?.id === artifact.id && record.terminalState === 'RECONCILED_NO_MUTATION');
  });
}

async function github(path, token, apiUrl, repository) {
  const response = await fetch(`${apiUrl}/repos/${repository}${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' },
  });
  if (!response.ok) throw new Error(`GITHUB_EVIDENCE_${response.status}`);
  return response.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (!token || repository !== 'dekorix/cza-akademi') throw new Error('ORPHAN_GATE_CONTEXT_INVALID');
  const directory = resolve('security/faz3/recovery/reconciliations');
  const records = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
  const allArtifacts = [];
  for (let page = 1; ; page += 1) {
    const response = await github(`/actions/artifacts?per_page=100&page=${page}`, token, apiUrl, repository);
    allArtifacts.push(...response.artifacts);
    if (response.artifacts.length < 100) break;
  }
  const unresolved = unresolvedRequestedWals({ artifacts: allArtifacts, records });
  if (unresolved.length) throw new Error(`P1_ORPHAN_WAL_UNRESOLVED:${unresolved.map(item => item.name).join(',')}`);
  for (const record of records) {
    const [run, jobResponse, artifactResponse] = await Promise.all([
      github(`/actions/runs/${record.workflowRunId}`, token, apiUrl, repository),
      github(`/actions/runs/${record.workflowRunId}/jobs?per_page=100`, token, apiUrl, repository),
      github(`/actions/runs/${record.workflowRunId}/artifacts?per_page=100`, token, apiUrl, repository),
    ]);
    verifyNoMutationReconciliation({ record, run, jobs: jobResponse.jobs, artifacts: artifactResponse.artifacts });
  }
  process.stdout.write(`${JSON.stringify({ result: 'PASS', activeRequestedWals: allArtifacts.filter(item => !item.expired && REQUESTED.test(item.name)).length, reconciliations: records.length })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
