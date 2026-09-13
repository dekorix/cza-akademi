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

const learning = block(bank, "const learningTransferTasks = sectionTasks('learning_transfer', [", "export const e3Tasks: E3Task[] = [");
const learningProtocol = block(protocol, "  learning_transfer: {", "};");

test('learning transfer uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(learning, new RegExp(`phase: '${phase}'`));
  }
});

test('learning transfer captures learning slope instead of one-shot correctness', () => {
  assert.match(learning, /model öncesi → model sonrası → yeni örnek/i);
  assert.match(learning, /yakın transfer/i);
  assert.match(learning, /uzak transfer/i);
  assert.match(learningProtocol, /önce bağımsız başlangıç kanıtı/i);
  assert.match(learningProtocol, /aynı örneği ezberletmek yerine yeni örnek/i);
  assert.match(learningProtocol, /Tek çözüm yolu dayatma/i);
  assert.match(learningProtocol, /nötr tavandır/i);
});