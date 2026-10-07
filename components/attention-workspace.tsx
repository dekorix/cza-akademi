'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vinext navigation intentionally uses native anchors. */
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  CircleAlert,
  Grid3X3,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  ATTENTION_LEARNING_PATH,
  SYNTHETIC_ATTENTION_STUDENT,
  type AttentionExerciseId,
  type AttentionLevelId,
  type AttentionMetrics,
} from '@/lib/attention-core';

type ColorId = 'red' | 'green' | 'blue' | 'amber';
type Screen = 'setup' | 'ready' | 'stimulus' | 'feedback' | 'summary';

type Stimulus =
  | {
      kind: 'stroop_conflict';
      word: ColorId;
      ink: ColorId;
      options: ColorId[];
      position: number;
      total: number;
    }
  | {
      kind: 'visual_memory_matrix';
      size: 3 | 4;
      activeCells: number[];
      exposureMs: number;
      position: number;
      total: number;
    };

type Receipt = {
  receiptType: 'attention_isolated_preview_receipt';
  classificationAuthority: 'server';
  timingAuthority: 'server_clock';
  answerScoringAuthority: 'server';
  evidenceClass: 'synthetic_attention';
  serverVerified: false;
  productionLedgerEligible: false;
  persisted: false;
  canonicalRecordCreated: false;
  diagnosticUse: false;
  metrics: AttentionMetrics;
};

const COLOR_LABELS: Record<ColorId, string> = {
  red: 'KIRMIZI',
  green: 'YEŞİL',
  blue: 'MAVİ',
  amber: 'SARI',
};

const INK_CLASSES: Record<ColorId, string> = {
  red: 'text-red-600',
  green: 'text-emerald-600',
  blue: 'text-blue-600',
  amber: 'text-amber-500',
};

function safeStimulus(value: unknown): value is Stimulus {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Stimulus>;
  if (
    !Number.isInteger(candidate.position) ||
    !Number.isInteger(candidate.total)
  ) {
    return false;
  }
  if (candidate.kind === 'stroop_conflict') {
    return (
      typeof candidate.word === 'string' &&
      typeof candidate.ink === 'string' &&
      Array.isArray(candidate.options) &&
      candidate.options.length === 4 &&
      candidate.options.every((option) => option in COLOR_LABELS)
    );
  }
  return (
    candidate.kind === 'visual_memory_matrix' &&
    (candidate.size === 3 || candidate.size === 4) &&
    Array.isArray(candidate.activeCells) &&
    Number.isInteger(candidate.exposureMs) &&
    Number(candidate.exposureMs) >= 500 &&
    Number(candidate.exposureMs) <= 2_000
  );
}

function safeReceipt(value: unknown): value is Receipt {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Receipt>;
  return (
    candidate.receiptType === 'attention_isolated_preview_receipt' &&
    candidate.classificationAuthority === 'server' &&
    candidate.timingAuthority === 'server_clock' &&
    candidate.answerScoringAuthority === 'server' &&
    candidate.evidenceClass === 'synthetic_attention' &&
    candidate.serverVerified === false &&
    candidate.productionLedgerEligible === false &&
    candidate.persisted === false &&
    candidate.canonicalRecordCreated === false &&
    candidate.diagnosticUse === false &&
    Boolean(candidate.metrics)
  );
}

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.08em] text-slate-500">
        {label}
      </p>
      <strong className="mt-2 block text-2xl font-black text-slate-900">
        {value}
      </strong>
      <span className="mt-1 block text-xs leading-5 text-slate-500">
        {note}
      </span>
    </div>
  );
}

