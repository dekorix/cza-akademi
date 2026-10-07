/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

const environment = {
  ...process.env,
  NODE_ENV: 'test',
  CZA_ATTENTION_ISOLATED_PREVIEW: 'true',
  CZA_ATTENTION_SESSION_SECRET: 'c'.repeat(64),
};

let session;
let vite;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  session = await vite.ssrLoadModule('/lib/attention-session-server.ts');
});

after(async () => {
  await vite.close();
});

test('production fails closed and preview requires a strong configured secret', () => {
  assert.equal(
    session.attentionPreviewEnabled({
      ...environment,
      NODE_ENV: 'production',
    }),
    false,
  );
  assert.throws(
    () =>
      session.assertAttentionConfiguration({
        ...environment,
        CZA_ATTENTION_SESSION_SECRET: 'short',
      }),
    (error) =>
      error.code === 'attention_configuration_unavailable' &&
      error.status === 503,
  );
});

test('start returns only an opaque prepare token and render starts server timing', () => {
  const subject = 'attention-preview:student-1';
  const started = session.startAttentionSession(
    subject,
    'stroop_conflict',
    'foundation',
    10_000,
    environment,
  );
  assert.equal(typeof started.prepareToken, 'string');
  assert.equal('stimulus' in started, false);
  assert.equal('shownAt' in started, false);
  assert.equal(started.prepareToken.includes(subject), false);

  const rendered = session.renderAttentionTrial(
    started.prepareToken,
    subject,
    20_000,
    environment,
  );
  assert.equal(rendered.stimulus.kind, 'stroop_conflict');
  assert.equal(rendered.responseToken.includes(rendered.stimulus.ink), false);
  assert.throws(
    () =>
      session.submitAttentionResponse(
        rendered.responseToken,
        subject,
        rendered.stimulus.ink,
        20_119,
        environment,
      ),
    (error) => error.code === 'attention_response_window_invalid',
  );
});

test('feedback waiting cannot pre-age the next trial clock', () => {
  const subject = 'attention-preview:lazy-clock';
  const started = session.startAttentionSession(
    subject,
    'stroop_conflict',
    'foundation',
    1_000,
    environment,
  );
  const first = session.renderAttentionTrial(
    started.prepareToken,
    subject,
    2_000,
    environment,
  );
  const answered = session.submitAttentionResponse(
    first.responseToken,
    subject,
    first.stimulus.ink,
    2_120,
    environment,
  );
  assert.equal(answered.completed, false);

  const next = session.renderAttentionTrial(
    answered.prepareToken,
    subject,
    20_000,
    environment,
  );
  assert.throws(
    () =>
      session.submitAttentionResponse(
        next.responseToken,
        subject,
        next.stimulus.ink,
        20_119,
        environment,
      ),
    (error) => error.code === 'attention_response_window_invalid',
  );
  const accepted = session.submitAttentionResponse(
    next.responseToken,
    subject,
    next.stimulus.ink,
    20_120,
    environment,
  );
  assert.equal(accepted.correct, true);
});

test('matrix answer is scored on the server only after exposure closes', () => {
  const subject = 'attention-preview:matrix';
  const started = session.startAttentionSession(
    subject,
    'visual_memory_matrix',
    'foundation',
    1_000,
    environment,
  );
  const rendered = session.renderAttentionTrial(
    started.prepareToken,
    subject,
    2_000,
    environment,
  );
  assert.equal(rendered.stimulus.kind, 'visual_memory_matrix');
  assert.equal(rendered.stimulus.activeCells.length, 3);
  assert.throws(
    () =>
      session.submitAttentionResponse(
        rendered.responseToken,
        subject,
        rendered.stimulus.activeCells,
        2_899,
        environment,
      ),
    (error) => error.code === 'attention_response_window_invalid',
  );
  const accepted = session.submitAttentionResponse(
    rendered.responseToken,
    subject,
    rendered.stimulus.activeCells,
    2_900,
    environment,
  );
  assert.equal(accepted.correct, true);
});

test('final receipt stays synthetic, non-diagnostic, deep frozen, and non-persistent', () => {
  const subject = 'attention-preview:receipt';
  let step = session.startAttentionSession(
    subject,
    'stroop_conflict',
    'foundation',
    1_000,
    environment,
  );
  let now = 2_000;
  let result;
  for (let round = 0; round < 4; round += 1) {
    const rendered = session.renderAttentionTrial(
      step.prepareToken,
      subject,
      now,
      environment,
    );
    result = session.submitAttentionResponse(
      rendered.responseToken,
      subject,
      rendered.stimulus.ink,
      now + 120,
      environment,
    );
    now += 1_000;
    step = result;
  }
  assert.equal(result.completed, true);
  assert.equal(result.receipt.evidenceClass, 'synthetic_attention');
  assert.equal(result.receipt.serverVerified, false);
  assert.equal(result.receipt.productionLedgerEligible, false);
  assert.equal(result.receipt.persisted, false);
  assert.equal(result.receipt.canonicalRecordCreated, false);
  assert.equal(result.receipt.diagnosticUse, false);
  assert.equal(result.receipt.metrics.correctRounds, 4);
  assert.equal(Object.isFrozen(result.receipt), true);
  assert.equal(Object.isFrozen(result.receipt.metrics), true);
  assert.equal(Object.isFrozen(result.receipt.measurementNotice), true);
});
