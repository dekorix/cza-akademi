#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const args = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
if (!args['--candidate-file'] || !args['--deny-hashes-file']) throw new Error('EGRESS_GUARD_INPUT_REQUIRED');
const candidates = JSON.parse(await readFile(args['--candidate-file'], 'utf8'));
const deny = new Set(JSON.parse(await readFile(args['--deny-hashes-file'], 'utf8')));
if (!Array.isArray(candidates) || !Array.isArray([...deny]) || deny.size === 0) throw new Error('EGRESS_DENYLIST_REQUIRED');
const checked = [];
for (const raw of candidates) {
  const parsed = new URL(raw);
  const hostname = parsed.hostname.toLowerCase();
  const digest = createHash('sha256').update(hostname).digest('hex');
  if (deny.has(digest)) throw new Error('PRODUCTION_ENDPOINT_REJECTED');
  checked.push({ hostnameSha256: digest });
}
process.stdout.write(`${JSON.stringify({ result: 'PASS', productionAccessed: false, checked })}\n`);
