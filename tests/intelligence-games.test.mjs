import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intelligenceGameActivities,scoreIntelligenceTrial,intelligenceSessionSummary,buildIntelligenceLearningRecord
} from '../lib/intelligence-games.ts';

test('intelligence games v1 covers four reasoning families',()=>{
  assert.deepEqual(intelligenceGameActivities.map(item=>item.code),[
    'pattern_completion','classification','logic_inference','planning_sequence'
  ]);
  assert.ok(intelligenceGameActivities.every(item=>item.first.length===3&&item.transfer.length===3));
});

test('trial scoring records correctness and revisions separately',()=>{
  const score=scoreIntelligenceTrial({
    puzzles:intelligenceGameActivities[0].first,
    answers:[1,1,0],
    revisions:[0,1,2],
    startedAt:1000,
    completedAt:5000,
  });
  assert.equal(score.correct,2);
  assert.equal(score.revisions,3);
  assert.equal(score.questionCount,3);
});

test('perfect new-example reasoning produces strong transfer',()=>{
  const summary=intelligenceSessionSummary({
    first:{correct:2,questionCount:3,accuracy:2/3,revisions:1,durationMs:4000},
    transfer:{correct:3,questionCount:3,accuracy:1,revisions:0,durationMs:3500},
  });
  assert.equal(summary.band,'STRONG_TRANSFER');
});

test('canonical intelligence record does not claim IQ equivalence',()=>{
  const record=buildIntelligenceLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    mode:'logic_inference',
    startedAt:'2026-10-06T09:00:00.000Z',
    completedAt:'2026-10-06T09:03:00.000Z',
    first:{correct:2,questionCount:3,accuracy:2/3,revisions:1,durationMs:4000},
    transfer:{correct:3,questionCount:3,accuracy:1,revisions:0,durationMs:3500},
  });
  assert.equal(record.moduleId,'intelligence_games');
  assert.equal(record.metadata.iqEquivalent,false);
  assert.ok(record.skills.includes('problem_solving_transfer'));
});
