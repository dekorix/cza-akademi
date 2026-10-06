import test from 'node:test';
import assert from 'node:assert/strict';
import {
  speedReadingActivities,countWords,scoreReadingTrial,speedReadingSummary,buildSpeedReadingLearningRecord
} from '../lib/speed-reading.ts';

test('speed reading v1 has four balanced training modes',()=>{
  assert.deepEqual(speedReadingActivities.map(item=>item.code),[
    'phrase_chunking','visual_span','paced_reading','comprehension_balance'
  ]);
  assert.ok(speedReadingActivities.every(item=>item.first.questions.length===2&&item.transfer.questions.length===2));
});

test('reading score combines duration with comprehension',()=>{
  const score=scoreReadingTrial({
    text:'bir iki üç dört beş altı',
    durationMs:6000,
    answers:[0,1],
    correctAnswers:[0,1],
  });
  assert.equal(countWords('bir iki üç'),3);
  assert.equal(score.wpm,60);
  assert.equal(score.comprehension,1);
});

test('poor comprehension blocks speed-only success',()=>{
  const summary=speedReadingSummary({
    first:{wordCount:50,durationMs:30000,wpm:100,correctAnswers:2,questionCount:2,comprehension:1},
    transfer:{wordCount:50,durationMs:15000,wpm:200,correctAnswers:0,questionCount:2,comprehension:0},
  });
  assert.equal(summary.band,'COMPREHENSION_FIRST');
});

test('canonical speed record stores fluency and comprehension transfer',()=>{
  const record=buildSpeedReadingLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    mode:'phrase_chunking',
    startedAt:'2026-10-06T09:00:00.000Z',
    completedAt:'2026-10-06T09:03:00.000Z',
    first:{wordCount:40,durationMs:30000,wpm:80,correctAnswers:2,questionCount:2,comprehension:1},
    transfer:{wordCount:40,durationMs:24000,wpm:100,correctAnswers:2,questionCount:2,comprehension:1},
  });
  assert.equal(record.moduleId,'speed_reading');
  assert.ok(record.skills.includes('reading_comprehension'));
  assert.equal(record.metadata.normReferenced,false);
});
