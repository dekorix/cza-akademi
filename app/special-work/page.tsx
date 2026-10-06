'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock3, Loader2, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DailyWork = {
  sessionIndex: number;
  totalSessions: number;
  week: number;
  sessionInWeek: number;
  title: string;
  focus: string;
  minutes: number;
  priorityKeys: string[];
  activities: {
    priorityKey: string;
    label: string;
    activity: string;
    successCriterion: string;
  }[];
  educatorHint: string;
  measurement: string;
  isReassessment: boolean;
};

type Data = {
  ok?: boolean;
  error?: string;
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
  today?: DailyWork | null;
  activeSession?: null | {
    id: string;
    session_index: number;
    plan_snapshot: DailyWork;
  };
};

function friendlyError(code: string) {
  if (code === 'session_required') return 'Çalışmaya devam etmek için öğrenci oturumunu yeniden aç.';
  if (code === 'special_program_not_found') return 'Aktif bireysel çalışma programı bulunamadı.';
  if (code === 'special_program_activities_incomplete') return 'Önce bugünkü bütün hedefleri tamamladığını işaretle.';
  if (code === 'special_program_already_complete') return 'Bu program tamamlandı. Eğitimcin yeniden ölçüm planını açacak.';
  if (code === 'special_program_session_not_found') return 'Açık çalışma oturumu bulunamadı. Çalışma merkezine dönüp yeniden aç.';
  return 'Çalışma şu anda kaydedilemedi.';
}

