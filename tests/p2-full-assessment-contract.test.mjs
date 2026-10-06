import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P2_FULL_SECTIONS,
  P2_FULL_MIN_TASKS,
  P2_FULL_MAX_TASKS,
  P2_FULL_REQUIRED_AREAS,
} from '../lib/p2-full-assessment-contract.ts';
import { resolveAssessmentBridge } from '../lib/assessment-bridge.ts';

test('P2 full assessment contract preserves all 23 original sections',()=>{
  assert.equal(P2_FULL_SECTIONS.length,23);
  assert.equal(new Set(P2_FULL_SECTIONS.map(item=>item.id)).size,23);
});

test('P2 full assessment preserves original micro-task scale',()=>{
  assert.equal(P2_FULL_MIN_TASKS,226);
  assert.equal(P2_FULL_MAX_TASKS,239);
});

test('P2 full assessment preserves 14 main reporting areas',()=>{
  assert.equal(P2_FULL_REQUIRED_AREAS.length,14);
  assert.equal(new Set(P2_FULL_REQUIRED_AREAS).size,14);
});

test('incomplete P2 must not be exposed as central ready',()=>{
  const p2=resolveAssessmentBridge('P2','GENERAL');
  assert.equal(p2?.status,'SOURCE_REFERENCE_ONLY');
  assert.equal(p2?.centralRoute,null);
  assert.equal(p2?.templateFamily,'CZA_P2_FULL_V1');
});
