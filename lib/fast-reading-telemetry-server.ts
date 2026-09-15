import {
  FAST_READING_MODULE_ID,
  FAST_READING_MODULE_VERSION,
  FAST_READING_TRIAL_COUNT,
  type FastReadingExerciseId,
  type FastReadingLevelId,
} from './fast-reading-core';

export type FastReadingClientTelemetry = {
  moduleId: typeof FAST_READING_MODULE_ID;
  moduleVersion: typeof FAST_READING_MODULE_VERSION;
  exerciseId: FastReadingExerciseId;
  levelId: FastReadingLevelId;
  metrics: {
    durationMs: number;
    correctResponses: number;
    incorrectResponses: number;
    totalResponses: number;
    comprehensionPercent: number | null;
  };
};

export type FastReadingTelemetryReceipt = {
  receiptType: 'fast_reading_preview_receipt';
  classificationAuthority: 'server';
  evidenceClass: 'client_telemetry';
  serverVerified: false;
  productionLedgerEligible: false;
  persisted: false;
  canonicalRecordCreated: false;
  telemetry: FastReadingClientTelemetry;
};

export class FastReadingTelemetryError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'FastReadingTelemetryError';
  }
}

function fail(code = 'fast_reading_telemetry_invalid'): never {
  throw new FastReadingTelemetryError(code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(
  value: Record<string, unknown>,
  required: readonly string[],
  ignored: readonly string[] = [],
) {
  const expected = new Set([...required, ...ignored]);
  if (
    Object.keys(value).some((key) => !expected.has(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    fail();
  }
}

function integer(value: unknown, minimum: number, maximum: number) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    fail();
  }
  return value;
}

function optionalPercent(value: unknown) {
  if (value === null) return null;
  return integer(value, 0, 100);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function parseFastReadingClientTelemetry(
  value: unknown,
): FastReadingClientTelemetry {
  if (!isPlainObject(value)) fail();
  exactFields(
    value,
    ['moduleId', 'moduleVersion', 'exerciseId', 'levelId', 'metrics'],
    [
      'evidenceClass',
      'serverVerified',
      'productionLedgerEligible',
      'persisted',
      'canonicalRecordCreated',
      'progressionToken',
      'action',
    ],
  );
  if (
    value.moduleId !== FAST_READING_MODULE_ID ||
    value.moduleVersion !== FAST_READING_MODULE_VERSION ||
    !['focus_expansion', 'schulte_scan', 'tachistoscope'].includes(
      String(value.exerciseId),
    ) ||
    !['starter', 'explorer', 'accelerator'].includes(String(value.levelId)) ||
    !isPlainObject(value.metrics)
  ) {
    fail();
  }
  exactFields(value.metrics, [
    'durationMs',
    'correctResponses',
    'incorrectResponses',
    'totalResponses',
    'comprehensionPercent',
  ]);
  const correctResponses = integer(value.metrics.correctResponses, 0, 10_000);
  const incorrectResponses = integer(
    value.metrics.incorrectResponses,
    0,
    10_000,
  );
  const totalResponses = integer(value.metrics.totalResponses, 0, 10_000);
  if (correctResponses + incorrectResponses !== totalResponses) fail();
  const comprehensionPercent = optionalPercent(
    value.metrics.comprehensionPercent,
  );
  if (value.exerciseId === 'tachistoscope') {
    if (
      totalResponses !== FAST_READING_TRIAL_COUNT ||
      comprehensionPercent !==
        Math.round((correctResponses / totalResponses) * 100)
    ) {
      fail();
    }
  } else if (comprehensionPercent !== null) {
    fail();
  }
  if (value.exerciseId === 'focus_expansion' && totalResponses !== 0) fail();

  return {
    moduleId: FAST_READING_MODULE_ID,
    moduleVersion: FAST_READING_MODULE_VERSION,
    exerciseId: value.exerciseId as FastReadingExerciseId,
    levelId: value.levelId as FastReadingLevelId,
    metrics: {
      durationMs: integer(value.metrics.durationMs, 0, 3_600_000),
      correctResponses,
      incorrectResponses,
      totalResponses,
      comprehensionPercent,
    },
  };
}

export function classifyFastReadingTelemetry(
  value: unknown,
): FastReadingTelemetryReceipt {
  const telemetry = parseFastReadingClientTelemetry(value);
  return deepFreeze({
    receiptType: 'fast_reading_preview_receipt',
    classificationAuthority: 'server',
    evidenceClass: 'client_telemetry',
    serverVerified: false,
    productionLedgerEligible: false,
    persisted: false,
    canonicalRecordCreated: false,
    telemetry,
  });
}
