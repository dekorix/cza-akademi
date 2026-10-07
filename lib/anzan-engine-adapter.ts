import { validateConfig, type ExerciseConfig } from './exercise-engine';
import {
  anzanDifficulty,
  createPresentationEvents,
  numberAudioManifest,
  scheduleAudioClips,
} from './anzan-engine';
import {
  ANZAN_ENGINE_ID,
  ANZAN_ENGINE_VERSION,
  type EngineDefinition,
} from './engine-contract';

function validateAnzanConfig(config: ExerciseConfig) {
  if (config.mode !== 'flash' && config.mode !== 'audio') {
    throw new Error('unsupported_anzan_activity');
  }
  validateConfig(config);
}

export const anzanEngineAdapter = Object.freeze({
  engineId: ANZAN_ENGINE_ID,
  engineVersion: ANZAN_ENGINE_VERSION,
  capabilities: Object.freeze([
    'VISUAL_PRESENTATION',
    'AUDIO_PRESENTATION',
    'TIMED_RESPONSE',
    'DIFFICULTY_PROJECTION',
  ]),
  supportedActivityTypes: Object.freeze(['FLASH_ANZAN', 'AUDIO_ANZAN']),
  rendererKey: 'ANZAN_STUDIO',
  validateConfig: validateAnzanConfig,
  createPresentationEvents,
  anzanDifficulty,
  numberAudioManifest,
  scheduleAudioClips,
} satisfies EngineDefinition & {
  createPresentationEvents: typeof createPresentationEvents;
  anzanDifficulty: typeof anzanDifficulty;
  numberAudioManifest: typeof numberAudioManifest;
  scheduleAudioClips: typeof scheduleAudioClips;
});
