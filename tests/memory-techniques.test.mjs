import test from 'node:test';
import assert from 'node:assert/strict';
import {
  memoryTechniques,
  scoreMemoryTrial,
  memorySessionSummary,
  buildMemoryLearningRecord,
} from '../lib/memory-techniques.ts';

test('memory v1 ships four distinct encoding techniques',()=>{
  assert.deepEqual(memoryTechniques.map(item=>item.code),['visual_link','story_chain','chunking','location']);
  assert.ok(memoryTechniques.every(item=>item.firstItems.length>=5&&item.transferItems.length>=5));
});

test('recall scoring rewards targets and penalizes intrusions',()=>{
  const score=scoreMemoryTrial({
    technique:'visual_link',
    phase:'first',
    selected:['balon','kitap','masa'],
    target:['balon','kitap','limon','anahtar','şapka'],
    startedAt:1000,
    completedAt:5000,
    cueUsed:false,
  });
  assert.equal(score.recalled,2);
  assert.equal(score.intrusions,1);
  assert.equal(score.accuracy,.2);
  assert.equal(score.supportLevel,'independent');
});

test('transfer summary distinguishes strong transfer from guided-practice need',()=>{
  const strong=memorySessionSummary({
    technique:'chunking',
    first:{recalled:4,intrusions:0,targetCount:5,accuracy:.8,latencyMs:2000,supportLevel:'independent'},
    transfer:{recalled:5,intrusions:0,targetCount:5,accuracy:1,latencyMs:1800,supportLevel:'independent'},
  });
  assert.equal(strong.band,'STRONG_TRANSFER');

  const support=memorySessionSummary({
    technique:'chunking',
    first:{recalled:2,intrusions:1,targetCount:5,accuracy:.2,latencyMs:2000,supportLevel:'prompted'},
    transfer:{recalled:2,intrusions:0,targetCount:5,accuracy:.4,latencyMs:1800,supportLevel:'prompted'},
  });
  assert.equal(support.band,'NEEDS_GUIDED_PRACTICE');
});

test('canonical record stores strategy, transfer and support without diagnosis',()=>{
  const record=buildMemoryLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    technique:'story_chain',
    startedAt:'2026-10-06T08:00:00.000Z',
    completedAt:'2026-10-06T08:02:00.000Z',
    first:{recalled:3,intrusions:0,targetCount:5,accuracy:.6,latencyMs:3000,supportLevel:'independent'},
    transfer:{recalled:4,intrusions:0,targetCount:5,accuracy:.8,latencyMs:2500,supportLevel:'independent'},
    cueUsed:false,
  });
  assert.equal(record.moduleId,'memory');
  assert.equal(record.activityType,'memory_story_chain');
  assert.ok(record.skills.includes('memory_transfer'));
  assert.equal(JSON.stringify(record).toLowerCase().includes('diagnosis'),false);
});
