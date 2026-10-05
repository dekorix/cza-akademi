import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParentFriendlySpecialReport } from '../lib/special-parent-report.ts';

const profile={
  sessionId:'11111111-1111-4111-8111-111111111111',
  profileCode:'SP-DYS',
  profileLabel:'Disleksi / Okuma Güçlüğü Tarama Profili',
  templateCode:'CZA_SPECIAL_V1_DYS',
  completedAt:'2026-10-01T10:00:00Z',
  evidenceCount:6,independentCount:3,supportedCount:3,overallStatus:'PRIORITY',
  domains:[
    {key:'phonological',label:'Fonolojik İşleme',evidenceCount:3,independentCount:3,supportedCount:0,score:.4,status:'RELATIVE_STRENGTH',recurringFlags:[]},
    {key:'letter_sound',label:'Harf–Ses Otomatikliği',evidenceCount:3,independentCount:0,supportedCount:3,score:1.5,status:'PRIORITY',recurringFlags:['b–d karıştı']},
  ],
  priorities:[],note:'x'
};

test('parent report removes technical raw evidence and uses family-friendly sections',()=>{
  const report=buildParentFriendlySpecialReport({
    studentDisplayName:'Öğrenci',
    profile,
    program:{status:'active',completedSessions:5,totalSessions:12,progress:42,currentWeek:2},
    reassessment:null,
  });
  assert.equal(report.progress.percent,42);
  assert.ok(report.strengths.includes('Fonolojik İşleme'));
  assert.ok(report.supportPriorities.includes('Harf–Ses Otomatikliği'));
  assert.match(report.disclaimer,/Klinik tanı koymaz/);
  assert.equal(JSON.stringify(report).includes('b–d karıştı'),false);
});

test('parent report summarizes before-after change without exposing scores',()=>{
  const report=buildParentFriendlySpecialReport({
    studentDisplayName:'Öğrenci',
    profile,
    program:{status:'completed',completedSessions:12,totalSessions:12,progress:100,currentWeek:4},
    reassessment:{overallOutcome:'IMPROVED',areas:[{key:'letter_sound',label:'Harf–Ses Otomatikliği',outcome:'IMPROVED',nextStep:'Bakım düzeyinde izle.'}]},
  });
  assert.equal(report.change.available,true);
  assert.equal(report.change.areas[0].change,'Belirgin gelişim');
  assert.equal('baselineScore' in report.change.areas[0],false);
});
