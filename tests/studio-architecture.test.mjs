import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { durationLabel, progressionSuggestion, speedLabel } from '../lib/timed-stimulus.ts';

const registry = fs.readFileSync(new URL('../lib/exercise-registry.ts',import.meta.url),'utf8');
const studio = fs.readFileSync(new URL('../app/studio/page.tsx',import.meta.url),'utf8');
const arithmeticPage = fs.readFileSync(new URL('../app/arithmetic/page.tsx',import.meta.url),'utf8');
const fingerPage = fs.readFileSync(new URL('../app/paritmetik/page.tsx',import.meta.url),'utf8');
const launch = fs.readFileSync(new URL('../components/exercise-launch-sequence.tsx',import.meta.url),'utf8');
const styles = fs.readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');

test('the central exercise registry contains all seven CZA modules and skill links',()=>{
  for(const id of ['FINGER_READING','FINGER_PRESSING','SOROBAN_READING','SOROBAN_WRITING','ADDITION_SUBTRACTION','FLASH_ANZAN','AUDIO_ANZAN']) assert.match(registry,new RegExp(id));
  assert.match(registry,/finger\.numberRecognition/);
  assert.match(registry,/soroban\.placeValue/);
  assert.match(registry,/mental\.visualization/);
});

test('finger and soroban reading share the same timed stimulus states',()=>{
  assert.match(studio,/timedReading/);
  assert.match(studio,/phase === 'stimulus'/);
  assert.match(studio,/presentationDurationMs/);
  assert.match(studio,/answerDurationMs/);
  assert.match(studio,/numberPattern\(current\.answer\)/);
  assert.match(studio,/presentationStartedAt/);
  assert.match(studio,/answerStartedAt/);
});

test('all studio modes use one launch sequence and later questions use a short neutral preparation',()=>{
  assert.match(studio,/ExerciseLaunchSequence/);
  assert.match(launch,/exerciseType/);
  assert.match(launch,/countdownEnabled/);
  assert.match(launch,/soundEnabled/);
  for(const label of ["'3'","'2'","'1'","'BAŞLA!'"]) assert.match(launch,new RegExp(label.replace(/[!*]/g,'\\$&')));
  assert.match(studio,/function nextQuestion\(\).*setPhase\('prepare'\)/);
  assert.doesNotMatch(studio,/function nextQuestion\(\).*setPhase\([^\n]*'countdown'/);
  assert.match(arithmeticPage,/ExerciseLaunchSequence/);
  assert.match(fingerPage,/ExerciseLaunchSequence/);
  assert.match(fingerPage,/setLaunching\(true\)/);
});

test('stimulus timing starts in the committed stimulus phase and motion has an accessible fallback',()=>{
  const stimulusEffect = studio.indexOf("if (phase !== 'stimulus'");
  const presentationStart = studio.indexOf('presentationStartedAt.current',stimulusEffect);
  assert.ok(stimulusEffect >= 0 && presentationStart > stimulusEffect);
  assert.match(styles,/prefers-reduced-motion: reduce/);
  assert.match(styles,/launch-reduced-fade/);
  assert.match(styles,/data-focus-mode/);
  for(const direction of ['up','right','left','zoom']) assert.match(launch,new RegExp(`direction: '${direction}'`));
  assert.match(styles,/launch-scene-right/);
  assert.match(styles,/launch-scene-left/);
  assert.match(styles,/launch-scene-zoom/);
});

test('human duration labels and progression advice stay pedagogically cautious',()=>{
  assert.equal(durationLabel(300),'0,3 sn · 300 ms');
  assert.equal(durationLabel(900),'0,9 sn · 900 ms');
  assert.equal(durationLabel(80),'0,08 sn · 80 ms');
  assert.equal(speedLabel(300),'Hızlı');
  assert.match(progressionSuggestion(96,30,500),/400 ms/);
  assert.match(progressionSuggestion(60,30,400),/500 ms/);
  assert.match(progressionSuggestion(100,3,500),/en az 10/);
});
