import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');
const block = bank.slice(
  bank.indexOf("const executiveAttentionTasks = sectionTasks('executive_attention', ["),
  bank.indexOf("const socialEmotionTasks = sectionTasks('social_emotion_play', ["),
);

test('executive attention uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(block, new RegExp(`phase: '${phase}'`));
  }
  assert.equal((block.match(/phase: '/g) || []).length, 8);
});

test('executive attention separates inhibition, rule learning and set shifting', () => {
  assert.match(block, /dürtü kontrolü/i);
  assert.match(block, /model öncesi\/sonrası değişimi/i);
  assert.match(block, /eski hedefe dönme/i);
  assert.match(block, /ters kural/i);
  assert.match(block, /nötr keşif\/tavan/i);
  assert.match(protocol, /Görünür geri sayım, hız puanı veya kırmızı hata göstergesi kullanma/i);
  assert.match(protocol, /tek oturumdaki dalgalanma tanısal sonuç değildir/i);
});
