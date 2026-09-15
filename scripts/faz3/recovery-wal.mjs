#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { appendFile, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [command, journalArg, ...rest] = process.argv.slice(2);
if (!command || !journalArg) throw new Error('RECOVERY_USAGE');
const journal = resolve(journalArg);
const options = Object.fromEntries(rest.map(value => value.split('=', 2)));
const allowed = ['PREPARED', 'WAL_DURABLE', 'REQUESTED', 'OBSERVED', 'RECONCILED'];

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
  if (!allowed.includes(state) || state === 'PREPARED') throw new Error('RECOVERY_STATE_INVALID');
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
