import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import {
  calculateServerObservedReadingMetrics,
  FAST_READING_LEVELS,
  FAST_READING_TRIAL_COUNT,
  levelById,
  recommendNextLevel,
  type FastReadingLevelId,
  type FastReadingMetrics,
} from './fast-reading-core';

const TOKEN_VERSION = 1;
const TOKEN_AAD = Buffer.from('cza-fast-reading-preview-v1', 'utf8');
const ATTEMPT_TTL_MS = 15 * 60_000;
const PREVIEW_IDENTITY_TTL_MS = 60 * 60_000;
const MAX_READING_MS = 120_000;

type PrivateTrial = {
  id: string;
  phrase: string;
  prompt: string;
  options: readonly [string, string, string];
  correctOptionIndex: 0 | 1 | 2;
};

type TrialPlan = {
  id: string;
  optionOrder: [number, number, number];
};

type AttemptState = {
  version: 1;
  kind: 'tachistoscope_attempt';
  subject: string;
  levelId: FastReadingLevelId;
  highestUnlockedLevel: FastReadingLevelId;
  attemptId: string;
  expiresAt: number;
  phase: 'prepare' | 'reading' | 'question';
  index: number;
  shownAt: number | null;
  correctAnswers: number;
  durationsMs: number[];
  trials: TrialPlan[];
};

type ProgressionState = {
  version: 1;
  kind: 'fast_reading_progression';
  subject: string;
  highestUnlockedLevel: FastReadingLevelId;
  expiresAt: number;
};

type PreviewIdentity = {
  subject: string;
  expiresAt: number;
};

export type PublicReadingTrial = {
  trialId: string;
  phrase: string;
  exposureMs: number;
  position: number;
  total: number;
};

export type PublicComprehensionQuestion = {
  trialId: string;
  prompt: string;
  options: [string, string, string];
};

export type FastReadingServerReceipt = {
  receiptType: 'fast_reading_preview_receipt';
  classificationAuthority: 'server';
  timingAuthority: 'server_clock';
  answerScoringAuthority: 'server';
  evidenceClass: 'client_telemetry';
  serverVerified: false;
  productionLedgerEligible: false;
  persisted: false;
  canonicalRecordCreated: false;
  levelId: FastReadingLevelId;
  recommendedLevel: FastReadingLevelId;
  highestUnlockedLevel: FastReadingLevelId;
  correctAnswers: number;
  questionCount: number;
  metrics: FastReadingMetrics;
};

export class FastReadingSessionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'FastReadingSessionError';
  }
}

