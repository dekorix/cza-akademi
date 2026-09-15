import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import {
  ATTENTION_MODULE_ID,
  ATTENTION_MODULE_VERSION,
  ATTENTION_SCHEMA_VERSION,
  attentionLevel,
  calculateAttentionMetrics,
  deepFreezeAttentionValue,
  type AttentionExerciseId,
  type AttentionLevelId,
  type AttentionRoundMeasurement,
} from './attention-core';

const TOKEN_VERSION = 1;
const TOKEN_AAD = Buffer.from('cza-attention-isolated-preview-v1', 'utf8');
const SESSION_TTL_MS = 15 * 60_000;
const IDENTITY_TTL_MS = 60 * 60_000;
const MAX_RESPONSE_MS = 30_000;

const COLOR_IDS = ['red', 'green', 'blue', 'amber'] as const;
type AttentionColorId = (typeof COLOR_IDS)[number];

type StroopPlan = Readonly<{
  kind: 'stroop_conflict';
  word: AttentionColorId;
  ink: AttentionColorId;
  optionOrder: readonly AttentionColorId[];
}>;

type MatrixPlan = Readonly<{
  kind: 'visual_memory_matrix';
  size: 3 | 4;
  activeCells: readonly number[];
  exposureMs: number;
}>;

type TrialPlan = StroopPlan | MatrixPlan;

type AttemptState = {
  version: 1;
  kind: 'attention_attempt';
  subject: string;
  attemptId: string;
  exerciseId: AttentionExerciseId;
  levelId: AttentionLevelId;
  expiresAt: number;
  phase: 'prepare' | 'response';
  index: number;
  shownAt: number | null;
  plans: TrialPlan[];
  measurements: AttentionRoundMeasurement[];
};

type PreviewIdentity = { subject: string; expiresAt: number };

export type PublicAttentionStimulus =
  | Readonly<{
      kind: 'stroop_conflict';
      word: AttentionColorId;
      ink: AttentionColorId;
      options: readonly AttentionColorId[];
      position: number;
      total: number;
    }>
  | Readonly<{
      kind: 'visual_memory_matrix';
      size: 3 | 4;
      activeCells: readonly number[];
      exposureMs: number;
      position: number;
      total: number;
    }>;

export type AttentionServerReceipt = Readonly<{
  receiptType: 'attention_isolated_preview_receipt';
  moduleId: typeof ATTENTION_MODULE_ID;
  moduleVersion: typeof ATTENTION_MODULE_VERSION;
  schemaVersion: typeof ATTENTION_SCHEMA_VERSION;
  classificationAuthority: 'server';
  timingAuthority: 'server_clock';
  answerScoringAuthority: 'server';
  evidenceClass: 'synthetic_attention';
  serverVerified: false;
  productionLedgerEligible: false;
  persisted: false;
  canonicalRecordCreated: false;
  diagnosticUse: false;
  levelId: AttentionLevelId;
  exerciseId: AttentionExerciseId;
  metrics: ReturnType<typeof calculateAttentionMetrics>;
  measurementNotice: Readonly<{
    model: 'server_observed_approximation';
    includesTransportAndRenderLatency: true;
    clientCanObservePresentedAnswers: true;
    interpretation: 'practice_feedback_only';
  }>;
}>;

export class AttentionSessionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'AttentionSessionError';
  }
}

function fail(code: string, status = 400): never {
  throw new AttentionSessionError(code, status);
}

function secretKey(environment: NodeJS.ProcessEnv) {
  const value = environment.CZA_ATTENTION_SESSION_SECRET?.trim();
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    fail('attention_configuration_unavailable', 503);
  }
  return Buffer.from(value, 'hex');
}

export function attentionPreviewEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.CZA_ATTENTION_ISOLATED_PREVIEW === 'true'
  );
}

export function assertAttentionConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (!attentionPreviewEnabled(environment)) {
    fail('attention_preview_not_found', 404);
  }
  secretKey(environment);
}

function seal(value: object, environment: NodeJS.ProcessEnv) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(environment), iv);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.');
}

