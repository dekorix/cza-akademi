'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vinext navigation intentionally uses native anchors. */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
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
  createSchulteBoard,
  evaluateSchulteAttempt,
  FAST_READING_LEARNING_PATH,
  FAST_READING_LEVELS,
  levelById,
  SYNTHETIC_FAST_READING_STUDENT,
  type FastReadingExerciseId,
  type FastReadingLevelId,
} from '@/lib/fast-reading-core';

type Screen = 'setup' | 'focus' | 'schulte' | 'tachistoscope' | 'summary';

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

const WORD_GROUPS = Object.freeze([
  'merakla keşfet',
  'sakince odaklan',
  'bütünü fark et',
  'anlamı yakala',
  'ritmini koru',
]);

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

export function FastReadingWorkspace() {
  const [levelId, setLevelId] = useState<FastReadingLevelId>('starter');
  const [exerciseId, setExerciseId] =
    useState<FastReadingExerciseId>('focus_expansion');
  const [screen, setScreen] = useState<Screen>('setup');
  const [focusRound, setFocusRound] = useState(1);
  const [expectedNumber, setExpectedNumber] = useState(1);
  const [selections, setSelections] = useState<number[]>([]);
  const [selectionDurations, setSelectionDurations] = useState<number[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const lastSelectionAt = useRef(0);
  const level = levelById(levelId);
  const board = useMemo(
    () => createSchulteBoard(level.schulteSize, level.schulteSize * 1009),
    [level.schulteSize],
  );
  const attempt = useMemo(
    () => evaluateSchulteAttempt(board, selections, selectionDurations),
    [board, selectionDurations, selections],
  );

  useEffect(() => {
    if (screen !== 'focus') return;
    const interval = window.setInterval(
      () => setFocusRound((round) => (round % 4) + 1),
      level.focusStepMs,
    );
    return () => window.clearInterval(interval);
  }, [level.focusStepMs, screen]);

  useEffect(() => {
    if (screen !== 'tachistoscope') return;
    const hidden = window.setTimeout(
      () => setWordVisible(false),
      Math.round(level.tachistoscopeExposureMs * 0.68),
    );
    const next = window.setTimeout(() => {
      if (wordIndex === WORD_GROUPS.length - 1) setScreen('summary');
      else {
        setWordVisible(true);
        setWordIndex((index) => index + 1);
      }
    }, level.tachistoscopeExposureMs);
    return () => {
      window.clearTimeout(hidden);
      window.clearTimeout(next);
    };
  }, [level.tachistoscopeExposureMs, screen, wordIndex]);

  function beginExercise(event: MouseEvent<HTMLButtonElement>) {
    setExpectedNumber(1);
    setSelections([]);
    setSelectionDurations([]);
    setWordIndex(0);
    setWordVisible(true);
    setFocusRound(1);
    lastSelectionAt.current = event.timeStamp;
    setScreen(
      exerciseId === 'focus_expansion'
        ? 'focus'
        : exerciseId === 'schulte_scan'
          ? 'schulte'
          : 'tachistoscope',
    );
  }

  function selectSchulteNumber(value: number, eventTimeStamp: number) {
    if (value !== expectedNumber) return;
    const now = eventTimeStamp;
    setSelections((current) => [...current, value]);
    setSelectionDurations((current) => [
      ...current,
      Math.max(0, Math.round(now - lastSelectionAt.current)),
    ]);
    lastSelectionAt.current = now;
    if (value === board.length) setScreen('summary');
    else setExpectedNumber(value + 1);
  }

  function resetToSetup() {
    setScreen('setup');
    setExpectedNumber(1);
    setSelections([]);
    setSelectionDurations([]);
    setWordIndex(0);
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
                  {FAST_READING_LEVELS.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={levelId === candidate.id}
                      onClick={() => setLevelId(candidate.id)}
                      className={`rounded-2xl border-2 p-5 text-left transition ${levelId === candidate.id ? 'border-[#277a67] bg-[#e8f6ef] shadow-md' : 'border-[#e1e7e3] bg-white hover:border-[#9dcbbb]'}`}
                    >
                      <span className="text-base font-black">
                        {levelId === candidate.id ? '✓ ' : ''}
                        {candidate.label}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-[#6f7f89]">
                        {candidate.description}
                      </span>
                    </button>
                  ))}
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
                onClick={beginExercise}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#193f36] px-6 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#245f51] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#6c57c0]"
              >
                <Play size={20} fill="currentColor" /> Egzersizi başlat
              </button>
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
                <div className="absolute size-[72%] animate-[spin_9s_linear_infinite] rounded-full">
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
                onClick={() => setScreen('summary')}
                className="mx-auto mt-7 flex min-h-12 items-center gap-2 rounded-xl bg-[#173f36] px-6 font-bold text-white"
              >
                <CircleCheckBig size={18} /> Turu tamamla
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
              <div className="flex items-center justify-between rounded-2xl bg-[#f2f6f3] px-5 py-4 text-sm">
                <span>
                  {attempt.correctSelections}/{attempt.totalCells} doğru sıra
                </span>
                <strong>%{attempt.accuracyPercent}</strong>
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
                  {level.tachistoscopeExposureMs} ms
                </span>
              </div>
              <div className="my-10 grid min-h-[360px] place-items-center overflow-hidden rounded-[2rem] bg-[radial-gradient(circle,#fff8dc,#f0d9a9_60%,#d6b778)] p-6 text-center shadow-inner">
                <div
                  className={`transition duration-150 ${wordVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                  aria-live="polite"
                >
                  <span className="text-xs font-black uppercase tracking-[.18em] text-[#9b6f38]">
                    Bak · Yakala · Hatırla
                  </span>
                  <p className="mt-4 text-4xl font-black tracking-[-.04em] text-[#3f3427] md:text-6xl">
                    {WORD_GROUPS[wordIndex]}
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f4ead7]">
                <div
                  className="h-full rounded-full bg-[#c67a2f] transition-all"
                  style={{
                    width: `${((wordIndex + 1) / WORD_GROUPS.length) * 100}%`,
                  }}
                />
              </div>
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
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
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
                  label="Kanıt sınıfı"
                  value="Telemetry"
                  note="Server-verified değildir"
                />
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={beginExercise}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#173f36] px-5 font-bold text-white"
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
