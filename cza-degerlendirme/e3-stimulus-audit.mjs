import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const c=vm.createContext({console,Date,Math,JSON,Set,Map,globalThis:null,module:{exports:{}},exports:{}});c.globalThis=c;
for(const f of ['e3-bank-v3.js','e3-bank-v3-foundation.js','e3-bank-v3-depth.js','e3-bank-v3-quality.js','e3-stimuli-v3.js'])vm.runInContext(fs.readFileSync(new URL(`./${f}`,import.meta.url),'utf8'),c,{filename:f});
const {E3_BANK:bank,E3_STIMULI:stim}=c;
assert.ok(stim,'E3_STIMULI yüklenmeli');
const names=[...new Set(bank.allTasks.map(t=>t.stimulus).filter(Boolean))];
assert.ok(names.length>=10,'Görsel uyaran çeşitliliği yetersiz');
for(const name of names){
  assert.ok(stim.has(name),`Uyaran renderer eksik: ${name}`);
  const html=stim.render(name);
  assert.ok(html.includes('v3-stimulus-board'),`${name}: kurumsal uyaran kabı eksik`);
  assert.ok(html.includes('data-choice='),`${name}: seçim düğmesi eksik`);
  assert.ok(html.includes('data-correct='),`${name}: ilk seçim kanıtı için doğru seçenek kodu eksik`);
  assert.ok((html.match(/class="svg-choice v3-stimulus-choice"/g)||[]).length>=2,`${name}: en az iki ayrıştırıcı seçenek olmalı`);
}
assert.equal(stim.supported.length,names.length,'Kullanılmayan veya eksik uyaran tanımı olmamalı');
console.log('E3_V3_STIMULUS_AUDIT_OK',JSON.stringify({stimuli:names.length,names}));
