import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(file){const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const anzan=await load('../lib/anzan-engine.ts');
const voiceClient=await load('../lib/cza-voice-client.ts');

test('repeated values remain separate presentation events',()=>{
  const sequence=[7,7,2,2,2,5];
  const events=anzan.createPresentationEvents({sequence,answer:25},300,100);
  assert.equal(events.filter(event=>event.phase==='VISIBLE').length,6);
  assert.deepEqual(events.filter(event=>event.phase==='VISIBLE').map(event=>event.term),sequence);
});

test('safe visual themes meet strong text contrast',()=>{
  for(const theme of Object.values(anzan.anzanThemes)) assert.ok(anzan.contrastRatio(theme.background,theme.foreground)>=7,theme.label);
});

test('Turkish language registry keeps subtraction wording deterministic',()=>{
  const tr=anzan.anzanLanguageRegistry['tr-TR'];
  assert.equal(tr.utterance(57,0),'57');
  assert.equal(tr.utterance(-3,2),'eksi 3');
  assert.equal(tr.utterance(7,2),'7');
});

test('voice integration stays server-side and preloads before playback',()=>{
  const page=fs.readFileSync(new URL('../app/studio/page.tsx',import.meta.url),'utf8');
  const route=fs.readFileSync(new URL('../app/api/voice/route.ts',import.meta.url),'utf8');
  assert.doesNotMatch(page,/speechSynthesis|SpeechSynthesisUtterance/);
  assert.match(page,/preloadVoiceClips/);
  assert.match(route,/process\.env\.OPENAI_API_KEY/);
  assert.match(route,/x-cza-voice-cache/);
  assert.match(route,/allowRequest\(request,'voice',60,60\*1000\)/);
  assert.match(route,/eksi \$\{Math\.abs\(term\)\}/);
});

test('0–99 audio library manifest is deterministic and complete',()=>{
  const manifest=anzan.numberAudioManifest();
  assert.equal(manifest.length,100); assert.equal(manifest[0],0); assert.equal(manifest.at(-1),99);
});

test('500, 300 and 200 ms gaps never overlap clips',()=>{
  for(const gap of [500,300,200]) { const schedule=anzan.scheduleAudioClips([410,620,380,510],gap); for(let index=1;index<schedule.length;index++) assert.ok(schedule[index].startMs>=schedule[index-1].endMs+gap); }
});

test('audio preloading limits simultaneous provider requests',async()=>{
  const originalFetch=globalThis.fetch, originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  let active=0, peak=0, id=0;
  globalThis.fetch=async()=>{ active++; peak=Math.max(peak,active); await new Promise(resolve=>setTimeout(resolve,5)); active--; return new Response(new Blob(['audio']),{status:200}); };
  URL.createObjectURL=()=>`blob:test-${++id}`;
  URL.revokeObjectURL=()=>{};
  try {
    const clips=await voiceClient.preloadVoiceClips(Array.from({length:12},(_,index)=>({term:index,index})),{language:'tr-TR',voiceProfile:'CZA_STANDARD',speechRate:1},4);
    assert.equal(clips.size,12);
    assert.ok(peak<=4,`peak request count was ${peak}`);
  } finally { globalThis.fetch=originalFetch; URL.createObjectURL=originalCreate; URL.revokeObjectURL=originalRevoke; }
});

