import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { feedbackModeFor, shouldShowCountdown } from '../lib/practice-mode.ts';

test('countdown is centrally limited to measured modes by default',()=>{
  assert.equal(shouldShowCountdown({practiceMode:'free_practice',timed:false}),false);
  assert.equal(shouldShowCountdown({practiceMode:'guided_practice',timed:true}),false);
  assert.equal(shouldShowCountdown({practiceMode:'guided_practice',countdownEnabled:true}),true);
  assert.equal(shouldShowCountdown({practiceMode:'performance',timed:true}),true);
  assert.equal(shouldShowCountdown({practiceMode:'assessment',assessmentMode:true}),true);
  assert.equal(feedbackModeFor('free_practice'),'immediate');
  assert.equal(feedbackModeFor('performance'),'end_of_session');
  assert.equal(feedbackModeFor('assessment'),'none_during_test');
});

const comparisonSource = fs.readFileSync(new URL('../lib/soroban-comparison.ts',import.meta.url),'utf8')
  .replace("import { placeName } from './soroban-curriculum';", "const placeName = place => ({1:'birler',10:'onlar',100:'yüzler',1000:'binler'}[place] ?? String(place));");
const comparisonJs = ts.transpileModule(comparisonSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const comparison = await import(`data:text/javascript;base64,${Buffer.from(comparisonJs).toString('base64')}`);

test('274 and 264 differ only on the tens rod and serialize compactly',()=>{
  const result = comparison.compareSorobanStates(274,264,3);
  assert.equal(result.isCorrect,false);
  assert.deepEqual(result.differingRods,[1]);
  assert.deepEqual(result.differingPlaceValues,[10]);
  assert.match(result.message,/onlar/);
  assert.equal(comparison.serializeSorobanState(7,5),'00007');
});

test('studio records visual soroban snapshots and delays test feedback',()=>{
  const studio = fs.readFileSync(new URL('../app/studio/page.tsx',import.meta.url),'utf8');
  const records = fs.readFileSync(new URL('../lib/core-records.ts',import.meta.url),'utf8');
  assert.match(studio,/studentSorobanState/);
  assert.match(studio,/targetSorobanState/);
  assert.match(studio,/SorobanAnswerComparison/);
  assert.match(studio,/feedbackModeFor\(practiceMode\)/);
  assert.match(records,/differingRods/);
  assert.match(records,/attemptType/);
});

test('arithmetic uses semantic operations and hides redundant addition signs',()=>{
  const engine = fs.readFileSync(new URL('../lib/arithmetic-engine.ts',import.meta.url),'utf8');
  const page = fs.readFileSync(new URL('../app/arithmetic/page.tsx',import.meta.url),'utf8');
  assert.match(engine,/operationType: 'ADD' \| 'SUBTRACT'/);
  assert.match(page,/step\.operationType === 'SUBTRACT' \? '−'/);
  assert.match(page,/settings\.operationMode === 'mixed' \? '\+' : ''/);
  assert.match(page,/effectiveTransitionSeconds/);
});
