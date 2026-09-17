'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CalendarDays, ChevronRight, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Provenance = 'SERVER_AUTHORITATIVE' | 'CLIENT_REPORTED' | 'MIXED';
type Report = {
  summary: {
    assignments: null | { total:number;active:number;completed:number;cancelled:number;provenance:Provenance };
    sessions: null | { total:number;completed:number;lastActivityAt:string|null;provenance:Provenance };
    clientPerformance: null | { attempts:number;correct:number;wrong:number;accuracy:number|null;evidenceStatus:string;provenance:Provenance };
  };
  modules:Array<{moduleCode:string;assignmentCount:number|null;sessionCount:number|null;completedSessions:number|null;attemptCount:number|null;clientReportedAccuracy:number|null;provenance:Provenance}>;
  errors:Array<{errorType:string;count:number;provenance:Provenance}>;
  evidence:Array<{id:string;type:string;moduleCode:string;skillCode:string|null;observedAt:string;verificationStatus:string;verificationAuthority:string|null;provenance:Provenance}>;
  trend:Array<{day:string;sessions:number|null;completions:number|null;attempts:number|null;clientReportedAccuracy:number|null;provenance:Provenance}>;
  sessions:Array<{id:string;assignmentId:string|null;moduleCode:string;status:string;startedAt:string;completedAt:string|null;lastActivityAt:string;provenance:Provenance}>;
  nextCursor:string|null;
};

