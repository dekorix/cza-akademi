#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [command, journalArg, ...rest] = process.argv.slice(2);
if (!command || !journalArg) throw new Error('RECOVERY_USAGE');
const journal = resolve(journalArg);
const options = Object.fromEntries(rest.map(value => value.split('=', 2)));
const allowed = ['PREPARED', 'WAL_DURABLE', 'REQUESTED', 'OBSERVED', 'RECONCILED', 'RECONCILED_NO_MUTATION'];

function validateNoMutationEvidence(evidence, previous) {
  if (evidence?.schemaVersion !== 'CZA-P1-NO-MUTATION-EVIDENCE-V1') throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (evidence?.source !== 'GITHUB_ACTIONS_JOB_API' || evidence?.repository !== 'dekorix/cza-akademi' || evidence?.walRunId !== previous.runId) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (evidence?.terminalState !== 'RECONCILED_NO_MUTATION' || !/^[0-9a-f]{40}$/.test(evidence?.headSha || '')) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (!Number.isSafeInteger(evidence.workflowRunId) || !Number.isSafeInteger(evidence.jobId)) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (evidence.providerMutationStarted !== false || evidence.neonProjectCreated !== false) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (evidence.providerMutationStep?.conclusion !== 'skipped' || evidence.providerMutationStep?.name !== 'Create only the isolated Neon staging project') throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (evidence.exchangeStep?.conclusion !== 'failure' || !Number.isSafeInteger(evidence.requestedWalArtifact?.id)) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (!/^sha256:[0-9a-f]{64}$/.test(evidence.requestedWalArtifact?.digest || '')) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  if (evidence.requestedWalArtifact?.name !== `faz3-p1-neon-wal-requested-${previous.runId}`) throw new Error('NO_MUTATION_EVIDENCE_INVALID');
  return evidence;
}

async function entries() {
  try { return (await readFile(journal, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
}

async function durableAppend(entry) {
  await mkdir(dirname(journal), { recursive: true });
  const handle = await open(journal, 'a', 0o600);
  try {
    await handle.write(`${JSON.stringify(entry)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
}

if (command === 'init') {
  const runId = options['--run-id'];
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(runId || '')) throw new Error('RUN_ID_INVALID');
  const resource = options['--resource'] || 'staging-stack';
  await durableAppend({ sequence: 1, state: 'PREPARED', runId, resource, label: `cza-f3-${runId.toLowerCase()}-${resource}`, at: new Date().toISOString() });
} else if (command === 'receipt') {
  const current = await readFile(journal);
  const receipt = options['--out'];
  if (!receipt) throw new Error('RECEIPT_PATH_REQUIRED');
  await writeFile(receipt, `${createHash('sha256').update(current).digest('hex')}\n`, { mode: 0o600 });
} else if (command === 'advance') {
  const state = options['--state'];
  if (!allowed.includes(state) || state === 'PREPARED' || state === 'RECONCILED_NO_MUTATION') throw new Error('RECOVERY_STATE_INVALID');
  const history = await entries();
  const previous = history.at(-1);
  const transitions = { PREPARED: 'WAL_DURABLE', WAL_DURABLE: 'REQUESTED', REQUESTED: 'OBSERVED', OBSERVED: 'RECONCILED' };
  if (!previous || transitions[previous.state] !== state) throw new Error('RECOVERY_TRANSITION_INVALID');
  if (state === 'WAL_DURABLE') {
    const receipt = options['--receipt'];
    const expected = createHash('sha256').update(await readFile(journal)).digest('hex');
    const supplied = (await readFile(receipt, 'utf8')).trim();
    if (expected !== supplied) throw new Error('WAL_DURABILITY_RECEIPT_INVALID');
  }
  await durableAppend({ ...previous, sequence: previous.sequence + 1, state, at: new Date().toISOString(), resourceId: options['--resource-id'] || previous.resourceId || null });
} else if (command === 'reconcile-no-mutation') {
  const history = await entries();
  const previous = history.at(-1);
  if (!previous || previous.state !== 'REQUESTED') throw new Error('RECOVERY_TRANSITION_INVALID');
  const evidencePath = options['--evidence'];
  if (!evidencePath) throw new Error('NO_MUTATION_EVIDENCE_REQUIRED');
  const evidenceBytes = await readFile(resolve(evidencePath));
  const evidence = validateNoMutationEvidence(JSON.parse(evidenceBytes), previous);
  await durableAppend({
    ...previous,
    sequence: previous.sequence + 1,
    state: 'RECONCILED_NO_MUTATION',
    at: new Date().toISOString(),
    workflowRunId: evidence.workflowRunId,
    jobId: evidence.jobId,
    evidenceSha256: createHash('sha256').update(evidenceBytes).digest('hex'),
  });
} else if (command === 'assert-mutation-ready') {
  const history = await entries();
  if (history.at(-1)?.state !== 'REQUESTED' || !history.some(entry => entry.state === 'WAL_DURABLE')) throw new Error('MUTATION_BEFORE_DURABLE_WAL');
} else if (command === 'new-run-id') {
  const time = Date.now().toString(32).toUpperCase().padStart(10, '0').slice(-10).replace(/[ILOU]/g, 'A');
  const random = randomBytes(10).toString('hex').toUpperCase().replace(/[ILOU]/g, 'B').slice(0, 16);
  process.stdout.write(`${time}${random}\n`);
  process.exit(0);
} else {
  throw new Error('RECOVERY_COMMAND_INVALID');
}
process.stdout.write(`${JSON.stringify({ result: 'PASS', command, journal })}\n`);
