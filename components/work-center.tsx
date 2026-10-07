'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vinext client navigation uses document links in this project. */
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type {
  StudentDashboardAssignment,
  StudentDashboardData,
} from '@/lib/student-dashboard-contract';
import { workStateLabel } from '@/lib/work-center';

const FREE_PRACTICE_WORKSHOPS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { label: 'Parmak', href: '/paritmetik', icon: Target },
  { label: 'Soroban', href: '/studio?mode=soroban-read', icon: BrainCircuit },
  { label: 'Toplama / Çıkarma', href: '/arithmetic', icon: LayoutDashboard },
  { label: 'Flash Anzan', href: '/studio?mode=flash', icon: Sparkles },
  { label: 'Hafıza Teknikleri', href: '/memory', icon: BrainCircuit },
  { label: 'Dikkat & Derin Odak', href: '/attention', icon: Target },
  { label: 'Hızlı Okuma', href: '/speed-reading', icon: BookOpenCheck },
  { label: 'Zihin Haritaları', href: '/mind-maps', icon: BrainCircuit },
  { label: 'Zekâ Oyunları', href: '/intelligence-games', icon: LayoutDashboard },
  { label: 'Etkili Not Alma', href: '/effective-notes', icon: BookOpenCheck },
  { label: 'Tam Öğrenme Sistemi', href: '/full-study', icon: BookOpenCheck },

];

function dateLabel(value: string | null) {
  if (!value) return 'Tarih sınırı yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bekleniyor';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function stateTone(state: StudentDashboardAssignment['status']) {
  if (state === 'completed') return 'bg-emerald-50 text-emerald-800';
  if (state === 'in_progress') return 'bg-blue-50 text-blue-800';
  if (state === 'available') return 'bg-amber-50 text-amber-900';
  return 'bg-slate-100 text-slate-700';
}

function AssignmentCard({
  assignment,
}: {
  assignment: StudentDashboardAssignment;
}) {
  const actionable =
    (assignment.status === 'available' ||
      assignment.status === 'in_progress') &&
    assignment.launchPath;

  return (
    <article className="rounded-3xl border border-[#dce5e0] bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8f4ee] text-[#176d5c]">
            <BookOpenCheck size={23} />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[#20323d]">
              {assignment.title}
            </h3>
            <p className="mt-1 text-sm font-semibold text-[#687982]">
              {assignment.moduleName}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-sm font-black ${stateTone(assignment.status)}`}
        >
          {workStateLabel(assignment.status)}
        </span>
      </div>

      <div className="mt-5">
        {assignment.instructions ? (
          <p className="mb-4 rounded-2xl bg-[#f3f7f5] p-4 text-sm leading-6 text-[#405a53]">
            <b>Eğitmen notu:</b> {assignment.instructions}
          </p>
        ) : null}
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-[#5f717a]">
            {assignment.attemptCount}/{assignment.expectedCount} adım
          </span>
          <span className="font-black text-[#226c5c]">
            %{assignment.progressPercent}
          </span>
        </div>
        <Progress
          value={assignment.progressPercent}
          aria-label={`${assignment.title} ilerlemesi yüzde ${assignment.progressPercent}`}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5ece8] pt-4">
        <span className="inline-flex items-center gap-2 text-sm text-[#687982]">
          <Clock3 size={17} />
          {assignment.lastActivityAt
            ? `Son çalışma: ${dateLabel(assignment.lastActivityAt)}`
            : assignment.startsAt
              ? `Açılış: ${dateLabel(assignment.startsAt)}`
              : 'Başlamaya hazır'}
        </span>
        <span className="inline-flex items-center gap-2 text-sm text-[#687982]">
          <CalendarClock size={17} /> Son tarih: {dateLabel(assignment.expiresAt)}
        </span>

        {actionable ? (
          <a
            href={`/assignment?recipe=${encodeURIComponent(assignment.id)}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1f705f] px-5 font-black text-white transition hover:bg-[#175748]"
          >
            {assignment.status === 'in_progress' ? 'Devam Et' : 'Başla'}
            <ArrowRight size={18} />
          </a>
        ) : assignment.status === 'completed' ? (
          <a
            href="#results"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#9bbcaf] bg-[#f2f8f5] px-5 font-black text-[#205f52]"
          >
            Sonucu Gör <ArrowRight size={18} />
          </a>
        ) : assignment.launchPath === null &&
          ['available', 'in_progress'].includes(assignment.status) ? (
          <span className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-100 px-5 font-bold text-slate-600">
            <LockKeyhole size={17} /> Henüz etkin değil
          </span>
        ) : (
          <span className="inline-flex min-h-12 items-center rounded-xl bg-slate-100 px-5 font-bold text-slate-600">
            {workStateLabel(assignment.status)}
          </span>
        )}
      </div>
    </article>
  );
}

