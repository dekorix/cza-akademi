export const FAST_READING_MODULE_ID = 'fast_reading_core';
export const FAST_READING_MODULE_VERSION = '0.5.0-preview';
export const FAST_READING_TRIAL_COUNT = 5;

export type FastReadingLevelId = 'starter' | 'explorer' | 'accelerator';
export type FastReadingExerciseId =
  | 'focus_expansion'
  | 'schulte_scan'
  | 'tachistoscope';

export type ClientTelemetryNotice = {
  evidenceClass: 'client_telemetry';
  serverVerified: false;
  productionLedgerEligible: false;
};

export type SyntheticFastReadingStudent = {
  fixtureId: string;
  fixtureKind: 'synthetic_student';
  displayName: string;
  ageBand: '8-10';
  baseline: {
    wordsPerMinute: number;
    comprehensionPercent: number;
    averageFixationMs: number;
    regressionsPer100Words: number;
    visualSpanCharacters: number;
    peripheralSpanDegreesEstimate: number;
  };
  measurementNotice: ClientTelemetryNotice & {
    visualSpanMethod: 'synthetic_estimate';
  };
};

export type FastReadingLevel = {
  id: FastReadingLevelId;
  label: string;
  description: string;
  schulteSize: 4 | 5;
  focusStepMs: number;
  tachistoscopeExposureMs: number;
  targetComprehensionPercent: number;
};

export type FastReadingMetrics = ClientTelemetryNotice & {
  serverObservedApproxWordsPerMinute: number;
  timingModel: 'server_observed_approximation';
  includesTransportAndRenderLatency: true;
  comprehensionPercent: number;
  durationMs: number;
};

export type SchulteAttemptResult = ClientTelemetryNotice & {
  completed: boolean;
  correctSelections: number;
  incorrectSelections: number;
  totalSelections: number;
  totalCells: number;
  accuracyPercent: number;
  averageSelectionMs: number | null;
  cappedIntervals: number;
};

export type SchulteSelection = {
  value: number;
  expected: number;
  correct: boolean;
  elapsedMs: number;
  durationCapped: boolean;
};

