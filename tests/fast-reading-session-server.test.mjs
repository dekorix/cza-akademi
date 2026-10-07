/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

const environment = {
  ...process.env,
  NODE_ENV: 'test',
  CZA_FAST_READING_ISOLATED_PREVIEW: 'true',
  CZA_FAST_READING_SESSION_SECRET: 'a'.repeat(64),
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
  session = await vite.ssrLoadModule('/lib/fast-reading-session-server.ts');
});

after(async () => {
  await vite.close();
});

function answerForOutcome(token, subject, now, expected) {
  for (let optionIndex = 0; optionIndex < 3; optionIndex += 1) {
    const result = session.answerComprehensionQuestion(
      token,
      subject,
      optionIndex,
      now,
      environment,
    );
    if (result.wasCorrect === expected) return result;
  }
  throw new Error('test_answer_not_found');
}

function completeAttempt(
  initial,
  subject,
  durationMs,
  answerCorrectly,
  feedbackDelayMs = 0,
) {
  let token = initial.sessionToken;
  let now = 10_000;
  let result;
  for (let index = 0; index < 5; index += 1) {
    now += durationMs;
    const question = session.finishReadingTrial(
      token,
      subject,
      now,
      environment,
    );
    result = answerForOutcome(
      question.sessionToken,
      subject,
      now + 1,
      answerCorrectly,
    );
    now += 1;
    if (!result.completed) {
      now += feedbackDelayMs;
      const prepared = session.startPreparedReadingTrial(
        result.prepareToken,
        subject,
        now,
        environment,
      );
      token = prepared.sessionToken;
    }
  }
  return result;
}

