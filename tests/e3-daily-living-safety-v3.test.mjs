import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');

function block(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing block: ${start}`);
  return source.slice(a, b);
}

const daily = block(bank, "const dailyLivingTasks = sectionTasks('daily_living_safety', [", "const learningTransferTasks = sectionTasks('learning_transfer', [");
const dailyProtocol = block(protocol, "  daily_living_safety: {", "  learning_transfer: {");

test('daily living and safety uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(daily, new RegExp(`phase: '${phase}'`));
  }
});

test('daily living stays contextual, non-shaming and safety first', () => {
  assert.match(daily, /modelden öğrenme/i);
  assert.match(daily, /güvenlik muhakemesi/i);
  assert.match(dailyProtocol, /Evde fırsat verilmemiş beceriyi çocuk yetersizliği sayma/i);
  assert.match(dailyProtocol, /Mahremiyet gerektiren özbakım görevini doğrudan uygulamaya zorlama/i);
  assert.match(dailyProtocol, /korkutma, gerçek tehlike, suçlama/i);
  assert.match(dailyProtocol, /nötr tavandır/i);
});