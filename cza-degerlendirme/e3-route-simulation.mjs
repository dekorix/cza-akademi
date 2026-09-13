import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const c=vm.createContext({console,Date,Math,JSON,Set,Map,globalThis:null,module:{exports:{}},exports:{}});c.globalThis=c;
for(const f of ['e3-bank-v3.js','e3-bank-v3-foundation.js','e3-bank-v3-depth.js','e3-bank-v3-quality.js','e3-engine-v3.js'])vm.runInContext(fs.readFileSync(new URL(`./${f}`,import.meta.url),'utf8'),c,{filename:f});
const {E3_BANK:bank,E3_ENGINE:engine}=c;

const profiles={
  strong:(task,i)=>({support:'INDEPENDENT',firstMatch:task.scoring==='accuracy'?true:null,flags:i%4===3?['SPONTANEOUS_EXPLANATION']:[]}),
  supported:(task)=>({support:'MODELED',firstMatch:task.scoring==='accuracy'?false:null,flags:[]}),
  mixed:(task,i)=>i%2===0?({support:'INDEPENDENT',firstMatch:task.scoring==='accuracy'?true:null,flags:[]}):({support:'VISUAL_PROMPT',firstMatch:task.scoring==='accuracy'?false:null,flags:i%3===0?['SELF_CORRECTED']:[]}),
  neutral:(task)=>({support:'NOT_OBSERVED',firstMatch:null,flags:[],neutral:true})
};

function simulate(domainId,age,profileName){
  const evidence={};const seen=new Set();const roles=[];let guard=0;
  while(guard++<30){
    const next=engine.selectNext(domainId,age,evidence);if(!next)break;
    assert.equal(seen.has(next.id),false,`${domainId}/${age}/${profileName}: aynı görev tekrar seçildi`);
    assert.ok(next.minAge<=age,`${domainId}/${age}/${profileName}: yaş üstü görev açıldı`);
    if(age<45)assert.notEqual(next.role,'ceiling',`${domainId}/${age}/${profileName}: erken tavan görevi açıldı`);
    seen.add(next.id);roles.push(next.role);
    evidence[next.id]=engine.createEvidence(next.id,profiles[profileName](next,seen.size-1));
  }
  assert.ok(guard<30,`${domainId}/${age}/${profileName}: rota sonlanmadı`);
  const band=engine.ageBand(age);const count=seen.size;
  assert.ok(count<=band.maxTasks,`${domainId}/${age}/${profileName}: maksimum görev sayısı aşıldı`);
  assert.ok(count>=band.base,`${domainId}/${age}/${profileName}: kanıt sayısı tabanın altında kaldı`);
  const summary=engine.domainSummary(domainId,evidence,age);
  return {count,roles,summary,evidence};
}

for(const d of bank.domains){
  for(const age of [36,39,42,45,47]){
    const strong=simulate(d.id,age,'strong');
    const supported=simulate(d.id,age,'supported');
    const mixed=simulate(d.id,age,'mixed');
    const neutral=simulate(d.id,age,'neutral');
    assert.ok(supported.count>=strong.count,`${d.id}/${age}: destek gerektiren rota güçlü rotadan kısa olmamalı`);
    assert.ok(mixed.count>=strong.count,`${d.id}/${age}: karışık rota güçlü rotadan kısa olmamalı`);
    assert.equal(neutral.summary.code,'INSUFFICIENT',`${d.id}/${age}: yalnız nötr kanıt yeterli sayılmamalı`);
    assert.ok(strong.summary.coverage.ratio>=0.66,`${d.id}/${age}: güçlü rota yaşa uygun kapsamı sağlamadı`);
    if(age>=45)assert.ok(strong.roles.includes('transfer'),`${d.id}/${age}: güçlü rotada transfer kanıtı yok`);
  }
}
console.log('E3_V3_ROUTE_SIMULATION_OK',JSON.stringify({domains:bank.domains.length,ages:5,profiles:Object.keys(profiles)}));