function fail(code: string, status = 400): never {
  throw new FastReadingSessionError(code, status);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

const PRIVATE_TRIAL_BANK: readonly PrivateTrial[] = deepFreeze([
  {
    id: 'map-forest',
    phrase: 'Meraklı çocuk eski haritayı dikkatle inceledi.',
    prompt: 'Çocuk neyi inceledi?',
    options: ['Eski haritayı', 'Yeni oyuncağı', 'Büyük saati'],
    correctOptionIndex: 0,
  },
  {
    id: 'bird-rain',
    phrase: 'Sarı kuş yağmur başlayınca çatıya kondu.',
    prompt: 'Kuş neden çatıya kondu?',
    options: ['Acıktığı için', 'Yağmur başladığı için', 'Gece olduğu için'],
    correctOptionIndex: 1,
  },
  {
    id: 'book-friend',
    phrase: 'Ece kitabı bitirince arkadaşına verdi.',
    prompt: 'Kitabı en son kim aldı?',
    options: ['Ece', 'Öğretmen', 'Ece’nin arkadaşı'],
    correctOptionIndex: 2,
  },
  {
    id: 'sapling-water',
    phrase: 'Deniz fidan susuz kalmasın diye onu suladı.',
    prompt: 'Deniz fidanı neden suladı?',
    options: [
      'Susuz kalmasın diye',
      'Boyunu ölçmek için',
      'Yerini değiştirmek için',
    ],
    correctOptionIndex: 0,
  },
  {
    id: 'bus-walk',
    phrase: 'Otobüsü kaçıran Mert okula yürüdü.',
    prompt: 'Mert neden okula yürüdü?',
    options: ['Yol kapalıydı', 'Otobüsü kaçırdı', 'Bisikleti bozuldu'],
    correctOptionIndex: 1,
  },
  {
    id: 'library-quiet',
    phrase: 'Kütüphanede çalışan Aslı telefonunu sessize aldı.',
    prompt: 'Aslı telefonunu nerede sessize aldı?',
    options: ['Bahçede', 'Kütüphanede', 'Otobüste'],
    correctOptionIndex: 1,
  },
  {
    id: 'blue-scarf',
    phrase: 'Rüzgâr esince mavi atkı dala takıldı.',
    prompt: 'Dala takılan şey neydi?',
    options: ['Mavi atkı', 'Kırmızı şapka', 'Sarı çanta'],
    correctOptionIndex: 0,
  },
  {
    id: 'cake-neighbor',
    phrase: 'Ayşe yaptığı kekin yarısını komşusuna götürdü.',
    prompt: 'Ayşe kekin ne kadarını götürdü?',
    options: ['Tamamını', 'Çeyreğini', 'Yarısını'],
    correctOptionIndex: 2,
  },
  {
    id: 'lamp-desk',
    phrase: 'Elektrikler kesilince masadaki küçük lamba yandı.',
    prompt: 'Elektrik kesilince ne yandı?',
    options: ['Küçük lamba', 'Televizyon', 'Fırın'],
    correctOptionIndex: 0,
  },
  {
    id: 'seed-spring',
    phrase: 'Bahar gelince bahçedeki tohumlar hızla filizlendi.',
    prompt: 'Tohumlar ne zaman filizlendi?',
    options: ['Kış bitmeden', 'Bahar gelince', 'Gece yarısı'],
    correctOptionIndex: 1,
  },
  {
    id: 'glass-table',
    phrase: 'Bora boş bardağı dikkatlice masaya bıraktı.',
    prompt: 'Bora bardağı nereye bıraktı?',
    options: ['Rafa', 'Çantaya', 'Masaya'],
    correctOptionIndex: 2,
  },
  {
    id: 'cat-cushion',
    phrase: 'Minik kedi öğleden sonra minderin altında uyudu.',
    prompt: 'Kedi nerede uyudu?',
    options: ['Minderin altında', 'Kapının önünde', 'Koltuğun üstünde'],
    correctOptionIndex: 0,
  },
  {
    id: 'snow-gloves',
    phrase: 'Kar yağınca Selim kalın eldivenlerini giydi.',
    prompt: 'Selim eldivenlerini neden giydi?',
    options: ['Yağmur yağdı', 'Kar yağdı', 'Güneş açtı'],
    correctOptionIndex: 1,
  },
  {
    id: 'pencil-drawer',
    phrase: 'Duru kırmızı kalemini çekmecenin içine koydu.',
    prompt: 'Duru kalemini nereye koydu?',
    options: ['Kalemliğe', 'Çekmeceye', 'Dolaba'],
    correctOptionIndex: 1,
  },
  {
    id: 'picnic-cloud',
    phrase: 'Koyu bulutları gören aile pikniği erken bitirdi.',
    prompt: 'Aile pikniği neden erken bitirdi?',
    options: ['Koyu bulutları gördü', 'Yiyecek kalmadı', 'Araba bozuldu'],
    correctOptionIndex: 0,
  },
]);

function secretKey(environment: NodeJS.ProcessEnv) {
  const value = environment.CZA_FAST_READING_SESSION_SECRET?.trim();
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    fail('fast_reading_configuration_unavailable', 503);
  }
  return Buffer.from(value, 'hex');
}

export function assertFastReadingConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
) {
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
    fail('fast_reading_session_invalid', 401);
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) fail('fast_reading_session_invalid', 401);
    const [iv, tag, ciphertext] = parts.map((part) =>
      Buffer.from(part, 'base64url'),
    );
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      fail('fast_reading_session_invalid', 401);
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
    if (error instanceof FastReadingSessionError) throw error;
    fail('fast_reading_session_invalid', 401);
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

function trialById(id: string) {
  const trial = PRIVATE_TRIAL_BANK.find((candidate) => candidate.id === id);
  if (!trial) fail('fast_reading_session_invalid', 401);
  return trial;
}

function publicTrial(state: AttemptState): PublicReadingTrial {
  const trial = trialById(state.trials[state.index].id);
  return {
    trialId: trial.id,
    phrase: trial.phrase,
    exposureMs: levelById(state.levelId).tachistoscopeExposureMs,
    position: state.index + 1,
    total: state.trials.length,
  };
}

