import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('historical acceptance uses unchanged git blobs and sealed migration digests', () => {
  const root = new URL('./fixtures/faz3-checkpoints/', import.meta.url);
  const sources = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8'));
  assert.equal(sources.length, 4);
  for (const source of sources) {
    assert.match(source.commit, /^[0-9a-f]{40}$/);
    const bytes = readFileSync(new URL(source.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), source.blob);
  }
  const evidence = JSON.parse(readFileSync(new URL('../delivery/p3/CZA_Faz3_P3_Staging_Acceptance.json', import.meta.url), 'utf8'));
  for (const migration of evidence.migration.files) {
    assert.equal(sources.find(source => source.path === migration.path).sha256, migration.sha256);
  }
});
