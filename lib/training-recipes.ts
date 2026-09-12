import { defaultConfig, validateConfig, type ExerciseConfig, type ExerciseMode } from './exercise-engine';
import { feedbackModeFor } from './practice-mode';

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

const recommendationKeys = new Set([
  'digits',
  'terms',
  'rounds',
  'interval',
  'presentationDurationMs',
  'answerDurationMs',
  'countdownEnabled',
  'practiceMode',
  'rods',
  'stimulusVisibleMs',
  'interStimulusGapMs',
  'showNumbers',
  'showNumbersDuringAudio',
  'speechRate',
]);

function invalidRecommendationSettings(): never {
  throw new Error('invalid_recommendation_settings');
}

export function recipeSettingsFromRecommendation(moduleCode: AssignableModuleCode, raw: Record<string, unknown>): ExerciseConfig {
  const next = { ...defaultRecipeSettings(moduleCode) };
  for (const key of Object.keys(raw)) if (!recommendationKeys.has(key)) invalidRecommendationSettings();

  if (Object.hasOwn(raw, 'digits')) {
    if (typeof raw.digits !== 'number' || !Number.isInteger(raw.digits)) invalidRecommendationSettings();
    next.digits = raw.digits;
    next.minDigits = raw.digits;
    next.maxDigits = raw.digits;
  }
  if (Object.hasOwn(raw, 'terms')) {
    if (typeof raw.terms !== 'number' || !Number.isInteger(raw.terms)) invalidRecommendationSettings();
    next.terms = raw.terms;
  }
  if (Object.hasOwn(raw, 'rounds')) {
    if (typeof raw.rounds !== 'number' || !Number.isInteger(raw.rounds)) invalidRecommendationSettings();
    next.rounds = raw.rounds;
  }
  if (Object.hasOwn(raw, 'interval')) {
    if (typeof raw.interval !== 'number' || !Number.isFinite(raw.interval)) invalidRecommendationSettings();
    next.interval = raw.interval;
  }
  if (Object.hasOwn(raw, 'presentationDurationMs')) {
    if (typeof raw.presentationDurationMs !== 'number' || !Number.isInteger(raw.presentationDurationMs)) invalidRecommendationSettings();
    next.presentationDurationMs = raw.presentationDurationMs;
  }
  if (Object.hasOwn(raw, 'answerDurationMs')) {
    if (typeof raw.answerDurationMs !== 'number' || !Number.isInteger(raw.answerDurationMs)) invalidRecommendationSettings();
    next.answerDurationMs = raw.answerDurationMs;
  }
  if (Object.hasOwn(raw, 'countdownEnabled')) {
    if (typeof raw.countdownEnabled !== 'boolean') invalidRecommendationSettings();
    next.countdownEnabled = raw.countdownEnabled;
  }
  if (Object.hasOwn(raw, 'practiceMode')) {
    if (raw.practiceMode !== 'guided_practice' && raw.practiceMode !== 'performance') invalidRecommendationSettings();
    next.practiceMode = raw.practiceMode;
  }
  if (Object.hasOwn(raw, 'rods')) {
    if (typeof raw.rods !== 'number' || ![4, 5, 6, 7].includes(raw.rods)) invalidRecommendationSettings();
    next.rods = raw.rods as 4 | 5 | 6 | 7;
  }
  if (Object.hasOwn(raw, 'stimulusVisibleMs')) {
    if (typeof raw.stimulusVisibleMs !== 'number' || !Number.isInteger(raw.stimulusVisibleMs) || raw.stimulusVisibleMs < 100 || raw.stimulusVisibleMs > 10000) invalidRecommendationSettings();
    next.stimulusVisibleMs = raw.stimulusVisibleMs;
  }
  if (Object.hasOwn(raw, 'interStimulusGapMs')) {
    if (typeof raw.interStimulusGapMs !== 'number' || !Number.isInteger(raw.interStimulusGapMs) || raw.interStimulusGapMs < 80 || raw.interStimulusGapMs > 3000) invalidRecommendationSettings();
    next.interStimulusGapMs = raw.interStimulusGapMs;
  }
  if (Object.hasOwn(raw, 'showNumbers')) {
    if (typeof raw.showNumbers !== 'boolean') invalidRecommendationSettings();
    next.showNumbers = raw.showNumbers;
  }
  if (Object.hasOwn(raw, 'showNumbersDuringAudio')) {
    if (typeof raw.showNumbersDuringAudio !== 'boolean') invalidRecommendationSettings();
    next.showNumbersDuringAudio = raw.showNumbersDuringAudio;
  }
  if (Object.hasOwn(raw, 'speechRate')) {
    if (typeof raw.speechRate !== 'number' || !Number.isFinite(raw.speechRate)) invalidRecommendationSettings();
    next.speechRate = raw.speechRate;
  }

  next.mode = assignableModules[moduleCode].mode;
  next.feedbackMode = feedbackModeFor(next.practiceMode ?? 'guided_practice');
  validateConfig(next);
  return next;
}
