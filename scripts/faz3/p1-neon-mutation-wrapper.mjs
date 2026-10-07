#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_SCOPES = ['staging:neon:create', 'staging:neon:delete', 'staging:neon:inspect'];
const LEASE_KEYS = ['expiresAt', 'leaseId', 'leaseToken', 'scopes', 'targetEnvironment'];
const CONTRACT_KEYS = [
  'createdAt', 'leaseProjectId', 'migrationEndpoint', 'pooledEndpoint', 'projectId',
  'projectName', 'region', 'targetEnvironment', 'unpooledEndpoint',
];

const exactArray = (actual, expected) => Array.isArray(actual)
  && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const exactKeys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

export function assertP1NeonMutationReady(history) {
  if (!Array.isArray(history) || history.length < 3) throw new Error('MUTATION_BEFORE_DURABLE_WAL');
  const states = history.map(entry => entry?.state);
  if (states[0] !== 'PREPARED' || !states.includes('WAL_DURABLE') || states.at(-1) !== 'REQUESTED') throw new Error('MUTATION_BEFORE_DURABLE_WAL');
  const runId = history[0]?.runId;
  if (!ULID.test(runId || '') || history.some(entry => entry?.runId !== runId)) throw new Error('WAL_IDENTITY_INVALID');
  return runId;
}

export function validateOpaqueLease(lease, { nowMs = Date.now() } = {}) {
  if (!exactKeys(lease, LEASE_KEYS)) throw new Error('OPAQUE_LEASE_INVALID');
  if (!UUID.test(lease.leaseId || '') || !/^cza_p1_[A-Za-z0-9_-]{43}$/.test(lease.leaseToken || '')) throw new Error('OPAQUE_LEASE_INVALID');
  if (!exactArray(lease.scopes, REQUIRED_SCOPES) || lease.targetEnvironment !== 'staging') throw new Error('OPAQUE_LEASE_INVALID');
  const expiresAt = Date.parse(lease.expiresAt || '');
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs || expiresAt > nowMs + 900_000) throw new Error('OPAQUE_LEASE_INVALID');
  if (JSON.stringify(lease).match(/neonApiKey|api[_-]?key|authorization/i)) throw new Error('RUNNER_CREDENTIAL_FORBIDDEN');
  return lease;
}

export function validateStagingContract(contract, { leaseId, runId }) {
  if (!exactKeys(contract, CONTRACT_KEYS)) throw new Error('NEON_STAGING_CONTRACT_INVALID');
  if (contract.leaseProjectId !== leaseId || contract.targetEnvironment !== 'staging') throw new Error('NEON_STAGING_CONTRACT_INVALID');
  if (!/^[a-z0-9-]{1,64}$/.test(contract.projectId || '') || contract.projectName !== `cza-f3-staging-${runId.toLowerCase()}`) throw new Error('NEON_STAGING_CONTRACT_INVALID');
  if (!/^aws-[a-z]+-[a-z]+-[1-9]$/.test(contract.region || '') || !Number.isFinite(Date.parse(contract.createdAt || ''))) throw new Error('NEON_STAGING_CONTRACT_INVALID');
  for (const key of ['pooledEndpoint', 'unpooledEndpoint', 'migrationEndpoint']) {
    const host = String(contract[key] || '').toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(host) || /(^|[.-])(prod|production)([.-]|$)/.test(host)) throw new Error('PRODUCTION_ENDPOINT_REJECTED');
  }
  return contract;
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
  const journal = options['--journal'];
  const leaseFile = options['--lease-file'];
  const contractFile = options['--contract-file'];
  if (!journal || !leaseFile || !contractFile) throw new Error('P1_NEON_PREREQUISITE_MISSING');
  const history = (await readFile(journal, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const runId = assertP1NeonMutationReady(history);
  const lease = validateOpaqueLease(JSON.parse(await readFile(leaseFile, 'utf8')));
  validateStagingContract(JSON.parse(await readFile(contractFile, 'utf8')), { leaseId: lease.leaseId, runId });
  process.stdout.write(`${JSON.stringify({ result: 'PASS', runId, providerCredentialExposed: false })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
