import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/cza-work-recommendations.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const skill = (skillId, label, status, confidence = 'HIGH') => ({
  skillId,
  label,
  cluster: 'Test',
  score: 60,
  evidenceCount: 6,
  groupCount: 3,
  confidence,
  status,
  supportRate: status === 'NEEDS_SUPPORT' ? 60 : 0,
});

test('working-memory support routes to a low-load guided Audio Anzan prescription', () => {
  const items = module.buildCzaWorkRecommendations({ skills: [skill('working_memory', 'Çalışma Belleği', 'NEEDS_SUPPORT')] });
  assert.equal(items.length, 1);
  assert.equal(items[0].moduleCode, 'audio_anzan');
  assert.equal(items[0].priority, 'HIGH');
  assert.equal(items[0].suggestedSettings.terms, 2);
  assert.equal(items[0].suggestedSettings.practiceMode, 'guided_practice');
  assert.equal(items[0].educatorApprovalRequired, true);
});

test('relative processing-speed strength is maintained with Flash Anzan instead of being labelled as a deficit', () => {
  const [item] = module.buildCzaWorkRecommendations({ skills: [skill('processing_speed', 'İşlemleme Hızı', 'RELATIVE_STRENGTH')] });
  assert.equal(item.moduleCode, 'flash_anzan');
  assert.equal(item.priority, 'MAINTAIN');
  assert.equal(item.suggestedSettings.practiceMode, 'performance');
});

test('insufficient evidence does not generate a work prescription', () => {
  const items = module.buildCzaWorkRecommendations({ skills: [skill('attention', 'Dikkat', 'NEEDS_SUPPORT', 'INSUFFICIENT')] });
  assert.deepEqual(items, []);
});

test('multiple math signals collapse into one arithmetic prescription and higher priority wins', () => {
  const items = module.buildCzaWorkRecommendations({
    skills: [
      skill('number_sense', 'Sayı ve Nicelik Duyusu', 'RELATIVE_STRENGTH'),
      skill('math_reasoning', 'Matematiksel Muhakeme', 'NEEDS_SUPPORT'),
    ],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].moduleCode, 'arithmetic');
  assert.equal(items[0].priority, 'HIGH');
  assert.deepEqual(new Set(items[0].sourceSkills), new Set(['Sayı ve Nicelik Duyusu', 'Matematiksel Muhakeme']));
});
