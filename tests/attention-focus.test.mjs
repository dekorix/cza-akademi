import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attentionActivities,
  scoreAttentionTrial,
  attentionSessionSummary,
  buildAttentionLearningRecord,
} from '../lib/attention-focus.ts';

test('attention v1 covers four executive-attention components',()=>{
  assert.deepEqual(attentionActivities.map(item=>item.code),[
    'selective_attention','sustained_attention','inhibition','rule_switch'
  ]);
});

test('attention scoring separates hits, false alarms and omissions',()=>{
  const score=scoreAttentionTrial({
    mode:'selective_attention',
    phase:'first',
    items:['▲','●','▲','■'],
    targets:['▲','▲'],
    selectedIndexes:[0,1],
    startedAt:1000,
    completedAt:5000,
    cueUsed:false,
  });
  assert.equal(score.hits,1);
  assert.equal(score.falseAlarms,1);
  assert.equal(score.omissions,1);
  assert.equal(score.supportLevel,'independent');
});

test('strong transfer requires accuracy and response control',()=>{
  const strong=attentionSessionSummary({
    mode:'inhibition',
    first:{hits:4,falseAlarms:0,omissions:0,correctRejects:6,targetCount:4,accuracy:1,latencyMs:3000,meanSelectionLatencyMs:750,supportLevel:'independent'},
    transfer:{hits:4,falseAlarms:0,omissions:0,correctRejects:6,targetCount:4,accuracy:1,latencyMs:2800,meanSelectionLatencyMs:700,supportLevel:'independent'},
  });
  assert.equal(strong.band,'STRONG_CONTROL');
});

test('canonical attention record stores transfer and control evidence without diagnosis',()=>{
  const record=buildAttentionLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    mode:'rule_switch',
    startedAt:'2026-10-06T09:00:00.000Z',
    completedAt:'2026-10-06T09:02:00.000Z',
    first:{hits:2,falseAlarms:0,omissions:0,correctRejects:6,targetCount:2,accuracy:1,latencyMs:2000,meanSelectionLatencyMs:1000,supportLevel:'independent'},
    transfer:{hits:2,falseAlarms:0,omissions:0,correctRejects:6,targetCount:2,accuracy:1,latencyMs:1900,meanSelectionLatencyMs:950,supportLevel:'independent'},
    cueUsed:false,
  });
  assert.equal(record.moduleId,'attention_focus');
  assert.equal(record.activityType,'attention_rule_switch');
  assert.ok(record.skills.includes('attention_transfer'));
  assert.equal(JSON.stringify(record).toLowerCase().includes('diagnosis'),false);
});
