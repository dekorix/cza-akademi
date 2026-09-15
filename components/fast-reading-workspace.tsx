'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vinext navigation intentionally uses native anchors. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  CircleCheckBig,
  Eye,
  Gauge,
  Grid2X2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import {
  advanceFocusRound,
  canCompleteFocus,
  createSchulteBoard,
  evaluateSchulteAttempt,
  FAST_READING_MODULE_ID,
  FAST_READING_MODULE_VERSION,
  FAST_READING_LEARNING_PATH,
  FAST_READING_LEVELS,
  isFastReadingLevelUnlocked,
  levelById,
  recordSchulteSelection,
  SYNTHETIC_FAST_READING_STUDENT,
  type FastReadingExerciseId,
  type FastReadingLevelId,
  type SchulteSelection,
} from '@/lib/fast-reading-core';

type Screen =
  | 'setup'
  | 'focus'
  | 'schulte'
  | 'tachistoscope'
  | 'comprehension'
  | 'summary';

type TelemetryReceipt = {
  classificationAuthority: 'server';
  evidenceClass: 'client_telemetry';
  serverVerified: false;
  productionLedgerEligible: false;
  persisted: false;
  canonicalRecordCreated: false;
  timingAuthority?: 'server_clock';
  answerScoringAuthority?: 'server';
  levelId?: FastReadingLevelId;
  recommendedLevel?: FastReadingLevelId;
  highestUnlockedLevel?: FastReadingLevelId;
  correctAnswers?: number;
  questionCount?: number;
  metrics?: {
    serverObservedApproxWordsPerMinute: number;
    timingModel: 'server_observed_approximation';
    includesTransportAndRenderLatency: true;
    comprehensionPercent: number;
    durationMs: number;
  };
};

type ReadingTrial = {
  trialId: string;
  phrase: string;
  exposureMs: number;
  position: number;
  total: number;
};

type ComprehensionQuestion = {
  trialId: string;
  prompt: string;
  options: [string, string, string];
};

const EXERCISES: readonly {
  id: FastReadingExerciseId;
  title: string;
  description: string;
  icon: typeof Eye;
  accent: string;
}[] = [
  {
    id: 'focus_expansion',
    title: 'Odak ve Genişletme',
    description: 'Merkeze bakarken çevredeki ışık noktalarını fark et.',
    icon: Target,
    accent: '#7457d9',
  },
  {
    id: 'schulte_scan',
    title: 'Schulte Tarama',
    description: 'Sayıları sırayla bul; bakışını planlı ve sakin gezdir.',
    icon: Grid2X2,
    accent: '#167c6b',
  },
  {
    id: 'tachistoscope',
    title: 'Kelime Yakalama',
    description: 'Kısa süre görünen kelime kümelerini tek bakışta yakala.',
    icon: Zap,
    accent: '#b96a21',
  },
];

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[.08em] text-[#607080]">
        {label}
      </p>
      <strong className="mt-2 block text-2xl font-black text-[#21384d]">
        {value}
      </strong>
      <span className="mt-1 block text-xs leading-5 text-[#667887]">
        {note}
      </span>
    </div>
  );
}

function safeReceipt(value: unknown): value is TelemetryReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<TelemetryReceipt>;
  return (
    receipt.classificationAuthority === 'server' &&
    receipt.evidenceClass === 'client_telemetry' &&
    receipt.serverVerified === false &&
    receipt.productionLedgerEligible === false &&
    receipt.persisted === false &&
    receipt.canonicalRecordCreated === false
  );
}

function safeTrial(value: unknown): value is ReadingTrial {
  if (!value || typeof value !== 'object') return false;
  const trialValue = value as Partial<ReadingTrial>;
  return (
    typeof trialValue.trialId === 'string' &&
    typeof trialValue.phrase === 'string' &&
    Number.isInteger(trialValue.exposureMs) &&
    Number(trialValue.exposureMs) >= 400 &&
    Number(trialValue.exposureMs) <= 5_000 &&
    Number.isInteger(trialValue.position) &&
    Number.isInteger(trialValue.total)
  );
}

function safeQuestion(value: unknown): value is ComprehensionQuestion {
  if (!value || typeof value !== 'object') return false;
  const questionValue = value as Partial<ComprehensionQuestion>;
  return (
    typeof questionValue.trialId === 'string' &&
    typeof questionValue.prompt === 'string' &&
    Array.isArray(questionValue.options) &&
    questionValue.options.length === 3 &&
    questionValue.options.every((option) => typeof option === 'string')
  );
}

