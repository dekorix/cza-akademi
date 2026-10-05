import type { Attempt, ExerciseConfig, ExerciseMode } from './exercise-engine';
import { exerciseForMode } from './exercise-registry';
import { feedbackModeFor, learningModeFor } from './practice-mode';
import { anzanDifficulty } from './anzan-engine';

export const moduleCodeByMode: Record<ExerciseMode, string> = {
  'finger-read': 'finger_read',
  'soroban-read': 'soroban_read',
  'soroban-write': 'soroban_write',
  flash: 'flash_anzan',
  audio: 'audio_anzan',
};

export function trainingSettings(config: ExerciseConfig) {
  const definition = exerciseForMode(config.mode);
  return {
    engine: 'cza-exercise-engine-v14',
    questionCount: config.rounds,
    difficultyLevel: config.maxDigits ?? config.digits,
    stimulusDurationMs: ['finger-read','soroban-read'].includes(config.mode) ? config.presentationDurationMs ?? 1000 : Math.round(config.interval * 1000),
    answerDurationMs: config.answerDurationMs ?? 0,
    exerciseType: definition?.id,
    practiceMode: config.practiceMode ?? 'free_practice',
    feedbackMode: config.feedbackMode ?? feedbackModeFor(config.practiceMode ?? 'free_practice'),
    skills: definition?.skills ?? [],
    skillProfile: config.mode === 'flash' ? 'anzan.visual' : config.mode === 'audio' ? 'anzan.auditory' : undefined,
    difficultyProfile: ['flash','audio'].includes(config.mode) ? anzanDifficulty(config) : undefined,
    exercise: config,
  };
}

export function attemptPayload(attempt: Attempt, config: ExerciseConfig, questionIndex: number, ids: { attemptId: string; questionId: string }) {
  const definition = exerciseForMode(config.mode);
  return {
    clientAttemptId: ids.attemptId,
    questionIndex,
    questionId: ids.questionId,
    targetNumber: attempt.expected,
    studentNumericAnswer: attempt.given,
    patternValid: !attempt.timeout,
    isCorrect: attempt.correct,
    errorType: attempt.correct ? 'OK' : attempt.timeout ? 'TIMEOUT' : 'RESPONSE_ERROR',
    errorDetail: attempt.correct ? 'Doğru cevap' : attempt.timeout ? 'Cevap süresi doldu.' : 'Girilen cevap beklenen sonuçla eşleşmedi.',
    stimulusDurationMs: attempt.stimulusDurationMs ?? (['finger-read','soroban-read'].includes(config.mode) ? config.presentationDurationMs ?? 1000 : Math.round(config.interval * 1000)),
    responseLatencyMs: attempt.responseLatencyMs ?? attempt.elapsedMs,
    totalResponseTimeMs: attempt.elapsedMs,
    learningMode: learningModeFor(config.practiceMode ?? (config.freePractice === false ? 'guided_practice' : 'free_practice')),
    difficultyLevel: config.maxDigits ?? config.digits,
    attemptNumber: 1,
    metadata: {
      engine: 'cza-exercise-engine-v14',
      exerciseMode: config.mode,
      exerciseType: definition?.id,
      skills: definition?.skills ?? [],
      operation: config.operation,
      sequence: attempt.sequence,
      expected: attempt.expected,
      given: attempt.given,
      answerDurationLimitMs: attempt.answerDurationLimitMs ?? config.answerDurationMs ?? 0,
      presentationStartedAt: attempt.presentationStartedAt,
      presentationEndedAt: attempt.presentationEndedAt,
      answerStartedAt: attempt.answerStartedAt,
      answeredAt: attempt.answeredAt,
      attemptType: attempt.attemptType ?? 'PRIMARY',
      targetSorobanState: attempt.targetSorobanState,
      studentSorobanState: attempt.studentSorobanState,
      differingRods: attempt.differingRods,
      stimulusEventCount: attempt.stimulusEventCount,
      language: attempt.language,
      audioPace: attempt.audioPace,
      showNumbers: attempt.showNumbers,
      transitionEffect: config.transitionEffect,
      stimulusVisibleMs: config.stimulusVisibleMs,
      interStimulusGapMs: config.interStimulusGapMs,
      voiceProfile: config.voiceProfile,
      voiceVersion: 1,
      skillProfile: config.mode === 'flash' ? 'anzan.visual' : config.mode === 'audio' ? 'anzan.auditory' : undefined,
      difficultyProfile: ['flash','audio'].includes(config.mode) ? anzanDifficulty(config) : undefined,
      config,
    },
  };
}


function canonicalSkillCode(skill: string) {
  return skill
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function canonicalSessionRecord(input: {
  clientRecordId: string;
  trainingSessionId: string;
  config: ExerciseConfig;
  attempts: Attempt[];
  startedAt: string;
  completedAt: string;
  metadata?: Record<string, unknown>;
}) {
  const definition = exerciseForMode(input.config.mode);
  const primaryAttempts = input.attempts.filter(attempt => attempt.attemptType !== 'RETRY_AFTER_FEEDBACK');
  const total = primaryAttempts.length;
  const correct = primaryAttempts.filter(attempt => attempt.correct).length;
  const startedAt = new Date(input.startedAt).toISOString();
  const completedAt = new Date(input.completedAt).toISOString();

  return {
    recordType: 'module_record' as const,
    schemaVersion: 'CZA_MODULE_RECORD_V1',
    contractVersion: '1.0.0',
    clientRecordId: input.clientRecordId,
    trainingSessionId: input.trainingSessionId,
    moduleId: moduleCodeByMode[input.config.mode],
    moduleVersion: '1.0.0',
    activityType: 'practice_session',
    startedAt,
    completedAt,
    supportLevel: 'unknown' as const,
    performance: {
      total,
      correct,
      wrong: Math.max(0, total - correct),
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
      timeoutCount: primaryAttempts.filter(attempt => attempt.timeout).length,
      retryCount: input.attempts.length - primaryAttempts.length,
    },
    skills: Array.from(new Set((definition?.skills ?? []).map(canonicalSkillCode).filter(Boolean))),
    metadata: {
      engine: 'cza-exercise-engine-v14',
      exerciseMode: input.config.mode,
      exerciseType: definition?.id ?? null,
      practiceMode: input.config.practiceMode ?? 'free_practice',
      ...input.metadata,
    },
  };
}
