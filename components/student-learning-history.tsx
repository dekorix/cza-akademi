'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LearningRecord = {
  id: string;
  training_session_id: string;
  module_code: string;
  module_version: string;
  activity_type: string;
  started_at: string;
  completed_at: string;
  support_level: string;
  performance?: Record<string, unknown> | null;
  skills?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type HistoryResponse = {
  ok: true;
  summary: {
    totalRecords: number;
    moduleCount: number;
    totalDurationMs: number;
    latestCompletedAt: string | null;
  };
  records: LearningRecord[];
};

const labels: Record<string, string> = {
  flash_anzan: 'Flash Anzan',
  audio_anzan: 'Sesli Anzan',
  soroban_read: 'Soroban Okuma',
  soroban_write: 'Soroban Yazma',
  finger_read: 'Parmak Okuma',
  finger_press: 'Parmak Basma',
  arithmetic: 'Toplama / Çıkarma',
};

function metric(record: LearningRecord, key: string) {
  const value = record.performance?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function durationLabel(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60000);
  if (minutes < 1) return '1 dk altı';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`;
}

export function StudentLearningHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void fetch('/api/student-history', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json() as Record<string, unknown>;
        if (!response.ok || body.ok !== true) {
          throw new Error(typeof body.error === 'string' ? body.error : 'learning_history_unavailable');
        }
        if (!controller.signal.aborted) setData(body as unknown as HistoryResponse);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          const code = reason instanceof Error ? reason.message : 'learning_history_unavailable';
          setError(code === 'session_required'
            ? 'Oturumun sona erdi. Öğrenci paneline yeniden giriş yap.'
            : 'Gelişim geçmişin şu anda getirilemedi.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const recent = useMemo(() => data?.records.slice(0, 8) || [], [data]);

  return <section id="development" className="scroll-mt-6 rounded-xl border border-border bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow text-primary">Tek öğrenci · gerçek geçmiş</p>
        <h2 className="mt-1 font-semibold">Çaban gelişime dönüşüyor</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Tamamlanan çalışmaların CZA'nın merkezî öğrenme kaydından okunur. Sayfayı yenilesen de geçmişin burada kalır.</p>
      </div>
      <span className="rounded-full border border-[#b9daca] bg-[#edf8f2] px-3 py-1 text-[11px] font-semibold text-[#276151]">Canonical Learning Record</span>
    </div>

    {loading ? <div className="mt-6 flex items-center gap-2 rounded-xl bg-secondary/40 p-5 text-sm text-muted-foreground"><Loader2 size={17} className="animate-spin"/> Gelişim geçmişin getiriliyor…</div> :
      error ? <div className="mt-6 rounded-xl bg-red-50 p-5"><p role="alert" className="text-sm text-red-800">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setRetry(value => value + 1)}><RotateCcw size={15}/> Yeniden dene</Button></div> :
      data ? <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#edf8f2] p-4"><b className="text-2xl text-[#276151]">{data.summary.totalRecords}</b><p className="mt-1 text-[11px] text-[#4c7468]">Tamamlanan çalışma</p></div>
          <div className="rounded-xl bg-[#eef4fb] p-4"><b className="text-2xl text-[#315a83]">{data.summary.moduleCount}</b><p className="mt-1 text-[11px] text-[#58708a]">Çalışılan atölye</p></div>
          <div className="rounded-xl bg-[#fbf7ee] p-4"><b className="text-2xl text-[#8a673d]">{durationLabel(data.summary.totalDurationMs)}</b><p className="mt-1 text-[11px] text-[#8a734e]">Toplam çalışma süresi</p></div>
        </div>

        {recent.length ? <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Son çalışmalarım</h3><span className="text-[10px] text-muted-foreground">Son {recent.length} kayıt</span></div>
          {recent.map(record => {
            const total = metric(record, 'total');
            const correct = metric(record, 'correct');
            const accuracy = metric(record, 'accuracy');
            const elapsed = Math.max(0, Date.parse(record.completed_at) - Date.parse(record.started_at));
            return <article key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="min-w-[190px]">
                <p className="font-semibold">{labels[record.module_code] || record.module_code}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(record.completed_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1"><Clock3 size={13}/>{durationLabel(elapsed)}</span>
                {total != null && <span className="rounded-full bg-secondary/60 px-3 py-1">{Math.round(total)} soru</span>}
                {correct != null && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-800"><CheckCircle2 size={13}/>{Math.round(correct)} doğru</span>}
                {accuracy != null && <span className="rounded-full bg-[#eef4fb] px-3 py-1 text-[#315a83]">%{Math.round(accuracy)}</span>}
              </div>
            </article>;
          })}
        </div> : <p className="mt-6 rounded-xl bg-secondary/40 p-5 text-sm leading-6 text-muted-foreground">Henüz canonical geçmiş kaydı yok. Egzersiz Stüdyosunda tamamlayacağın ilk çalışma burada görünecek.</p>}
      </> : null}
  </section>;
}
