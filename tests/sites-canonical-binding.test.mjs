import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonicalProjectId = 'appgprj_6abf93124e7c819193147ac0c0a3e931';
const legacyProjectId = 'appgprj_6a98e9bc27c481919d11f1b06147198b';
const canonicalOrigin = 'https://celik-zihin-akademisi.habipcann65.chatgpt.site';
const legacyMarkers = [
  'cza-egzersiz-akademisi',
  'cza-egzersiz-akademisi.habipcann65.chatgpt.site',
  legacyProjectId,
  'CZA Egzersiz Akademisi',
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function runtimeFiles() {
  const roots = ['.openai', 'app', 'apps-script', 'components', 'lib', 'public'];
  const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.gs']);
  const files = [];

  function walk(relativeDir) {
    const absoluteDir = path.join(root, relativeDir);
    if (!fs.existsSync(absoluteDir)) return;

    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }
      if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(relativePath);
    }
  }

  roots.forEach(walk);
  return files;
}

test('hosting binds the repository to canonical Çelik Zihin Akademisi Sites', () => {
  const hosting = JSON.parse(read('.openai/hosting.json'));
  assert.equal(hosting.project_id, canonicalProjectId);
  assert.notEqual(hosting.project_id, legacyProjectId);
});

test('secure Apps Script handoff targets canonical B /work without changing ticket mechanics', () => {
  const handoff = read('apps-script/Handoff.gs');
  assert.ok(handoff.includes(canonicalOrigin + '/work'));
  assert.match(handoff, /CZA_WORK_HANDOFF_SECONDS = 120/);
  assert.match(handoff, /CacheService\.getScriptCache\(\)\.put/);
  assert.match(handoff, /cache\.remove\(key\)/);
  assert.doesNotMatch(handoff, /cza-egzersiz-akademisi/);
});

test('root metadata identifies the unified Çelik Zihin Akademisi product on canonical B domain', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /title: 'Çelik Zihin Akademisi'/);
  assert.match(layout, /siteName: 'Çelik Zihin Akademisi'/);
  assert.ok(layout.includes(canonicalOrigin));
  assert.match(layout, /Başlangıç değerlendirmesi/);
  assert.match(layout, /özel eğitim ve öğrenme profili/);
  assert.doesNotMatch(layout, /cza-egzersiz-akademisi/);
  assert.doesNotMatch(layout, /CZA Egzersiz Akademisi/);
});

test('active runtime source tree contains no legacy A Sites binding or legacy product identity', () => {
  const stale = [];
  for (const relativePath of runtimeFiles()) {
    const content = read(relativePath);
    for (const marker of legacyMarkers) {
      if (content.includes(marker)) stale.push(relativePath + ' -> ' + marker);
    }
  }
  assert.deepEqual(stale, []);
});
