import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpecialReassessmentPlan, compareSpecialReassessment } from '../lib/special-reassessment.ts';

const profile={
  sessionId:'11111111-1111-4111-8111-111111111111',
  profileCode:'SP-DYS',
  profileLabel:'Disleksi / Okuma Güçlüğü Tarama Profili',
  templateCode:'CZA_SPECIAL_V1_DYS',
  completedAt:'2026-10-01T10:00:00Z',
  evidenceCount:6,independentCount:1,supportedCount:5,overallStatus:'PRIORITY',
  domains:[
    {key:'letter_sound',label:'Harf–Ses Otomatikliği',evidenceCount:3,independentCount:0,supportedCount:3,score:2.2,status:'EXPERT_REVIEW',recurringFlags:['b–d karıştı']},
    {key:'blending',label:'Hece Birleştirme',evidenceCount:3,independentCount:1,supportedCount:2,score:1.5,status:'PRIORITY',recurringFlags:['Hece düzeyinde kaldı']},
  ],
  priorities:[],note:'x'
};
const program={id:'22222222-2222-4222-8222-222222222222',plan:{
  profileCode:'SP-DYS',profileLabel:profile.profileLabel,assessmentSessionId:profile.sessionId,durationWeeks:4,sessionsPerWeek:3,sessionMinutes:25,
  selectedPriorityKeys:['letter_sound','blending'],priorities:[],weeks:[],reassessment:{week:4,rule:'x'},note:'n'
}};

test('reassessment plan uses only selected priority areas',()=>{
  const plan=buildSpecialReassessmentPlan(profile,program);
  assert.equal(plan.areas.length,2);
  assert.equal(plan.areas[0].probeCount,3);
  assert.match(plan.areas[0].instruction,/3 yeni örnek/);
});

test('comparison detects improvement and independence change',()=>{
  const result=compareSpecialReassessment(profile,program,[
    {key:'letter_sound',label:'Harf–Ses Otomatikliği',probes:[
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
      {verdict:'PARTIAL',support:'VERBAL_PROMPT',flags:[]},
    ]},
    {key:'blending',label:'Hece Birleştirme',probes:[
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
    ]},
  ]);
  assert.equal(result.areas[0].outcome,'IMPROVED');
  assert.equal(result.areas[1].outcome,'IMPROVED');
  assert.equal(result.overallOutcome,'IMPROVED');
  assert.equal(result.nextDecision,'CLOSE_OR_MAINTAIN');
});

test('persistent priority never auto-diagnoses',()=>{
  const result=compareSpecialReassessment(profile,program,[
    {key:'letter_sound',label:'Harf–Ses Otomatikliği',probes:[
      {verdict:'DIFFERENT',support:'MODELED',flags:['b–d karıştı']},
      {verdict:'DIFFERENT',support:'MODELED',flags:['b–d karıştı']},
      {verdict:'NO_RESPONSE',support:'PHYSICAL_ASSIST',flags:['Uzun arama / gecikme']},
    ]},
    {key:'blending',label:'Hece Birleştirme',probes:[
      {verdict:'DIFFERENT',support:'MODELED',flags:['Hece düzeyinde kaldı']},
      {verdict:'PARTIAL',support:'MODELED',flags:['Hece düzeyinde kaldı']},
      {verdict:'DIFFERENT',support:'VERBAL_PROMPT',flags:[]},
    ]},
  ]);
  assert.equal(result.overallOutcome,'PERSISTENT_PRIORITY');
  assert.equal(result.nextDecision,'EXPERT_REVIEW_CONSIDER');
  assert.match(result.note,/klinik tanı koymaz/);
});
