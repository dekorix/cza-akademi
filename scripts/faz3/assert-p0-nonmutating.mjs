#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.argv[2] || 'infra/staging/p0-static');
const command = process.argv.includes('--command') ? process.argv[process.argv.indexOf('--command') + 1] : 'validate';
if (command === 'apply' || command === 'destroy' || command === 'import') {
  process.stderr.write(`P0_MUTATION_COMMAND_FORBIDDEN:${command}\n`);
  process.exit(23);
}

const files = (await readdir(root)).filter(name => name.endsWith('.tf'));
let source = '';
for (const file of files) source += `\n${await readFile(resolve(root, file), 'utf8')}`;
const forbidden = /^\s*(resource|data|module|provider|import|removed)\s+["{]/m;
if (forbidden.test(source) || /\b(local-exec|remote-exec)\b/.test(source) || /backend\s+"/.test(source)) {
  process.stderr.write('P0_PROVISIONING_SURFACE_DETECTED\n');
  process.exit(24);
}

if (command === 'scan') {
  process.stdout.write(JSON.stringify({ result: 'PASS', root, mutatingResources: 0, providers: 0 }) + '\n');
  process.exit(0);
}

const tofu = process.env.CZA_TOFU_BIN || 'tofu';
const args = command === 'plan'
  ? ['-chdir=' + root, 'plan', '-refresh=false', '-lock=false', '-input=false', '-out=p0.plan']
  : ['-chdir=' + root, command];
const result = spawnSync(tofu, args, { stdio: 'inherit', env: { PATH: process.env.PATH || '' } });
if (result.error) {
  process.stderr.write(`P0_TOFU_UNAVAILABLE:${result.error.message}\n`);
  process.exit(25);
}
process.exit(result.status ?? 26);
