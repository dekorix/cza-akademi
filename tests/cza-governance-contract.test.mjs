import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGovernancePR, REQUIRED_SECTIONS } from '../scripts/qa/cza-governance-contract.mjs';

const headingText = [
  'Hedef kullanıcı, sınırlar ve eski kararı bozmadan değişen API alanları ayrıntılı biçimde listelendi.',
  'Önceki 23 görev ve yeni 23 görev ayrı dosyada eşlenerek eksiltme denetimi yapıldı.',
  'Tek Student ID, candidate/cycle, tenant ve educator yetki izolasyonu korunduğu doğrulandı.',
  'Hedef yaş ve ekran tasarımı ile erişilebilirlik kontrolleri için somut kabul ölçütleri belirlendi.',
  'Unit PASS run-123, Chrome NOT_RUN ve staging readback BLOCKED kaynak bağlantıları belgelendi.',
  'YAYIN_ETKISI YOK çünkü yalnız dosya açıklaması değişti, geri dönüş SHA üzerinden mümkün.',
  'BASE_SHA abc123, HEAD_SHA def456 ve sonraki tek adım kontrollü kalite kabulüdür.',
];
const filled = [
  'CZA-GATE-V1',
  'KAPSAM SAPMASI: YOK',
  'YAYIN_ETKISI: YOK',
  'PRODUCTION_YETKISI: YOK',
  ...REQUIRED_SECTIONS.flatMap((name, index) => ['## ' + name, headingText[index]]),
].join('\n\n');

test('complete new PR passes required acceptance sections', () => {
  const result = validateGovernancePR({body: filled, createdAt:'2026-10-09T00:30:00Z'});
  assert.deepEqual(result.errors, []);
  assert.equal(result.pass, true);
  assert.equal(result.legacy, false);
});
test('new PR missing evidence or content fails closed', () => {
  const result = validateGovernancePR({body:'CZA-GATE-V1\nKAPSAM SAPMASI: YOK\nYAYIN_ETKISI: YOK\nPRODUCTION_YETKISI: YOK',createdAt:'2026-10-09T00:30:00Z'});
  assert.equal(result.pass, false);
  assert.equal(result.errors.filter(e=>e.startsWith('Missing section')).length, REQUIRED_SECTIONS.length);
});
test('template checkbox/comment only is not accepted as evidence', () => {
  const body = filled.replace(headingText[0], '<!-- fill me -->\n- [ ] Tamamlandı');
  const result = validateGovernancePR({body,createdAt:'2026-10-09T00:30:00Z'});
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(e=>e.includes(REQUIRED_SECTIONS[0])));
});
test('unknown production impact blocks merge gate', () => {
  const result = validateGovernancePR({body:filled.replace('YAYIN_ETKISI: YOK','YAYIN_ETKISI: BELIRSIZ'),createdAt:'2026-10-09T00:30:00Z'});
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(e=>e.includes('BELIRSIZ')));
});
test('scope drift halts even when rest of PR is complete', () => {
  const result = validateGovernancePR({body:filled.replace('KAPSAM SAPMASI: YOK','KAPSAM SAPMASI: VAR'),createdAt:'2026-10-09T00:30:00Z'});
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(e=>e.includes('KAPSAM SAPMASI=VAR')));
});
test('pre-existing PR is not retroactively blocked', () => {
  const result = validateGovernancePR({body:'', createdAt:'2026-10-08T20:00:00Z'});
  assert.equal(result.pass, true);
  assert.equal(result.legacy, true);
});
test('invalid creation timestamp fails closed on new check', () => {
  const result = validateGovernancePR({body:filled, createdAt:'invalid'});
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(e=>e.includes('timestamp')));
});
test('unrelated text cannot satisfy named sections', () => {
  const result = validateGovernancePR({body:filled.replace('## '+REQUIRED_SECTIONS[5], '## Şahsi Notlar'),createdAt:'2026-10-09T00:30:00Z'});
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(e=>e.includes('Missing section: '+REQUIRED_SECTIONS[5])));
});
