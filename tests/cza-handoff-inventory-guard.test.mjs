import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditCzaSourceInventory } from '../scripts/qa/cza-handoff-inventory-guard.mjs';
const files=()=>({
  bridge:readFileSync('lib/assessment-bridge.ts','utf8'),
  p2:readFileSync('lib/p2-full-assessment-contract.ts','utf8'),
  skills:readFileSync('docs/CZA_14_Beceri_v1.md','utf8'),
  protocol:readFileSync('docs/CZA_KONTROL_PROTOKOLU.md','utf8'),
  decisionLedger:readFileSync('docs/CZA_KARAR_DEFTERI.md','utf8'),
  inventory:readFileSync('docs/CZA_DEGERLENDIRME_KAYNAK_ENVANTERI_20261009.md','utf8'),
});
test('canonical source contract has 16+10 profile IDs, P2 23 sections and 14 skills',()=>{
  const r=auditCzaSourceInventory(files());assert.deepEqual(r.errors,[]);assert.equal(r.pass,true);
  assert.deepEqual(r.stats,{intake:16,special:10,p2Sections:23,p2Min:226,p2Max:239,skills:14});
  assert.equal(r.kind,'SOURCE_INVENTORY_ONLY_NOT_STAGING_ACCEPTANCE');
});
test('missing intake code fails',()=>{
  const f=files();f.bridge=f.bridge.replace("'P10',","");const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('intake MISSING: P10')));
});
test('missing special profile fails',()=>{
  const f=files();f.bridge=f.bridge.replace("'SP-MIX',","");const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('special MISSING: SP-MIX')));
});
test('missing P2 block fails',()=>{
  const f=files();f.p2=f.p2.replace(/\{ id:'P2-23'[^\n]*\},?\n/,'');const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('P2 sections MISSING: P2-23')));
});
test('P2 bounds changed require explicit before/after decision',()=>{
  const f=files();f.p2=f.p2.replace('minTasks:9, maxTasks:9','minTasks:8, maxTasks:9');const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('checksum')));
});
test('missing canonical 14 skill fails',()=>{
  const f=files();f.skills=f.skills.replace('**CZA-S14','**SKILL-14');const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('skills MISSING: CZA-S14')));
});
test('P2 cannot be marked central ready without updating guard and evidence',()=>{
  const f=files();f.bridge=f.bridge.replace("P2:{profileCode:'P2',sourceLabel:'1. sınıf sonu / 2. sınıf başlangıcı',status:'SOURCE_REFERENCE_ONLY'","P2:{profileCode:'P2',sourceLabel:'1. sınıf sonu / 2. sınıf başlangıcı',status:'CENTRAL_READY'");
  const r=auditCzaSourceInventory(f);assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('P2 source-only')));
});
test('forgotten governance decision ledger fails',()=>{
  const f=files();f.decisionLedger='';const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('decision checkpoint')));
});
test('invented new profile requires explicit inventory revision',()=>{
  const f=files();f.bridge=f.bridge.replace("'P10',","'P10','P11',");const r=auditCzaSourceInventory(f);
  assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes('intake ADDED')));
});
