import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const soroban = fs.readFileSync(new URL('../components/soroban.tsx',import.meta.url),'utf8');
const numberDisplay = fs.readFileSync(new URL('../components/exercise-number-display.tsx',import.meta.url),'utf8');
const styles = fs.readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const arithmetic = fs.readFileSync(new URL('../app/arithmetic/page.tsx',import.meta.url),'utf8');
const studio = fs.readFileSync(new URL('../app/studio/page.tsx',import.meta.url),'utf8');
const finger = fs.readFileSync(new URL('../app/paritmetik/page.tsx',import.meta.url),'utf8');

test('the shared soroban uses prismatic beads, central tokens and static reading states',()=>{
  for(const token of ['--soroban-red-base','--soroban-red-highlight','--soroban-red-shadow','--soroban-green-base','--soroban-green-highlight','--soroban-green-shadow','--soroban-frame','--soroban-rod','--soroban-bar','--soroban-background']) assert.match(styles,new RegExp(token));
  assert.match(styles,/clip-path:\s*polygon\(18% 0,82% 0,100% 50%,82% 100%,18% 100%,0 50%\)/);
  assert.match(soroban,/abacus-static/);
  assert.match(soroban,/abacus-interactive/);
  assert.match(styles,/\.abacus-static \.abacus-bead/);
  assert.match(soroban,/highlightPlaces/);
  assert.match(styles,/\.abacus-rod-difference/);
});

test('one numeric display standard is shared by arithmetic, finger and studio targets',()=>{
  assert.match(numberDisplay,/exercise-number/);
  assert.match(styles,/font-variant-numeric:\s*lining-nums tabular-nums/);
  assert.match(styles,/--exercise-number-primary/);
  assert.match(styles,/font-size:\s*clamp/);
  for(const source of [arithmetic,studio,finger]) assert.match(source,/ExerciseNumberDisplay/);
});

test('arithmetic finger assistance exposes guided and free modes without restarting the question',()=>{
  assert.match(arithmetic,/changeFingerMode\('guided'\)/);
  assert.match(arithmetic,/changeFingerMode\('free'\)/);
  assert.match(arithmetic,/transitionFinger\(currentHand, fingerName, fingerMode\)/);
  assert.match(arithmetic,/invalidStateNormalized/);
  const modeFunction = arithmetic.slice(arithmetic.indexOf('function changeFingerMode'),arithmetic.indexOf('const summary'));
  assert.doesNotMatch(modeFunction,/setIndex|setQuestions|setSessionId|setAnswer/);
});