export function FastReadingWorkspace() {
  const [levelId, setLevelId] = useState<FastReadingLevelId>('starter');
  const [exerciseId, setExerciseId] =
    useState<FastReadingExerciseId>('focus_expansion');
  const [screen, setScreen] = useState<Screen>('setup');
  const [focusRound, setFocusRound] = useState(1);
  const [expectedNumber, setExpectedNumber] = useState(1);
  const [schulteSelections, setSchulteSelections] = useState<
    SchulteSelection[]
  >([]);
  const [schulteSeed, setSchulteSeed] = useState(1);
  const [trial, setTrial] = useState<ReadingTrial | null>(null);
  const [question, setQuestion] = useState<ComprehensionQuestion | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [progressionToken, setProgressionToken] = useState('');
  const [prepareToken, setPrepareToken] = useState('');
  const [completedReceipt, setCompletedReceipt] =
    useState<TelemetryReceipt | null>(null);
  const [completedProgressionToken, setCompletedProgressionToken] =
    useState('');
  const [answerResult, setAnswerResult] = useState<
    'correct' | 'incorrect' | null
  >(null);
  const [phraseVisible, setPhraseVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [highestUnlockedLevel, setHighestUnlockedLevel] =
    useState<FastReadingLevelId>('starter');
  const [recommendedLevel, setRecommendedLevel] =
    useState<FastReadingLevelId>('starter');
  const [receipt, setReceipt] = useState<TelemetryReceipt | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<
    'idle' | 'sending' | 'error'
  >('idle');
  const [flowStatus, setFlowStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  );
  const lastSelectionAt = useRef(0);
  const level = levelById(levelId);
  const board = useMemo(
    () => createSchulteBoard(level.schulteSize, schulteSeed),
    [level.schulteSize, schulteSeed],
  );
  const attempt = useMemo(
    () => evaluateSchulteAttempt(board, schulteSelections),
    [board, schulteSelections],
  );
  const readingMetrics =
    exerciseId === 'tachistoscope' ? receipt?.metrics || null : null;

  useEffect(() => {
    if (screen !== 'focus') return;
    const interval = window.setInterval(
      () => setFocusRound(advanceFocusRound),
      level.focusStepMs,
    );
    return () => window.clearInterval(interval);
  }, [level.focusStepMs, screen]);

  useEffect(() => {
    if (screen !== 'tachistoscope' || !trial) return;
    const hidePhrase = window.setTimeout(
      () => setPhraseVisible(false),
      trial.exposureMs,
    );
    return () => window.clearTimeout(hidePhrase);
  }, [screen, trial]);

  async function postFastReading(body: Record<string, unknown>) {
    const response = await fetch('/api/fast-reading/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok || result.ok !== true) {
      throw new Error(
        typeof result.error === 'string'
          ? result.error
          : 'fast_reading_request_failed',
      );
    }
    return result;
  }

  async function beginExercise() {
    if (flowStatus === 'loading') return;
    setFlowStatus('loading');
    setExpectedNumber(1);
    setSchulteSelections([]);
    const randomSeed =
      globalThis.crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
    setSchulteSeed((previousSeed) =>
      randomSeed === previousSeed ? (randomSeed + 1) & 0x7fffffff : randomSeed,
    );
    setTrial(null);
    setQuestion(null);
    setSessionToken('');
    setPrepareToken('');
    setCompletedReceipt(null);
    setCompletedProgressionToken('');
    setAnswerResult(null);
    setPhraseVisible(false);
    setSelectedOption(null);
    setRecommendedLevel(levelId);
    setReceipt(null);
    setReceiptStatus('idle');
    setFocusRound(1);
    try {
      const result = await postFastReading({
        action: 'start',
        exerciseId,
        levelId,
        progressionToken: progressionToken || null,
      });
      if (exerciseId === 'tachistoscope') {
        if (
          !safeTrial(result.trial) ||
          typeof result.sessionToken !== 'string'
        ) {
          throw new Error('fast_reading_start_invalid');
        }
        setTrial(result.trial);
        setSessionToken(result.sessionToken);
        setPhraseVisible(true);
      }
      lastSelectionAt.current = window.performance.now();
      setScreen(
        exerciseId === 'focus_expansion'
          ? 'focus'
          : exerciseId === 'schulte_scan'
            ? 'schulte'
            : 'tachistoscope',
      );
      setFlowStatus('idle');
    } catch {
      setFlowStatus('error');
    }
  }

  function selectSchulteNumber(value: number, eventTimeStamp: number) {
    const selection = recordSchulteSelection(
      expectedNumber,
      value,
      Math.max(0, eventTimeStamp - lastSelectionAt.current),
      board.length,
    );
    setSchulteSelections((current) => [...current, selection]);
    lastSelectionAt.current = eventTimeStamp;
    if (!selection.correct) return;
    if (value === board.length) setScreen('summary');
    else setExpectedNumber(value + 1);
  }

  async function finishVisibleReading() {
    if (phraseVisible || !sessionToken || flowStatus === 'loading') return;
    setFlowStatus('loading');
    try {
      const result = await postFastReading({
        action: 'read',
        sessionToken,
      });
      if (
        !safeQuestion(result.question) ||
        typeof result.sessionToken !== 'string' ||
        result.question.trialId !== trial?.trialId
      ) {
        throw new Error('fast_reading_question_invalid');
      }
      setQuestion(result.question);
      setSessionToken(result.sessionToken);
      setScreen('comprehension');
      setFlowStatus('idle');
    } catch {
      setFlowStatus('error');
    }
  }

  async function answerTachistoscope(optionIndex: number) {
    if (
      selectedOption !== null ||
      !question ||
      !sessionToken ||
      flowStatus === 'loading'
    ) {
      return;
    }
    setSelectedOption(optionIndex);
    setFlowStatus('loading');
    try {
      const result = await postFastReading({
        action: 'answer',
        sessionToken,
        selectedOptionIndex: optionIndex,
      });
      if (typeof result.wasCorrect !== 'boolean') {
        throw new Error('fast_reading_answer_invalid');
      }
      setAnswerResult(result.wasCorrect ? 'correct' : 'incorrect');
      if (result.completed === true) {
        if (
          !safeReceipt(result.receipt) ||
          typeof result.progressionToken !== 'string'
        ) {
          throw new Error('fast_reading_receipt_invalid');
        }
        setCompletedReceipt(result.receipt);
        setCompletedProgressionToken(result.progressionToken);
        setPrepareToken('');
      } else {
        if (typeof result.prepareToken !== 'string') {
          throw new Error('fast_reading_next_trial_invalid');
        }
        setPrepareToken(result.prepareToken);
        setSessionToken('');
      }
      setFlowStatus('idle');
    } catch {
      setSelectedOption(null);
      setAnswerResult(null);
      setFlowStatus('error');
    }
  }

  async function continueTachistoscope() {
    if (!answerResult || flowStatus === 'loading') return;
    if (prepareToken) {
      setFlowStatus('loading');
      try {
        const result = await postFastReading({
          action: 'phrase-start',
          prepareToken,
        });
        if (
          !safeTrial(result.trial) ||
          typeof result.sessionToken !== 'string'
        ) {
          throw new Error('fast_reading_phrase_start_invalid');
        }
        setTrial(result.trial);
        setSessionToken(result.sessionToken);
        setPrepareToken('');
        setQuestion(null);
        setSelectedOption(null);
        setAnswerResult(null);
        setPhraseVisible(true);
        setScreen('tachistoscope');
        setFlowStatus('idle');
      } catch {
        setFlowStatus('error');
      }
      return;
    }
    if (
      completedReceipt?.recommendedLevel &&
      completedReceipt.highestUnlockedLevel &&
      completedReceipt.metrics &&
      completedProgressionToken
    ) {
      setReceipt(completedReceipt);
      setRecommendedLevel(completedReceipt.recommendedLevel);
      setHighestUnlockedLevel(completedReceipt.highestUnlockedLevel);
      setProgressionToken(completedProgressionToken);
      setScreen('summary');
    }
  }

  async function requestServerClassification() {
    setReceiptStatus('sending');
    setReceipt(null);
    const correctResponses =
      exerciseId === 'schulte_scan' ? attempt.correctSelections : 0;
    const incorrectResponses =
      exerciseId === 'schulte_scan' ? attempt.incorrectSelections : 0;
    try {
      const result = await postFastReading({
        action: 'classify',
        moduleId: FAST_READING_MODULE_ID,
        moduleVersion: FAST_READING_MODULE_VERSION,
        exerciseId,
        levelId,
        progressionToken: progressionToken || null,
        metrics: {
          durationMs:
            exerciseId === 'focus_expansion'
              ? level.focusStepMs * 3
              : schulteSelections.reduce(
                  (total, selection) => total + selection.elapsedMs,
                  0,
                ),
          correctResponses,
          incorrectResponses,
          totalResponses: correctResponses + incorrectResponses,
          comprehensionPercent: null,
        },
      });
      if (!safeReceipt(result.receipt)) {
        throw new Error('telemetry_receipt_invalid');
      }
      setReceipt(result.receipt);
      setReceiptStatus('idle');
    } catch {
      setReceiptStatus('error');
    }
  }

  function resetToSetup() {
    setScreen('setup');
    setExpectedNumber(1);
    setSchulteSelections([]);
    setTrial(null);
    setQuestion(null);
    setSessionToken('');
    setPrepareToken('');
    setCompletedReceipt(null);
    setCompletedProgressionToken('');
    setAnswerResult(null);
    setPhraseVisible(false);
    setSelectedOption(null);
    setReceipt(null);
    setReceiptStatus('idle');
    setFlowStatus('idle');
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#e4fff3_0,transparent_32%),radial-gradient(circle_at_top_right,#eee7ff_0,transparent_30%),#f8f7f2] text-[#20364a]">
      <header className="border-b border-[#dbe5df] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#183d35] font-black text-white shadow-lg shadow-[#183d35]/15">
              CZA
            </span>
            <div>
              <p className="text-base font-black">Hızlı Okuma Laboratuvarı</p>
              <p className="text-xs text-[#6f7f89]">
                Faz 2 · İzole öğrenci önizlemesi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-[#e8f6ef] px-4 py-2 text-xs font-bold text-[#276958] sm:inline-flex">
              <ShieldCheck size={16} /> Sentetik veri
            </span>
            <a
              href="/work"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#cad9d2] bg-white px-4 text-sm font-bold transition hover:bg-[#f2f7f4]"
            >
              <ArrowLeft size={17} /> Çalışma paneli
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <section className="rounded-3xl bg-[#183d35] p-5 text-white shadow-xl shadow-[#183d35]/15">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#d8f4a8] text-xl font-black text-[#214438]">
                D
              </span>
              <div>
                <p className="font-black">
                  {SYNTHETIC_FAST_READING_STUDENT.displayName}
                </p>
                <p className="text-xs text-[#b9d9ce]">8–10 yaş · Mock profil</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/10 p-3">
                <span className="text-xs text-[#b9d9ce]">Başlangıç hızı</span>
                <strong className="mt-1 block text-xl">92 K/D</strong>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <span className="text-xs text-[#b9d9ce]">Anlama</span>
                <strong className="mt-1 block text-xl">%78</strong>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dde5e0] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[.12em] text-[#6b7c86]">
              Öğrenme yolu
            </p>
            <ol className="mt-4 space-y-4">
              {FAST_READING_LEARNING_PATH.map((step, index) => (
                <li key={step.id} className="flex gap-3">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${index === 0 ? 'bg-[#d8f4a8] text-[#214438]' : 'bg-[#edf1ef] text-[#75827d]'}`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#74838d]">
                      {step.goal}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <section className="min-w-0">
          {screen === 'setup' ? (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#173f36,#276b5d_55%,#5c4ca7)] p-7 text-white shadow-2xl shadow-[#314d46]/15 md:p-9">
                <div className="max-w-3xl">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-bold text-[#dbf5eb] ring-1 ring-white/15">
                    <Sparkles size={15} /> Gözleri zorlamadan, anlamayı
                    koruyarak
                  </span>
                  <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-.04em] md:text-5xl">
                    Bakışını genişlet.
                    <br />
                    Anlamı tek seferde yakala.
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-[#d4e8e2]">
                    Önce odağı hazırla, sonra görsel alanı genişlet. Hız ancak
                    anlama doğruluğu korunursa yükselir.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.11em] text-[#607080]">
                      1 · Ritmini seç
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Bugünkü çalışma seviyesi
                    </h2>
                  </div>
                  <span className="text-xs text-[#77858e]">
                    Anlama eşiği en az %{level.targetComprehensionPercent}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {FAST_READING_LEVELS.map((candidate) =>
                    (() => {
                      const unlocked = isFastReadingLevelUnlocked(
                        candidate.id,
                        highestUnlockedLevel,
                      );
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={!unlocked}
                          aria-pressed={levelId === candidate.id}
                          aria-label={`${candidate.label}${unlocked ? '' : ' — kilitli'}`}
                          onClick={() => {
                            if (unlocked) setLevelId(candidate.id);
                          }}
                          className={`rounded-2xl border-2 p-5 text-left transition ${!unlocked ? 'cursor-not-allowed border-[#e5e7e6] bg-[#f4f5f4] opacity-60' : levelId === candidate.id ? 'border-[#277a67] bg-[#e8f6ef] shadow-md' : 'border-[#e1e7e3] bg-white hover:border-[#9dcbbb]'}`}
                        >
                          <span className="flex items-center justify-between gap-2 text-base font-black">
                            <span>
                              {levelId === candidate.id ? '✓ ' : ''}
                              {candidate.label}
                            </span>
                            {!unlocked ? (
                              <span className="rounded-full bg-[#e1e4e2] px-2 py-1 text-[10px] uppercase tracking-wide">
                                Kilitli
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-2 block text-xs leading-5 text-[#6f7f89]">
                            {candidate.description}
                          </span>
                        </button>
                      );
                    })(),
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[.11em] text-[#607080]">
                  2 · Egzersizini seç
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {EXERCISES.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      data-exercise-id={exercise.id}
                      aria-pressed={exerciseId === exercise.id}
                      onClick={() => setExerciseId(exercise.id)}
                      className={`group rounded-3xl border-2 bg-white p-5 text-left transition hover:-translate-y-1 hover:shadow-lg ${exerciseId === exercise.id ? 'border-[#6755b3] shadow-md' : 'border-[#e1e7e3]'}`}
                    >
                      <span
                        className="grid size-12 place-items-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: exercise.accent }}
                      >
                        <exercise.icon size={24} />
                      </span>
                      <span className="mt-5 block text-base font-black">
                        {exercise.title}
                      </span>
                      <span className="mt-2 block min-h-14 text-xs leading-5 text-[#6d7d87]">
                        {exercise.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={flowStatus === 'loading'}
                onClick={beginExercise}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#193f36] px-6 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#245f51] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#6c57c0] disabled:cursor-wait disabled:bg-[#788b84]"
              >
                <Play size={20} fill="currentColor" />{' '}
                {flowStatus === 'loading'
                  ? 'Güvenli oturum hazırlanıyor…'
                  : 'Egzersizi başlat'}
              </button>
              {flowStatus === 'error' ? (
                <p
                  className="text-center text-sm font-bold text-[#a0443d]"
                  role="alert"
                >
                  Güvenli egzersiz oturumu açılamadı. Oturumunu kontrol edip
                  yeniden dene.
                </p>
              ) : null}
            </div>
          ) : null}

          {screen === 'focus' ? (
            <div className="rounded-[2rem] border border-[#dfe6e1] bg-white p-6 shadow-xl md:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.12em] text-[#735cc4]">
                    Odak ve genişletme
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Merkeze bak, çevreyi fark et
                  </h2>
                </div>
                <span className="rounded-full bg-[#f0ecff] px-4 py-2 text-xs font-bold text-[#6753ad]">
                  Tur {focusRound}/4
                </span>
              </div>
              <div className="relative mx-auto my-10 grid aspect-square w-full max-w-[520px] place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle,#ffffff_0_5%,#e9fff5_6%_18%,#dcd4ff_19%_36%,#d8f2e8_37%_55%,#f7e9c5_56%_74%,#e8f2ed_75%)] shadow-inner">
                {[0, 1, 2].map((ring) => (
                  <span
                    key={ring}
                    className="absolute rounded-full border border-[#566f87]/20"
                    style={{
                      width: `${38 + ring * 25}%`,
                      height: `${38 + ring * 25}%`,
                    }}
                  />
                ))}
                <div className="absolute size-[72%] animate-[spin_9s_linear_infinite] rounded-full motion-reduce:animate-none">
                  <span className="absolute left-1/2 top-0 size-5 -translate-x-1/2 rounded-full bg-[#7457d9] shadow-[0_0_22px_#7457d9]" />
                  <span className="absolute bottom-[10%] left-[8%] size-4 rounded-full bg-[#e99535] shadow-[0_0_18px_#e99535]" />
                  <span className="absolute right-[3%] top-[46%] size-4 rounded-full bg-[#1f9b81] shadow-[0_0_18px_#1f9b81]" />
                </div>
                <span className="z-10 grid size-20 place-items-center rounded-full bg-[#173f36] text-white shadow-[0_0_0_12px_#ffffffaa,0_12px_35px_#183d3555]">
                  <Eye size={34} />
                </span>
              </div>
              <p className="mx-auto max-w-2xl text-center text-sm leading-7 text-[#637680]">
                Başını sabit tut. Ortadaki göz simgesine bakarken dönen renkleri
                isimlendirmeden fark etmeye çalış.
              </p>
              <button
                type="button"
                disabled={!canCompleteFocus(focusRound)}
                onClick={() => setScreen('summary')}
                className="mx-auto mt-7 flex min-h-12 items-center gap-2 rounded-xl bg-[#173f36] px-6 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#a8b4af]"
              >
                <CircleCheckBig size={18} />{' '}
                {!canCompleteFocus(focusRound)
                  ? 'Odak turu sürüyor…'
                  : 'Turu tamamla'}
              </button>
            </div>
          ) : null}

          {screen === 'schulte' ? (
            <div className="rounded-[2rem] border border-[#dfe6e1] bg-white p-6 shadow-xl md:p-9">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.12em] text-[#167c6b]">
                    Schulte tarama
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Sıradaki sayı: {expectedNumber}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f6ef] px-4 py-2 text-xs font-bold text-[#246b5a]">
                  <Timer size={15} /> Kendi ritminde
                </span>
              </div>
              <div
                className={`mx-auto my-8 grid max-w-[570px] gap-2 rounded-3xl bg-[#173f36] p-3 shadow-xl ${level.schulteSize === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}
              >
                {board.map((value) => {
                  const completed = value < expectedNumber;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={completed}
                      aria-label={`${value} sayısı`}
                      onClick={(event) =>
                        selectSchulteNumber(value, event.timeStamp)
                      }
                      className={`aspect-square rounded-2xl text-xl font-black transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#f4cf61] md:text-2xl ${completed ? 'bg-[#d8f4a8] text-[#315345]' : 'bg-white text-[#21384d] hover:scale-[1.03] hover:bg-[#f5e9bd]'}`}
                    >
                      {completed ? (
                        <CircleCheckBig className="mx-auto" size={24} />
                      ) : (
                        value
                      )}
                    </button>
                  );
                })}
              </div>
              <div
                className="grid gap-2 rounded-2xl bg-[#f2f6f3] px-5 py-4 text-sm sm:grid-cols-3"
                aria-live="polite"
              >
                <span>{attempt.correctSelections} doğru seçim</span>
                <span>{attempt.incorrectSelections} yanlış seçim</span>
                <strong className="sm:text-right">
                  {attempt.totalSelections} deneme · %{attempt.accuracyPercent}
                </strong>
              </div>
            </div>
          ) : null}

          {screen === 'tachistoscope' ? (
            <div className="rounded-[2rem] border border-[#eadfce] bg-white p-6 shadow-xl md:p-9">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.12em] text-[#b46b28]">
                    Kelime yakalama
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Tek bakışta kelime grubu
                  </h2>
                </div>
                <span className="rounded-full bg-[#fff3de] px-4 py-2 text-xs font-bold text-[#9a5c22]">
                  {trial ? `${trial.position}/${trial.total}` : 'Hazırlanıyor'}
                </span>
              </div>
              <div className="my-10 grid min-h-[360px] place-items-center overflow-hidden rounded-[2rem] bg-[radial-gradient(circle,#fff8dc,#f0d9a9_60%,#d6b778)] p-6 text-center shadow-inner">
                <div
                  className="transition duration-150 motion-reduce:transition-none"
                  aria-live="polite"
                >
                  <span className="text-xs font-black uppercase tracking-[.18em] text-[#9b6f38]">
                    {phraseVisible
                      ? 'Tek bakışta oku'
                      : 'Gösterim süresi tamamlandı'}
                  </span>
                  <p
                    className="mt-4 text-4xl font-black tracking-[-.04em] text-[#3f3427] md:text-6xl"
                    data-testid="tachistoscope-phrase"
                    data-exposure-ms={trial?.exposureMs}
                  >
                    {phraseVisible
                      ? trial?.phrase || 'Güvenli içerik hazırlanıyor…'
                      : 'Metin kapandı'}
                  </p>
                </div>
              </div>
              <p className="text-center text-sm leading-6 text-[#77654d]">
                Metin, seviye için belirlenen süre dolunca otomatik kapanır.
                Yaklaşık hız; sunucunun metni üretmesi ile “Soruyu göster”
                isteği arasındaki farktan hesaplanır ve ağ/render gecikmesini
                içerir.
              </p>
              <button
                type="button"
                disabled={phraseVisible || flowStatus === 'loading'}
                onClick={finishVisibleReading}
                className="mx-auto mt-5 flex min-h-12 items-center gap-2 rounded-xl bg-[#8f5520] px-6 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#baa78f]"
              >
                <BookOpenCheck size={18} />{' '}
                {flowStatus === 'loading'
                  ? 'Soru hazırlanıyor…'
                  : phraseVisible
                    ? 'Metin gösteriliyor…'
                    : 'Soruyu göster'}
              </button>
            </div>
          ) : null}

          {screen === 'comprehension' && question && trial ? (
            <div className="rounded-[2rem] border border-[#ded8ef] bg-white p-7 shadow-xl md:p-10">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[#6753ad]">
                Sunucu anlama doğrulaması · {trial.position}/{trial.total}
              </p>
              <h2 className="mt-3 text-2xl font-black">{question.prompt}</h2>
              <fieldset className="mt-7 grid gap-3">
                <legend className="sr-only">Yanıtlar</legend>
                {question.options.map((option, optionIndex) => {
                  const answered = selectedOption !== null;
                  const selected = optionIndex === selectedOption;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={answered}
                      aria-pressed={selected}
                      onClick={() => answerTachistoscope(optionIndex)}
                      className={`min-h-14 rounded-2xl border-2 px-5 text-left font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#6c57c0] ${answered && selected && answerResult === 'correct' ? 'border-[#278069] bg-[#e8f6ef] text-[#245f51]' : answered && selected && answerResult === 'incorrect' ? 'border-[#c46056] bg-[#fff0ed] text-[#8b3e37]' : 'border-[#ded8ef] bg-white hover:border-[#8b78d3]'}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </fieldset>
              <p className="mt-5 min-h-6 text-sm font-bold" aria-live="polite">
                {selectedOption === null
                  ? 'Bir yanıt seçmeden ilerleyemezsin.'
                  : flowStatus === 'loading'
                    ? 'Yanıt sunucuda değerlendiriliyor…'
                    : answerResult === 'correct'
                      ? 'Doğru — anlamı yakaladın.'
                      : answerResult === 'incorrect'
                        ? 'Bu yanıtta anlam ayrıntısı kaçtı; doğru cevap istemciye açıklanmadı.'
                        : 'Yanıt doğrulanamadı; yeniden seçebilirsin.'}
              </p>
              <button
                type="button"
                disabled={!answerResult || flowStatus === 'loading'}
                onClick={continueTachistoscope}
                className="mt-5 min-h-12 rounded-xl bg-[#173f36] px-6 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#a8b4af]"
              >
                {completedReceipt
                  ? 'Sonucu gör'
                  : flowStatus === 'loading'
                    ? 'Sonraki grup hazırlanıyor…'
                    : 'Sonraki kelime grubu'}
              </button>
            </div>
          ) : null}

          {screen === 'summary' ? (
            <div className="rounded-[2rem] border border-[#dce6e0] bg-white p-7 shadow-xl md:p-10">
              <span className="grid size-16 place-items-center rounded-2xl bg-[#d8f4a8] text-[#214438]">
                <CircleCheckBig size={34} />
              </span>
              <p className="mt-6 text-xs font-black uppercase tracking-[.12em] text-[#28705f]">
                Tur tamamlandı
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.035em]">
                Harika odaklandın, Deniz!
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667883]">
                Bu önizlemedeki sonuçlar yalnız tarayıcı telemetrisidir;
                doğrulanmış pedagojik kanıt veya canlı öğrenci kaydı değildir.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Çalışma"
                  value={
                    EXERCISES.find((item) => item.id === exerciseId)?.title ||
                    'Egzersiz'
                  }
                  note="Seçilen mock görev"
                />
                <MetricCard
                  label="Seviye"
                  value={level.label}
                  note={`Anlama hedefi ≥ %${level.targetComprehensionPercent}`}
                />
                <MetricCard
                  label={exerciseId === 'schulte_scan' ? 'Hatalar' : 'Anlama'}
                  value={
                    exerciseId === 'schulte_scan'
                      ? String(attempt.incorrectSelections)
                      : exerciseId === 'tachistoscope' && readingMetrics
                        ? `%${readingMetrics.comprehensionPercent}`
                        : 'Ölçülmedi'
                  }
                  note={
                    exerciseId === 'schulte_scan'
                      ? `${attempt.totalSelections} toplam deneme`
                      : 'Yalnız istemci telemetrisi'
                  }
                />
                {exerciseId === 'tachistoscope' && readingMetrics ? (
                  <MetricCard
                    label="Sunucu gözlemli yaklaşık hız"
                    value={`${readingMetrics.serverObservedApproxWordsPerMinute} K/D`}
                    note={`${readingMetrics.durationMs} ms · ağ ve render gecikmesi dahil`}
                  />
                ) : null}
              </div>
              {exerciseId === 'tachistoscope' && readingMetrics ? (
                <div className="mt-5 rounded-2xl bg-[#f3f0ff] p-5 text-sm leading-6 text-[#4e4380]">
                  <strong className="block text-base">
                    Önerilen seviye: {levelById(recommendedLevel).label}
                  </strong>
                  {recommendedLevel === levelId
                    ? `Anlama eşiği (%${level.targetComprehensionPercent}) henüz karşılanmadı; üst seviye kilitli kaldı.`
                    : `Anlama eşiği karşılandı; ${levelById(recommendedLevel).label} seviyesi açıldı.`}
                </div>
              ) : null}
              <div className="mt-5 rounded-2xl border border-[#d8e2dd] bg-[#f7faf8] p-5">
                <p className="text-sm leading-6 text-[#5d7068]">
                  Sunucu yalnız veri sınıfını belirler. Bu sonuç hiçbir koşulda
                  doğrulanmış kanıta veya canonical ledger kaydına dönüşmez.
                </p>
                <button
                  type="button"
                  disabled={
                    receiptStatus === 'sending' ||
                    exerciseId === 'tachistoscope'
                  }
                  onClick={requestServerClassification}
                  className="mt-3 min-h-11 rounded-xl border border-[#b9ccc3] bg-white px-4 text-sm font-bold disabled:opacity-60"
                >
                  {exerciseId === 'tachistoscope'
                    ? 'Sunucu tarafından otomatik sınıflandırıldı'
                    : receiptStatus === 'sending'
                      ? 'Sınıflandırılıyor…'
                      : 'Sunucuda telemetri olarak sınıflandır'}
                </button>
                <p className="mt-3 text-xs font-bold" aria-live="polite">
                  {receipt
                    ? 'Sunucu makbuzu: client_telemetry · persisted=false · serverVerified=false'
                    : receiptStatus === 'error'
                      ? 'Sınıflandırma başarısız; hiçbir kayıt oluşturulmadı.'
                      : 'Henüz sunucuya gönderilmedi.'}
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={flowStatus === 'loading'}
                  onClick={beginExercise}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#173f36] px-5 font-bold text-white disabled:cursor-wait disabled:bg-[#788b84]"
                >
                  <RotateCcw size={18} /> Aynı turu tekrarla
                </button>
                <button
                  type="button"
                  onClick={resetToSetup}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#cbd9d2] bg-white px-5 font-bold"
                >
                  <Gauge size={18} /> Başka çalışma seç
                </button>
              </div>
            </div>
          ) : null}

          {screen !== 'setup' && flowStatus === 'error' ? (
            <p
              className="mt-5 rounded-2xl border border-[#e6b7b2] bg-[#fff0ed] p-4 text-center text-sm font-bold text-[#8b3e37]"
              role="alert"
            >
              Güvenli egzersiz adımı tamamlanamadı. Bu tur kaydedilmedi; çalışma
              seçimine dönüp yeniden dene.
            </p>
          ) : null}

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce5e0] bg-white/70 px-5 py-4 text-xs text-[#697b85]">
            <span className="inline-flex items-center gap-2">
              <BookOpenCheck size={16} /> Önce doğruluk ve anlama, sonra hız.
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} /> Production ledger bağlantısı yok.
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
