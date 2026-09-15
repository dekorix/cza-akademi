import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Worker deploy bundle includes every imported module without contacting Cloudflare', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cza-worker-bundle-'));
  try {
    const result = spawnSync(resolve('node_modules/.bin/wrangler'), [
      'deploy', '--dry-run', '--outdir', directory, '--config', 'infra/staging/worker/wrangler.toml',
    ], { encoding: 'utf8', env: { PATH: process.env.PATH || '' } });
    assert.equal(result.status, 0, result.stderr);
    const files = await readdir(directory);
    assert.ok(files.some(name => name.endsWith('.js')));
    const sizes = await Promise.all(files.map(name => stat(resolve(directory, name)).then(info => info.size)));
    assert.ok(sizes.some(size => size > 1_000));
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Uploading|Deployed|workers\.dev/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
