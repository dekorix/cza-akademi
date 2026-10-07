import type { ExerciseConfig } from './exercise-engine';

export const ANZAN_ENGINE_ID = 'ANZAN' as const;
export const ANZAN_ENGINE_VERSION = '1' as const;

export type EngineId = typeof ANZAN_ENGINE_ID;
export type EngineVersion = typeof ANZAN_ENGINE_VERSION;
export type EngineCapability =
  | 'VISUAL_PRESENTATION'
  | 'AUDIO_PRESENTATION'
  | 'TIMED_RESPONSE'
  | 'DIFFICULTY_PROJECTION';
export type EngineActivityType = 'FLASH_ANZAN' | 'AUDIO_ANZAN';
export type EngineReference = Readonly<{ engineId: EngineId; engineVersion: EngineVersion }>;

export type EngineDefinition = EngineReference & Readonly<{
  capabilities: readonly EngineCapability[];
  supportedActivityTypes: readonly EngineActivityType[];
  rendererKey: 'ANZAN_STUDIO';
  validateConfig(config: ExerciseConfig): void;
}>;

export const ANZAN_ENGINE_REFERENCE: EngineReference = Object.freeze({
  engineId: ANZAN_ENGINE_ID,
  engineVersion: ANZAN_ENGINE_VERSION,
});
