import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveNoteActivities,scoreEffectiveNoteTrial,effectiveNoteSummary,buildEffectiveNoteLearningRecord
} from '../lib/effective-notes.ts';

test('effective notes v1 covers four note-taking strategies',()=>{
  assert.deepEqual(effectiveNoteActivities.map(item=>item.code),[
    'main_idea_filter','keyword_notes','question_answer','summary_compression'
  ]);
});

test('note scoring separates structured accuracy from compression',()=>{
  const task=effectiveNoteActivities[0].first;
  const score=scoreEffectiveNoteTrial({
    task,
    answers:[0,0,2],
    note:'Su buharlaşır bulut olur ve yağışla geri döner.',
    startedAt:1000,
    completedAt:5000,
  });
  assert.equal(score.correct,2);
  assert.ok(score.noteWordCount>0);
  assert.ok(score.compressionRatio>0);
});

test('strong note transfer needs accurate selection and compact note',()=>{
  const summary=effectiveNoteSummary({
    first:{correct:3,promptCount:3,selectionAccuracy:1,noteWordCount:10,sourceWordCount:50,compressionRatio:.2,durationMs:3000},
    transfer:{correct:3,promptCount:3,selectionAccuracy:1,noteWordCount:8,sourceWordCount:50,compressionRatio:.16,durationMs:2800},
  });
  assert.equal(summary.band,'STRONG_TRANSFER');
});

test('canonical note record never stores raw note or pretends semantic grading',()=>{
  const record=buildEffectiveNoteLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    mode:'keyword_notes',
    startedAt:'2026-10-06T09:00:00.000Z',
    completedAt:'2026-10-06T09:03:00.000Z',
    first:{correct:3,promptCount:3,selectionAccuracy:1,noteWordCount:7,sourceWordCount:40,compressionRatio:.175,durationMs:3000},
    transfer:{correct:3,promptCount:3,selectionAccuracy:1,noteWordCount:6,sourceWordCount:40,compressionRatio:.15,durationMs:2800},
  });
  assert.equal(record.moduleId,'effective_notes');
  assert.equal(record.metadata.rawNoteStored,false);
  assert.equal(record.metadata.semanticAutoGrading,false);
});
