import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');

function sectionBlock(start, end) {
  return bank.slice(bank.indexOf(start), bank.indexOf(end));
}

const expressive = sectionBlock(
  "const expressiveLanguageTasks = sectionTasks('expressive_language', [",
  'const earlyMathTasks',
);

test('expressive language uses the eight-stage CZA evidence chain', () => {
  for (const phase of ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING']) {
    assert.match(expressive, new RegExp(`phase: '${phase}'`));
  }
  assert.equal((expressive.match(/phase: '/g) || []).length, 8);
});

test('expressive language captures repair, narrative transfer and non-pressured evidence', () => {
  assert.match(expressive, /model öncesi ve sonrası değişimi ayrı kaydet/i);
  assert.match(expressive, /olay sırası/i);
  assert.match(expressive, /anlatı bütünlüğü/i);
  assert.match(expressive, /nötr keşif\/tavan/i);
  assert.match(protocol, /Tek bir gramer hatasını başarısızlık sayma/i);
  assert.match(protocol, /NOT_ASSESSED/);
});
