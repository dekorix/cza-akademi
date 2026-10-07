'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, CalendarClock, ClipboardPlus, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Assignment = {
  id: string; module_code: string; name: string; instructions: string | null;
  starts_at: string | null; expires_at: string | null; status: string;
  session_count: number; completed_count: number;
};

const MODULES = [
  ['finger_read', 'Parmak okuma'], ['soroban_read', 'Soroban okuma'],
  ['soroban_write', 'Soroban yazma'], ['flash_anzan', 'Flash Anzan'],
  ['audio_anzan', 'Sesli Anzan'],
] as const;

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif', upcoming: 'Yaklaşan', completed: 'Tamamlandı',
  cancelled: 'İptal edildi', expired: 'Süresi doldu',
};

function localDate(value: string | null) {
  return value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sınır yok';
}

export function EducatorAssignmentManager({ studentId, onChanged }: { studentId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [moduleCode, setModuleCode] = useState('finger_read');
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [rounds, setRounds] = useState('10');
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef('');

  const load = useCallback(async () => {
    const response = await fetch('/api/educator-assignments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'list', studentId, moduleCode: moduleCode || undefined, status: status || undefined }),
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error('Ödevler alınamadı.');
    setItems(data.assignments);
  }, [moduleCode, status, studentId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load().catch(() => setMessage('Ödevler alınamadı.')), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  function reset() {
    setEditingId(''); setTitle(''); setInstructions(''); setStartsAt(''); setExpiresAt(''); setRounds('10'); requestId.current = '';
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const response = await fetch('/api/educator-assignments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editingId ? {
          action: 'update', studentId, assignmentId: editingId, title, instructions,
          startsAt: startsAt || null, expiresAt: expiresAt || null,
        } : {
          action: 'create', studentId, moduleCode, title: title || null, instructions,
          startsAt: startsAt || null, expiresAt: expiresAt || null,
          settings: { rounds: Number(rounds) }, clientRequestId: requestId.current,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error === 'active_assignment_exists' ? 'Bu modülde zaten etkin bir ödev var.' : 'Ödev kaydedilemedi.');
      setMessage(editingId ? 'Ödev güncellendi.' : 'Ödev oluşturuldu.');
      reset(); await load(); onChanged?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Ödev kaydedilemedi.'); }
    finally { setBusy(false); }
  }

  async function cancel(id: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/educator-assignments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', studentId, assignmentId: id }),
      });
      if (!response.ok) throw new Error('Ödev iptal edilemedi.');
      setMessage('Ödev iptal edildi; geçmiş kaydı korundu.'); await load(); onChanged?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Ödev iptal edilemedi.'); }
    finally { setBusy(false); }
  }

  return <section className="rounded-3xl border border-[#dce5e0] bg-white p-5 shadow-sm sm:p-6" aria-labelledby="assignment-manager-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-bold uppercase tracking-[.1em] text-[#276151]">U5 · Güvenli ödevlendirme</p><h3 id="assignment-manager-title" className="mt-2 text-2xl font-black">Ödev yönetimi</h3></div>
      <span className="rounded-full bg-[#edf7f2] px-3 py-1.5 text-sm font-bold text-[#276151]">{items.length} kayıt</span>
    </div>
    {message ? <output className="mt-4 block rounded-xl bg-[#f5f8f6] p-3 text-sm">{message}</output> : null}
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-2xl border bg-[#fbfdfc] p-4 md:grid-cols-2">
      <label htmlFor="u5-module" className="text-sm font-bold">Modül<select id="u5-module" disabled={Boolean(editingId)} value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3">{MODULES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="u5-title" className="text-sm font-bold">Çalışma adı<Input id="u5-title" className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="Örn. Haftalık soroban çalışması" /></label>
      <label htmlFor="u5-start" className="text-sm font-bold">Başlangıç<Input id="u5-start" className="mt-2" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
      <label htmlFor="u5-due" className="text-sm font-bold">Son tarih<Input id="u5-due" className="mt-2" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
      {!editingId ? <label htmlFor="u5-rounds" className="text-sm font-bold">Çalışma adedi<Input id="u5-rounds" className="mt-2" type="number" min="1" max="100" value={rounds} onChange={(e) => setRounds(e.target.value)} /></label> : null}
      <label htmlFor="u5-instructions" className="text-sm font-bold md:col-span-2">Eğitmen talimatı<textarea id="u5-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border bg-white p-3 font-normal" placeholder="Öğrenciye kısa ve açık yönerge" /></label>
      <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={busy} type="submit"><ClipboardPlus size={17} /> {editingId ? 'Değişiklikleri kaydet' : 'Ödev oluştur'}</Button>{editingId ? <Button type="button" variant="outline" onClick={reset}>Vazgeç</Button> : null}</div>
    </form>
    <div className="mt-6 flex flex-wrap gap-3">
      <label htmlFor="u5-status" className="text-sm font-bold">Durum<select id="u5-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ml-2 min-h-10 rounded-lg border bg-white px-3"><option value="">Tümü</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <Button type="button" variant="outline" size="sm" onClick={() => void load()}><RefreshCw size={15} /> Yenile</Button>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.id} data-assignment-id={item.id} className="rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3"><div><h4 className="font-black">{item.name}</h4><p className="mt-1 text-sm text-muted-foreground">{MODULES.find(([code]) => code === item.module_code)?.[1] || item.module_code}</p></div><span className="rounded-full bg-[#edf7f2] px-2.5 py-1 text-xs font-bold">{STATUS_LABELS[item.status] || item.status}</span></div>
      {item.instructions ? <p className="mt-3 text-sm">{item.instructions}</p> : null}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock size={15} /> {localDate(item.starts_at)} → {localDate(item.expires_at)}</p>
      <p className="mt-2 text-xs text-muted-foreground">Oturum: {item.session_count} · Tamamlanan: {item.completed_count}</p>
      {item.status !== 'cancelled' && item.status !== 'completed' ? <div className="mt-4 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingId(item.id); setModuleCode(item.module_code); setTitle(item.name); setInstructions(item.instructions || ''); setStartsAt(item.starts_at?.slice(0, 16) || ''); setExpiresAt(item.expires_at?.slice(0, 16) || ''); }}><Pencil size={15} /> Düzenle</Button><Button type="button" size="sm" variant="outline" onClick={() => void cancel(item.id)}><Ban size={15} /> İptal</Button></div> : null}
    </article>)}{!items.length ? <p className="text-sm text-muted-foreground">Filtreyle eşleşen ödev yok.</p> : null}</div>
  </section>;
}
