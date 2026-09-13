import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');
const block = bank.slice(
  bank.indexOf("const socialEmotionTasks = sectionTasks('social_emotion_play', ["),
  bank.indexOf("const motorTasks = sectionTasks('motor_graphomotor', ["),
);

test('social emotion uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(block, new RegExp(`phase: '${phase}'`));
  }
  assert.equal((block.match(/phase: '/g) || []).length, 8);
});

test('social emotion remains pluralistic, non-moralizing and learning-sensitive', () => {
  assert.match(block, /tek doğru cevap arama/i);
  assert.match(block, /model öncesi\/sonrası değişimi/i);
  assert.match(block, /farklı tercih/i);
  assert.match(block, /birden fazla kabul edilebilir çözüm/i);
  assert.match(block, /nötr keşif\/tavan/i);
  assert.match(protocol, /ahlaki yetersizlik gibi yorumlama/i);
  assert.match(protocol, /Tek bir sosyal yanıt kişilik, ahlak veya tanı göstergesi değildir/i);
});
