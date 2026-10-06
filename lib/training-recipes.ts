import { defaultConfig, validateConfig, type ExerciseConfig, type ExerciseMode } from './exercise-engine';
import { feedbackModeFor } from './practice-mode';

export const assignableModules = {
  finger_read: { label: 'Parmak Okuma', mode: 'finger-read', launchPath: '/studio', engine: 'cza-exercise-engine-v14' },
  soroban_read: { label: 'Soroban Okuma', mode: 'soroban-read', launchPath: '/studio', engine: 'cza-exercise-engine-v14' },
  soroban_write: { label: 'Soroban Yazma', mode: 'soroban-write', launchPath: '/studio', engine: 'cza-exercise-engine-v14' },
  flash_anzan: { label: 'Flash Anzan', mode: 'flash', launchPath: '/studio', engine: 'cza-exercise-engine-v14' },
  audio_anzan: { label: 'Sesli Anzan', mode: 'audio', launchPath: '/studio', engine: 'cza-exercise-engine-v14' },
  memory: { label: 'Hafıza Teknikleri', mode: null, launchPath: '/memory', engine: 'cza-memory-v1' },
  attention_focus: { label: 'Dikkat & Derin Odak', mode: null, launchPath: '/attention', engine: 'cza-attention-v1' },
  speed_reading: { label: 'Hızlı Okuma', mode: null, launchPath: '/speed-reading', engine: 'cza-speed-reading-v1' },
  mind_maps: { label: 'Zihin Haritaları', mode: null, launchPath: '/mind-maps', engine: 'cza-mind-maps-v1' },
  intelligence_games: { label: 'Zekâ Oyunları', mode: null, launchPath: '/intelligence-games', engine: 'cza-intelligence-games-v1' },
  effective_notes: { label: 'Etkili Not Alma', mode: null, launchPath: '/effective-notes', engine: 'cza-effective-notes-v1' },
  full_learning_37: { label: 'Tam Öğrenme Sistemi 37', mode: null, launchPath: '/full-study', engine: 'cza-full-learning-37-v1' },
} as const;

export type AssignableModuleCode = keyof typeof assignableModules;

export function isAssignableModule(value: string): value is AssignableModuleCode {
  return Object.hasOwn(assignableModules, value);
}

export function defaultRecipeSettings(moduleCode: AssignableModuleCode): ExerciseConfig | Record<string, unknown> {
  const definition = assignableModules[moduleCode];
  const mode = definition.mode;
  if (mode === null) return { engine: definition.engine, practiceMode: 'guided_practice', assigned: true };
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
  const definition = assignableModules[moduleCode];
  if (definition.mode === null) invalidRecommendationSettings();
  const next = { ...defaultRecipeSettings(moduleCode) } as ExerciseConfig;
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

  next.mode = definition.mode;
  next.feedbackMode = feedbackModeFor(next.practiceMode ?? 'guided_practice');
  validateConfig(next);
  return next;
}


export function assignmentUsesStudio(moduleCode: AssignableModuleCode) {
  return assignableModules[moduleCode].mode !== null;
}

export function assignmentLaunchPath(moduleCode: AssignableModuleCode, recipeId: string) {
  const base = assignableModules[moduleCode].launchPath;
  const key = assignmentUsesStudio(moduleCode) ? 'recipe' : 'assignedRecipe';
  const separator = base.includes('?') ? '&' : '?';
  return base + separator + key + '=' + encodeURIComponent(recipeId) + (assignmentUsesStudio(moduleCode) ? '&program=assigned' : '');
}
