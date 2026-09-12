import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const protocol = fs.readFileSync(new URL('../lib/preschool-e3-protocol.ts', import.meta.url), 'utf8');
const childPage = fs.readFileSync(new URL('../app/assessment/e3/page.tsx', import.meta.url), 'utf8');
const reportPage = fs.readFileSync(new URL('../app/educator/assessment/e3/report/page.tsx', import.meta.url), 'utf8');

const sectionIds = [
  'visual_concepts', 'receptive_language', 'expressive_language', 'early_math', 'memory',
  'executive_attention', 'social_emotion_play', 'motor_graphomotor', 'daily_living_safety', 'learning_transfer',
];

test('E3 has ten independent developmental evidence areas and an 80-task bank structure', () => {
  for (const sectionId of sectionIds) {
    assert.match(bank, new RegExp(`sectionTasks\\('${sectionId}'`));
    assert.match(protocol, new RegExp(`${sectionId}: \\{`));
  }
  assert.match(bank, /E3_TASK_BANK_V1\.0/);
  assert.match(bank, /const agePattern: \(36 \| 39 \| 42 \| 45\)\[\] = \[36, 36, 36, 36, 36, 39, 42, 45\]/);
  assert.equal((bank.match(/\['CG-\d{2}'/g) || []).length, 24);
});

test('E3 keeps four age bands, adaptive evidence count and neutral ceiling logic', () => {
  assert.match(bank, /36-38/);
  assert.match(bank, /39-41/);
  assert.match(bank, /42-44/);
  assert.match(bank, /45-47/);
  assert.match(bank, /return band === '36-38' \? 4 : band === '39-41' \? 5 : band === '42-44' \? 6 : 7/);
  assert.match(bank, /weakCount >= 2 \? 1 : 0/);
  assert.match(bank, /neutralProbe: index === 7/);
});

test('E3 child flow records support, behavior, self-correction and neutral skip without correctness pressure', () => {
  assert.match(childPage, /e3SupportLadder/);
  assert.match(childPage, /e3BehaviorFlags/);
  assert.match(childPage, /SELF_CORRECTION/);
  assert.match(childPage, /Görevi nötr geç · değerlendirilemedi/);
  assert.match(childPage, /Doğru\/yanlış rengi, puan, geri sayım veya performans baskısı gösterilmez/);
  assert.match(childPage, /Bu bir keşif\/tavan görevidir/);
  assert.match(protocol, /Tek oturumda bitirme zorunluluğu yoktur/);
});

test('E3 remains an assessment system and does not directly assign CZA training recipes', () => {
  const combined = childPage + reportPage + protocol;
  assert.doesNotMatch(combined, /educator-e3-assignments/);
  assert.doesNotMatch(combined, /training_recipes/);
  assert.doesNotMatch(combined, /Onayla ve ata/);
  assert.doesNotMatch(combined, /E3 → CZA Çalışma Paneli/);
});

test('E3 report language remains non-diagnostic and evidence based', () => {
  assert.match(bank, /norm, tanı, gelişim yaşı veya standart gelişim taraması değildir/);
  assert.match(reportPage, /Göreli güçlü kanıt/);
  assert.match(reportPage, /Gelişen \/ karışık profil/);
  assert.match(reportPage, /Yakın destekle izlenecek/);
  assert.match(reportPage, /Kanıt yetersiz/);
});
