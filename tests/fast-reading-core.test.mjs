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

test('synthetic profile cannot be mistaken for verified evidence', () => {
  const student = core.SYNTHETIC_FAST_READING_STUDENT;
  assert.equal(student.fixtureKind, 'synthetic_student');
  assert.equal(student.measurementNotice.evidenceClass, 'client_telemetry');
  assert.equal(student.measurementNotice.serverVerified, false);
  assert.equal(student.measurementNotice.productionLedgerEligible, false);
  assert.equal(
    student.measurementNotice.visualSpanMethod,
    'synthetic_estimate',
  );
});

test('Schulte boards are deterministic permutations for each supported size', () => {
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

test('Schulte evaluation stops at the first sequence error', () => {
  const board = core.createSchulteBoard(4, 7);
  const result = core.evaluateSchulteAttempt(
    board,
    [1, 2, 4, 3],
    [500, 450, 400, 350],
  );
  assert.equal(result.completed, false);
  assert.equal(result.correctSelections, 2);
  assert.equal(result.accuracyPercent, 13);
  assert.equal(result.serverVerified, false);
});

test('reading speed is calculated only with bounded comprehension inputs', () => {
  const metrics = core.calculateReadingMetrics(180, 90_000, 4, 5);
  assert.equal(metrics.wordsPerMinute, 120);
  assert.equal(metrics.comprehensionPercent, 80);
  assert.equal(metrics.evidenceClass, 'client_telemetry');
  assert.throws(
    () => core.calculateReadingMetrics(180, 0, 4, 5),
    /fast_reading_metrics_invalid/,
  );
});

test('speed progression never advances when comprehension threshold is missed', () => {
  assert.equal(
    core.recommendNextLevel('starter', {
      wordsPerMinute: 220,
      comprehensionPercent: 79,
    }),
    'starter',
  );
  assert.equal(
    core.recommendNextLevel('starter', {
      wordsPerMinute: 125,
      comprehensionPercent: 80,
    }),
    'explorer',
  );
  assert.equal(
    core.recommendNextLevel('accelerator', {
      wordsPerMinute: 240,
      comprehensionPercent: 90,
    }),
    'accelerator',
  );
});
