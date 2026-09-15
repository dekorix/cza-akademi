/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let core;
let vite;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  core = await vite.ssrLoadModule('/lib/attention-core.ts');
});

after(async () => {
  await vite.close();
});

test('synthetic fixture and every nested level rule are recursively frozen', () => {
  assert.equal(Object.isFrozen(core.ATTENTION_LEVELS), true);
  assert.equal(Object.isFrozen(core.ATTENTION_LEVELS[0]), true);
  assert.equal(Object.isFrozen(core.SYNTHETIC_ATTENTION_STUDENT), true);
  assert.equal(Object.isFrozen(core.SYNTHETIC_ATTENTION_STUDENT.baseline), true);
  assert.equal(
    Object.isFrozen(core.SYNTHETIC_ATTENTION_STUDENT.measurementNotice),
    true,
  );
  assert.throws(() => {
    core.ATTENTION_LEVELS[0].minimumStroopResponseMs = 0;
  }, TypeError);
  assert.equal(core.ATTENTION_LEVELS[0].minimumStroopResponseMs, 120);
});

test('fixture is explicitly synthetic and ineligible for persistence', () => {
  const notice = core.SYNTHETIC_ATTENTION_STUDENT.measurementNotice;
  assert.equal(notice.evidenceClass, 'synthetic_attention');
  assert.equal(notice.serverVerified, false);
  assert.equal(notice.productionLedgerEligible, false);
  assert.equal(notice.persisted, false);
  assert.equal(notice.diagnosticUse, false);
});

test('metrics use bounded server-observed durations and expose variability honestly', () => {
  const common = {
    timingModel: 'server_observed_approximation',
    includesTransportAndRenderLatency: true,
  };
  const metrics = core.calculateAttentionMetrics([
    {
      ...common,
      exerciseId: 'stroop_conflict',
      correct: true,
      serverObservedResponseMs: 500,
    },
    {
      ...common,
      exerciseId: 'stroop_conflict',
      correct: false,
      serverObservedResponseMs: 1_000,
    },
  ]);
  assert.equal(metrics.averageServerObservedResponseMs, 750);
  assert.equal(metrics.conflictManagementAccuracyPercent, 50);
  assert.equal(metrics.visualMemoryAccuracyPercent, null);
  assert.equal(metrics.focusDeviationMultiplier, 0.33);
  assert.equal(Object.isFrozen(metrics), true);
  assert.throws(
    () =>
      core.calculateAttentionMetrics([
        {
          ...common,
          exerciseId: 'stroop_conflict',
          correct: true,
          serverObservedResponseMs: 30_001,
        },
      ]),
    /attention_measurements_invalid/,
  );
});