function publicQuestion(state: AttemptState): PublicComprehensionQuestion {
  const plan = state.trials[state.index];
  const trial = trialById(plan.id);
  return {
    trialId: trial.id,
    prompt: trial.prompt,
    options: plan.optionOrder.map(
      (optionIndex) => trial.options[optionIndex],
    ) as [string, string, string],
  };
}

function validAttempt(
  state: AttemptState,
  subject: string,
  phase: AttemptState['phase'],
  now: number,
) {
  if (
    state.version !== TOKEN_VERSION ||
    state.kind !== 'tachistoscope_attempt' ||
    state.subject !== subject ||
    state.phase !== phase ||
    !Number.isInteger(state.index) ||
    state.index < 0 ||
    state.index >= FAST_READING_TRIAL_COUNT ||
    state.trials.length !== FAST_READING_TRIAL_COUNT ||
    state.expiresAt <= now ||
    (phase === 'reading'
      ? !Number.isInteger(state.shownAt)
      : state.shownAt !== null)
  ) {
    fail('fast_reading_session_invalid', 401);
  }
}

function highestAllowedLevel(
  subject: string,
  progressionToken: string | null,
  now: number,
  environment: NodeJS.ProcessEnv,
) {
  if (!progressionToken) return 'starter' as const;
  const state = unseal<ProgressionState>(progressionToken, environment);
  if (
    state.version !== TOKEN_VERSION ||
    state.kind !== 'fast_reading_progression' ||
    state.subject !== subject ||
    state.expiresAt <= now ||
    !FAST_READING_LEVELS.some(
      (level) => level.id === state.highestUnlockedLevel,
    )
  ) {
    fail('fast_reading_progression_invalid', 403);
  }
  return state.highestUnlockedLevel;
}

export function authorizeRequestedLevel(
  subject: string,
  levelId: FastReadingLevelId,
  progressionToken: string | null,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const requestedIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === levelId,
  );
  const highestUnlockedLevel = highestAllowedLevel(
    subject,
    progressionToken,
    now,
    environment,
  );
  const highestIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === highestUnlockedLevel,
  );
  if (requestedIndex < 0 || requestedIndex > highestIndex) {
    fail('fast_reading_level_locked', 403);
  }
  return highestUnlockedLevel;
}

export function startTachistoscopeSession(
  subject: string,
  levelId: FastReadingLevelId,
  progressionToken: string | null,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const highestUnlockedLevel = authorizeRequestedLevel(
    subject,
    levelId,
    progressionToken,
    now,
    environment,
  );
  const trials = shuffled(PRIVATE_TRIAL_BANK)
    .slice(0, FAST_READING_TRIAL_COUNT)
    .map((trial) => ({
      id: trial.id,
      optionOrder: shuffled([0, 1, 2]) as [number, number, number],
    }));
  const state: AttemptState = {
    version: TOKEN_VERSION,
    kind: 'tachistoscope_attempt',
    subject,
    levelId,
    highestUnlockedLevel,
    attemptId: randomBytes(16).toString('hex'),
    expiresAt: now + ATTEMPT_TTL_MS,
    phase: 'reading',
    index: 0,
    shownAt: now,
    correctAnswers: 0,
    durationsMs: [],
    trials,
  };
  return deepFreeze({
    trial: publicTrial(state),
    sessionToken: seal(state, environment),
    highestUnlockedLevel,
  });
}

export function finishReadingTrial(
  sessionToken: string,
  subject: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const state = unseal<AttemptState>(sessionToken, environment);
  validAttempt(state, subject, 'reading', now);
  const durationMs = now - (state.shownAt as number);
  const minimumDurationMs = levelById(state.levelId).tachistoscopeExposureMs;
  if (durationMs < minimumDurationMs || durationMs > MAX_READING_MS) {
    fail('fast_reading_duration_invalid');
  }
  const nextState: AttemptState = {
    ...state,
    phase: 'question',
    shownAt: null,
    durationsMs: [...state.durationsMs, durationMs],
  };
  return deepFreeze({
    question: publicQuestion(nextState),
    sessionToken: seal(nextState, environment),
  });
}