export default function SpecialWorkPage() {
  const [data, setData] = useState<Data | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [programCompleted, setProgramCompleted] = useState(false);

  const programId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('program') || '';
  }, []);

  useEffect(() => {
    if (!programId) return;
    let active = true;
    void fetch(`/api/core/special-program?program=${encodeURIComponent(programId)}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json() as Data;
        if (!response.ok || body.ok !== true) throw new Error(body.error || 'load_failed');
        if (!active) return;
        setData(body);
        if (body.activeSession?.id) setSessionId(String(body.activeSession.id));
      })
      .catch(error => { if (active) setMessage(friendlyError(error instanceof Error ? error.message : 'load_failed')); });
    return () => { active = false; };
  }, [programId]);

  const today = data?.activeSession?.plan_snapshot || data?.today || null;
  const allChecked = Boolean(today?.priorityKeys?.length) && today!.priorityKeys.every(key => checked.includes(key));

  async function start() {
    if (!data?.program || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/core/special-program', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', programId: data.program.id }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; session?: { id?: string; plan_snapshot?: DailyWork }; today?: DailyWork };
      if (!response.ok || body.ok !== true || !body.session?.id) throw new Error(body.error || 'start_failed');
      setSessionId(String(body.session.id));
      setData(current => current ? { ...current, activeSession: { id: String(body.session!.id), session_index: body.today?.sessionIndex || current.today?.sessionIndex || 1, plan_snapshot: body.today || body.session!.plan_snapshot || current.today! } } : current);
    } catch (error) {
      setMessage(friendlyError(error instanceof Error ? error.message : 'start_failed'));
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!sessionId || !today || !allChecked || !reflection || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/core/special-program', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          sessionId,
          reflection,
          note,
          completedPriorityKeys: checked,
        }),
      });
      const body = await response.json() as {
        ok?: boolean;
        error?: string;
        progress?: number;
        completedSessions?: number;
        totalSessions?: number;
        programCompleted?: boolean;
      };
      if (!response.ok || body.ok !== true) throw new Error(body.error || 'complete_failed');
      setDone(true);
      setProgramCompleted(Boolean(body.programCompleted));
      setData(current => current ? {
        ...current,
        progress: body.progress,
        completedSessions: body.completedSessions,
        totalSessions: body.totalSessions,
      } : current);
    } catch (error) {
      setMessage(friendlyError(error instanceof Error ? error.message : 'complete_failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!programId) return <main className="grid min-h-screen place-items-center bg-background p-6"><p className="rounded-xl border bg-white p-5 text-sm font-semibold">Program bağlantısı eksik.</p></main>;
  if (!data && !message) return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="text-center"><Loader2 className="mx-auto animate-spin text-[#385a78]"/><p className="mt-4 text-sm font-semibold">Bugünkü çalışma hazırlanıyor…</p></div></main>;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-3xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezine dön</a>

      {message && <p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{message}</p>}

      {data?.program && today && !done && <section className="mt-5 overflow-hidden rounded-3xl border border-[#d4e0ec] bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#385a78,#557fa5)] p-6 text-white md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black tracking-[.12em]">{today.isReassessment ? 'YENİDEN ÖLÇÜM' : 'BUGÜNKÜ ÇALIŞMAM'}</span>
            <span className="text-xs text-[#dce8f2]">{data.program.profileLabel}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold">{today.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#e8f0f6]">{today.focus}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-[#e8f0f6]">
            <span className="inline-flex items-center gap-1.5"><Clock3 size={15}/>{today.minutes} dakika</span>
            <span className="inline-flex items-center gap-1.5"><Target size={15}/>{today.activities.length} hedef</span>
            <span>{data.completedSessions || 0}/{data.totalSessions || today.totalSessions} tamamlandı</span>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {!sessionId && <div className="rounded-2xl border border-[#dce5ee] bg-[#f8fafc] p-5">
            <h2 className="font-semibold">Hazır olduğunda başla</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Acele etmene gerek yok. Her hedefi sırayla yap, bittikçe işaretle.</p>
            <Button onClick={start} disabled={busy} className="mt-5 h-12 w-full bg-[#385a78] text-base hover:bg-[#2d4b66]">
              {busy ? <><Loader2 className="animate-spin"/> Açılıyor…</> : <><Sparkles/> Çalışmayı başlat</>}
            </Button>
          </div>}

          {sessionId && <>
            <div className="space-y-4">
              {today.activities.map((activity, index) => {
                const active = checked.includes(activity.priorityKey);
                return <button key={activity.priorityKey} type="button" onClick={() => setChecked(current => active ? current.filter(key => key !== activity.priorityKey) : [...current, activity.priorityKey])}
                  className={`w-full rounded-2xl border p-5 text-left transition ${active ? 'border-[#8bb5a4] bg-[#edf8f2]' : 'border-[#dce4ed] bg-white'}`}>
                  <div className="flex gap-4">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-black ${active ? 'border-[#4d8976] bg-[#4d8976] text-white' : 'border-[#b8c7d4] text-[#71879a]'}`}>
                      {active ? <Check size={16}/> : index + 1}
                    </span>
                    <div>
                      <p className="text-[10px] font-black tracking-[.1em] text-[#6f879b]">{activity.label.toLocaleUpperCase('tr-TR')}</p>
                      <h3 className="mt-1 text-base font-semibold">{activity.activity}</h3>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">Hedef: {activity.successCriterion}</p>
                    </div>
                  </div>
                </button>;
              })}
            </div>

            <div className="mt-7 rounded-2xl border border-[#dbe5ee] bg-[#f8fafc] p-5">
              <h2 className="font-semibold">Bugün sana nasıl geldi?</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ['EASY','Kolaydı'],
                  ['OKAY','İyiydi'],
                  ['HARD','Zordu'],
                ].map(([value,label]) => <button key={value} type="button" onClick={() => setReflection(value)}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${reflection === value ? 'border-[#557fa5] bg-[#eef4fb] text-[#385a78]' : 'border-border bg-white'}`}>{label}</button>)}
              </div>
              <label className="mt-5 block text-sm font-semibold">
                İstersen kısa bir not bırak
                <textarea value={note} onChange={event => setNote(event.target.value.slice(0,500))}
                  className="mt-2 min-h-20 w-full resize-none rounded-xl border border-border bg-white p-3 text-sm font-normal"
                  placeholder="Örneğin: Harflerde biraz zorlandım."/>
              </label>
            </div>

            <Button onClick={complete} disabled={!allChecked || !reflection || busy} className="mt-6 h-12 w-full bg-[#276151] text-base hover:bg-[#204f43]">
              {busy ? <><Loader2 className="animate-spin"/> Kaydediliyor…</> : 'Bugünkü çalışmayı tamamla'}
            </Button>
            {(!allChecked || !reflection) && <p className="mt-3 text-center text-xs text-muted-foreground">Tamamlamak için bütün hedefleri işaretle ve bugünkü deneyimini seç.</p>}
          </>}
        </div>
      </section>}

      {done && <section className="mt-5 rounded-3xl border border-[#b9daca] bg-[#edf8f2] p-8 text-center text-[#276151] shadow-sm">
        <CheckCircle2 className="mx-auto" size={42}/>
        <h1 className="mt-4 text-2xl font-semibold">{programCompleted ? '4 haftalık program tamamlandı!' : 'Bugünkü çalışma tamamlandı!'}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6">
          {programCompleted
            ? 'Çalışma kayıtların merkezi dosyana işlendi. Şimdi eğitimcin başlangıç değerlendirmesiyle karşılaştırmalı yeniden ölçümü planlayacak.'
            : 'Çalışman güvenli öğrenci kaydına işlendi. Bir sonraki oturum zamanı geldiğinde yeni paket burada görünecek.'}
        </p>
        <a href="/work" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#276151] px-5 text-sm font-semibold text-white">Çalışma merkezine dön</a>
      </section>}
    </div>
  </main>;
}
