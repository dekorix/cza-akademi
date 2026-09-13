import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const memory=new Map();
const localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const c=vm.createContext({console,Date,Math,JSON,Set,Map,localStorage,crypto:{randomUUID:()=>`test-session-${memory.size}`},globalThis:null,module:{exports:{}},exports:{}});c.globalThis=c;
for(const f of ['e3-bank-v3.js','e3-bank-v3-foundation.js','e3-bank-v3-depth.js','e3-bank-v3-quality.js','e3-engine-v3.js','e3-session-v4.js'])vm.runInContext(fs.readFileSync(new URL(`./${f}`,import.meta.url),'utf8'),c,{filename:f});
const {E3_SESSION:s,E3_ENGINE:e,E3_BANK:b}=c;
assert.ok(s&&e&&b,'v4 bağımlılıkları yüklenmeli');

function dateMonthsAgo(n){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
s.reset();
assert.equal(s.configureStudent({name:'Test',birth:dateMonthsAgo(35),assessor:'Eğitimci'}).ok,false,'35 ay reddedilmeli');
assert.equal(s.configureStudent({name:'Test',birth:dateMonthsAgo(48),assessor:'Eğitimci'}).ok,false,'48 ay reddedilmeli');
const configured=s.configureStudent({name:'Deneme Öğrenci',birth:dateMonthsAgo(42),assessor:'CZA Eğitimci',language:'Türkçe',purpose:'GENERAL'});
assert.equal(configured.ok,true,'42 aylık oturum kurulmalı');
assert.equal(s.state().screen,'dashboard');
assert.equal(s.state().student.age,42);
assert.ok(s.state().session.startedAt,'oturum başlangıcı kaydedilmeli');

const first=s.startDomain('VC');assert.ok(first,'ilk görev seçilmeli');
assert.equal(s.state().screen,'task');
const r1=s.recordChoice('A',false);const r2=s.recordChoice('B',true);
assert.equal(r2.touches,2,'dokunuş sayısı birikmeli');
assert.equal(r2.firstMatch,false,'ilk seçim kanıtı sonradan değişmemeli');
assert.equal(s.commitTask({flags:[],note:'',neutral:false}).ok,false,'destek düzeyi olmadan kanıt kapanmamalı');
const saved=s.commitTask({support:'INDEPENDENT',flags:['SELF_CORRECTED'],note:'İlk seçimden sonra strateji değiştirdi.'});
assert.equal(saved.ok,true,'görev kanıtı kaydedilmeli');
assert.ok(s.state().evidence[first.id],'kanıt oturum dosyasında tutulmalı');
assert.equal(s.state().evidence[first.id].firstMatch,false);

s.setCaregiver('CG-VC-1','Bazen görülür');
assert.equal(s.state().caregiver['CG-VC-1'],'Bazen görülür');
const exported=s.exportRecord();
assert.equal(exported.version,'E3-v4');
assert.equal(exported.student.name,'Deneme Öğrenci');
assert.ok(exported.session.id);
assert.ok(exported.progress.total===10);
assert.ok(memory.has(s.STORAGE),'durum localStorage üzerinde saklanmalı');
console.log('E3_V4_SESSION_TEST_OK',JSON.stringify({age:s.state().student.age,evidence:Object.keys(s.state().evidence).length,domains:exported.progress.total}));
