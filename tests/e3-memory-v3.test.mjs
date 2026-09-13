import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');
const block = bank.slice(
  bank.indexOf("const memoryTasks = sectionTasks('memory', ["),
  bank.indexOf("const executiveAttentionTasks = sectionTasks('executive_attention', ["),
);

test('memory uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(block, new RegExp(`phase: '${phase}'`));
  }
  assert.equal((block.match(/phase: '/g) || []).length, 8);
});

test('memory separates recall, order, strategy learning and updating', () => {
  assert.match(block, /serbest hatırlama/i);
  assert.match(block, /içerik-sıra ayrımı/i);
  assert.match(block, /model öncesi\/sonrası değişimi/i);
  assert.match(block, /görsel güncelleme/i);
  assert.match(block, /nötr keşif\/tavan/i);
  assert.match(protocol, /Hatırlama ile tanımayı aynı beceri gibi yorumlama/i);
  assert.match(protocol, /Yorgunluk ve dikkat dağınıklığını bellek yetersizliği gibi yorumlama/i);
});
