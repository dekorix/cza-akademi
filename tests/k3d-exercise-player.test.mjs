/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({
  configFile: false,
  root,
  resolve: { alias: { '@': root } },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});
const dispatch = await vite.ssrLoadModule(
  '/components/exercise-renderer-dispatch.tsx',
);
const controller = await vite.ssrLoadModule(
  '/components/use-exercise-player-controller.ts',
);
const adapter = await vite.ssrLoadModule('/lib/anzan-engine-adapter.ts');
const response = await vite.ssrLoadModule('/lib/response-contract.ts');
const studio = await readFile(
  new URL('../app/studio/page.tsx', import.meta.url),
  'utf8',
);
const playerSource = await readFile(
  new URL('../components/exercise-player.tsx', import.meta.url),
  'utf8',
);
const rendererSource = await readFile(
  new URL('../components/anzan-exercise-renderer.tsx', import.meta.url),
  'utf8',
);
const dispatchSource = await readFile(
  new URL('../components/exercise-renderer-dispatch.tsx', import.meta.url),
  'utf8',
);
const controllerSource = await readFile(
  new URL('../components/use-exercise-player-controller.ts', import.meta.url),
  'utf8',
);

test.after(async () => vite.close());

test('player resolves canonical ANZAN renderer through the single engine registry', () => {
  const flash = dispatch.resolvePlayerEngine('flash');
  const audio = dispatch.resolvePlayerEngine('audio');
  assert.equal(flash, adapter.anzanEngineAdapter);
  assert.equal(audio, adapter.anzanEngineAdapter);
  assert.equal(flash.engineId, 'ANZAN');
  assert.equal(flash.engineVersion, '1');
  assert.equal(flash.rendererKey, 'ANZAN_STUDIO');
});

test('player lookup fails closed for unknown and mismatched activities', () => {
  assert.throws(
    () => dispatch.resolvePlayerEngine('unknown-mode'),
    /unknown_exercise_activity/,
  );
  assert.throws(
    () => dispatch.resolvePlayerEngine('flash', 'AUDIO_ANZAN'),
    /unsupported_engine_activity/,
  );
  assert.equal(dispatch.resolvePlayerEngine('finger-read'), null);
});

test('controller executes the complete allowed lifecycle transition matrix', () => {
  assert.deepEqual(controller.allowedPlayerTransitions, {
    ready: [
      'START_COUNTDOWN',
      'START_STIMULUS',
      'START_SEQUENCE',
      'START_ANSWER',
      'RESET',
    ],
    countdown: [
      'START_STIMULUS',
      'START_SEQUENCE',
      'START_ANSWER',
      'COMPLETE',
      'RESET',
    ],
    prepare: [
      'START_STIMULUS',
      'START_SEQUENCE',
      'START_ANSWER',
      'COMPLETE',
      'RESET',
    ],
    stimulus: ['PRESENTATION_COMPLETE', 'COMPLETE', 'RESET'],
    sequence: ['PRESENTATION_COMPLETE', 'COMPLETE', 'RESET'],
    answer: ['SUBMIT', 'SUBMIT_FEEDBACK', 'NEXT', 'COMPLETE', 'RESET'],
    feedback: ['NEXT', 'COMPLETE', 'RETRY', 'RESET'],
    finished: ['RESET'],
  });
  let phase = 'ready';
  phase = controller.nextPlayerPhase(phase, 'START_COUNTDOWN');
  assert.equal(phase, 'countdown');
  phase = controller.nextPlayerPhase(phase, 'START_SEQUENCE');
  assert.equal(phase, 'sequence');
  phase = controller.nextPlayerPhase(phase, 'PRESENTATION_COMPLETE');
  assert.equal(phase, 'answer');
  phase = controller.nextPlayerPhase(phase, 'SUBMIT_FEEDBACK');
  assert.equal(phase, 'feedback');
  phase = controller.nextPlayerPhase(phase, 'NEXT');
  assert.equal(phase, 'prepare');
  phase = controller.nextPlayerPhase(phase, 'START_STIMULUS');
  assert.equal(phase, 'stimulus');
  phase = controller.nextPlayerPhase(phase, 'PRESENTATION_COMPLETE');
  assert.equal(phase, 'answer');
  phase = controller.nextPlayerPhase(phase, 'SUBMIT');
  assert.equal(phase, 'answer');
  phase = controller.nextPlayerPhase(phase, 'COMPLETE');
  assert.equal(phase, 'finished');
  phase = controller.nextPlayerPhase(phase, 'RESET');
  assert.equal(phase, 'ready');
});

