import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpecialEducationProgramDraft } from '../lib/special-education-program.ts';

const profile = {
  sessionId:'11111111-1111-4111-8111-111111111111',
  profileCode:'SP-DYS',
  profileLabel:'Disleksi / Okuma Güçlüğü Tarama Profili',
  templateCode:'CZA_SPECIAL_V1_DYS',
  completedAt:'2026-10-05T20:00:00Z',
  evidenceCount:8, independentCount:3, supportedCount:5,
  overallStatus:'PRIORITY',
  domains:[],
  priorities:[
    {key:'letter_sound',label:'Harf–Ses Otomatikliği',status:'PRIORITY',reason:'x'},
    {key:'blending',label:'Hece Birleştirme ve Köprüleme',status:'WATCH',reason:'y'},
    {key:'error_awareness',label:'Hata Farkındalığı ve Öz-Düzeltme',status:'WATCH',reason:'z'},
  ],
  note:'tanı değildir'
};

test('builds educator-reviewable four-week program',()=>{
  const draft=buildSpecialEducationProgramDraft(profile,{sessionsPerWeek:3,sessionMinutes:25});
  assert.equal(draft.durationWeeks,4);
  assert.equal(draft.weeks.length,4);
  assert.equal(draft.priorities.length,3);
  assert.equal(draft.priorities[0].key,'letter_sound');
  assert.match(draft.note,/eğitimci onayı olmadan/i);
});

test('caps cadence and allows priority selection',()=>{
  const draft=buildSpecialEducationProgramDraft(profile,{sessionsPerWeek:9,sessionMinutes:90,selectedPriorityKeys:['blending']});
  assert.equal(draft.sessionsPerWeek,5);
  assert.equal(draft.sessionMinutes,45);
  assert.deepEqual(draft.selectedPriorityKeys,['blending']);
});
