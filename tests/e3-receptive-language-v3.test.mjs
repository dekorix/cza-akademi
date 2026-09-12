import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');

function sectionBlock(start, end) {
  return bank.slice(bank.indexOf(start), bank.indexOf(end));
}

const receptive = sectionBlock(
  "const receptiveLanguageTasks = sectionTasks('receptive_language', [",
  'const expressiveLanguageTasks',
);

test('receptive language uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(receptive, new RegExp(`phase: '${phase}'`));
  }
  assert.equal((receptive.match(/phase: '/g) || []).length, 8);
});

test('receptive language separates prompting, learning response and sequence evidence', () => {
  assert.match(receptive, /model öncesi ve sonrası performansı ayrı kaydet/i);
  assert.match(receptive, /çalışma belleği ile dil yükünü karıştırma/i);
  assert.match(receptive, /nötr keşif\/tavan/i);
  assert.match(protocol, /VERBAL_PROMPT/);
  assert.match(protocol, /VISUAL_PROMPT/);
  assert.match(protocol, /MODELED/);
});