test('question bank and answer keys stay out of the client module', () => {
  const clientSource = fs.readFileSync(
    new URL('../components/fast-reading-workspace.tsx', import.meta.url),
    'utf8',
  );
  const coreSource = fs.readFileSync(
    new URL('../lib/fast-reading-core.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(clientSource, /correctOptionIndex|Meraklı çocuk/);
  assert.doesNotMatch(coreSource, /correctOptionIndex|Meraklı çocuk/);
});

test('server chooses trials and option order cryptographically and seals the plan', () => {
  const firstTrials = new Set();
  const firstTokens = [];
  const optionOrders = new Map();
  for (let index = 0; index < 64; index += 1) {
    const started = session.startTachistoscopeSession(
      `student:${index}`,
      'starter',
      null,
      10_000,
      environment,
    );
    firstTrials.add(started.trial.trialId);
    assert.equal(started.trial.exposureMs, 1_200);
    firstTokens.push(started.sessionToken);
    assert.equal(started.sessionToken.includes(started.trial.phrase), false);
    const question = session.finishReadingTrial(
      started.sessionToken,
      `student:${index}`,
      11_200,
      environment,
    );
    const orders = optionOrders.get(question.question.trialId) || new Set();
    orders.add(question.question.options.join('|'));
    optionOrders.set(question.question.trialId, orders);
  }
  assert.ok(firstTrials.size > 1);
  assert.equal(new Set(firstTokens).size, firstTokens.length);
  assert.ok([...optionOrders.values()].some((orders) => orders.size > 1));
});

test('server clock controls approximate speed and server scoring controls progression', () => {
  const subject = 'student:timing-test';
  const initial = session.startTachistoscopeSession(
    subject,
    'starter',
    null,
    10_000,
    environment,
  );
  const fast = completeAttempt(initial, subject, 1_200, true);
  const slow = completeAttempt(initial, subject, 2_400, true);

  assert.equal(fast.completed, true);
  assert.equal(fast.receipt.correctAnswers, 5);
  assert.equal(fast.receipt.metrics.durationMs, 6_000);
  assert.equal(
    fast.receipt.metrics.timingModel,
    'server_observed_approximation',
  );
  assert.equal(fast.receipt.metrics.includesTransportAndRenderLatency, true);
  assert.equal(fast.receipt.timingAuthority, 'server_clock');
  assert.equal(fast.receipt.answerScoringAuthority, 'server');
  assert.equal(fast.receipt.highestUnlockedLevel, 'explorer');
  assert.equal(slow.receipt.metrics.durationMs, 12_000);
  assert.ok(
    fast.receipt.metrics.serverObservedApproxWordsPerMinute >
      slow.receipt.metrics.serverObservedApproxWordsPerMinute,
  );

  const explorer = session.startTachistoscopeSession(
    subject,
    'explorer',
    fast.progressionToken,
    20_000,
    environment,
  );
  assert.equal(explorer.trial.position, 1);
  assert.throws(
    () =>
      session.startTachistoscopeSession(
        subject,
        'explorer',
        `${fast.progressionToken}x`,
        20_000,
        environment,
      ),
    /fast_reading_session_invalid/,
  );
});

test('failed comprehension keeps the next level locked on the server', () => {
  const subject = 'student:locked-test';
  const initial = session.startTachistoscopeSession(
    subject,
    'starter',
    null,
    10_000,
    environment,
  );
  const failed = completeAttempt(initial, subject, 1_200, false);
  assert.equal(failed.receipt.metrics.comprehensionPercent, 0);
  assert.equal(failed.receipt.highestUnlockedLevel, 'starter');
  assert.throws(
    () =>
      session.startTachistoscopeSession(
        subject,
        'explorer',
        failed.progressionToken,
        20_000,
        environment,
      ),
    (error) =>
      error instanceof session.FastReadingSessionError &&
      error.code === 'fast_reading_level_locked' &&
      error.status === 403,
  );
});

test('server rejects reading windows outside the measured safety bounds', () => {
  const subject = 'student:duration-test';
  const initial = session.startTachistoscopeSession(
    subject,
    'starter',
    null,
    10_000,
    environment,
  );
  assert.throws(
    () =>
      session.finishReadingTrial(
        initial.sessionToken,
        subject,
        11_199,
        environment,
      ),
    /fast_reading_duration_invalid/,
  );
  assert.throws(
    () =>
      session.finishReadingTrial(
        initial.sessionToken,
        subject,
        130_001,
        environment,
      ),
    /fast_reading_duration_invalid/,
  );
});

test('feedback waiting cannot pre-age the next reading window', () => {
  const subject = 'student:feedback-race-test';
  const initial = session.startTachistoscopeSession(
    subject,
    'starter',
    null,
    10_000,
    environment,
  );
  const question = session.finishReadingTrial(
    initial.sessionToken,
    subject,
    11_200,
    environment,
  );
  const answer = answerForOutcome(
    question.sessionToken,
    subject,
    11_201,
    false,
  );
  assert.equal(answer.completed, false);
  assert.equal(typeof answer.prepareToken, 'string');
  assert.equal(Object.hasOwn(answer, 'nextTrial'), false);
  assert.equal(Object.hasOwn(answer, 'sessionToken'), false);

  const prepared = session.startPreparedReadingTrial(
    answer.prepareToken,
    subject,
    60_000,
    environment,
  );
  assert.equal(prepared.trial.position, 2);
  assert.throws(
    () =>
      session.finishReadingTrial(
        prepared.sessionToken,
        subject,
        60_001,
        environment,
      ),
    /fast_reading_duration_invalid/,
  );
  assert.equal(
    session.finishReadingTrial(
      prepared.sessionToken,
      subject,
      61_200,
      environment,
    ).question.trialId,
    prepared.trial.trialId,
  );
});

test('preview identity is signed, expiring, and unavailable in production', () => {
  const token = session.issuePreviewIdentity(1_000, environment);
  const subject = session.verifyPreviewIdentity(token, 2_000, environment);
  assert.match(subject, /^preview:[0-9a-f]{32}$/);
  assert.equal(
    session.verifyPreviewIdentity(`${token}x`, 2_000, environment),
    null,
  );
  assert.equal(
    session.verifyPreviewIdentity(token, 2_000, {
      ...environment,
      NODE_ENV: 'production',
    }),
    null,
  );
});

test('session configuration fails closed without a strong secret', () => {
  assert.throws(
    () => session.assertFastReadingConfiguration({ NODE_ENV: 'test' }),
    (error) =>
      error instanceof session.FastReadingSessionError &&
      error.code === 'fast_reading_configuration_unavailable' &&
      error.status === 503,
  );
});
