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
const player = await vite.ssrLoadModule('/components/exercise-player.tsx');
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

test.after(async () => vite.close());

test('player resolves canonical ANZAN renderer through the single engine registry', () => {
  const flash = player.resolvePlayerEngine('flash');
  const audio = player.resolvePlayerEngine('audio');
  assert.equal(flash, adapter.anzanEngineAdapter);
  assert.equal(audio, adapter.anzanEngineAdapter);
  assert.equal(flash.engineId, 'ANZAN');
  assert.equal(flash.engineVersion, '1');
  assert.equal(flash.rendererKey, 'ANZAN_STUDIO');
});

test('player lookup fails closed for unknown and mismatched activities', () => {
  assert.throws(
    () => player.resolvePlayerEngine('unknown-mode'),
    /unknown_exercise_activity/,
  );
  assert.throws(
    () => player.resolvePlayerEngine('flash', 'AUDIO_ANZAN'),
    /unsupported_engine_activity/,
  );
  assert.equal(player.resolvePlayerEngine('finger-read'), null);
});

test('common player owns lifecycle shell while ANZAN renderer owns presentation', () => {
  for (const phase of [
    'ready',
    'countdown',
    'prepare',
    'stimulus',
    'sequence',
    'answer',
    'feedback',
    'finished',
  ])
    assert.match(playerSource, new RegExp(`'${phase}'`));
  assert.match(playerSource, /data-player-phase/);
  assert.match(playerSource, /<AnzanExerciseRenderer/);
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
