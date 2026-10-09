import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('approved CZA ecosystem boundary remains explicit across agent and governance files', () => {
  const boundary = read('docs/CZA_TEK_EKOSISTEM_TANITIM_SINIRI_20261009.md');
  const agents = read('AGENTS.md');
  const protocol = read('docs/CZA_KONTROL_PROTOKOLU.md');
  const ledger = read('docs/CZA_KARAR_DEFTERI.md');
  const vision = read('docs/CZA_URUN_VIZYONU_TASLAK.md');

  assert.match(boundary, /TEK ÜST ÜRÜN/);
  assert.match(boundary, /Tanıtım Sitesi|Tanıtım ve Satış Web Sitesi/);
  assert.match(boundary, /tek Student Learning Profile|tek öğrenme omurgası|tek öğrenci kimliği/i);
  for (const [source, value] of [['AGENTS.md', agents], ['Kontrol protokolü', protocol], ['Karar defteri', ledger], ['Ürün vizyonu', vision]]) {
    assert.ok(value.includes('CZA_TEK_EKOSISTEM_TANITIM_SINIRI_20261009.md'), source + ' missing canonical site boundary reference');
  }
  assert.ok(ledger.includes('CZA-K-006'));
  assert.match(agents, /tek üst ürün|tek CZA markası/i);
  assert.match(boundary, /TEKNİK AYRIŞTIRMA BORCU/);
});

test('existing assessment handoff and Sites configuration are not deleted by documentation-only boundary change', () => {
  const manifest = JSON.parse(read('.openai/hosting.json'));
  const handoff = read('apps-script/Handoff.gs');
  const vite = read('vite.config.ts');
  const canonicalTest = read('tests/sites-canonical-binding.test.mjs');

  assert.equal(manifest.project_id, 'appgprj_6abf93124e7c819193147ac0c0a3e931');
  assert.ok(handoff.includes('https://celik-zihin-akademisi.habipcann65.chatgpt.site/work'));
  assert.ok(vite.includes("import hostingConfig from './.openai/hosting.json'"));
  assert.ok(canonicalTest.includes('hosting binds the repository to canonical'));
});
