'use client';

import { useEffect, useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronUp } from 'lucide-react';

type Assignment = {
  id: string;
  module_code: string;
  module_name: string;
  name: string;
  expires_at?: string | null;
  session_count?: number;
  last_completed_at?: string | null;
};

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

  if (!loaded || !items.length) return null;

  return <section className="fixed bottom-4 right-4 z-[70] w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-[#b9daca] bg-white shadow-2xl">
    <button type="button" onClick={() => setOpen(value => !value)} className="flex w-full items-center gap-3 bg-[#edf8f2] px-4 py-3 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#226f60] text-white"><BookOpenCheck size={20}/></span>
      <span className="min-w-0 flex-1"><b className="block text-sm text-[#18372f]">Eğitimcinin atadığı çalışmalar</b><span className="text-xs text-[#55766b]">{items.length} aktif çalışma</span></span>
      {open ? <ChevronDown size={18}/> : <ChevronUp size={18}/>} 
    </button>
    {open && <div className="max-h-[52vh] space-y-3 overflow-y-auto p-4">
      {items.map(item => <div key={item.id} className="rounded-xl border border-border p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{item.module_name || item.module_code}</p>
        <h3 className="mt-1 font-semibold">{item.name}</h3>
        <p className="mt-2 text-xs text-muted-foreground">{Number(item.session_count || 0) > 0 ? `${item.session_count} seans kaydı var` : 'Henüz başlanmadı'}</p>
        <a className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/80" href={`/assignment?recipe=${encodeURIComponent(item.id)}`}>Çalışmayı aç</a>
      </div>)}
    </div>}
  </section>;
}