const labels:Record<Provenance,string>={SERVER_AUTHORITATIVE:'Sunucu kaydı',CLIENT_REPORTED:'İstemci bildirimi',MIXED:'Karma kaynak'};
function Badge({value}:{value:Provenance}) {
  const tone=value==='SERVER_AUTHORITATIVE'?'bg-emerald-100 text-emerald-800':value==='CLIENT_REPORTED'?'bg-amber-100 text-amber-900':'bg-sky-100 text-sky-900';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{value==='SERVER_AUTHORITATIVE'?<ShieldCheck size={12}/>:<TriangleAlert size={12}/>} {labels[value]}</span>;
}
function date(value:string|null){return value?new Date(value).toLocaleString('tr-TR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Yeterli kayıt yok';}

export function EducatorAnalytics({studentId}:{studentId:string}) {
  const [report,setReport]=useState<Report|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [moduleCode,setModuleCode]=useState('');
  const [assignmentStatus,setAssignmentStatus]=useState(''); const [sessionStatus,setSessionStatus]=useState(''); const [provenance,setProvenance]=useState('');
  const load=useCallback(async(cursor='')=>{
    setLoading(true);setError('');
    const params=new URLSearchParams({studentId,limit:'12'});
    if(from)params.set('from',new Date(`${from}T00:00:00`).toISOString()); if(to)params.set('to',new Date(`${to}T23:59:59.999`).toISOString());
    if(moduleCode)params.set('module',moduleCode);if(assignmentStatus)params.set('assignmentStatus',assignmentStatus);
    if(sessionStatus)params.set('sessionStatus',sessionStatus);if(provenance)params.set('provenance',provenance);if(cursor)params.set('cursor',cursor);
    try{const response=await fetch(`/api/educator-analytics?${params}`,{cache:'no-store'});const data=await response.json();
      if(!response.ok||data.ok!==true)throw new Error(response.status===403?'Bu öğrenci raporuna erişim yetkin yok.':'Rapor alınamadı.');
      const incoming=data.report as Report;setReport(current=>cursor&&current?{...incoming,sessions:[...current.sessions,...incoming.sessions]}:incoming);
    }catch(reason){setError(reason instanceof Error?reason.message:'Rapor alınamadı.');}finally{setLoading(false);}
  },[studentId,from,to,moduleCode,assignmentStatus,sessionStatus,provenance]);
  useEffect(()=>{const task=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(task);},[load]);
  const a=report?.summary.assignments,s=report?.summary.sessions,p=report?.summary.clientPerformance;
  return <section className="rounded-3xl border border-[#d8e6df] bg-[#f7faf8] p-4 shadow-sm sm:p-6" aria-label="Öğrenci analitik raporu">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#527668]">U6 · Gerçek öğrenci analitiği</p><h3 className="mt-1 text-xl font-bold text-[#18372f]">Rapor ve gelişim görünümü</h3><p className="mt-2 max-w-3xl text-sm text-[#5f746c]">Sunucu kayıtları ile öğrenci cihazından bildirilen sonuçlar ayrı güven sınıflarında sunulur.</p></div><BarChart3 className="text-[#276151]"/></div>
    <form className="mt-5 grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-3 xl:grid-cols-6" onSubmit={e=>{e.preventDefault();void load();}}>
      <label htmlFor="u6-from" className="text-xs font-semibold">Başlangıç<Input id="u6-from" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-2"/></label>
      <label htmlFor="u6-to" className="text-xs font-semibold">Bitiş<Input id="u6-to" type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-2"/></label>
      <label className="text-xs font-semibold">Modül<select value={moduleCode} onChange={e=>setModuleCode(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3"><option value="">Tümü</option>{['arithmetic','finger_read','finger_press','soroban_read','soroban_write','flash_anzan','audio_anzan'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-xs font-semibold">Ödev durumu<select value={assignmentStatus} onChange={e=>setAssignmentStatus(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3"><option value="">Tümü</option><option value="active">Aktif</option><option value="upcoming">Yaklaşan</option><option value="completed">Tamamlanan</option><option value="cancelled">İptal</option></select></label>
      <label className="text-xs font-semibold">Oturum durumu<select value={sessionStatus} onChange={e=>setSessionStatus(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3"><option value="">Tümü</option><option value="active">Aktif</option><option value="completed">Tamamlanan</option><option value="aborted">Yarım kalan</option></select></label>
      <label className="text-xs font-semibold">Kaynak<select value={provenance} onChange={e=>setProvenance(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3"><option value="">Tümü</option><option value="SERVER_AUTHORITATIVE">Sunucu</option><option value="CLIENT_REPORTED">İstemci</option><option value="MIXED">Karma</option></select></label>
      <Button className="md:col-span-3 xl:col-span-6" disabled={loading}>{loading?'Rapor hazırlanıyor…':'Filtreleri uygula'}</Button>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {report&&<>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {a&&<article className="rounded-2xl bg-white p-4"><Badge value={a.provenance}/><b className="mt-4 block text-3xl text-[#18372f]">{a.total}</b><p className="text-sm">Toplam ödev</p><p className="mt-2 text-xs text-muted-foreground">{a.active} aktif · {a.completed} tamamlandı · {a.cancelled} iptal</p></article>}
        {s&&<article className="rounded-2xl bg-white p-4"><Badge value={s.provenance}/><b className="mt-4 block text-3xl text-[#18372f]">{s.total}</b><p className="text-sm">Oturum</p><p className="mt-2 text-xs text-muted-foreground">{s.completed} tamamlandı · Son: {date(s.lastActivityAt)}</p></article>}
        {p&&<article className="rounded-2xl bg-white p-4"><Badge value={p.provenance}/><b className="mt-4 block text-3xl text-[#18372f]">{p.accuracy===null?'—':`%${p.accuracy}`}</b><p className="text-sm">Bildirilen doğruluk</p><p className="mt-2 text-xs text-muted-foreground">{p.attempts?p.attempts+' istemci attempt kaydı':'Yeterli attempt kanıtı yok; %0 değildir.'}</p></article>}
        <article className="rounded-2xl bg-[#18372f] p-4 text-white"><CalendarDays/><b className="mt-4 block text-3xl">{report.trend.length}</b><p className="text-sm">Kayıt bulunan gün</p><p className="mt-2 text-xs text-[#c8ddd4]">Otomatik “gelişti/geriledi” hükmü üretilmez.</p></article>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-5"><h4 className="font-bold">Modül dağılımı</h4><div className="mt-4 space-y-3">{report.modules.map(m=><article key={m.moduleCode} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><b>{m.moduleCode}</b><Badge value={m.provenance}/></div><p className="mt-2 text-xs text-muted-foreground">Ödev {m.assignmentCount??'—'} · Oturum {m.sessionCount??'—'} · Attempt {m.attemptCount??'—'} · İstemci doğruluğu {m.clientReportedAccuracy===null?'yetersiz':`%${m.clientReportedAccuracy}`}</p></article>)}{!report.modules.length&&<p className="text-sm text-muted-foreground">Filtreye uygun modül kaydı yok.</p>}</div></section>
        <section className="rounded-2xl bg-white p-5"><h4 className="font-bold">Hata örüntüleri</h4><div className="mt-4 space-y-3">{report.errors.map(e=><article key={e.errorType} className="flex items-center justify-between rounded-xl border p-3"><div><b className="text-sm">{e.errorType}</b><p className="text-xs text-muted-foreground">{e.count} istemci bildirimi</p></div><Badge value={e.provenance}/></article>)}{!report.errors.length&&<p className="text-sm text-muted-foreground">Hata kanıtı yok veya filtre dışı.</p>}</div></section>
      </div>
      <section className="mt-5 rounded-2xl bg-white p-5"><h4 className="font-bold">Evidence ve güven kaynağı</h4><div className="mt-4 grid gap-3 md:grid-cols-2">{report.evidence.map(e=><article key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><b>{e.type}</b><Badge value={e.provenance}/></div><p className="mt-2 text-xs text-muted-foreground">{e.moduleCode} · {e.skillCode||'Genel kanıt'} · {date(e.observedAt)}</p></article>)}{!report.evidence.length&&<p className="text-sm text-muted-foreground">Filtreye uygun evidence kaydı yok.</p>}</div></section>
      <section className="mt-5 rounded-2xl bg-white p-5"><h4 className="font-bold">Zaman içindeki kayıtlar</h4><div className="mt-4 overflow-x-auto"><table className="min-w-[680px] w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Gün</th><th>Oturum</th><th>Tamamlanma</th><th>Attempt</th><th>İstemci doğruluğu</th><th>Kaynak</th></tr></thead><tbody>{report.trend.map(t=><tr key={t.day} className="border-b"><td className="p-3">{date(t.day)}</td><td>{t.sessions??'—'}</td><td>{t.completions??'—'}</td><td>{t.attempts??'—'}</td><td>{t.clientReportedAccuracy===null?'Yetersiz':`%${t.clientReportedAccuracy}`}</td><td><Badge value={t.provenance}/></td></tr>)}</tbody></table></div></section>
      <section className="mt-5 rounded-2xl bg-white p-5"><h4 className="font-bold">Bounded oturum geçmişi</h4><div className="mt-4 grid gap-3 md:grid-cols-2">{report.sessions.map(x=><article key={x.id} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><b>{x.moduleCode}</b><Badge value={x.provenance}/></div><p className="mt-2 text-sm">{x.status} · {date(x.lastActivityAt)}</p><p className="mt-1 break-all text-xs text-muted-foreground">{x.id}</p></article>)}</div>{report.nextCursor&&<Button variant="outline" className="mt-4 w-full" onClick={()=>void load(report.nextCursor!)} disabled={loading}>Daha eski oturumları getir <ChevronRight/></Button>}</section>
    </>}
  </section>;
}
