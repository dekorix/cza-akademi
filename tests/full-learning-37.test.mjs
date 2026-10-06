import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fullLearningStages,fullStudyAlias,stageByAlias,fullLearningProgress,buildFullLearningRecord
} from '../lib/full-learning-37.ts';

test('canonical full-learning contract contains exactly 37 unique ordered stages',()=>{
  assert.equal(fullLearningStages.length,37);
  assert.equal(new Set(fullLearningStages.map(stage=>stage.alias)).size,37);
  assert.deepEqual(fullLearningStages.map(stage=>stage.index),Array.from({length:37},(_,i)=>i+1));
  assert.equal(fullLearningStages[0].alias,'/cover');
  assert.equal(fullLearningStages[36].alias,'/teacherguide');
  assert.equal(fullStudyAlias,'/fullstudy');
});

test('critical canonical aliases retain their fixed positions',()=>{
  assert.equal(stageByAlias('/teachme')?.index,5);
  assert.equal(stageByAlias('/mindmap')?.index,8);
  assert.equal(stageByAlias('/quizme')?.index,22);
  assert.equal(stageByAlias('/mockexam')?.index,29);
  assert.equal(stageByAlias('/mastery')?.index,31);
  assert.equal(stageByAlias('/profile')?.index,35);
});

test('progress ignores unknown aliases and returns the next canonical stage',()=>{
  const progress=fullLearningProgress(['/cover','/studentinfo','/bogus']);
  assert.equal(progress.completed,2);
  assert.equal(progress.total,37);
  assert.equal(progress.next?.alias,'/objectives');
});

test('canonical record stores stage evidence but not raw student text',()=>{
  const record=buildFullLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    alias:'/feynman',
    topic:'Su döngüsü',
    startedAt:'2026-10-06T10:00:00.000Z',
    completedAt:'2026-10-06T10:03:00.000Z',
    evidenceWordCount:42,
    confidence:4,
    independent:true,
    transferApplied:true,
  });
  assert.equal(record.moduleId,'full_learning_37');
  assert.equal(record.activityType,'full_learning_feynman');
  assert.equal(record.performance.stageIndex,11);
  assert.equal(record.metadata.rawEvidenceStored,false);
  assert.equal(record.metadata.superCommand,'/fullstudy');
});
