import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/core-records.ts', import.meta.url), 'utf8')
  .replace("import { exerciseForMode } from './exercise-registry';", "const exerciseForMode = mode => ({id: mode.toUpperCase(), skills: []});");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

assert.equal(module.moduleCodeByMode.flash, 'flash_anzan');
assert.equal(module.moduleCodeByMode.audio, 'audio_anzan');
const config = {mode:'flash',digits:1,minDigits:1,maxDigits:2,terms:3,rounds:5,interval:.5,operation:'mixed',pool:[1,2],additionPool:[1],subtractionPool:[2],freePractice:true};
assert.deepEqual(module.trainingSettings(config).questionCount, 5);
const payload = module.attemptPayload({sequence:[8,-2,4],expected:10,given:9,correct:false,elapsedMs:1234,stimulusDurationMs:500},config,2,{attemptId:'a',questionId:'q'});
assert.equal(payload.errorType, 'RESPONSE_ERROR');
assert.deepEqual(payload.metadata.sequence, [8,-2,4]);
assert.equal(payload.totalResponseTimeMs, 1234);
console.log('core records: 7 assertions passed');
