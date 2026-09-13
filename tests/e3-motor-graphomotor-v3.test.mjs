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

const motor = block(bank, "const motorTasks = sectionTasks('motor_graphomotor', [", "const dailyLivingTasks = sectionTasks('daily_living_safety', [");
const motorProtocol = block(protocol, "  motor_graphomotor: {", "  daily_living_safety: {");

test('motor graphomotor uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(motor, new RegExp(`phase: '${phase}'`));
  }
});

test('motor graphomotor captures process, learning and safety without perfection pressure', () => {
  assert.match(motor, /modelden öğrenme/i);
  assert.match(motor, /yakın transfer/i);
  assert.match(motor, /uzak transfer/i);
  assert.match(motorProtocol, /Kalem tutuşunu görev sırasında zorla düzeltme/i);
  assert.match(motorProtocol, /Mükemmel şekil veya çizgi bekleme/i);
  assert.match(motorProtocol, /fiziksel güvenlik önceliklidir/i);
  assert.match(motorProtocol, /nötr tavan/i);
});