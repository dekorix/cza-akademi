/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({ configFile:false, server:{ middlewareMode:true, hmr:false }, appType:'custom', logLevel:'error' });
const registry = await vite.ssrLoadModule('/lib/engine-registry.ts');
const adapterModule = await vite.ssrLoadModule('/lib/anzan-engine-adapter.ts');
const anzan = await vite.ssrLoadModule('/lib/anzan-engine.ts');
const exercises = await vite.ssrLoadModule('/lib/exercise-registry.ts');
const exerciseEngine = await vite.ssrLoadModule('/lib/exercise-engine.ts');

test.after(async () => vite.close());

test('registry contains only canonical ANZAN version 1 with current capabilities', () => {
  assert.equal(registry.engineRegistry.length, 1);
  const definition = registry.engineDefinition('ANZAN', '1');
  assert.equal(definition.engineId, 'ANZAN');
  assert.equal(definition.engineVersion, '1');
  assert.equal(definition.rendererKey, 'ANZAN_STUDIO');
  assert.deepEqual(definition.supportedActivityTypes, ['FLASH_ANZAN','AUDIO_ANZAN']);
  assert.deepEqual(definition.capabilities, [
    'VISUAL_PRESENTATION','AUDIO_PRESENTATION','TIMED_RESPONSE','DIFFICULTY_PROJECTION',
  ]);
});

test('registry lookup and capability checks fail closed', () => {
  assert.throws(() => registry.engineDefinition('MATCHING', '1'), /unknown_engine/);
  assert.throws(() => registry.engineDefinition('ANZAN', '2'), /unknown_engine_version/);
  assert.equal(registry.requireEngineCapability('ANZAN', '1', 'AUDIO_PRESENTATION').engineId, 'ANZAN');
  assert.throws(() => registry.requireEngineCapability('ANZAN', '1', 'UNIMPLEMENTED'), /unsupported_engine_capability/);
});

test('canonical Flash and Audio exercises reference the single versioned engine', () => {
  const references = Object.fromEntries(exercises.exerciseRegistry.filter(item => item.engine).map(item => [item.id, item.engine]));
  assert.deepEqual(references, {
    FLASH_ANZAN:{ engineId:'ANZAN', engineVersion:'1' },
    AUDIO_ANZAN:{ engineId:'ANZAN', engineVersion:'1' },
  });
  assert.equal(exercises.exerciseRegistry.filter(item => !item.engine).length, 5);
});

test('adapter delegates presentation, difficulty, and audio behavior to the existing Anzan engine', () => {
  const adapter = adapterModule.anzanEngineAdapter;
  assert.equal(adapter.createPresentationEvents, anzan.createPresentationEvents);
  assert.equal(adapter.anzanDifficulty, anzan.anzanDifficulty);
  assert.equal(adapter.numberAudioManifest, anzan.numberAudioManifest);
  assert.equal(adapter.scheduleAudioClips, anzan.scheduleAudioClips);
  assert.deepEqual(adapter.createPresentationEvents({sequence:[4,-1],answer:3},200,80), anzan.createPresentationEvents({sequence:[4,-1],answer:3},200,80));
  assert.deepEqual(adapter.scheduleAudioClips([100,150],25), [{index:0,startMs:0,endMs:100},{index:1,startMs:125,endMs:275}]);
  assert.equal(adapter.anzanDifficulty({terms:3,operation:'mixed',mode:'audio'}).audioVisualMode, 'AUDITORY');
});

test('adapter reuses common config validation and rejects non-Anzan activities', () => {
  const adapter = adapterModule.anzanEngineAdapter;
  assert.doesNotThrow(() => adapter.validateConfig({...exerciseEngine.defaultConfig,mode:'flash'}));
  assert.doesNotThrow(() => adapter.validateConfig({...exerciseEngine.defaultConfig,mode:'audio'}));
  assert.throws(() => adapter.validateConfig({...exerciseEngine.defaultConfig,mode:'audio',language:'en-US'}), /ses dili/);
  assert.throws(() => adapter.validateConfig({...exerciseEngine.defaultConfig,mode:'soroban-read'}), /unsupported_anzan_activity/);
});