function unseal<T>(token: string, environment: NodeJS.ProcessEnv): T {
  if (typeof token !== 'string' || token.length < 40 || token.length > 4096) {
    fail('attention_session_invalid', 401);
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) fail('attention_session_invalid', 401);
    const [iv, tag, ciphertext] = parts.map((part) =>
      Buffer.from(part, 'base64url'),
    );
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      fail('attention_session_invalid', 401);
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      secretKey(environment),
      iv,
    );
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        'utf8',
      ),
    ) as T;
  } catch (error) {
    if (error instanceof AttentionSessionError) throw error;
    fail('attention_session_invalid', 401);
  }
}

function shuffled<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function stroopPlan(): StroopPlan {
  const word = COLOR_IDS[randomInt(COLOR_IDS.length)];
  const possibleInk = COLOR_IDS.filter((color) => color !== word);
  return {
    kind: 'stroop_conflict',
    word,
    ink: possibleInk[randomInt(possibleInk.length)],
    optionOrder: shuffled(COLOR_IDS),
  };
}

function matrixPlan(levelId: AttentionLevelId): MatrixPlan {
  const level = attentionLevel(levelId);
  const cells = shuffled(
    Array.from({ length: level.matrixSize ** 2 }, (_, index) => index),
  ).slice(0, level.matrixActiveCells);
  return {
    kind: 'visual_memory_matrix',
    size: level.matrixSize,
    activeCells: cells.sort((left, right) => left - right),
    exposureMs: level.matrixExposureMs,
  };
}

function plansFor(exerciseId: AttentionExerciseId, levelId: AttentionLevelId) {
  const count = attentionLevel(levelId).stroopRounds;
  return Array.from({ length: count }, () =>
    exerciseId === 'stroop_conflict' ? stroopPlan() : matrixPlan(levelId),
  );
}

function validAttempt(
  state: AttemptState,
  subject: string,
  phase: AttemptState['phase'],
  now: number,
) {
  if (
    state.version !== TOKEN_VERSION ||
    state.kind !== 'attention_attempt' ||
    state.subject !== subject ||
    state.phase !== phase ||
    !Number.isInteger(state.index) ||
    state.index < 0 ||
    state.index >= state.plans.length ||
    state.plans.length < 1 ||
    state.plans.length > 8 ||
    state.expiresAt <= now ||
    (phase === 'response'
      ? !Number.isInteger(state.shownAt)
      : state.shownAt !== null)
  ) {
    fail('attention_session_invalid', 401);
  }
}

function publicStimulus(state: AttemptState): PublicAttentionStimulus {
  const plan = state.plans[state.index];
  const position = state.index + 1;
  const total = state.plans.length;
  return plan.kind === 'stroop_conflict'
    ? {
        kind: plan.kind,
        word: plan.word,
        ink: plan.ink,
        options: plan.optionOrder,
        position,
        total,
      }
    : {
        kind: plan.kind,
        size: plan.size,
        activeCells: plan.activeCells,
        exposureMs: plan.exposureMs,
        position,
        total,
      };
}

function validMatrixAnswer(value: unknown, cellCount: number) {
  if (
    !Array.isArray(value) ||
    value.length > cellCount ||
    value.some(
      (cell) =>
        !Number.isInteger(cell) || (cell as number) < 0 || cell >= cellCount,
    ) ||
    new Set(value).size !== value.length
  ) {
    fail('attention_answer_invalid');
  }
  return [...value].sort((left, right) => left - right) as number[];
}

function scoreResponse(plan: TrialPlan, answer: unknown) {
  if (plan.kind === 'stroop_conflict') {
    if (!COLOR_IDS.includes(answer as AttentionColorId)) {
      fail('attention_answer_invalid');
    }
    return answer === plan.ink;
  }
  const selected = validMatrixAnswer(answer, plan.size ** 2);
  return (
    selected.length === plan.activeCells.length &&
    selected.every((cell, index) => cell === plan.activeCells[index])
  );
}

export function startAttentionSession(
  subject: string,
  exerciseId: AttentionExerciseId,
  levelId: AttentionLevelId,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  assertAttentionConfiguration(environment);
  const state: AttemptState = {
    version: TOKEN_VERSION,
    kind: 'attention_attempt',
    subject,
    attemptId: randomBytes(16).toString('hex'),
    exerciseId,
    levelId,
    expiresAt: now + SESSION_TTL_MS,
    phase: 'prepare',
    index: 0,
    shownAt: null,
    plans: plansFor(exerciseId, levelId),
    measurements: [],
  };
  return deepFreezeAttentionValue({
    exerciseId,
    levelId,
    position: 1,
    total: state.plans.length,
    prepareToken: seal(state, environment),
  });
}

