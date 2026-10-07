'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, ChevronDown, Clock3, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LearningTimelineEvent } from '@/lib/persistence/learning-timeline';

type TimelinePage = { events: LearningTimelineEvent[]; hasMore: boolean; nextCursor: string | null };
const EVENT_LABELS: Record<LearningTimelineEvent['eventType'], string> = {
  ASSIGNMENT_AVAILABLE: 'Çalışma atandı', WORK_STARTED: 'Çalışma başladı',
  WORK_RESUMED: 'Çalışmaya devam edildi', WORK_COMPLETED: 'Çalışma tamamlandı',
  LEARNING_RESULT: 'Sonuç kaydedildi', ERROR_OBSERVED: 'Hata gözlendi',
  SKILL_EVIDENCE: 'Beceri kanıtı',
};
const ASSIGNMENT_LABELS = {
  ASSIGNMENT_CREATED: 'Ödev oluşturuldu', ASSIGNMENT_STARTED: 'Ödev başlatıldı',
  ASSIGNMENT_COMPLETED: 'Ödev tamamlandı', ASSIGNMENT_CANCELLED: 'Ödev iptal edildi',
} as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date(value));
}

function summary(event: LearningTimelineEvent) {
  if (typeof event.errorSummary?.errorType === 'string') return `Hata: ${event.errorSummary.errorType}`;
  if (typeof event.skillSummary?.skillCode === 'string') return `Beceri: ${event.skillSummary.skillCode}`;
  const attemptCount = event.resultSummary?.attemptCount;
  const correctCount = event.resultSummary?.correctCount;
  if (event.verificationStatus !== 'server_verified' && typeof attemptCount === 'number') {
    return `Bildirilen: ${typeof correctCount === 'number' ? correctCount : 0}/${attemptCount} doğru`;
  }
  return event.status;
}

function Provenance({ event }: { event: LearningTimelineEvent }) {
  const verified = event.verificationStatus === 'server_verified';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
    verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
  }`}>
    {verified ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
    {verified ? 'Doğrulanmış kanıt' : 'Kaydedilen sonuç'}
  </span>;
}

export function LearningTimeline({ endpoint, title = 'Öğrenme Geçmişi' }: { endpoint: string; title?: string }) {
  const [events, setEvents] = useState<LearningTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor: string | null, replace: boolean, signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await fetch(`${endpoint}${cursor ? `${separator}cursor=${encodeURIComponent(cursor)}` : ''}`, {
        cache: 'no-store', signal,
      });
      const data = await response.json() as { ok?: boolean; timeline?: TimelinePage };
      if (!response.ok || data.ok !== true || !data.timeline) throw new Error('timeline_unavailable');
      setEvents((current) => replace ? data.timeline!.events : [...current, ...data.timeline!.events]);
      setNextCursor(data.timeline.nextCursor); setHasMore(data.timeline.hasMore);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError('Öğrenme geçmişi şu anda yüklenemedi.');
      }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => void load(null, true, controller.signal), 0);
    return () => { window.clearTimeout(task); controller.abort(); };
  }, [load]);

  const dayGroups = events.reduce<Array<{ day: string; events: LearningTimelineEvent[] }>>((groups, event) => {
    const day = dayLabel(event.occurredAt);
    const current = groups.at(-1);
    if (current?.day === day) current.events.push(event);
    else groups.push({ day, events: [event] });
    return groups;
  }, []);

  return <section className="rounded-3xl border border-[#dce5e0] bg-white p-5 shadow-sm sm:p-6" aria-labelledby="learning-timeline-heading">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-bold uppercase tracking-[.1em] text-[#a2602c]">Canonical zaman çizelgesi</p><h3 id="learning-timeline-heading" className="mt-2 text-2xl font-black">{title}</h3></div>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#697983]"><Clock3 size={17} /> En yeni olay önce</span>
    </div>
    {error ? <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}
    <div className="mt-5 space-y-6">
      {dayGroups.map((group) => <section key={group.day} aria-label={group.day}>
        <h4 className="mb-3 text-base font-black text-[#3f5d58]">{group.day}</h4>
        <div className="space-y-3">{group.events.map((event) => <details key={event.eventId} className="group rounded-2xl border border-[#dfe7e3] p-4 open:bg-[#f8fbf9]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-black text-[#243d3a]">{event.title}</p><p className="mt-1 text-sm text-[#65777e]">{event.assignmentLifecycle ? ASSIGNMENT_LABELS[event.assignmentLifecycle] : EVENT_LABELS[event.eventType]} · {event.moduleCode}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Provenance event={event} /><ChevronDown size={17} className="transition group-open:rotate-180" /></div>
        </summary>
        <div className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
          <p className="inline-flex items-center gap-2"><CalendarClock size={16} /> {dateLabel(event.occurredAt)}</p>
          <p><b>Kısa sonuç:</b> {summary(event)}</p>
          {event.supportLevel ? <p><b>Destek:</b> {event.supportLevel}</p> : null}
          <p><b>Kaynak:</b> {event.sourceReference}</p>
        </div>
        </details>)}</div>
      </section>)}
      {!loading && !events.length && !error ? <p className="rounded-2xl bg-[#f7f9f8] p-5 text-sm text-[#687982]">Henüz çalışma geçmişi oluşmadı.</p> : null}
      {loading ? <output className="flex items-center justify-center gap-2 py-5 text-sm"><Loader2 className="animate-spin" size={17} /> Geçmiş yükleniyor…</output> : null}
    </div>
    {hasMore && nextCursor && !loading ? <Button variant="outline" className="mt-5 min-h-11 w-full sm:w-auto" onClick={() => void load(nextCursor, false)}><ChevronDown size={17} /> Daha fazla yükle</Button> : null}
  </section>;
}
