#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const outputDirectory = resolve('delivery/evidence');
await mkdir(outputDirectory, { recursive: true });

function run(name, command, args, env = process.env) {
  const result = spawnSync(command, args, { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 });
  return { name, command: [command, ...args], exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}

const tofu = process.env.CZA_TOFU_BIN || 'tofu';
const testFiles = (await readdir('tests')).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
const executions = [
  run('full-node-test-suite', process.execPath, ['--test', ...testFiles]),
  run('typescript', resolve('node_modules/.bin/tsc'), ['--noEmit']),
  run('opentofu-fmt', tofu, ['fmt', '-check', '-recursive', 'infra/staging']),
  run('p0-surface', process.execPath, ['scripts/faz3/assert-p0-nonmutating.mjs', 'infra/staging/p0-static', '--command', 'scan']),
];
for (const execution of executions) {
  if (execution.exitCode !== 0) {
    process.stderr.write(execution.stderr);
    throw new Error(`LOCAL_EVIDENCE_FAILED:${execution.name}`);
  }
}
const testOutput = executions[0].stdout;
const testCount = Number(/ℹ tests (\d+)/.exec(testOutput)?.[1] || /# tests (\d+)/.exec(testOutput)?.[1] || 0);
const passCount = Number(/ℹ pass (\d+)/.exec(testOutput)?.[1] || /# pass (\d+)/.exec(testOutput)?.[1] || 0);
const failCount = Number(/ℹ fail (\d+)/.exec(testOutput)?.[1] || /# fail (\d+)/.exec(testOutput)?.[1] || 0);
const report = {
  schemaVersion: 'CZA-FAZ3-LOCAL-EVIDENCE-V4',
  result: failCount === 0 && testCount > 0 && passCount === testCount ? 'PASS' : 'FAIL',
  tests: { total: testCount, passed: passCount, failed: failCount },
  checks: executions.slice(1).map(item => ({ name: item.name, exitCode: item.exitCode })),
  providerMutationAttempted: false,
  workflowTriggered: false,
  productionAccessed: false,
};
await writeFile(resolve(outputDirectory, 'local-static-results.json'), `${JSON.stringify(report, null, 2)}\n`);

const socketPath = resolve('/tmp', `cza-af-unix-${process.pid}.sock`);
const socketResult = await new Promise(resolveResult => {
  const server = createServer();
  server.once('error', error => resolveResult({ available: false, code: error.code || 'UNKNOWN' }));
  server.listen(socketPath, () => server.close(() => resolveResult({ available: true, code: null })));
});
const provider = {
  schemaVersion: 'CZA-FAZ3-PROVIDER-PROOF-STATUS-V4',
  result: socketResult.available ? 'NATIVE_RUNNER_AVAILABLE_NOT_EXECUTED' : 'BLOCKED',
  afUnix: socketResult,
  adapterUsed: false,
  providerBinaryModified: false,
  providerSchemaExecuted: false,
  reason: socketResult.available ? 'WORKFLOW_EXECUTION_FORBIDDEN_THIS_TURN' : 'NATIVE_AF_UNIX_UNAVAILABLE_AND_WORKFLOW_EXECUTION_FORBIDDEN_THIS_TURN',
};
await writeFile(resolve(outputDirectory, 'provider-proof-status.json'), `${JSON.stringify(provider, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ local: report, provider })}\n`);
