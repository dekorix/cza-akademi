import type { Attempt, ExerciseConfig, ExerciseMode } from './exercise-engine';

export const moduleCodeByMode: Record<ExerciseMode, string> = {
  'soroban-read': 'soroban_read',
  'soroban-write': 'soroban_write',
  flash: 'flash_anzan',
  audio: 'audio_anzan',
};

export function trainingSettings(config: ExerciseConfig) {
  return {
    engine: 'cza-exercise-engine-v14',
    questionCount: config.rounds,
    difficultyLevel: config.maxDigits ?? config.digits,
    stimulusDurationMs: Math.round(config.interval * 1000),
    exercise: config,
  };
}

export function attemptPayload(attempt: Attempt, config: ExerciseConfig, questionIndex: number, ids: { attemptId: string; questionId: string }) {
  return {
    clientAttemptId: ids.attemptId,
    questionIndex,
    questionId: ids.questionId,
    targetNumber: attempt.expected,
    studentNumericAnswer: attempt.given,
    patternValid: true,
    isCorrect: attempt.correct,
    errorType: attempt.correct ? 'OK' : 'A01',
    errorDetail: attempt.correct ? 'Doğru cevap' : 'Girilen cevap beklenen sonuçla eşleşmedi.',
    stimulusDurationMs: attempt.stimulusDurationMs ?? Math.round(config.interval * 1000),
    responseLatencyMs: attempt.responseLatencyMs ?? attempt.elapsedMs,
    totalResponseTimeMs: attempt.elapsedMs,
    learningMode: config.freePractice === false ? 'program' : 'free_practice',
    difficultyLevel: config.maxDigits ?? config.digits,
    attemptNumber: 1,
    metadata: {
      engine: 'cza-exercise-engine-v14',
      exerciseMode: config.mode,
      operation: config.operation,
      sequence: attempt.sequence,
      expected: attempt.expected,
      given: attempt.given,
      config,
    },
  };
}
