/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

import { exerciseForMode, exerciseRegistry } from '../lib/exercise-registry.ts';
import { createQuestion, defaultConfig, score, validateConfig } from '../lib/exercise-engine.ts';
import * as anzan from '../lib/anzan-engine.ts';
import { assignedEnginePath, freePracticePath, isAssignedEngineModule } from '../lib/work-center.ts';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const dataModule = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`);

const recipes = await dataModule(read('../lib/training-recipes.ts')
  .replace("import { defaultConfig, validateConfig, type ExerciseConfig, type ExerciseMode } from './exercise-engine';", `
    const defaultConfig = ${JSON.stringify(defaultConfig)};
    const modeLabels = { 'finger-read':'Parmak', 'soroban-read':'Soroban okuma', 'soroban-write':'Soroban yazma', flash:'Flash', audio:'Sesli' };
    const validateConfig = ${validateConfig.toString()};
  `)
  .replace("import { feedbackModeFor } from './practice-mode';", "const feedbackModeFor = mode => mode === 'performance' ? 'end_of_session' : 'immediate';"));

const records = await dataModule(read('../lib/core-records.ts')
  .replace("import { exerciseForMode } from './exercise-registry';", `const definitions = ${JSON.stringify(exerciseRegistry)}; const exerciseForMode = mode => definitions.find(item => item.mode === mode);`)
  .replace("import { feedbackModeFor, learningModeFor } from './practice-mode';", "const feedbackModeFor = mode => mode === 'performance' ? 'end_of_session' : mode === 'assessment' ? 'none_during_test' : 'immediate'; const learningModeFor = mode => mode;")
  .replace("import { anzanDifficulty } from './anzan-engine';", `const anzanDifficulty = ${anzan.anzanDifficulty.toString()};`));

function seeded(seed) {
  let state = seed;
  return () => { state = state * 16807 % 2147483647; return (state - 1) / 2147483646; };
}

test('registry preserves the seven unique canonical IDs, metadata, routing, and unknown lookup', () => {
  assert.deepEqual(exerciseRegistry.map(item => item.id), [
    'FINGER_READING', 'FINGER_PRESSING', 'SOROBAN_READING', 'SOROBAN_WRITING',
    'ADDITION_SUBTRACTION', 'FLASH_ANZAN', 'AUDIO_ANZAN',
  ]);
  assert.equal(new Set(exerciseRegistry.map(item => item.id)).size, exerciseRegistry.length);
  for (const item of exerciseRegistry) {
    assert.ok(item.title && item.description && item.category && item.icon);
    assert.ok(item.skills.length > 0);
    assert.notEqual(Boolean(item.mode), Boolean(item.href), item.id);
  }
  assert.equal(exerciseForMode('flash')?.id, 'FLASH_ANZAN');
  assert.equal(exerciseForMode('not-a-mode'), undefined);
});

test('exercise engine deterministically creates the current question shape for every mode', () => {
  for (const mode of ['finger-read', 'soroban-read', 'soroban-write', 'flash', 'audio']) {
    const config = { ...defaultConfig, mode, digits: 1, minDigits: 1, maxDigits: 1, terms: 4 };
    const first = createQuestion(config, seeded(8128));
    const second = createQuestion(config, seeded(8128));
    assert.deepEqual(first, second, mode);
    assert.equal(first.answer, first.sequence.reduce((sum, term) => sum + term, 0));
    assert.equal(first.sequence.length, mode.includes('soroban') || mode === 'finger-read' ? 1 : 4);
  }
});

test('exercise config boundaries and malformed inputs retain their fail-closed behavior', () => {
  assert.doesNotThrow(() => validateConfig({ ...defaultConfig, mode: 'finger-read', digits: 2, minDigits: 2, maxDigits: 2, presentationDurationMs: 80 }));
  assert.doesNotThrow(() => validateConfig({ ...defaultConfig, mode: 'flash', stimulusVisibleMs: 100, interStimulusGapMs: 80 }));
  assert.doesNotThrow(() => validateConfig({ ...defaultConfig, mode: 'audio', language: 'tr-TR', speechRate: .75 }));
  for (const patch of [
    { mode: 'unknown' }, { mode: 'finger-read', digits: 3 },
    { mode: 'flash', stimulusVisibleMs: 99 }, { mode: 'flash', interStimulusGapMs: 79 },
    { mode: 'audio', language: 'en-US' }, { speechRate: 1.31 }, { pool: [] },
    { mode: 'soroban-read', rods: 4, minDigits: 5, maxDigits: 5 },
  ]) assert.throws(() => validateConfig({ ...defaultConfig, ...patch }));
});

test('score excludes retry feedback attempts and preserves timeout and latency semantics', () => {
  assert.deepEqual(score([
    { correct: true, elapsedMs: 500, attemptType: 'PRIMARY' },
    { correct: true, elapsedMs: 200, attemptType: 'RETRY_AFTER_FEEDBACK' },
    { correct: false, timeout: true, elapsedMs: 1500 },
    { correct: false, elapsedMs: 1000 },
  ]), { total: 3, correct: 1, wrong: 1, timeout: 1, accuracy: 33, averageResponseMs: 1000, fastestCorrectMs: 500 });
});

test('Anzan presentation, themes, language, difficulty, and audio schedule remain canonical', () => {
  assert.deepEqual(anzan.transitionEffects.map(item => item.id), ['NONE','FADE','MICRO_SCALE','SLIDE_UP','SLIDE_DOWN','PULSE','BLINK_CLEAN','FLIP_SOFT']);
  for (const theme of Object.values(anzan.anzanThemes)) assert.ok(anzan.contrastRatio(theme.background, theme.foreground) >= 7);
  const events = anzan.createPresentationEvents({ sequence: [7, -2], answer: 5 }, 300, 120);
  assert.deepEqual(events.map(event => [event.eventIndex, event.term, event.phase]), [
    [0,7,'ENTER'], [0,7,'VISIBLE'], [0,7,'EXIT'], [0,7,'GAP'],
    [1,-2,'ENTER'], [1,-2,'VISIBLE'], [1,-2,'EXIT'], [1,-2,'GAP'],
  ]);
  assert.equal(anzan.anzanLanguageRegistry['tr-TR'].utterance(-8, 1), 'eksi 8');
  assert.deepEqual(anzan.anzanDifficulty({ stimulusVisibleMs: 250, minDigits: 1, maxDigits: 2, terms: 5, additionPool: [1,2], subtractionPool: [3], operation: 'mixed', mode: 'audio' }), {
    stimulusSpeed: 250, digitCount: { min: 1, max: 2 }, operationCount: 5,
    additionDigitPool: [1,2], subtractionDigitPool: [3], operationType: 'mixed', audioVisualMode: 'AUDITORY',
  });
  assert.deepEqual(anzan.scheduleAudioClips([100, 200, 50], 25), [
    { index: 0, startMs: 0, endMs: 100 }, { index: 1, startMs: 125, endMs: 325 }, { index: 2, startMs: 350, endMs: 400 },
  ]);
  assert.throws(() => anzan.scheduleAudioClips([100, 0], 25));
  assert.throws(() => anzan.numberAudioManifest(-1, 10));
});

test('recipe resolution keeps canonical modes, defaults, overrides, and invalid input barriers', () => {
  const expected = { finger_read:'finger-read', soroban_read:'soroban-read', soroban_write:'soroban-write', flash_anzan:'flash', audio_anzan:'audio' };
  for (const [moduleCode, mode] of Object.entries(expected)) {
    assert.equal(recipes.isAssignableModule(moduleCode), true);
    const defaults = recipes.defaultRecipeSettings(moduleCode);
    assert.equal(defaults.mode, mode);
    assert.equal(defaults.practiceMode, 'guided_practice');
    const resolved = recipes.recipeSettingsFromRecommendation(moduleCode, { rounds: 12, practiceMode: 'performance' });
    assert.equal(resolved.mode, mode);
    assert.equal(resolved.rounds, 12);
    assert.equal(resolved.feedbackMode, 'end_of_session');
  }
  assert.equal(recipes.isAssignableModule('arithmetic'), false);
  assert.throws(() => recipes.defaultRecipeSettings('unknown'));
  assert.throws(() => recipes.recipeSettingsFromRecommendation('flash_anzan', { mode: 'audio' }));
  assert.throws(() => recipes.recipeSettingsFromRecommendation('audio_anzan', { language: 'en-US' }));
});

test('work-center routing remains allowlisted and unknown targets fail closed', () => {
  for (const moduleCode of ['finger_read','soroban_read','soroban_write','flash_anzan','audio_anzan']) {
    assert.equal(isAssignedEngineModule(moduleCode), true);
    assert.equal(assignedEnginePath(moduleCode, 'recipe /?'), '/studio?program=assigned&recipe=recipe%20%2F%3F');
  }
  assert.equal(isAssignedEngineModule('arithmetic'), false);
  assert.equal(assignedEnginePath('arithmetic', 'r1'), null);
  assert.equal(freePracticePath('finger_press'), '/paritmetik');
  assert.equal(freePracticePath('flash_anzan'), '/studio?mode=flash');
  assert.equal(freePracticePath('unknown'), null);
});

test('core records preserve module, engine, skill, difficulty, and attempt contracts', () => {
  const config = { ...defaultConfig, mode:'audio', rounds:3, terms:4, minDigits:1, maxDigits:2, interval:.8, practiceMode:'performance', feedbackMode:'end_of_session' };
  assert.equal(records.moduleCodeByMode.audio, 'audio_anzan');
  const settings = records.trainingSettings(config);
  assert.equal(settings.engine, 'cza-exercise-engine-v14');
  assert.equal(settings.exerciseType, 'AUDIO_ANZAN');
  assert.deepEqual(settings.skills, ['anzan.calculation','response.fluency']);
  assert.equal(settings.skillProfile, 'anzan.auditory');
  assert.equal(settings.difficultyProfile.audioVisualMode, 'AUDITORY');
  const payload = records.attemptPayload({ sequence:[8,-2], expected:6, given:-1, correct:false, timeout:true, elapsedMs:1200, language:'tr-TR', audioPace:180, showNumbers:false }, config, 2, {attemptId:'a-1',questionId:'q-2'});
  assert.equal(payload.clientAttemptId, 'a-1');
  assert.equal(payload.questionIndex, 2);
  assert.equal(payload.errorType, 'TIMEOUT');
  assert.equal(payload.learningMode, 'performance');
  assert.equal(payload.metadata.engine, 'cza-exercise-engine-v14');
  assert.equal(payload.metadata.exerciseMode, 'audio');
  assert.deepEqual(payload.metadata.sequence, [8,-2]);
  assert.equal(payload.metadata.voiceVersion, 1);
});

test('Studio retains its current start, presentation, answer, next-step, completion, and mode behavior', () => {
  const studio = read('../app/studio/page.tsx');
  assert.match(studio, /async function start\(\)/);
  assert.match(studio, /setQuestions\(generated\).*setRunConfig/s);
  assert.match(studio, /setPhase\(countdown \? 'countdown'/);
  assert.match(studio, /phase === 'stimulus'.*Zamanlı görsel uyaran/s);
  assert.match(studio, /phase === 'sequence'.*anzan-stimulus-screen/s);
  assert.match(studio, /phase === 'answer'.*onSubmit=.*submit\(\)/s);
  assert.match(studio, /function nextQuestion\(\).*setPhase\('prepare'\)/s);
  assert.match(studio, /await core\('finish',\{sessionId\}\); setPhase\('finished'\)/);
  assert.match(studio, /modeLabels\[active \|\| phase === 'finished' \? runConfig\.mode : config\.mode\]/);
  assert.match(studio, /trainingSettings\(config\)/);
  assert.match(studio, /attemptPayload\(attempt,runConfig/);
});