export function WorkCenter({
  dashboard,
  loading,
  error,
  onLogout,
}: {
  dashboard: StudentDashboardData | null;
  loading: boolean;
  error: string;
  onLogout: () => void;
}) {
  const assignments = dashboard?.assignments ?? [];
  const inProgress = assignments.filter(
    (item) => item.status === 'in_progress',
  );
  const available = assignments.filter((item) => item.status === 'available');
  const upcoming = assignments.filter((item) => item.status === 'assigned');
  const completed = assignments.filter((item) => item.status === 'completed');
  const primary = inProgress[0] ?? available[0] ?? null;
  const history = dashboard?.recentActivity ?? [];
  const displayName = dashboard?.profile.name || 'Öğrenci';
  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: LucideIcon;
  }> = [
    {
      label: 'Başlamaya hazır',
      value: dashboard?.summary.availableAssignments ?? 0,
      icon: CalendarClock,
    },
    {
      label: 'Devam eden',
      value: dashboard?.summary.inProgressAssignments ?? 0,
      icon: Play,
    },
    {
      label: 'Tamamlanan',
      value: dashboard?.summary.completedAssignments ?? 0,
      icon: CheckCircle2,
    },
    {
      label: 'Genel doğruluk',
      value: `%${dashboard?.summary.accuracy ?? 0}`,
      icon: Target,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f3f7f5] text-[#21313e]">
      <header className="sticky top-0 z-30 border-b border-[#dce5e0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-3 font-black text-[#214d45]"
          >
            <ArrowLeft size={20} />
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#183f47] text-xs text-[#dff3b0]">
              CZA
            </span>
            <span className="hidden sm:inline">Öğrenci Paneli</span>
          </a>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl bg-[#edf5f1] px-4 py-2 font-bold text-[#285f53] sm:inline-flex">
              {displayName}
            </span>
            <Button variant="outline" onClick={onLogout} className="min-h-11">
              <LogOut size={17} />{' '}
              <span className="hidden sm:inline">Güvenli çıkış</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-900"
          >
            {error}
          </p>
        ) : null}

        <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(125deg,#153f47,#1e6c60_58%,#345b82)] p-6 text-white shadow-[0_22px_55px_rgba(23,62,70,.2)] md:p-9">
          <div
            className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-white/10"
            aria-hidden="true"
          />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-bold uppercase tracking-[.12em] text-[#d8efb5]">
                Çalışma Merkezim
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight md:text-4xl">
                {primary?.status === 'in_progress'
                  ? 'Kaldığın yer hazır.'
                  : primary
                    ? 'Sıradaki çalışman hazır.'
                    : 'Bugünkü çalışmaların tamam.'}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#e2efeb]">
                Atamalarını, ilerlemeni ve sonuçlarını aynı öğrenci geçmişinde
                güvenle takip et.
              </p>
            </div>
            {primary?.launchPath ? (
              <a
                href={`/assignment?recipe=${encodeURIComponent(primary.id)}`}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#f4d66f] px-7 text-lg font-black text-[#233d3c] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#ffe68f]"
              >
                {primary.status === 'in_progress' ? 'Devam Et' : 'Şimdi Başla'}
                <Play size={20} fill="currentColor" />
              </a>
            ) : (
              <span className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/15 px-6 font-bold text-white ring-1 ring-white/20">
                <CheckCircle2 size={20} /> Yeni atama bekleniyor
              </span>
            )}
          </div>
        </section>

        <section
          className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Çalışma merkezi özeti"
        >
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <article
              key={String(label)}
              className="rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#667781]">{label}</span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef5f1] text-[#226c5c]">
                  <Icon size={20} />
                </span>
              </div>
              <strong className="mt-3 block text-3xl font-black tabular-nums">
                {value}
              </strong>
            </article>
          ))}
        </section>

        {loading ? (
          <output
            aria-live="polite"
            className="mt-6 block rounded-3xl border border-[#dce5e0] bg-white p-10 text-center font-semibold text-[#61727c]"
          >
            Çalışma verilerin hazırlanıyor…
          </output>
        ) : (
          <div className="mt-7 space-y-8">
            <section aria-labelledby="today-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-bold uppercase tracking-[.1em] text-[#24705e]">
                    Bugünkü çalışmalarım
                  </p>
                  <h2 id="today-heading" className="mt-2 text-2xl font-black">
                    Aktif atamalarım
                  </h2>
                </div>
                <span className="rounded-full bg-[#eaf4ef] px-4 py-2 font-bold text-[#286858]">
                  {inProgress.length + available.length} etkin
                </span>
              </div>
              {inProgress.length + available.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {[...inProgress, ...available].map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[#cbd9d2] bg-white p-8 text-center">
                  <CheckCircle2 className="mx-auto text-[#4f907a]" size={32} />
                  <p className="mt-3 text-lg font-black">
                    Etkin atanmış çalışman yok.
                  </p>
                  <p className="mt-2 text-[#687982]">
                    Aşağıdaki beceri atölyelerinden serbest çalışma
                    yapabilirsin.
                  </p>
                </div>
              )}
            </section>

            {upcoming.length ? (
              <section aria-labelledby="upcoming-heading">
                <h2 id="upcoming-heading" className="mb-4 text-2xl font-black">
                  Yaklaşan çalışmalarım
                </h2>
                <div className="grid gap-4 xl:grid-cols-2">
                  {upcoming.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section
              id="results"
              className="scroll-mt-28"
              aria-labelledby="completed-heading"
            >
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="font-bold uppercase tracking-[.1em] text-[#6652a8]">
                    Sonuçlarım
                  </p>
                  <h2
                    id="completed-heading"
                    className="mt-2 text-2xl font-black"
                  >
                    Tamamladıklarım
                  </h2>
                </div>
              </div>
              {completed.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {completed.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-3xl border border-[#dcd7ec] bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black">
                            {assignment.title}
                          </h3>
                          <p className="mt-1 text-[#687982]">
                            {assignment.moduleName}
                          </p>
                        </div>
                        <CheckCircle2
                          className="shrink-0 text-emerald-700"
                          size={26}
                        />
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-2xl bg-[#f3f6f5] p-3">
                          <strong className="text-2xl">
                            {assignment.attemptCount}
                          </strong>
                          <p className="mt-1 text-sm">Yanıt</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <strong className="text-2xl text-emerald-800">
                            {assignment.correctCount}
                          </strong>
                          <p className="mt-1 text-sm">Doğru</p>
                        </div>
                        <div className="rounded-2xl bg-[#f5f2fc] p-3">
                          <strong className="text-2xl text-[#6652a8]">
                            %
                            {assignment.attemptCount
                              ? Math.round(
                                  (100 * assignment.correctCount) /
                                    assignment.attemptCount,
                                )
                              : 0}
                          </strong>
                          <p className="mt-1 text-sm">Başarı</p>
                        </div>
                      </div>
                      {assignment.freePracticePath ? (
                        <a
                          href={assignment.freePracticePath}
                          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b7adcf] px-4 font-bold text-[#5e4a92]"
                        >
                          <RotateCcw size={17} /> Serbest tekrar
                        </a>
                      ) : (
                        <span className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-4 font-bold text-slate-600">
                          Tekrar henüz etkin değil
                        </span>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-3xl bg-white p-6 text-[#687982] shadow-sm">
                  İlk atanmış çalışmanı tamamladığında sonuçların burada
                  görünecek.
                </p>
              )}
            </section>

            <section
              className="rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm md:p-7"
              aria-labelledby="workshops-heading"
            >
              <div>
                <p className="font-bold uppercase tracking-[.1em] text-[#315f86]">
                  Serbest çalışma
                </p>
                <h2 id="workshops-heading" className="mt-2 text-2xl font-black">
                  Beceri atölyeleri
                </h2>
                <p className="mt-2 text-[#687982]">
                  Serbest tekrar yeni bir resmî atama oluşturmaz.
                </p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {FREE_PRACTICE_WORKSHOPS.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    className="group rounded-2xl border border-[#dce5e0] p-5 transition hover:-translate-y-0.5 hover:border-[#8db6aa] hover:shadow-md"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef5f1] text-[#246755]">
                      <Icon size={24} />
                    </span>
                    <h3 className="mt-4 text-lg font-black">{label}</h3>
                    <span className="mt-4 inline-flex items-center gap-2 font-bold text-[#246755]">
                      Aç <ArrowRight size={17} />
                    </span>
                  </a>
                ))}
              </div>
            </section>

            <section
              className="rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm md:p-7"
              aria-labelledby="history-heading"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-bold uppercase tracking-[.1em] text-[#a2602c]">
                    Kalıcı öğrenci geçmişi
                  </p>
                  <h2 id="history-heading" className="mt-2 text-2xl font-black">
                    Son çalışma geçmişim
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 font-semibold text-[#697983]">
                  <History size={18} /> En yeni önce
                </span>
              </div>
              {history.length ? (
                <div className="mt-5 divide-y divide-[#e2e9e5]">
                  {history.map((activity) => (
                    <article
                      key={activity.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div>
                        <h3 className="font-black">
                          {activity.assignmentTitle || activity.moduleName}
                        </h3>
                        <p className="mt-1 text-[#6b7a83]">
                          {dateLabel(
                            activity.completedAt || activity.startedAt,
                          )}{' '}
                          · {activity.attemptCount} yanıt
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`rounded-full px-3 py-1.5 text-sm font-black ${activity.status === 'completed' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}
                        >
                          {activity.status === 'completed'
                            ? 'Tamamlandı'
                            : 'Devam ediyor'}
                        </span>
                        {activity.attemptCount ? (
                          <p className="mt-2 font-black text-[#6652a8]">
                            %{activity.accuracy}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-[#f7f9f8] p-5 text-[#687982]">
                  Henüz çalışma geçmişin yok.
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