test('every disallowed phase and intent pair is rejected with state unchanged', () => {
  const phases = Object.keys(controller.allowedPlayerTransitions);
  const intents = [
    'START_COUNTDOWN',
    'START_STIMULUS',
    'START_SEQUENCE',
    'START_ANSWER',
    'PRESENTATION_COMPLETE',
    'SUBMIT',
    'SUBMIT_FEEDBACK',
    'NEXT',
    'COMPLETE',
    'RETRY',
    'RESET',
  ];
  let rejected = 0;
  for (const phase of phases) {
    for (const intent of intents) {
      const result = controller.playerTransition(phase, intent);
      const expected =
        controller.allowedPlayerTransitions[phase].includes(intent);
      assert.equal(result.accepted, expected, `${phase} + ${intent}`);
      if (!expected) {
        rejected += 1;
        assert.equal(result.phase, phase, `${phase} + ${intent} changed state`);
        assert.equal(controller.nextPlayerPhase(phase, intent), phase);
      }
    }
  }
  assert.equal(rejected, 57);
  for (const [phase, intent] of [
    ['ready', 'COMPLETE'],
    ['ready', 'NEXT'],
    ['ready', 'SUBMIT_FEEDBACK'],
    ['finished', 'START_SEQUENCE'],
    ['feedback', 'START_STIMULUS'],
    ['ready', 'PRESENTATION_COMPLETE'],
  ])
    assert.deepEqual(controller.playerTransition(phase, intent), {
      accepted: false,
      phase,
    });
});

test('invalid transitions cannot invoke lifecycle or persistence side effects', () => {
  let sideEffects = 0;
  const invalid = [
    ['ready', 'COMPLETE'],
    ['ready', 'NEXT'],
    ['ready', 'SUBMIT_FEEDBACK'],
    ['finished', 'START_SEQUENCE'],
    ['feedback', 'START_STIMULUS'],
    ['ready', 'PRESENTATION_COMPLETE'],
  ];
  for (const [phase, intent] of invalid) {
    const result = controller.applyPlayerIntent(phase, intent, () => {
      sideEffects += 1;
    });
    assert.equal(result.accepted, false);
    assert.equal(result.phase, phase);
  }
  assert.equal(sideEffects, 0);
  const valid = controller.applyPlayerIntent('answer', 'SUBMIT', () => {
    sideEffects += 1;
  });
  assert.equal(valid.accepted, true);
  assert.equal(sideEffects, 1);
});

test('Studio delegates player state-machine ownership to the controller', () => {
  assert.match(studio, /useExercisePlayerController<Attempt>/);
  assert.doesNotMatch(studio, /useState<ExercisePlayerPhase>/);
  assert.doesNotMatch(studio, /setPhase\(/);
  for (const intent of [
    'beginPlayer',
    'presentQuestion',
    'playerSubmitted',
    'nextPlayerQuestion',
    'completePlayer',
    'resetPlayer',
  ])
    assert.match(studio, new RegExp(intent));
  assert.match(controllerSource, /const \[answer, setAnswer\] = useState/);
  assert.match(controllerSource, /const \[phase, setPhase\] = useState/);
});

test('common player is engine-agnostic and renderer dispatch owns ANZAN selection', () => {
  assert.match(playerSource, /data-player-phase/);
  assert.match(playerSource, /<ExerciseRendererDispatch/);
  assert.doesNotMatch(playerSource, /anzanThemes|AnzanTheme/);
  assert.doesNotMatch(playerSource, /mode === ['"](?:flash|audio)['"]/);
  assert.doesNotMatch(playerSource, /AnzanExerciseRenderer/);
  assert.match(dispatchSource, /<AnzanExerciseRenderer/);
  assert.match(dispatchSource, /engineDefinition/);
  assert.match(dispatchSource, /anzanThemes/);
  assert.doesNotMatch(playerSource, /question\.sequence\[term\]/);
  assert.match(rendererSource, /question\.sequence\[term\]/);
  assert.match(rendererSource, /aria-label="Sayıyı dinle"/);
  assert.match(rendererSource, /data-effect=/);
  assert.match(studio, /<ExercisePlayer/);
  assert.doesNotMatch(studio, /className="anzan-stimulus-screen/);
});

test('numeric response contract remains canonical', () => {
  assert.deepEqual(response.numericResponse(7), {
    type: 'numeric',
    payload: { value: 7 },
  });
  assert.throws(
    () => response.numericResponse(Number.NaN),
    /invalid_numeric_response/,
  );
});
