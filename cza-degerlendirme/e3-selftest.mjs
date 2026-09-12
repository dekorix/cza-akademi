import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context=vm.createContext({console,Date,Math,JSON,Set,Map,globalThis:null,module:{exports:{}},exports:{}});
context.globalThis=context;
for(const file of ['e3-bank-v3.js','e3-bank-v3-foundation.js','e3-engine-v3.js']){
  const code=fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
  vm.runInContext(code,context,{filename:file});
}
const bank=context.E3_BANK;
const engine=context.E3_ENGINE;
assert.ok(bank,'E3_BANK yüklenmeli');
assert.ok(engine,'E3_ENGINE yüklenmeli');
assert.equal(bank.domains.length,10,'10 gelişim alanı olmalı');
assert.equal(bank.allTasks.length,140,'Toplam görev bankası 140 görev olmalı');
assert.equal(bank.caregiver.length,30,'Bakımveren bankası 30 madde olmalı');

const ids=bank.allTasks.map(t=>t.id);
assert.equal(new Set(ids).size,ids.length,'Görev kimlikleri benzersiz olmalı');
for(const d of bank.domains){
  assert.equal(d.tasks.length,14,`${d.id} alanında 14 görev olmalı`);
  assert.ok(d.facets.length>=4,`${d.id} çok boyutlu kanıt üretmeli`);
  assert.ok(d.tasks.filter(t=>t.minAge<=36).length>=6,`${d.id} 36–38 ay için en az 6 uygun görev içermeli`);
  const cg=bank.caregiver.filter(q=>q.domainId===d.id);
  assert.equal(cg.length,3,`${d.id} için 3 bakımveren maddesi olmalı`);
  for(const t of d.tasks){
    assert.ok(t.title&&t.childPrompt&&t.protocol,'Her görev başlık, çocuk yönergesi ve protokol içermeli');
    assert.ok(Array.isArray(t.facets)&&t.facets.length>0,'Her görev en az bir beceri boyutuna bağlanmalı');
    assert.ok(t.minAge>=36&&t.minAge<=45,'Görev başlangıç yaşı E3 sınırlarında olmalı');
    assert.ok(['anchor','discriminator','transfer','ceiling'].includes(t.role),'Geçerli görev rolü olmalı');
    if(t.role==='ceiling')assert.equal(t.neutral,true,'Tavan görevleri nötr olmalı');
  }
}

for(const age of [36,39,42,45,47]){
  const band=engine.ageBand(age);assert.ok(band,`${age} ay bandı çözülmeli`);
  for(const d of bank.domains){
    const route=engine.recommendedRoute(d.id,age,{});
    assert.ok(route.length>=band.base,`${d.id}/${age}: temel kanıt yoğunluğu karşılanmalı`);
    assert.ok(route.length<=band.maxTasks,`${d.id}/${age}: aşırı değerlendirme yapılmamalı`);
    assert.ok(route.every(t=>t.minAge<=age),`${d.id}/${age}: yaş üstü görev açılmamalı`);
  }
}

const supportEvidence={};
for(const id of ['VC01','VC02','VC03'])supportEvidence[id]=engine.createEvidence(id,{support:'MODELED',firstMatch:false});
const nextSupport=engine.selectNext('VC',42,supportEvidence);
assert.ok(nextSupport,'Destek gereksiniminde ayırt edici görev açılmalı');
assert.notEqual(nextSupport.role,'ceiling','Zorlanma varken tavan görevi öne alınmamalı');

const strongEvidence={};
for(const id of ['VC01','VC02','VC03','VC04','VC05','VC06','VC07','VC08'])strongEvidence[id]=engine.createEvidence(id,{support:'INDEPENDENT',firstMatch:true});
const summary=engine.domainSummary('VC',45,strongEvidence);
assert.ok(['Göreli güçlü kanıt','Gelişen / karışık profil'].includes(summary.status),'Alan özeti normatif olmayan etiket üretmeli');

assert.equal(engine.validateSession(35,{}).valid,false,'35 ay E3 dışında olmalı');
assert.equal(engine.validateSession(48,{}).valid,false,'48 ay E3 dışında olmalı');
assert.equal(engine.validateSession(42,{}).valid,true,'42 ay geçerli olmalı');
console.log('E3_V3_SELFTEST_OK',JSON.stringify({domains:bank.domains.length,tasks:bank.allTasks.length,caregiver:bank.caregiver.length,version:bank.meta.version}));
