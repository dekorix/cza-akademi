import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const c=vm.createContext({console,Date,Math,JSON,Set,Map,globalThis:null,module:{exports:{}},exports:{}});c.globalThis=c;
for(const f of ['e3-bank-v3.js','e3-bank-v3-foundation.js','e3-bank-v3-depth.js','e3-engine-v3.js'])vm.runInContext(fs.readFileSync(new URL(`./${f}`,import.meta.url),'utf8'),c,{filename:f});
const {E3_BANK:bank,E3_ENGINE:engine}=c;
const forbidden=/zeka yaşı|gerilik|başarısız|tanı koy|normal değil|geri kaldı/i;
const roles=['anchor','discriminator','transfer','ceiling'];
for(const d of bank.domains){
  const titleSet=new Set();
  for(const role of roles)assert.ok(d.tasks.some(t=>t.role===role),`${d.id}: ${role} görevi eksik`);
  const totalMethodFloor=d.id==='VC'?3:4;
  assert.ok(new Set(d.tasks.map(t=>t.modality)).size>=totalMethodFloor,`${d.id}: toplam yöntem çeşitliliği düşük`);
  for(const t of d.tasks){
    assert.ok(t.protocol.length>=35,`${t.id}: uygulama protokolü kısa`);
    assert.ok(t.childPrompt.length<=120,`${t.id}: çocuk yönergesi gereksiz uzun`);
    assert.equal(forbidden.test(`${t.title} ${t.childPrompt}`),false,`${t.id}: damgalayıcı/klinik dil bulundu`);
    assert.equal(titleSet.has(t.title),false,`${d.id}: yinelenen görev başlığı ${t.title}`);titleSet.add(t.title);
  }
  for(const age of [36,39,42,45,47]){
    const route=engine.recommendedRoute(d.id,age,{});
    const band=engine.ageBand(age);
    assert.ok(route.length>=band.base&&route.length<=band.maxTasks,`${d.id}/${age}: rota yoğunluğu sınır dışında`);
    const modalities=new Set(route.map(t=>t.modality));
    const minModalities=d.id==='VC'?(age>=45?3:2):(age>=42?3:2);
    assert.ok(modalities.size>=minModalities,`${d.id}/${age}: yöntem çeşitliliği düşük`);
    const routeFacets=new Set(route.flatMap(t=>t.facets));
    const ageFacets=engine.activeFacets(d.id,age);
    const coveredAgeFacets=ageFacets.filter(f=>routeFacets.has(f));
    assert.ok(coveredAgeFacets.length/Math.max(1,ageFacets.length)>=0.66,`${d.id}/${age}: yaşa uygun beceri boyutu kapsamı düşük`);
    if(age<45)assert.equal(route.some(t=>t.role==='ceiling'),false,`${d.id}/${age}: erken tavan görevi açıldı`);
    assert.ok(route.filter(t=>t.role==='ceiling').length<=1,`${d.id}/${age}: birden fazla tavan görevi açıldı`);
  }
}
const scales=new Set(bank.caregiver.flatMap(q=>q.responseScale));
assert.deepEqual([...scales],['Sık görülür','Bazen görülür','Henüz gözlenmedi','Emin değilim'],'Bakımveren ölçeği tutarlı olmalı');
console.log('E3_V3_QUALITY_AUDIT_OK',JSON.stringify({domains:bank.domains.length,tasks:bank.allTasks.length,caregiver:bank.caregiver.length,version:bank.meta.version}));
