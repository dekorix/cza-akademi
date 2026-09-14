export const FAST_READING_MODULE_ID = 'fast_reading_core';
export const FAST_READING_MODULE_VERSION = '0.1.0-preview';

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
  wordsPerMinute: number;
  comprehensionPercent: number;
  durationMs: number;
};

export type SchulteAttemptResult = ClientTelemetryNotice & {
  completed: boolean;
  correctSelections: number;
  totalCells: number;
  accuracyPercent: number;
  averageSelectionMs: number | null;
};

export const CLIENT_TELEMETRY_NOTICE: ClientTelemetryNotice = Object.freeze({
  evidenceClass: 'client_telemetry',
  serverVerified: false,
  productionLedgerEligible: false,
});

export const FAST_READING_LEVELS: readonly FastReadingLevel[] = Object.freeze([
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
    targetComprehensionPercent: 82,
  },
  {
    id: 'accelerator',
    label: 'Hızlanma',
    description: 'Anlamayı koruyarak daha kısa gösterim aralıkları.',
    schulteSize: 5,
    focusStepMs: 700,
    tachistoscopeExposureMs: 650,
    targetComprehensionPercent: 85,
  },
]);

export const SYNTHETIC_FAST_READING_STUDENT: SyntheticFastReadingStudent =
  Object.freeze({
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

export const FAST_READING_LEARNING_PATH = Object.freeze([
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

export function evaluateSchulteAttempt(
  board: readonly number[],
  selections: readonly number[],
  selectionDurationsMs: readonly number[],
): SchulteAttemptResult {
  const size = Math.sqrt(board.length);
  if (
    !Number.isInteger(size) ||
    ![4, 5].includes(size) ||
    new Set(board).size !== board.length ||
    board.some((value) => !integerInRange(value, 1, board.length)) ||
    selectionDurationsMs.length !== selections.length ||
    selectionDurationsMs.some((value) => !integerInRange(value, 0, 60_000))
  ) {
    throw new Error('schulte_attempt_invalid');
  }

  let correctSelections = 0;
  for (const selection of selections) {
    if (selection === correctSelections + 1) correctSelections += 1;
    else break;
  }
  const totalDuration = selectionDurationsMs.reduce(
    (total, duration) => total + duration,
    0,
  );

  return {
    ...CLIENT_TELEMETRY_NOTICE,
    completed: correctSelections === board.length,
    correctSelections,
    totalCells: board.length,
    accuracyPercent: Math.round((correctSelections / board.length) * 100),
    averageSelectionMs:
      selections.length === 0
        ? null
        : Math.round(totalDuration / selections.length),
  };
}

export function calculateReadingMetrics(
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
    wordsPerMinute: Math.round((wordCount * 60_000) / durationMs),
    comprehensionPercent: Math.round((correctAnswers / questionCount) * 100),
    durationMs,
  };
}

export function recommendNextLevel(
  currentLevel: FastReadingLevelId,
  metrics: Pick<FastReadingMetrics, 'wordsPerMinute' | 'comprehensionPercent'>,
) {
  const currentIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === currentLevel,
  );
  if (currentIndex < 0) throw new Error('fast_reading_level_invalid');
  const current = FAST_READING_LEVELS[currentIndex];
  const comprehensionReady =
    metrics.comprehensionPercent >= current.targetComprehensionPercent;
  const speedIsPlausible = integerInRange(metrics.wordsPerMinute, 20, 1_200);
  if (!speedIsPlausible || !comprehensionReady) return current.id;
  return FAST_READING_LEVELS[
    Math.min(currentIndex + 1, FAST_READING_LEVELS.length - 1)
  ].id;
}
