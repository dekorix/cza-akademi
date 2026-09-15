export const ATTENTION_MODULE_ID = 'attention_focus_core';
export const ATTENTION_MODULE_VERSION = '0.1.0-isolated-preview';
export const ATTENTION_SCHEMA_VERSION = 'CZA_SYNTHETIC_ATTENTION_V1';

export type AttentionExerciseId = 'stroop_conflict' | 'visual_memory_matrix';
export type AttentionLevelId = 'foundation' | 'developing' | 'advanced';

export type AttentionLevel = Readonly<{
  id: AttentionLevelId;
  label: string;
  stroopRounds: number;
  matrixSize: 3 | 4;
  matrixActiveCells: number;
  matrixExposureMs: number;
  minimumStroopResponseMs: number;
}>;

export type SyntheticAttentionStudent = Readonly<{
  fixtureId: string;
  fixtureKind: 'synthetic_student';
  displayName: string;
  ageBand: '8-10';
  baseline: Readonly<{
    serverObservedResponseMs: number;
    conflictManagementAccuracyPercent: number;
    visualMemoryAccuracyPercent: number;
    focusDeviationMultiplier: number;
  }>;
  measurementNotice: Readonly<{
    evidenceClass: 'synthetic_attention';
    timingAuthority: 'server_clock';
    serverVerified: false;
    productionLedgerEligible: false;
    persisted: false;
    diagnosticUse: false;
  }>;
}>;

export type AttentionRoundMeasurement = Readonly<{
  exerciseId: AttentionExerciseId;
  correct: boolean;
  serverObservedResponseMs: number;
  timingModel: 'server_observed_approximation';
  includesTransportAndRenderLatency: true;
}>;

export type AttentionMetrics = Readonly<{
  averageServerObservedResponseMs: number;
  conflictManagementAccuracyPercent: number | null;
  visualMemoryAccuracyPercent: number | null;
  focusDeviationMultiplier: number;
  correctRounds: number;
  totalRounds: number;
}>;

export function deepFreezeAttentionValue<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreezeAttentionValue(nested);
    }
    Object.freeze(value);
  }
  return value;
}

export const ATTENTION_LEVELS: readonly AttentionLevel[] =
  deepFreezeAttentionValue([
    {
      id: 'foundation',
      label: 'Temel Odak',
      stroopRounds: 4,
      matrixSize: 3,
      matrixActiveCells: 3,
      matrixExposureMs: 900,
      minimumStroopResponseMs: 120,
    },
    {
      id: 'developing',
      label: 'Gelişen Kontrol',
      stroopRounds: 6,
      matrixSize: 4,
      matrixActiveCells: 5,
      matrixExposureMs: 750,
      minimumStroopResponseMs: 120,
    },
    {
      id: 'advanced',
      label: 'İleri Odak',
      stroopRounds: 8,
      matrixSize: 4,
      matrixActiveCells: 6,
      matrixExposureMs: 600,
      minimumStroopResponseMs: 100,
    },
  ]);

export const SYNTHETIC_ATTENTION_STUDENT: SyntheticAttentionStudent =
  deepFreezeAttentionValue({
    fixtureId: 'synthetic-attention-student-01',
    fixtureKind: 'synthetic_student',
    displayName: 'Ekin',
    ageBand: '8-10',
    baseline: {
      serverObservedResponseMs: 820,
      conflictManagementAccuracyPercent: 72,
      visualMemoryAccuracyPercent: 68,
      focusDeviationMultiplier: 0.24,
    },
    measurementNotice: {
      evidenceClass: 'synthetic_attention',
      timingAuthority: 'server_clock',
      serverVerified: false,
      productionLedgerEligible: false,
      persisted: false,
      diagnosticUse: false,
    },
  });

export const ATTENTION_LEARNING_PATH = deepFreezeAttentionValue([
  {
    id: 'settle',
    label: 'Hazırlan',
    goal: 'Uyaran görünmeden önce sakin ve dengeli bir odak kur.',
  },
  {
    id: 'inhibit',
    label: 'Çelişkiyi yönet',
    goal: 'Kelimenin anlamını bastırıp görünen yazı rengini seç.',
  },
  {
    id: 'encode',
    label: 'Görsel örüntüyü kodla',
    goal: 'Kısa süreli matristeki konumları bütün olarak fark et.',
  },
  {
    id: 'recall',
    label: 'Hatırla ve işaretle',
    goal: 'Örüntü kapandıktan sonra konumları dikkatle geri çağır.',
  },
]);

export function attentionLevel(levelId: AttentionLevelId) {
  const level = ATTENTION_LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error('attention_level_invalid');
  return level;
}

function percentage(correct: number, total: number) {
  return total === 0 ? null : Math.round((correct / total) * 100);
}

export function calculateAttentionMetrics(
  rounds: readonly AttentionRoundMeasurement[],
): AttentionMetrics {
  if (
    rounds.length < 1 ||
    rounds.length > 32 ||
    rounds.some(
      (round) =>
        !round ||
        !['stroop_conflict', 'visual_memory_matrix'].includes(
          round.exerciseId,
        ) ||
        typeof round.correct !== 'boolean' ||
        !Number.isInteger(round.serverObservedResponseMs) ||
        round.serverObservedResponseMs < 0 ||
        round.serverObservedResponseMs > 30_000 ||
        round.timingModel !== 'server_observed_approximation' ||
        round.includesTransportAndRenderLatency !== true,
    )
  ) {
    throw new Error('attention_measurements_invalid');
  }

  const durations = rounds.map((round) => round.serverObservedResponseMs);
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const variance =
    durations.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    durations.length;
  const deviationMultiplier = average === 0 ? 0 : Math.sqrt(variance) / average;
  const stroop = rounds.filter((round) => round.exerciseId === 'stroop_conflict');
  const memory = rounds.filter(
    (round) => round.exerciseId === 'visual_memory_matrix',
  );

  return deepFreezeAttentionValue({
    averageServerObservedResponseMs: Math.round(average),
    conflictManagementAccuracyPercent: percentage(
      stroop.filter((round) => round.correct).length,
      stroop.length,
    ),
    visualMemoryAccuracyPercent: percentage(
      memory.filter((round) => round.correct).length,
      memory.length,
    ),
    focusDeviationMultiplier: Number(
      Math.min(3, deviationMultiplier).toFixed(2),
    ),
    correctRounds: rounds.filter((round) => round.correct).length,
    totalRounds: rounds.length,
  });
}
