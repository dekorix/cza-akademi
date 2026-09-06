import type { Attempt, ExerciseConfig, ExerciseMode } from './exercise-engine';
import { exerciseForMode } from './exercise-registry';
import { feedbackModeFor, learningModeFor } from './practice-mode';

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
      config,
    },
  };
}
