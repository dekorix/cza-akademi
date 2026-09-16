import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/faz3/recovery-wal.mjs');
const run = (args, expected = 0) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  assert.equal(result.status, expected, result.stderr);
  return result;
};

test('WAL must be durably acknowledged before REQUESTED and survives lost provider response', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cza-faz3-wal-'));
  const journal = resolve(directory, 'journal.jsonl');
  const durable = resolve(directory, 'durable.jsonl');
  const receipt = resolve(directory, 'receipt.txt');
  try {
    run(['init', journal, '--run-id=01J8ABCDEFGHJKMNPQRSTVWXYZ', '--resource=neon-project']);
    const premature = spawnSync(process.execPath, [script, 'advance', journal, '--state=REQUESTED'], { encoding: 'utf8' });
    assert.notEqual(premature.status, 0);
    await import('node:fs/promises').then(fs => fs.copyFile(journal, durable));
    run(['receipt', durable, `--out=${receipt}`]);
    run(['advance', journal, '--state=WAL_DURABLE', `--receipt=${receipt}`]);
    run(['advance', journal, '--state=REQUESTED']);
    run(['assert-mutation-ready', journal]);
    run(['advance', journal, '--state=OBSERVED', '--resource-id=discovered-by-label']);
    run(['advance', journal, '--state=RECONCILED', '--resource-id=discovered-by-label']);
    const states = (await readFile(journal, 'utf8')).trim().split('\n').map(line => JSON.parse(line).state);
    assert.deepEqual(states, ['PREPARED', 'WAL_DURABLE', 'REQUESTED', 'OBSERVED', 'RECONCILED']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('P0 mutation command is a hard nonzero failure', () => {
  const result = spawnSync(process.execPath, ['scripts/faz3/assert-p0-nonmutating.mjs', 'infra/staging/p0-static', '--command', 'apply'], { encoding: 'utf8' });
  assert.equal(result.status, 23);
  assert.match(result.stderr, /P0_MUTATION_COMMAND_FORBIDDEN/);
});

test('REQUESTED can reach RECONCILED_NO_MUTATION only with machine-verifiable skipped-step evidence', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cza-faz3-no-mutation-'));
  const journal = resolve(directory, 'journal.jsonl');
  const durable = resolve(directory, 'durable.jsonl');
  const receipt = resolve(directory, 'receipt.txt');
  const evidence = resolve('security/faz3/recovery/reconciliations/35067500579-01K2KH2DCA2448770B9A359BE9.json');
  try {
    run(['init', journal, '--run-id=01K2KH2DCA2448770B9A359BE9', '--resource=neon-staging-project']);
    await import('node:fs/promises').then(fs => fs.copyFile(journal, durable));
    run(['receipt', durable, `--out=${receipt}`]);
    run(['advance', journal, '--state=WAL_DURABLE', `--receipt=${receipt}`]);
    run(['advance', journal, '--state=REQUESTED']);
    assert.notEqual(spawnSync(process.execPath, [script, 'advance', journal, '--state=RECONCILED_NO_MUTATION'], { encoding: 'utf8' }).status, 0);
    run(['reconcile-no-mutation', journal, `--evidence=${evidence}`]);
    const history = (await readFile(journal, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(history.at(-1).state, 'RECONCILED_NO_MUTATION');
    assert.match(history.at(-1).evidenceSha256, /^[0-9a-f]{64}$/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
