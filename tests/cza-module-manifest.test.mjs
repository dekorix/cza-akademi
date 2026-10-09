import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const doc=JSON.parse(readFileSync('docs/CZA_MODUL_KANONIK_MANIFEST.json','utf8'));
const phases=doc.canonical_phases;
const all=[...doc.canonical_phases,...doc.cross_cutting_modules];
test('all ten canonical stages exist in approved order',()=>{
 assert.deepEqual(phases.map(x=>x.id),Array.from({length:10},(_,i)=>'F'+String(i+1).padStart(2,'0')));
 assert.match(doc.notice,/tamamlanma kanıtı değildir/);
});
test('the critical 15 crosscutting program families have distinct IDs',()=>{
 assert.deepEqual(doc.cross_cutting_modules.map(x=>x.id),Array.from({length:15},(_,i)=>'X'+String(i+1).padStart(2,'0')));
 assert.equal(new Set(all.map(x=>x.id)).size,all.length);
 assert.ok(doc.cross_cutting_modules.some(x=>x.name.includes('P2')));
 assert.ok(doc.cross_cutting_modules.some(x=>x.name.includes('Özel Eğitim')));
 assert.ok(doc.cross_cutting_modules.some(x=>x.name.includes('paket')));
});
test('source references exist but are not automatically accepted',()=>{
 for(const m of all){
   assert.ok(m.acceptance_required?.length>=22,m.id+' missing acceptance contract');
   assert.equal(m.source_status,'SOURCE_REFERENCE_PRESENT_ACCEPTANCE_UNVERIFIED');
   assert.ok(m.source_refs.length>0,m.id+' has no sources');
   for(const path of m.source_refs){
     assert.ok(!path.startsWith('/')&&!path.includes('..'),m.id+' unsafe ref');
     assert.ok(existsSync(path),m.id+' missing source '+path);
   }
 }
});
test('commercial and high risk decisions cannot be silently omitted',()=>{
 assert.ok(doc.commercial_decisions_open.length>=3);
 assert.ok(doc.high_risk_open.length>=3);
 assert.ok(doc.high_risk_open.some(x=>x.includes('PR #73')));
 assert.ok(doc.high_risk_open.some(x=>x.includes('PR #74')));
 assert.ok(doc.high_risk_open.some(x=>x.includes('#72')));
});
