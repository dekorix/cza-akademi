'use client';

/* oxlint-disable next/no-html-link-for-pages -- CZA navigation intentionally uses full-page anchors; the client router shim is regression-tested as unsupported. */
import {
  ArrowRight,
  AudioLines,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { StudentDashboardData } from '@/lib/student-dashboard-contract';

const moduleLinks = [
  {
    title: 'Parmak teknikleri',
    detail: 'Okuma ve basma çalışmaları',
    href: '/paritmetik',
    icon: Target,
    tone: 'bg-[#fff4e8] text-[#995b22]',
  },
  {
    title: 'Soroban',
    detail: 'Temel öğretim ve uygulama',
    href: '/learn',
    icon: BrainCircuit,
    tone: 'bg-[#e8f5ef] text-[#176d5c]',
  },
  {
    title: 'Flash Anzan',
    detail: 'Görsel zihinsel işlem',
    href: '/studio?mode=flash',
    icon: Sparkles,
    tone: 'bg-[#f0edff] text-[#6652a8]',
  },
  {
    title: 'Sesli Anzan',
    detail: 'Yapılandırma hazır olduğunda',
    href: '/studio?mode=audio',
    icon: AudioLines,
    tone: 'bg-[#edf3f7] text-[#48677d]',
  },
];

const dashboardLinks = [
  { href: '#today', label: 'Atanan Çalışmalar', icon: CalendarClock },
  { href: '#results', label: 'Sonuçlarım', icon: CheckCircle2 },
  { href: '#history', label: 'Geçmişim', icon: History },
  { href: '#profile', label: 'Beceri Profilim', icon: ChartNoAxesCombined },
  { href: '/work', label: 'Çalışma Merkezim', icon: LayoutDashboard },
];

function dateLabel(value: string | null) {
  if (!value) return 'Devam ediyor';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bekleniyor';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
export function StudentDashboard({
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
  const displayName = dashboard?.profile.name || 'Öğrenci';
  const assignments = dashboard?.assignments ?? [];
  const summary = dashboard?.summary;
  const summaryCards = [
    { label: 'Aktif çalışma', value: summary?.activeAssignments ?? 0, icon: CalendarClock, color: '#315f86' },
    { label: 'Tamamlanan', value: summary?.completedSessions ?? 0, icon: CheckCircle2, color: '#1b7863' },
    { label: 'Yanıtlanan soru', value: summary?.totalAttempts ?? 0, icon: BookOpenCheck, color: '#735ea8' },
    { label: 'Doğruluk', value: `%${summary?.accuracy ?? 0}`, icon: Target, color: '#a2602c' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-[#21313e]">
      <header className="sticky top-0 z-30 border-b border-[#dce5e0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="CZA Öğrenci Paneli">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#183f47] text-sm font-black text-[#dff3b0] shadow-sm">CZA</span>
            <span>
              <strong className="block text-base">Öğrenci Paneli</strong>
              <span className="block text-xs text-[#61727c]">Tek öğrenci · tek gelişim geçmişi</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl bg-[#edf5f1] px-4 py-2 text-sm font-bold text-[#285f53] sm:inline-flex">{displayName}</span>
            <Button variant="outline" onClick={onLogout} className="min-h-11">
              <LogOut size={17} /> <span className="hidden sm:inline">Güvenli çıkış</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        {error && (
          <p role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {error}
          </p>
        )}

        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(125deg,#153f47,#1f6f62_58%,#345b82)] p-6 text-white shadow-[0_20px_50px_rgba(23,62,70,.18)] md:p-9">
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative grid items-end gap-7 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.12em] text-[#d8efb5]">Bugünkü gelişim alanın</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight md:text-4xl">Merhaba {displayName}. Sıradaki adımın hazır.</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#e2efeb]">Atanan çalışmalarını aç, kendi hızında ilerle ve sonuçlarını tek öğrenme geçmişinde gör.</p>
            </div>
            <a href="/work" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#f4d66f] px-7 text-base font-black text-[#233d3c] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#ffe68f]">
              Çalışma Merkezim <ArrowRight size={20} />
            </a>
          </div>
        </section>

        <nav aria-label="Öğrenci paneli bölümleri" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {dashboardLinks.map(({ href, label, icon: Icon }) => (
            <a key={label} href={href} className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#d9e3de] bg-white px-4 text-sm font-bold shadow-sm transition hover:border-[#77aa9b] hover:text-[#166655]">
              <Icon size={18} /> {label}
            </a>
          ))}
        </nav>

        <section id="results" className="mt-6 grid scroll-mt-28 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Öğrenci ilerleme özeti">
          {summaryCards.map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#667781]">{label}</span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f2f6f4]" style={{ color }}><Icon size={20} /></span>
              </div>
              <strong className="mt-3 block text-3xl font-black tabular-nums">{value}</strong>
            </article>
          ))}
        </section>

        {loading ? (
          <output aria-live="polite" className="mt-6 block rounded-3xl border border-[#dce5e0] bg-white p-10 text-center text-sm font-semibold text-[#61727c]">Panel verilerin hazırlanıyor…</output>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_.9fr]">
            <section id="today" className="scroll-mt-28 rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm md:p-7" aria-labelledby="today-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[.1em] text-[#24705e]">Bugün / sıradaki</p>
                  <h2 id="today-heading" className="mt-2 text-2xl font-black">Atanan çalışmaların</h2>
                </div>
                <span className="rounded-full bg-[#eef6f2] px-3 py-1.5 text-sm font-bold text-[#2a6859]">{assignments.length} etkin</span>
              </div>

              {assignments.length ? (
                <div className="mt-5 space-y-3">
                  {assignments.slice(0, 5).map((assignment) => (
                    <article key={assignment.id} className="flex flex-col gap-4 rounded-2xl border border-[#dfe8e3] bg-[#fbfdfc] p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5f2ec] text-[#1b705e]"><BookOpenCheck size={21} /></span>
                        <div className="min-w-0">
                          <h3 className="font-black">{assignment.title}</h3>
                          <p className="mt-1 text-sm text-[#63747d]">{assignment.moduleName} · {assignment.completedCount}/{Math.max(assignment.sessionCount, 1)} tamamlandı</p>
                        </div>
                      </div>
                      <a href={`/assignment?recipe=${encodeURIComponent(assignment.id)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1f705f] px-5 text-sm font-black text-white hover:bg-[#175748]">
                        Çalışmayı aç <ChevronRight size={17} />
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#cfdcd6] bg-[#f8fbf9] p-7 text-center">
                  <CheckCircle2 className="mx-auto text-[#55947f]" />
                  <p className="mt-3 font-black">Bekleyen atanmış çalışman yok.</p>
                  <p className="mt-1 text-sm text-[#687982]">Serbest çalışma yapmak için Çalışma Merkezini açabilirsin.</p>
                </div>
              )}
            </section>

            <section id="profile" className="scroll-mt-28 rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm md:p-7" aria-labelledby="profile-heading">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[.1em] text-[#6652a8]">Öğrenme profili köprüsü</p>
                  <h2 id="profile-heading" className="mt-2 text-xl font-black">Beceri görünümün</h2>
                </div>
                <UserRound className="text-[#6652a8]" />
              </div>
              {dashboard?.skillProfile.length ? (
                <div className="mt-6 space-y-5">
                  {dashboard.skillProfile.slice(0, 4).map((skill) => (
                    <div key={skill.moduleCode}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold">{skill.moduleName}</span>
                        <span className="font-black text-[#6652a8]">%{skill.accuracy}</span>
                      </div>
                      <Progress value={skill.accuracy} aria-label={`${skill.moduleName} yüzde ${skill.accuracy}`} />
                      <p className="mt-1 text-xs text-[#6a7a83]">{skill.correct}/{skill.total} doğru yanıt</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-[#f5f3fc] p-5 text-sm leading-6 text-[#625b78]">İlk çalışmanı tamamladığında beceri görünümün gerçek sonuçlarından oluşmaya başlayacak.</p>
              )}
              <p className="mt-5 text-xs leading-5 text-[#718088]">Bu görünüm eğitimsel çalışma verisidir; klinik tanı veya sağlık etiketi üretmez.</p>
            </section>
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm md:p-7" aria-labelledby="modules-heading">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.1em] text-[#315f86]">CZA modülleri</p>
            <h2 id="modules-heading" className="mt-2 text-2xl font-black">Beceri atölyelerine geç</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {moduleLinks.map((module) => (
              <a key={module.title} href={module.href} className="group rounded-2xl border border-[#dce5e0] p-5 transition hover:-translate-y-0.5 hover:border-[#8db6aa] hover:shadow-md">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${module.tone}`}><module.icon size={24} /></span>
                <h3 className="mt-4 font-black">{module.title}</h3>
                <p className="mt-1 text-sm text-[#687982]">{module.detail}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#246755]">Aç <ChevronRight size={16} className="transition group-hover:translate-x-1" /></span>
              </a>
            ))}
          </div>
        </section>

        <section id="history" className="mt-6 scroll-mt-28 rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm md:p-7" aria-labelledby="history-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.1em] text-[#a2602c]">Kalıcı öğrenci geçmişi</p>
              <h2 id="history-heading" className="mt-2 text-2xl font-black">Son aktivitelerin</h2>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#697983]"><Clock3 size={17} /> En yeni çalışma önce</span>
          </div>
          {dashboard?.recentActivity.length ? (
            <div className="mt-5 divide-y divide-[#e2e9e5]">
              {dashboard.recentActivity.map((activity) => (
                <article key={activity.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <h3 className="font-black">{activity.moduleName}</h3>
                    <p className="mt-1 text-sm text-[#6b7a83]">{dateLabel(activity.completedAt || activity.startedAt)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-black ${activity.status === 'completed' ? 'bg-emerald-50 text-emerald-800' : activity.status === 'active' ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                    {activity.status === 'completed' ? 'Tamamlandı' : activity.status === 'active' ? 'Devam ediyor' : 'İptal edildi'}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-[#f7f9f8] p-5 text-sm text-[#687982]">Henüz tamamlanmış veya devam eden çalışma kaydı yok.</p>
          )}
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce5e0] pt-6 text-xs text-[#72818a]">
          <span>CZA Student Learning Profile · U1 çekirdeği</span>
          <span>Koçluk, LGS/YKS ve veli görünümü sonraki onaylı fazlarda bağlanacaktır.</span>
        </footer>
      </main>
    </div>
  );
}
