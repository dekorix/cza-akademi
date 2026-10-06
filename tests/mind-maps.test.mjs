import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mindMapActivities,scoreMindMapTrial,mindMapSessionSummary,buildMindMapLearningRecord
} from '../lib/mind-maps.ts';

test('every mind-map task uses exactly seven branches',()=>{
  assert.equal(mindMapActivities.length,4);
  assert.ok(mindMapActivities.every(item=>item.first.branches.length===7&&item.transfer.branches.length===7));
});

test('mind-map scoring separates completeness from correctness',()=>{
  const task=mindMapActivities[0].first;
  const score=scoreMindMapTrial({
    task,
    selections:['enerji','yanlış','','elma','sabah','ev','denge'],
    startedAt:1000,
    completedAt:6000,
  });
  assert.equal(score.completedBranches,6);
  assert.equal(score.correctBranches,5);
  assert.equal(score.branchCount,7);
});

test('transfer band requires a nearly complete accurate seven-branch map',()=>{
  const summary=mindMapSessionSummary({
    first:{correctBranches:5,completedBranches:7,branchCount:7,accuracy:5/7,completeness:1,durationMs:4000},
    transfer:{correctBranches:7,completedBranches:7,branchCount:7,accuracy:1,completeness:1,durationMs:3500},
  });
  assert.equal(summary.band,'STRONG_TRANSFER');
});

test('canonical mind-map record preserves seven-branch transfer evidence',()=>{
  const record=buildMindMapLearningRecord({
    trainingSessionId:'22222222-2222-4222-8222-222222222222',
    clientRecordId:'11111111-1111-4111-8111-111111111111',
    mode:'branch_match',
    startedAt:'2026-10-06T09:00:00.000Z',
    completedAt:'2026-10-06T09:04:00.000Z',
    first:{correctBranches:7,completedBranches:7,branchCount:7,accuracy:1,completeness:1,durationMs:3000},
    transfer:{correctBranches:7,completedBranches:7,branchCount:7,accuracy:1,completeness:1,durationMs:2800},
  });
  assert.equal(record.moduleId,'mind_maps');
  assert.equal(record.metadata.branchCount,7);
  assert.ok(record.skills.includes('hierarchy'));
});