export function renderAttentionTrial(
  prepareToken: string,
  subject: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const state = unseal<AttemptState>(prepareToken, environment);
  validAttempt(state, subject, 'prepare', now);
  const nextState: AttemptState = {
    ...state,
    phase: 'response',
    shownAt: now,
  };
  return deepFreezeAttentionValue({
    stimulus: publicStimulus(nextState),
    responseToken: seal(nextState, environment),
  });
}

export function submitAttentionResponse(
  responseToken: string,
  subject: string,
  answer: unknown,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const state = unseal<AttemptState>(responseToken, environment);
  validAttempt(state, subject, 'response', now);
  const plan = state.plans[state.index];
  const durationMs = now - (state.shownAt as number);
  const minimumMs =
    plan.kind === 'stroop_conflict'
      ? attentionLevel(state.levelId).minimumStroopResponseMs
      : plan.exposureMs;
  if (durationMs < minimumMs || durationMs > MAX_RESPONSE_MS) {
    fail('attention_response_window_invalid');
  }
  const correct = scoreResponse(plan, answer);
  const measurement: AttentionRoundMeasurement = {
    exerciseId: state.exerciseId,
    correct,
    serverObservedResponseMs: durationMs,
    timingModel: 'server_observed_approximation',
    includesTransportAndRenderLatency: true,
  };
  const measurements = [...state.measurements, measurement];

  if (state.index < state.plans.length - 1) {
    const nextState: AttemptState = {
      ...state,
      phase: 'prepare',
      index: state.index + 1,
      shownAt: null,
      measurements,
    };
    return deepFreezeAttentionValue({
      completed: false as const,
      correct,
      serverObservedResponseMs: durationMs,
      nextPosition: nextState.index + 1,
      prepareToken: seal(nextState, environment),
    });
  }

  const receipt: AttentionServerReceipt = deepFreezeAttentionValue({
    receiptType: 'attention_isolated_preview_receipt',
    moduleId: ATTENTION_MODULE_ID,
    moduleVersion: ATTENTION_MODULE_VERSION,
    schemaVersion: ATTENTION_SCHEMA_VERSION,
    classificationAuthority: 'server',
    timingAuthority: 'server_clock',
    answerScoringAuthority: 'server',
    evidenceClass: 'synthetic_attention',
    serverVerified: false,
    productionLedgerEligible: false,
    persisted: false,
    canonicalRecordCreated: false,
    diagnosticUse: false,
    levelId: state.levelId,
    exerciseId: state.exerciseId,
    metrics: calculateAttentionMetrics(measurements),
    measurementNotice: {
      model: 'server_observed_approximation',
      includesTransportAndRenderLatency: true,
      clientCanObservePresentedAnswers: true,
      interpretation: 'practice_feedback_only',
    },
  });
  return deepFreezeAttentionValue({
    completed: true as const,
    correct,
    serverObservedResponseMs: durationMs,
    receipt,
  });
}

export function issueAttentionPreviewIdentity(
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  assertAttentionConfiguration(environment);
  const identity: PreviewIdentity = {
    subject: `attention-preview:${randomBytes(16).toString('hex')}`,
    expiresAt: now + IDENTITY_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString(
    'base64url',
  );
  const signature = createHmac('sha256', secretKey(environment))
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAttentionPreviewIdentity(
  token: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (!attentionPreviewEnabled(environment) || token.length > 1024) return null;
  try {
    const [payload, suppliedSignature, extra] = token.split('.');
    if (!payload || !suppliedSignature || extra) return null;
    const expected = createHmac('sha256', secretKey(environment))
      .update(payload)
      .digest();
    const supplied = Buffer.from(suppliedSignature, 'base64url');
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return null;
    }
    const identity = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as PreviewIdentity;
    if (
      typeof identity.subject !== 'string' ||
      !identity.subject.startsWith('attention-preview:') ||
      !Number.isInteger(identity.expiresAt) ||
      identity.expiresAt <= now
    ) {
      return null;
    }
    return identity.subject;
  } catch {
    return null;
  }
}
