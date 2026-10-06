import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P2_FULL_SECTIONS,
  P2_FULL_MIN_TASKS,
  P2_FULL_MAX_TASKS,
  P2_FULL_REQUIRED_AREAS,
} from '../lib/p2-full-assessment-contract.ts';
import { resolveAssessmentBridge } from '../lib/assessment-bridge.ts';

test('P2 full assessment contract preserves all 23 original sections',()=>{
  assert.equal(P2_FULL_SECTIONS.length,23);
  assert.equal(new Set(P2_FULL_SECTIONS.map(item=>item.id)).size,23);
});

test('P2 full assessment preserves original micro-task scale',()=>{
  assert.equal(P2_FULL_MIN_TASKS,226);
  assert.equal(P2_FULL_MAX_TASKS,239);
});

test('P2 full assessment preserves 14 main reporting areas',()=>{
  assert.equal(P2_FULL_REQUIRED_AREAS.length,14);
  assert.equal(new Set(P2_FULL_REQUIRED_AREAS).size,14);
});

test('incomplete P2 must not be exposed as central ready',()=>{
  const p2=resolveAssessmentBridge('P2','GENERAL');
  assert.equal(p2?.status,'SOURCE_REFERENCE_ONLY');
  assert.equal(p2?.centralRoute,null);
  assert.equal(p2?.templateFamily,'CZA_P2_FULL_V1');
});


test('P2 card opens the dedicated restoration hub instead of the E3-only alert',()=>{
  const source=fs.readFileSync(new URL('../cza-degerlendirme/app.js',import.meta.url),'utf8');
  assert.match(source,/x\.dataset\.code==='P2'/);
  assert.match(source,/window\.location\.href='\/assessment\/p2'/);
  assert.match(source,/TAM KAYNAK · RESTORASYON/);
});

test('P2 restoration hub exposes the frozen full-source contract',()=>{
  const source=fs.readFileSync(new URL('../app/assessment/p2/page.tsx',import.meta.url),'utf8');
  assert.match(source,/P2_FULL_SECTIONS\.map/);
  assert.match(source,/P2_FULL_REQUIRED_AREAS\.map/);
  assert.match(source,/Gerçek öğrenci verisi/);
  assert.match(source,/cza-degerlendirme-hl4a5d\.v2\.appdeploy\.ai/);
});


test('central intake is the single profile hub and keeps incomplete P2 behind the restoration boundary',()=>{
  const source=fs.readFileSync(new URL('../components/central-assessment-intake.tsx',import.meta.url),'utf8');
  assert.match(source,/Tüm başlangıç değerlendirmeleri tek yerde/);
  assert.match(source,/ERKEN GELİŞİM/);
  assert.match(source,/OKUL ÇAĞI/);
  assert.match(source,/ÖZEL EĞİTİM VE ÖĞRENME PROFİLİ/);
  assert.match(source,/SP-DYS/);
  assert.match(source,/SP-MIX/);
  assert.match(source,/profileCode==='P2'/);
  assert.match(source,/target\?\.status==='SOURCE_REFERENCE_ONLY'/);
  assert.match(source,/window\.location\.href='\/assessment\/p2'/);
  assert.doesNotMatch(source,/cza-degerlendirme-hl4a5d\.v2\.appdeploy\.ai/);
});
