import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');

function sectionBlock(start, end) {
  return bank.slice(bank.indexOf(start), bank.indexOf(end));
}

const earlyMath = sectionBlock(
  "const earlyMathTasks = sectionTasks('early_math', [",
  'const memoryTasks',
);

test('early math uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(earlyMath, new RegExp(`phase: '${phase}'`));
  }
  assert.equal((earlyMath.match(/phase: '/g) || []).length, 8);
});

test('early math captures strategy, model response and quantity change without symbol pressure', () => {
  assert.match(earlyMath, /model öncesi ve sonrası değişimi ayrı kaydet/i);
  assert.match(earlyMath, /İşlem sembolü kullanma/);
  assert.match(earlyMath, /erken toplamsal düşünme/i);
  assert.match(earlyMath, /erken çıkarımsal nicelik/i);
  assert.match(earlyMath, /nötr keşif\/tavan/i);
  assert.match(protocol, /parmakla\/tek tek saymayı hata sayma/i);
});