export const CLIENT_TELEMETRY_NOTICE: ClientTelemetryNotice = Object.freeze({
  evidenceClass: 'client_telemetry',
  serverVerified: false,
  productionLedgerEligible: false,
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export const FAST_READING_LEVELS: readonly FastReadingLevel[] = deepFreeze([
  {
    id: 'starter',
    label: 'Başlangıç',
    description: 'Sakin odak, geniş tarama ve 4×4 sayı alanı.',
    schulteSize: 4,
    focusStepMs: 1100,
    tachistoscopeExposureMs: 1200,
    targetComprehensionPercent: 80,
  },
  {
    id: 'explorer',
    label: 'Keşif',
    description: 'Daha geniş görsel alan ve dengeli okuma ritmi.',
    schulteSize: 5,
    focusStepMs: 900,
    tachistoscopeExposureMs: 900,
    targetComprehensionPercent: 80,
  },
  {
    id: 'accelerator',
    label: 'Hızlanma',
    description: 'Anlamayı koruyarak daha kısa gösterim aralıkları.',
    schulteSize: 5,
    focusStepMs: 700,
    tachistoscopeExposureMs: 650,
    targetComprehensionPercent: 100,
  },
]);

export const SYNTHETIC_FAST_READING_STUDENT: SyntheticFastReadingStudent =
  deepFreeze({
    fixtureId: 'synthetic-fast-reader-01',
    fixtureKind: 'synthetic_student',
    displayName: 'Deniz',
    ageBand: '8-10',
    baseline: {
      wordsPerMinute: 92,
      comprehensionPercent: 78,
      averageFixationMs: 420,
      regressionsPer100Words: 7,
      visualSpanCharacters: 5,
      peripheralSpanDegreesEstimate: 18,
    },
    measurementNotice: {
      ...CLIENT_TELEMETRY_NOTICE,
      visualSpanMethod: 'synthetic_estimate' as const,
    },
  });

export const FAST_READING_LEARNING_PATH = deepFreeze([
  {
    id: 'settle_focus',
    label: 'Odağı hazırla',
    goal: 'Gözleri zorlamadan merkez noktada sakin dikkat oluştur.',
  },
  {
    id: 'expand_visual_span',
    label: 'Görsel alanı genişlet',
    goal: 'Başı oynatmadan merkezin çevresindeki işaretleri fark et.',
  },
  {
    id: 'scan_schulte',
    label: 'Planlı tarama yap',
    goal: 'Sayıları sırayla bulurken merkeze dönüş alışkanlığı geliştir.',
  },
  {
    id: 'flash_words',
    label: 'Kelime gruplarını yakala',
    goal: 'Tek tek harfler yerine anlamlı kelime kümelerini gör.',
  },
  {
    id: 'transfer_comprehension',
    label: 'Anlamaya aktar',
    goal: 'Hız artarken ana fikir ve ayrıntı doğruluğunu koru.',
  },
]);

function integerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function levelById(levelId: FastReadingLevelId) {
  const level = FAST_READING_LEVELS.find(
    (candidate) => candidate.id === levelId,
  );
  if (!level) throw new Error('fast_reading_level_invalid');
  return level;
}

export function createSchulteBoard(size: 4 | 5, seed: number) {
  if (!integerInRange(seed, 0, 2_147_483_647)) {
    throw new Error('schulte_seed_invalid');
  }
  const values = Array.from({ length: size * size }, (_, index) => index + 1);
  const random = seededRandom(seed);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

export function recordSchulteSelection(
  expected: number,
  value: number,
  elapsedMs: number,
  totalCells: number,
): SchulteSelection {
  if (
    !integerInRange(totalCells, 16, 25) ||
    ![16, 25].includes(totalCells) ||
    !integerInRange(expected, 1, totalCells) ||
    !integerInRange(value, 1, totalCells) ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0
  ) {
    throw new Error('schulte_selection_invalid');
  }
  const roundedDuration = Math.round(elapsedMs);
  return {
    value,
    expected,
    correct: value === expected,
    elapsedMs: Math.min(roundedDuration, 60_000),
    durationCapped: roundedDuration > 60_000,
  };
}

export function evaluateSchulteAttempt(
  board: readonly number[],
  selections: readonly SchulteSelection[],
): SchulteAttemptResult {
  const size = Math.sqrt(board.length);
  if (
    !Number.isInteger(size) ||
    ![4, 5].includes(size) ||
    new Set(board).size !== board.length ||
    board.some((value) => !integerInRange(value, 1, board.length))
  ) {
    throw new Error('schulte_attempt_invalid');
  }

  let expected = 1;
  let correctSelections = 0;
  for (const selection of selections) {
    if (
      !selection ||
      !integerInRange(selection.value, 1, board.length) ||
      selection.expected !== expected ||
      selection.correct !== (selection.value === expected) ||
      !integerInRange(selection.elapsedMs, 0, 60_000) ||
      typeof selection.durationCapped !== 'boolean'
    ) {
      throw new Error('schulte_attempt_invalid');
    }
    if (selection.correct) {
      correctSelections += 1;
      expected += 1;
    }
  }
  const totalDuration = selections.reduce(
    (total, selection) => total + selection.elapsedMs,
    0,
  );
  const incorrectSelections = selections.length - correctSelections;

  return {
    ...CLIENT_TELEMETRY_NOTICE,
    completed: correctSelections === board.length,
    correctSelections,
    incorrectSelections,
    totalSelections: selections.length,
    totalCells: board.length,
    accuracyPercent:
      selections.length === 0
        ? 0
        : Math.round((correctSelections / selections.length) * 100),
    averageSelectionMs:
      selections.length === 0
        ? null
        : Math.round(totalDuration / selections.length),
    cappedIntervals: selections.filter((selection) => selection.durationCapped)
      .length,
  };
}

export function calculateServerObservedReadingMetrics(
  wordCount: number,
  durationMs: number,
  correctAnswers: number,
  questionCount: number,
): FastReadingMetrics {
  if (
    !integerInRange(wordCount, 1, 10_000) ||
    !integerInRange(durationMs, 1_000, 3_600_000) ||
    !integerInRange(questionCount, 1, 100) ||
    !integerInRange(correctAnswers, 0, questionCount)
  ) {
    throw new Error('fast_reading_metrics_invalid');
  }
  return {
    ...CLIENT_TELEMETRY_NOTICE,
    serverObservedApproxWordsPerMinute: Math.round(
      (wordCount * 60_000) / durationMs,
    ),
    timingModel: 'server_observed_approximation',
    includesTransportAndRenderLatency: true,
    comprehensionPercent: Math.round((correctAnswers / questionCount) * 100),
    durationMs,
  };
}

export function recommendNextLevel(
  currentLevel: FastReadingLevelId,
  metrics: Pick<FastReadingMetrics, 'comprehensionPercent'>,
) {
  const currentIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === currentLevel,
  );
  if (currentIndex < 0) throw new Error('fast_reading_level_invalid');
  if (!integerInRange(metrics.comprehensionPercent, 0, 100)) {
    throw new Error('fast_reading_metrics_invalid');
  }
  const current = FAST_READING_LEVELS[currentIndex];
  const comprehensionReady =
    metrics.comprehensionPercent >= current.targetComprehensionPercent;
  if (!comprehensionReady) return current.id;
  return FAST_READING_LEVELS[
    Math.min(currentIndex + 1, FAST_READING_LEVELS.length - 1)
  ].id;
}

export function isFastReadingLevelUnlocked(
  candidate: FastReadingLevelId,
  highestUnlocked: FastReadingLevelId,
) {
  const candidateIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === candidate,
  );
  const highestIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === highestUnlocked,
  );
  if (candidateIndex < 0 || highestIndex < 0) {
    throw new Error('fast_reading_level_invalid');
  }
  return candidateIndex <= highestIndex;
}

export function advanceFocusRound(currentRound: number) {
  if (!integerInRange(currentRound, 1, 4)) {
    throw new Error('focus_round_invalid');
  }
  return Math.min(currentRound + 1, 4);
}

export function canCompleteFocus(currentRound: number) {
  if (!integerInRange(currentRound, 1, 4)) {
    throw new Error('focus_round_invalid');
  }
  return currentRound === 4;
}
