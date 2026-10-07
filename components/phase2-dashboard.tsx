'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vinext navigation intentionally uses native anchors. */
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Brain,
  Eye,
  GraduationCap,
  LockKeyhole,
  School,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  PHASE2_MODULES,
  PHASE2_TRUST_BOUNDARY,
  type Phase2Audience,
  type Phase2ModuleLink,
} from '@/lib/phase2-integration';

const MODULE_VISUALS = {
  'fast-reading': {
    icon: Eye,
    accent: 'bg-violet-700',
    surface: 'from-violet-50 to-white',
  },
  attention: {
    icon: Brain,
    accent: 'bg-emerald-700',
    surface: 'from-emerald-50 to-white',
  },
  'book-preparation': {
    icon: BookOpenCheck,
    accent: 'bg-sky-700',
    surface: 'from-sky-50 to-white',
  },
} as const;

function ModuleCard({ module }: { module: Phase2ModuleLink }) {
  const visual = MODULE_VISUALS[module.id];
  const Icon = visual.icon;
  return (
    <article
      data-module-id={module.id}
      className={`flex h-full flex-col rounded-3xl border border-slate-200 bg-gradient-to-br ${visual.surface} p-6 shadow-sm`}
    >
      <div className={`grid size-14 place-items-center rounded-2xl text-white ${visual.accent}`}>
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <p className="mt-5 text-base font-black uppercase tracking-[.08em] text-slate-500">
        {module.audience === 'student' ? 'Öğrenci alanı' : 'Eğitmen alanı'}
      </p>
      <h3 className="mt-2 text-2xl font-black text-slate-950">{module.title}</h3>
      <p className="mt-3 flex-1 leading-7 text-slate-600">{module.description}</p>
      <dl className="mt-5 grid gap-2 rounded-2xl bg-white/80 p-4 text-base">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Veri etiketi</dt>
          <dd className="font-bold text-slate-800">{module.evidenceLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Kalıcı kayıt</dt>
          <dd className="font-bold text-rose-700">Kapalı</dd>
        </div>
      </dl>
      <a
        href={module.href}
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transition-none"
      >
        {module.audience === 'educator' ? 'Kimlik kapısına git' : 'Laboratuvarı aç'}
        <ArrowRight aria-hidden="true" className="size-4" />
      </a>
    </article>
  );
}

export function Phase2Dashboard() {
  const [audience, setAudience] = useState<Phase2Audience>('student');
  const modules = PHASE2_MODULES.filter(
    (module) => module.audience === audience,
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a
            href="/"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 font-bold shadow-sm"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Ana CZA paneli
          </a>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-3 font-black text-amber-900">
            <LockKeyhole aria-hidden="true" className="size-4" /> İzole laboratuvar
          </span>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_22px_80px_rgba(15,23,42,.08)]">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-9 text-white sm:px-10 sm:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-black uppercase tracking-[.15em] text-emerald-300">
                  Çelik Zihin Akademisi · Faz 2
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                  Öğrenme laboratuvarları tek merkezde
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Öğrenci egzersizleri ile eğitimci içerik mutfağı aynı görsel
                  merkezden açılır; kimlik, token ve veri sınırları birleşmez.
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <ShieldCheck aria-hidden="true" className="size-7 text-emerald-300" />
                  <div>
                    <strong className="block">Üretim bağlantısı yok</strong>
                    <span className="text-slate-300">Ledger ve persistence kapalı</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div
              role="tablist"
              aria-label="Faz 2 çalışma rolü"
              className="grid max-w-xl grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={audience === 'student'}
                onClick={() => setAudience('student')}
                className={`min-h-12 rounded-xl px-4 font-black ${
                  audience === 'student'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                <GraduationCap aria-hidden="true" className="mr-2 inline size-5" />
                Öğrenci
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={audience === 'educator'}
                onClick={() => setAudience('educator')}
                className={`min-h-12 rounded-xl px-4 font-black ${
                  audience === 'educator'
                    ? 'bg-white text-sky-800 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                <School aria-hidden="true" className="mr-2 inline size-5" />
                Eğitmen
              </button>
            </div>

            <div className="mt-7 grid gap-5 md:grid-cols-2" data-testid="phase2-modules">
              {modules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>

            <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start gap-4">
                <Sparkles aria-hidden="true" className="mt-1 size-6 shrink-0 text-emerald-800" />
                <div>
                  <h2 className="text-xl font-black">Dürüst ölçüm sözlüğü</h2>
                  <p className="mt-2 leading-7 text-emerald-950">
                    Süreler <strong>{PHASE2_TRUST_BOUNDARY.timingTerm}</strong>{' '}
                    olarak adlandırılır. Dikkat sonuçları yalnız{' '}
                    <strong>{PHASE2_TRUST_BOUNDARY.attentionEvidenceTerm}</strong>{' '}
                    sınıfındadır. Bunlar doğrulanmış pedagojik kanıt, tanı veya not
                    değildir.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
