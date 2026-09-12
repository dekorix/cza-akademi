import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/assessment/e3/page.tsx', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../app/api/assessment-e3/route.ts', import.meta.url), 'utf8');
const visualBlock = bank.split("const visualConceptTasks = sectionTasks('visual_concepts', [")[1].split("const receptiveLanguageTasks")[0];

test('visual concepts uses the fixed eight-stage CZA evidence chain', () => {
  const phases = ['WARMUP','CORE','DEEPEN','STRATEGY','LEARNING_RESPONSE','NEAR_TRANSFER','FAR_TRANSFER','CEILING'];
  assert.equal((visualBlock.match(/phase: '/g) || []).length, 8);
  for (const phase of phases) assert.match(visualBlock, new RegExp(`phase: '${phase}'`));
  assert.match(bank, /\[36, 36, 36, 36, 36, 39, 42, 45\]/);
  assert.match(bank, /neutralProbe: index === 7/);
});

test('visual concepts captures strategy, learning response and transfer metadata', () => {
  assert.match(visualBlock, /model öncesi davranış ile model sonrası değişimi ayrı yaz/i);
  assert.match(visualBlock, /yakın transfer/i);
  assert.match(visualBlock, /uzak transfer/i);
  assert.match(visualBlock, /visualSpec:/);
  assert.match(protocol, /Model gerekiyorsa yalnız bir açık örnek göster/);
  assert.match(page, /e3TaskPhaseLabels/);
  assert.match(page, /Görsel materyal niyeti/);
  assert.match(route, /taskPhase: task\.phase \?\? null/);
});