export function AttentionWorkspace() {
  const [exerciseId, setExerciseId] =
    useState<AttentionExerciseId>('stroop_conflict');
  const [screen, setScreen] = useState<Screen>('setup');
  const [prepareToken, setPrepareToken] = useState('');
  const [responseToken, setResponseToken] = useState('');
  const [stimulus, setStimulus] = useState<Stimulus | null>(null);
  const [matrixVisible, setMatrixVisible] = useState(false);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    responseMs: number;
  } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const levelId: AttentionLevelId = 'foundation';

  useEffect(() => {
    if (
      screen !== 'stimulus' ||
      stimulus?.kind !== 'visual_memory_matrix'
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => setMatrixVisible(false),
      stimulus.exposureMs,
    );
    return () => window.clearTimeout(timer);
  }, [screen, stimulus]);

  async function postAttention(body: Record<string, unknown>) {
    const response = await fetch('/api/attention/session', {
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
          : 'attention_request_failed',
      );
    }
    return result;
  }

  async function begin() {
    if (status === 'loading') return;
    setStatus('loading');
    setReceipt(null);
    setFeedback(null);
    setStimulus(null);
    setSelectedCells([]);
    try {
      const result = await postAttention({
        action: 'start',
        exerciseId,
        levelId,
      });
      if (typeof result.prepareToken !== 'string') {
        throw new Error('attention_start_invalid');
      }
      setPrepareToken(result.prepareToken);
      setScreen('ready');
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  async function renderNext() {
    if (!prepareToken || status === 'loading') return;
    setStatus('loading');
    setFeedback(null);
    setSelectedCells([]);
    try {
      const result = await postAttention({
        action: 'render',
        prepareToken,
      });
      if (!safeStimulus(result.stimulus) || typeof result.responseToken !== 'string') {
        throw new Error('attention_render_invalid');
      }
      setStimulus(result.stimulus);
      setResponseToken(result.responseToken);
      setPrepareToken('');
      setMatrixVisible(result.stimulus.kind === 'visual_memory_matrix');
      setScreen('stimulus');
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  async function answer(answerValue: ColorId | number[]) {
    if (!responseToken || status === 'loading') return;
    setStatus('loading');
    try {
      const result = await postAttention({
        action: 'response',
        responseToken,
        answer: answerValue,
      });
      if (
        typeof result.correct !== 'boolean' ||
        !Number.isInteger(result.serverObservedResponseMs)
      ) {
        throw new Error('attention_response_invalid');
      }
      setFeedback({
        correct: result.correct,
        responseMs: Number(result.serverObservedResponseMs),
      });
      setResponseToken('');
      if (result.completed === true) {
        if (!safeReceipt(result.receipt)) {
          throw new Error('attention_receipt_invalid');
        }
        setReceipt(result.receipt);
        setScreen('summary');
      } else {
        if (typeof result.prepareToken !== 'string') {
          throw new Error('attention_prepare_invalid');
        }
        setPrepareToken(result.prepareToken);
        setScreen('feedback');
      }
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  function reset() {
    setScreen('setup');
    setPrepareToken('');
    setResponseToken('');
    setStimulus(null);
    setSelectedCells([]);
    setFeedback(null);
    setReceipt(null);
    setStatus('idle');
  }

  function toggleCell(cell: number) {
    if (matrixVisible) return;
    setSelectedCells((current) =>
      current.includes(cell)
        ? current.filter((value) => value !== cell)
        : [...current, cell],
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Ana panel
          </a>
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
            İZOLE · SENTETİK
          </span>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_20px_70px_rgba(15,23,42,.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-5 py-7 sm:px-9">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-700 p-3 text-white">
                <Brain aria-hidden="true" className="size-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">
                  Faz 2 · Dikkat laboratuvarı
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">
                  Sakin bak. Çelişkiyi yönet. Hatırla.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Bu ekran yalnız sentetik alıştırma geri bildirimi üretir. Sonuçlar
                  tanı, not veya doğrulanmış pedagojik kanıt değildir.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-9">
            {screen === 'setup' && (
              <div className="grid gap-7 lg:grid-cols-[1fr_.8fr]">
                <div>
                  <h2 className="text-lg font-black">Egzersizini seç</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      data-exercise-id="stroop_conflict"
                      aria-pressed={exerciseId === 'stroop_conflict'}
                      onClick={() => setExerciseId('stroop_conflict')}
                      className={`min-h-32 rounded-2xl border p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transition-none ${
                        exerciseId === 'stroop_conflict'
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Sparkles aria-hidden="true" className="size-6 text-emerald-700" />
                      <strong className="mt-4 block">Stroop Çelişkisi</strong>
                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                        Kelimeyi değil, yazının rengini seç.
                      </span>
                    </button>
                    <button
                      type="button"
                      data-exercise-id="visual_memory_matrix"
                      aria-pressed={exerciseId === 'visual_memory_matrix'}
                      onClick={() => setExerciseId('visual_memory_matrix')}
                      className={`min-h-32 rounded-2xl border p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 motion-reduce:transition-none ${
                        exerciseId === 'visual_memory_matrix'
                          ? 'border-sky-600 bg-sky-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Grid3X3 aria-hidden="true" className="size-6 text-sky-700" />
                      <strong className="mt-4 block">Görsel Hafıza Matrisi</strong>
                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                        Parlayan hücreleri örüntü kapandıktan sonra hatırla.
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={begin}
                    disabled={status === 'loading'}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 font-black text-white hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
                  >
                    <Play aria-hidden="true" className="size-4" />
                    {status === 'loading' ? 'Hazırlanıyor…' : 'Egzersizi hazırla'}
                  </button>
                </div>

                <aside className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">
                    Sentetik profil
                  </p>
                  <p className="mt-2 text-xl font-black">
                    {SYNTHETIC_ATTENTION_STUDENT.displayName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {SYNTHETIC_ATTENTION_STUDENT.ageBand} yaş · fixture
                  </p>
                  <ol className="mt-5 space-y-3">
                    {ATTENTION_LEARNING_PATH.map((step, index) => (
                      <li key={step.id} className="flex gap-3 text-sm">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white font-black text-emerald-700">
                          {index + 1}
                        </span>
                        <span>
                          <strong className="block">{step.label}</strong>
                          <span className="text-slate-500">{step.goal}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </aside>
              </div>
            )}

            {screen === 'ready' && (
              <div className="mx-auto max-w-xl py-10 text-center">
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                  <Timer aria-hidden="true" className="size-9" />
                </div>
                <h2 className="mt-5 text-2xl font-black">Sayaç henüz başlamadı</h2>
                <p className="mt-3 text-slate-600">
                  Rahat bir duruş al. “Uyaranı göster” dediğin anda sunucu yeni
                  tur saatini başlatacak.
                </p>
                <button
                  type="button"
                  onClick={renderNext}
                  disabled={status === 'loading'}
                  className="mt-6 min-h-12 rounded-xl bg-emerald-700 px-6 font-black text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {status === 'loading' ? 'Açılıyor…' : 'Uyaranı göster'}
                </button>
              </div>
            )}

            {screen === 'stimulus' && stimulus?.kind === 'stroop_conflict' && (
              <div className="mx-auto max-w-2xl py-6 text-center">
                <p className="text-sm font-bold text-slate-500">
                  Tur {stimulus.position}/{stimulus.total} · Kelimeyi değil rengi seç
                </p>
                <div
                  data-testid="stroop-word"
                  className={`my-12 text-5xl font-black tracking-wider sm:text-7xl ${INK_CLASSES[stimulus.ink]}`}
                >
                  {COLOR_LABELS[stimulus.word]}
                </div>
                <fieldset disabled={status === 'loading'}>
                  <legend className="sr-only">Yazının görünen rengini seç</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {stimulus.options.map((color) => (
                      <button
                        key={color}
                        type="button"
                        data-color-id={color}
                        onClick={() => answer(color)}
                        className="min-h-14 rounded-xl border border-slate-200 bg-white font-black hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                      >
                        {COLOR_LABELS[color]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {screen === 'stimulus' &&
              stimulus?.kind === 'visual_memory_matrix' && (
                <div className="mx-auto max-w-xl py-4 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    Tur {stimulus.position}/{stimulus.total} ·{' '}
                    {matrixVisible
                      ? 'Parlayan hücrelere bak'
                      : 'Hatırladığın hücreleri seç'}
                  </p>
                  <div
                    data-testid="memory-matrix"
                    data-visible={matrixVisible ? 'true' : 'false'}
                    data-exposure-ms={stimulus.exposureMs}
                    className="mx-auto my-7 grid max-w-sm gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${stimulus.size}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from(
                      { length: stimulus.size ** 2 },
                      (_, cell) => {
                        const active =
                          matrixVisible && stimulus.activeCells.includes(cell);
                        const selected = selectedCells.includes(cell);
                        return (
                          <button
                            key={cell}
                            type="button"
                            aria-label={`Matris hücresi ${cell + 1}`}
                            aria-pressed={selected}
                            disabled={matrixVisible || status === 'loading'}
                            onClick={() => toggleCell(cell)}
                            className={`aspect-square rounded-xl border transition motion-reduce:transition-none ${
                              active
                                ? 'border-sky-500 bg-sky-500'
                                : selected
                                  ? 'border-emerald-600 bg-emerald-100'
                                  : 'border-slate-200 bg-slate-50'
                            }`}
                          />
                        );
                      },
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => answer(selectedCells)}
                    disabled={matrixVisible || status === 'loading'}
                    className="min-h-12 rounded-xl bg-slate-900 px-6 font-black text-white disabled:opacity-40"
                  >
                    Yanıtı gönder
                  </button>
                </div>
              )}

            {screen === 'feedback' && feedback && (
              <div className="mx-auto max-w-xl py-10 text-center" aria-live="polite">
                {feedback.correct ? (
                  <CheckCircle2 aria-hidden="true" className="mx-auto size-14 text-emerald-700" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mx-auto size-14 text-amber-600" />
                )}
                <h2 className="mt-4 text-2xl font-black">
                  {feedback.correct ? 'Doğru odak' : 'Bu turda hedef kaçtı'}
                </h2>
                <p className="mt-2 text-slate-600">
                  Sunucu gözlemli yaklaşık yanıt: {feedback.responseMs} ms
                </p>
                <button
                  type="button"
                  onClick={renderNext}
                  disabled={status === 'loading'}
                  className="mt-6 min-h-12 rounded-xl bg-emerald-700 px-6 font-black text-white disabled:opacity-50"
                >
                  Sonraki turu başlat
                </button>
              </div>
            )}

            {screen === 'summary' && receipt && (
              <div aria-live="polite">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">
                      Alıştırma tamamlandı
                    </p>
                    <h2 className="mt-1 text-2xl font-black">Sentetik dikkat özeti</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">
                    <ShieldCheck aria-hidden="true" className="size-4" /> Sunucu sınıflandırmalı
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Doğruluk"
                    value={`${receipt.metrics.correctRounds}/${receipt.metrics.totalRounds}`}
                    note="Sunucuda puanlandı"
                  />
                  <MetricCard
                    label="Yaklaşık yanıt"
                    value={`${receipt.metrics.averageServerObservedResponseMs} ms`}
                    note="Ağ ve render gecikmesini içerir"
                  />
                  <MetricCard
                    label="Odak sapması"
                    value={receipt.metrics.focusDeviationMultiplier.toFixed(2)}
                    note="Tanısal olmayan süre değişkenliği"
                  />
                  <MetricCard
                    label="Kanıt sınıfı"
                    value="Sentetik"
                    note="Ledger ve persistence kapalı"
                  />
                </div>
                <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Bu özet yalnız alıştırma geri bildirimidir. Tarayıcı sunulan uyaranı
                  gözlemleyebilir; sonuç gerçek öğrenci kanıtı veya klinik ölçüm değildir.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-900 px-6 font-black text-white"
                >
                  <RotateCcw aria-hidden="true" className="size-4" /> Yeniden çalış
                </button>
              </div>
            )}

            {status === 'error' && (
              <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">
                Güvenli oturum tamamlanamadı. Sayfayı yenileyip tekrar deneyin.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
