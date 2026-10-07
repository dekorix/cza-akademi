/* oxlint-disable typescript/no-floating-promises -- node:test declarations register synchronously. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL('../lib/fast-reading-core.ts', import.meta.url),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);

test('synthetic profile and every nested trust notice are deeply frozen', () => {
  const student = core.SYNTHETIC_FAST_READING_STUDENT;
  assert.equal(student.fixtureKind, 'synthetic_student');
  assert.equal(student.measurementNotice.evidenceClass, 'client_telemetry');
  assert.equal(student.measurementNotice.serverVerified, false);
  assert.equal(student.measurementNotice.productionLedgerEligible, false);
  assert.equal(
    student.measurementNotice.visualSpanMethod,
    'synthetic_estimate',
  );
  assert.equal(Object.isFrozen(student), true);
  assert.equal(Object.isFrozen(student.baseline), true);
  assert.equal(Object.isFrozen(student.measurementNotice), true);
  assert.throws(() => {
    student.measurementNotice.serverVerified = true;
  }, TypeError);
  assert.equal(student.measurementNotice.serverVerified, false);
});

test('Schulte boards are valid permutations and a new session seed changes layout', () => {
  for (const size of [4, 5]) {
    const first = core.createSchulteBoard(size, 20260914);
    const replay = core.createSchulteBoard(size, 20260914);
    assert.deepEqual(first, replay);
    assert.deepEqual(
      [...first].sort((a, b) => a - b),
      Array.from({ length: size * size }, (_, index) => index + 1),
    );
  }
  assert.notDeepEqual(
    core.createSchulteBoard(5, 1),
    core.createSchulteBoard(5, 2),
  );
});

test('wrong Schulte clicks remain in the attempt and lower its score', () => {
  const board = core.createSchulteBoard(4, 7);
  const selections = [
    core.recordSchulteSelection(1, 1, 500, 16),
    core.recordSchulteSelection(2, 9, 450, 16),
    core.recordSchulteSelection(2, 2, 400, 16),
    core.recordSchulteSelection(3, 8, 350, 16),
    core.recordSchulteSelection(3, 3, 300, 16),
  ];
  const result = core.evaluateSchulteAttempt(board, selections);
  assert.equal(result.completed, false);
  assert.equal(result.correctSelections, 3);
  assert.equal(result.incorrectSelections, 2);
  assert.equal(result.totalSelections, 5);
  assert.equal(result.accuracyPercent, 60);
  assert.equal(result.serverVerified, false);
});

test('a long Schulte wait is capped and reported instead of crashing the session', () => {
  const board = core.createSchulteBoard(4, 11);
  const delayed = core.recordSchulteSelection(1, 1, 180_000, 16);
  assert.deepEqual(delayed, {
    value: 1,
    expected: 1,
    correct: true,
    elapsedMs: 60_000,
    durationCapped: true,
  });
  const result = core.evaluateSchulteAttempt(board, [delayed]);
  assert.equal(result.correctSelections, 1);
  assert.equal(result.cappedIntervals, 1);
  assert.equal(result.averageSelectionMs, 60_000);
});

test('reading speed is calculated only with bounded comprehension inputs', () => {
  const metrics = core.calculateServerObservedReadingMetrics(180, 90_000, 4, 5);
  assert.equal(metrics.serverObservedApproxWordsPerMinute, 120);
  assert.equal(metrics.timingModel, 'server_observed_approximation');
  assert.equal(metrics.includesTransportAndRenderLatency, true);
  assert.equal(metrics.comprehensionPercent, 80);
  assert.equal(metrics.evidenceClass, 'client_telemetry');
  assert.throws(
    () => core.calculateServerObservedReadingMetrics(180, 0, 4, 5),
    /fast_reading_metrics_invalid/,
  );
});

test('comprehension threshold controls progression and rejects impossible percentages', () => {
  assert.equal(
    core.recommendNextLevel('starter', {
      comprehensionPercent: 79,
    }),
    'starter',
  );
  assert.equal(
    core.recommendNextLevel('starter', {
      comprehensionPercent: 80,
    }),
    'explorer',
  );
  assert.equal(
    core.recommendNextLevel('accelerator', {
      comprehensionPercent: 90,
    }),
    'accelerator',
  );
  assert.throws(
    () =>
      core.recommendNextLevel('starter', {
        comprehensionPercent: 999,
      }),
    /fast_reading_metrics_invalid/,
  );
});

test('locked levels cannot be selected before comprehension unlocks them', () => {
  assert.equal(core.isFastReadingLevelUnlocked('starter', 'starter'), true);
  assert.equal(core.isFastReadingLevelUnlocked('explorer', 'starter'), false);
  assert.equal(
    core.isFastReadingLevelUnlocked('accelerator', 'starter'),
    false,
  );
  assert.equal(core.isFastReadingLevelUnlocked('explorer', 'explorer'), true);
  assert.equal(
    core.isFastReadingLevelUnlocked('accelerator', 'explorer'),
    false,
  );
});

test('focus completion stays locked until the timed fourth round', () => {
  let round = 1;
  assert.equal(core.canCompleteFocus(round), false);
  round = core.advanceFocusRound(round);
  assert.equal(core.canCompleteFocus(round), false);
  round = core.advanceFocusRound(round);
  assert.equal(core.canCompleteFocus(round), false);
  round = core.advanceFocusRound(round);
  assert.equal(round, 4);
  assert.equal(core.canCompleteFocus(round), true);
  assert.equal(core.advanceFocusRound(round), 4);
});

test('every level rule is recursively immutable at runtime', () => {
  assert.equal(Object.isFrozen(core.FAST_READING_LEVELS), true);
  for (const level of core.FAST_READING_LEVELS) {
    assert.equal(Object.isFrozen(level), true);
  }
  assert.throws(() => {
    core.FAST_READING_LEVELS[0].targetComprehensionPercent = 0;
  }, TypeError);
  assert.equal(core.FAST_READING_LEVELS[0].targetComprehensionPercent, 80);
  assert.equal(
    core.recommendNextLevel('starter', {
      comprehensionPercent: 0,
    }),
    'starter',
  );
});

test('five-question progression thresholds align to exact twenty-point steps', () => {
  assert.deepEqual(
    core.FAST_READING_LEVELS.map((level) => level.targetComprehensionPercent),
    [80, 80, 100],
  );
  for (const level of core.FAST_READING_LEVELS) {
    assert.equal(level.targetComprehensionPercent % 20, 0);
    assert.ok(level.tachistoscopeExposureMs >= 650);
  }
});