export function answerComprehensionQuestion(
  sessionToken: string,
  subject: string,
  selectedOptionIndex: number,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const state = unseal<AttemptState>(sessionToken, environment);
  validAttempt(state, subject, 'question', now);
  if (
    !Number.isInteger(selectedOptionIndex) ||
    selectedOptionIndex < 0 ||
    selectedOptionIndex > 2
  ) {
    fail('fast_reading_answer_invalid');
  }
  const plan = state.trials[state.index];
  const trial = trialById(plan.id);
  const correctOptionIndex = plan.optionOrder.indexOf(trial.correctOptionIndex);
  const wasCorrect = selectedOptionIndex === correctOptionIndex;
  const correctAnswers = state.correctAnswers + (wasCorrect ? 1 : 0);

  if (state.index < state.trials.length - 1) {
    const nextState: AttemptState = {
      ...state,
      phase: 'prepare',
      index: state.index + 1,
      shownAt: null,
      correctAnswers,
    };
    return deepFreeze({
      completed: false as const,
      wasCorrect,
      prepareToken: seal(nextState, environment),
    });
  }

  const totalWords = state.trials.reduce(
    (total, planItem) =>
      total + trialById(planItem.id).phrase.trim().split(/\s+/).length,
    0,
  );
  const totalDurationMs = state.durationsMs.reduce(
    (total, duration) => total + duration,
    0,
  );
  const metrics = calculateServerObservedReadingMetrics(
    totalWords,
    totalDurationMs,
    correctAnswers,
    state.trials.length,
  );
  const recommendedLevel = recommendNextLevel(state.levelId, metrics);
  const currentIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === state.levelId,
  );
  const recommendedIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === recommendedLevel,
  );
  const previousHighestIndex = FAST_READING_LEVELS.findIndex(
    (level) => level.id === state.highestUnlockedLevel,
  );
  const highestUnlockedLevel =
    FAST_READING_LEVELS[
      Math.max(currentIndex, recommendedIndex, previousHighestIndex)
    ].id;
  const progressionState: ProgressionState = {
    version: TOKEN_VERSION,
    kind: 'fast_reading_progression',
    subject,
    highestUnlockedLevel,
    expiresAt: now + PREVIEW_IDENTITY_TTL_MS,
  };
  const receipt: FastReadingServerReceipt = deepFreeze({
    receiptType: 'fast_reading_preview_receipt',
    classificationAuthority: 'server',
    timingAuthority: 'server_clock',
    answerScoringAuthority: 'server',
    evidenceClass: 'client_telemetry',
    serverVerified: false,
    productionLedgerEligible: false,
    persisted: false,
    canonicalRecordCreated: false,
    levelId: state.levelId,
    recommendedLevel,
    highestUnlockedLevel,
    correctAnswers,
    questionCount: state.trials.length,
    metrics,
  });
  return deepFreeze({
    completed: true as const,
    wasCorrect,
    receipt,
    progressionToken: seal(progressionState, environment),
  });
}

export function startPreparedReadingTrial(
  prepareToken: string,
  subject: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const state = unseal<AttemptState>(prepareToken, environment);
  validAttempt(state, subject, 'prepare', now);
  const nextState: AttemptState = {
    ...state,
    phase: 'reading',
    shownAt: now,
  };
  return deepFreeze({
    trial: publicTrial(nextState),
    sessionToken: seal(nextState, environment),
  });
}

export function issuePreviewIdentity(
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (
    environment.NODE_ENV === 'production' ||
    environment.CZA_FAST_READING_ISOLATED_PREVIEW !== 'true'
  ) {
    fail('fast_reading_auth_required', 401);
  }
  const identity: PreviewIdentity = {
    subject: `preview:${randomBytes(16).toString('hex')}`,
    expiresAt: now + PREVIEW_IDENTITY_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString(
    'base64url',
  );
  const signature = createHmac('sha256', secretKey(environment))
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPreviewIdentity(
  token: string,
  now = Date.now(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (
    environment.NODE_ENV === 'production' ||
    environment.CZA_FAST_READING_ISOLATED_PREVIEW !== 'true' ||
    typeof token !== 'string' ||
    token.length > 1024
  ) {
    return null;
  }
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
      !identity.subject.startsWith('preview:') ||
      identity.expiresAt <= now
    ) {
      return null;
    }
    return identity.subject;
  } catch {
    return null;
  }
}

export function levelTarget(levelId: FastReadingLevelId) {
  return levelById(levelId).targetComprehensionPercent;
}
