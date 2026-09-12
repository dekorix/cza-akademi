import { defaultConfig, type ExerciseConfig, type ExerciseMode } from './exercise-engine';

export const assignableModules = {
  finger_read: { label: 'Parmak Okuma', mode: 'finger-read' },
  soroban_read: { label: 'Soroban Okuma', mode: 'soroban-read' },
  soroban_write: { label: 'Soroban Yazma', mode: 'soroban-write' },
  flash_anzan: { label: 'Flash Anzan', mode: 'flash' },
  audio_anzan: { label: 'Sesli Anzan', mode: 'audio' },
} as const satisfies Record<string, { label: string; mode: ExerciseMode }>;

export type AssignableModuleCode = keyof typeof assignableModules;

export function isAssignableModule(value: string): value is AssignableModuleCode {
  return Object.hasOwn(assignableModules, value);
}

export function defaultRecipeSettings(moduleCode: AssignableModuleCode): ExerciseConfig {
  const mode = assignableModules[moduleCode].mode;
  const common: ExerciseConfig = {
    ...defaultConfig,
    mode,
    practiceMode: 'guided_practice',
    feedbackMode: 'immediate',
    rounds: 10,
    countdownEnabled: false,
    answerDurationMs: 0,
  };

  if (mode === 'finger-read') return { ...common, digits: 1, minDigits: 1, maxDigits: 1, presentationDurationMs: 1400 };
  if (mode === 'soroban-read') return { ...common, digits: 1, minDigits: 1, maxDigits: 1, rods: 5, presentationDurationMs: 1500 };
  if (mode === 'soroban-write') return { ...common, digits: 1, minDigits: 1, maxDigits: 1, rods: 5 };
  if (mode === 'flash') return { ...common, digits: 1, minDigits: 1, maxDigits: 1, terms: 4, interval: 0.8, stimulusVisibleMs: 800, interStimulusGapMs: 180, showNumbers: true };
  return { ...common, digits: 1, minDigits: 1, maxDigits: 1, terms: 4, interval: 1.1, language: 'tr-TR', speechRate: 0.9, showNumbersDuringAudio: false };
}
