import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpecialDailyWork } from '../lib/special-daily-work.ts';

const draft = {
  profileCode:'SP-DYS', profileLabel:'Disleksi / Okuma Güçlüğü Tarama Profili',
  assessmentSessionId:'11111111-1111-4111-8111-111111111111',
  durationWeeks:4, sessionsPerWeek:3, sessionMinutes:25,
  selectedPriorityKeys:['letter_sound','blending','error_awareness'],
  priorities:[
    {key:'letter_sound',label:'Harf–Ses Otomatikliği',status:'PRIORITY',objective:'x',successCriterion:'a',activities:['A1','A2','A3']},
    {key:'blending',label:'Hece Birleştirme',status:'WATCH',objective:'y',successCriterion:'b',activities:['B1','B2','B3']},
    {key:'error_awareness',label:'Hata Farkındalığı',status:'WATCH',objective:'z',successCriterion:'c',activities:['C1','C2','C3']},
  ],
  weeks:[
    {week:1,focus:'Taban',educatorAction:'E1',measurement:'M1'},
    {week:2,focus:'Güçlendirme',educatorAction:'E2',measurement:'M2'},
    {week:3,focus:'Transfer',educatorAction:'E3',measurement:'M3'},
    {week:4,focus:'Kalıcılık',educatorAction:'E4',measurement:'M4'},
  ],
  reassessment:{week:4,rule:'Yeni örneklerle yeniden ölç.'},
  note:'n'
};

test('returns next short daily package',()=>{
  const work=buildSpecialDailyWork(draft,0);
  assert.ok(work);
  assert.equal(work?.week,1);
  assert.equal(work?.sessionInWeek,1);
  assert.equal(work?.minutes,25);
  assert.equal(work?.activities.length,3);
});

test('advances week from completed session count',()=>{
  const work=buildSpecialDailyWork(draft,3);
  assert.equal(work?.week,2);
  assert.equal(work?.sessionInWeek,1);
});

test('final session becomes reassessment',()=>{
  const work=buildSpecialDailyWork(draft,11);
  assert.equal(work?.isReassessment,true);
  assert.equal(work?.week,4);
});

test('returns null when program is complete',()=>{
  assert.equal(buildSpecialDailyWork(draft,12),null);
});
