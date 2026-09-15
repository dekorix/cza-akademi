#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const repo = resolve(process.argv[2] || '.');
const output = resolve(repo, process.argv[3] || 'infra/staging/generated/offline-resource-graph.json');

async function walk(directory) {
  const result = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = resolve(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

const nodes = [];
for (const path of await walk(resolve(repo, 'infra/staging'))) {
  if (!path.endsWith('.tf')) continue;
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/^\s*(resource|module|data)\s+"([^"]+)"(?:\s+"([^"]+)")?/gm)) {
    nodes.push({
      kind: match[1],
      type: match[2],
      name: match[3] || match[2],
      file: relative(repo, path).replaceAll('\\', '/'),
    });
  }
}

const classification = JSON.parse(await readFile(resolve(repo, 'infra/staging/control-classification.json'), 'utf8'));
const graph = {
  schemaVersion: 'CZA-FAZ3-OFFLINE-RESOURCE-GRAPH-V4',
  source: 'GENERATED_FROM_HCL_AND_CONTROL_CLASSIFICATION',
  sourceSha256: createHash('sha256').update(JSON.stringify({ nodes, controls: classification.controls })).digest('hex'),
  nodes: nodes.sort((a, b) => `${a.file}:${a.type}:${a.name}`.localeCompare(`${b.file}:${b.type}:${b.name}`)),
  controls: classification.controls,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(graph, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ result: 'PASS', output: relative(repo, output), nodes: nodes.length, controls: classification.controls.length })}\n`);
