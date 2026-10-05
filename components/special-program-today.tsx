'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, CalendarDays, Clock3, Target } from 'lucide-react';

type TodayResponse = {
  ok?: boolean;
  program?: null | {
    id: string;
    profileLabel: string;
    version: number;
    sessionMinutes: number;
    sessionsPerWeek: number;
  };
  completedSessions?: number;
  totalSessions?: number;
  progress?: number;
  today?: null | {
    title: string;
    focus: string;
    minutes: number;
    week: number;
    sessionInWeek: number;
    activities: { label: string; activity: string }[];
    isReassessment: boolean;
  };
};

export function SpecialProgramToday() {
  const [data, setData] = useState<TodayResponse | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/core/special-program', { cache: 'no-store' })
      .then(async response => response.status === 401 ? null : response.json())
      .then(value => { if (active && value?.ok === true) setData(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!data?.program || !data.today) return null;

  return <section className="mb-7 overflow-hidden rounded-2xl border border-[#c9d8e8] bg-[linear-gradient(135deg,#f7faff,#eef4fb)] shadow-sm" aria-labelledby="special-today-title">
    <div className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-7">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#385a78] px-3 py-1 text-[10px] font-black tracking-[.12em] text-white">BUGÜNKÜ BİREYSEL ÇALIŞMAM</span>
          {data.today.isReassessment && <span className="rounded-full bg-[#fff2d8] px-3 py-1 text-[10px] font-black text-[#8a6120]">YENİDEN ÖLÇÜM</span>}
        </div>
        <h2 id="special-today-title" className="mt-4 text-2xl font-semibold text-[#294b68]">{data.today.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#60798f]">{data.today.focus}</p>

        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-[#506b83]">
          <span className="inline-flex items-center gap-1.5"><Clock3 size={15}/>{data.today.minutes} dakika</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={15}/>{data.today.week}. hafta · {data.today.sessionInWeek}. oturum</span>
          <span className="inline-flex items-center gap-1.5"><Target size={15}/>{data.today.activities.length} kısa hedef</span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[#557fa5]" style={{ width: `${Math.max(4, Number(data.progress || 0))}%` }}/>
        </div>
        <p className="mt-2 text-[10px] text-[#71879a]">{data.completedSessions || 0}/{data.totalSessions || 0} çalışma tamamlandı · %{data.progress || 0}</p>
      </div>

      <a
        href={`/special-work?program=${encodeURIComponent(data.program.id)}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#385a78] px-6 text-sm font-bold text-white transition hover:bg-[#2d4b66]"
      >
        <BrainCircuit size={18}/> Bugünkü çalışmayı aç <ArrowRight size={17}/>
      </a>
    </div>
  </section>;
}
