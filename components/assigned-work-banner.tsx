'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, Clock3, PlayCircle } from 'lucide-react';

type AssignmentStatus = 'assigned' | 'started' | 'completed';

type Assignment = {
  id: string;
  module_code: string;
  module_name: string;
  name: string;
  expires_at?: string | null;
  session_count?: number;
  completed_count?: number;
  last_completed_at?: string | null;
  latest_learning_record_id?: string | null;
  status?: AssignmentStatus;
};

const statusLabel: Record<AssignmentStatus, string> = {
  assigned: 'Atandı',
  started: 'Başlandı',
  completed: 'Tamamlandı',
};

function StatusIcon({ status }: { status: AssignmentStatus }) {
  if (status === 'completed') return <CheckCircle2 size={14}/>;
  if (status === 'started') return <Clock3 size={14}/>;
  return <PlayCircle size={14}/>;
}

export function AssignedWorkBanner() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/core/assignments', { cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) return { ok: false, assignments: [] };
        return response.json();
      })
      .then(data => {
        if (active && data?.ok === true && Array.isArray(data.assignments)) setItems(data.assignments);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const activeCount = useMemo(() => items.filter(item => item.status !== 'completed').length, [items]);
  const completedCount = items.length - activeCount;

  if (!loaded || !items.length) return null;

  return <section className="fixed bottom-4 right-4 z-[70] w-[min(92vw,440px)] overflow-hidden rounded-2xl border border-[#b9daca] bg-white shadow-2xl">
    <button type="button" onClick={() => setOpen(value => !value)} className="flex w-full items-center gap-3 bg-[#edf8f2] px-4 py-3 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#226f60] text-white"><BookOpenCheck size={20}/></span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm text-[#18372f]">Eğitimcinin atadığı çalışmalar</b>
        <span className="text-xs text-[#55766b]">{activeCount} açık görev{completedCount ? ' · ' + completedCount + ' tamamlandı' : ''}</span>
      </span>
      {open ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
    </button>
    {open && <div className="max-h-[56vh] space-y-3 overflow-y-auto p-4">
      {items.map(item => {
        const status = item.status || (Number(item.completed_count || 0) > 0 ? 'completed' : Number(item.session_count || 0) > 0 ? 'started' : 'assigned');
        return <article key={item.id} className="rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{item.module_name || item.module_code}</p>
              <h3 className="mt-1 font-semibold">{item.name}</h3>
            </div>
            <span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ' + (status === 'completed' ? 'bg-emerald-50 text-emerald-800' : status === 'started' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800')}>
              <StatusIcon status={status}/>{statusLabel[status]}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {status === 'completed'
              ? item.last_completed_at ? 'Tamamlandı · ' + new Date(item.last_completed_at).toLocaleDateString('tr-TR') : 'Tamamlandı'
              : status === 'started' ? 'Çalışmaya başladın, tamamlamayı unutma.' : 'Henüz başlanmadı.'}
          </p>
          {status === 'completed' && item.latest_learning_record_id
            ? <p className="mt-2 text-[10px] text-muted-foreground">Sonuç merkezi öğrenci geçmişine işlendi.</p>
            : null}
          {status === 'completed'
            ? <span className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">Görev tamamlandı</span>
            : <a className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/80" href={'/assignment?recipe=' + encodeURIComponent(item.id)}>{status === 'started' ? 'Çalışmaya devam et' : 'Çalışmayı başlat'}</a>}
        </article>;
      })}
    </div>}
  </section>;
}
