'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusLabel: Record<string,string> = {
  RELATIVE_STRENGTH: 'Göreli güçlü kanıt',
  DEVELOPING: 'Gelişen / karışık profil',
  WATCH_SUPPORT: 'Yakın destekle izlenecek',
  INSUFFICIENT: 'Kanıt yetersiz',
};

type Section = {
  sectionId: string; label: string; assessed: number; independent: number; supported: number; notObserved: number;
  firstMatchRate: number | null; independenceRate: number | null; averageLatencyMs: number | null; status: string;
};
type Report = {
  profileCode: string; ageMonths: number; ageBand: string; assessmentPurpose: string; childAssessed: number;
  sections: Section[]; caregiver: Array<{code:string;category:string;question:string;answer:string}>;
  caregiverCoverage: number; disclaimer: string;
};

async function loadReport(sessionId:string) {
  const response = await fetch('/api/assessment-e3',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'report',sessionId})});
  const data = await response.json();
  if(!response.ok||data.ok===false) throw new Error(data.error||'e3_report_unavailable');
  return data as {session:{student_label?:string;completed_at?:string;metadata?:Record<string,unknown>};report:Report};
}

function pct(value:number|null){ return value==null?'—':`%${Math.round(value*100)}`; }

export default function E3ReportPage(){
  const [sessionId,setSessionId]=useState('');
  const [student,setStudent]=useState('Öğrenci');
  const [report,setReport]=useState<Report|null>(null);
  const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [message,setMessage]=useState('');

  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('session')||'';if(!id)return;setSessionId(id);void open(id)},[]);
  async function open(id=sessionId){if(!id.trim()){setMessage('Oturum kimliği gerekli.');setStatus('error');return;}setStatus('loading');setMessage('');try{const data=await loadReport(id.trim());setStudent(data.session?.student_label||'Öğrenci');setReport(data.report);setStatus('ready')}catch(error){setMessage(error instanceof Error?error.message:'Rapor açılamadı.');setStatus('error')}}

  return <main className="min-h-screen bg-[#f3f7f5] print:bg-white"><header className="print:hidden bg-[#18372f] px-5 text-white md:px-9"><div className="mx-auto flex h-20 max-w-[1380px] items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d8eeac] text-xs font-black text-[#18372f]">CZA</span><div><p className="text-sm font-semibold">36–48 Ay Gelişim Raporu · E3</p><p className="text-[10px] text-[#bad4ca]">ÇOCUK KANITI + BAKIMVEREN KAYNAĞI</p></div></div><a href="/educator" className="flex items-center gap-2 text-xs text-[#d5e8e0]"><ArrowLeft size={15}/> Eğitimci Merkezi</a></div></header><div className="mx-auto max-w-[1380px] px-5 py-8 md:px-9 print:max-w-none print:px-0 print:py-0"><section className="print:hidden mb-7 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-end"><div className="flex-1"><label className="text-sm font-semibold">E3 oturum kimliği</label><input value={sessionId} onChange={e=>setSessionId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"/></div><Button onClick={()=>void open()} disabled={status==='loading'} className="h-11 bg-[#226f60]">{status==='loading'?<><RefreshCw className="animate-spin"/> Hazırlanıyor</>:<><FileText/> Raporu aç</>}</Button></div>{message&&<p className="mt-3 text-sm text-red-700">{message}</p>}</section>{status==='ready'&&report&&<div className="space-y-6"><section className="rounded-3xl border bg-white p-7 shadow-sm print:shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b8b80]">CZA · E3 · 36–48 Ay</p><h1 className="mt-2 text-3xl font-bold text-[#18372f]">{student}</h1><p className="mt-2 text-sm text-muted-foreground">{report.ageMonths} tamamlanmış ay · yaş bandı {report.ageBand} · amaç {report.assessmentPurpose}</p></div><div className="flex gap-2 print:hidden"><Button variant="outline" onClick={()=>window.print()}><Printer/> Yazdır / PDF</Button></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#eef8f2] p-4"><b className="text-2xl text-[#226f60]">{report.childAssessed}</b><p className="mt-1 text-xs text-muted-foreground">yorumlanan doğrudan çocuk kanıtı</p></div><div className="rounded-2xl bg-[#f7f3e8] p-4"><b className="text-2xl text-[#725f31]">%{report.caregiverCoverage}</b><p className="mt-1 text-xs text-muted-foreground">bakımveren kaynak kapsamı</p></div><div className="rounded-2xl bg-[#f2f5f8] p-4"><b className="text-2xl text-[#39556d]">10</b><p className="mt-1 text-xs text-muted-foreground">gelişimsel kanıt alanı</p></div></div><p className="mt-6 rounded-2xl border border-[#d9e6e0] bg-[#f8fbf9] p-4 text-sm leading-6 text-[#48675e]">{report.disclaimer}</p></section><section className="rounded-3xl border bg-white p-7 shadow-sm print:shadow-none"><h2 className="text-xl font-bold text-[#18372f]">Alan bazlı kanıt profili</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Alan</th><th className="p-3">Kanıt</th><th className="p-3">Bağımsızlık</th><th className="p-3">İlk eşleşme</th><th className="p-3">Ort. tepki</th><th className="p-3">Yorum</th></tr></thead><tbody>{report.sections.map(section=><tr key={section.sectionId} className="border-b last:border-0"><td className="p-3 font-semibold">{section.label}<div className="mt-1 text-[11px] font-normal text-muted-foreground">Bağımsız {section.independent} · destekli {section.supported} · gözlenmedi {section.notObserved}</div></td><td className="p-3">{section.assessed}</td><td className="p-3">{pct(section.independenceRate)}</td><td className="p-3">{pct(section.firstMatchRate)}</td><td className="p-3">{section.averageLatencyMs==null?'—':`${(section.averageLatencyMs/1000).toFixed(1)} sn`}</td><td className="p-3"><span className="rounded-full border bg-[#f8fbf9] px-3 py-1 text-xs font-semibold text-[#315f50]">{statusLabel[section.status]||section.status}</span></td></tr>)}</tbody></table></div></section><section className="rounded-3xl border bg-white p-7 shadow-sm print:shadow-none"><h2 className="text-xl font-bold text-[#18372f]">Bakımveren kaynağı</h2><p className="mt-2 text-sm text-muted-foreground">Bu yanıtlar çocuk görevlerinden ayrı tutulur; doğrudan performans kanıtının yerine geçmez.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{report.caregiver.map(item=><article key={item.code} className="rounded-2xl border border-[#e0e9e4] p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#6b8b80]">{item.category}</p><p className="mt-2 text-sm font-semibold text-[#29483f]">{item.question}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p></article>)}</div></section><section className="rounded-3xl border border-[#eadfbd] bg-[#fffaf0] p-6"><h2 className="font-bold text-[#6c5828]">Yorumlama sınırı</h2><p className="mt-2 text-sm leading-6 text-[#725f31]">Bu raporda “göreli güçlü”, “gelişen” ve “yakın destekle izlenecek” ifadeleri yalnız bu CZA oturumundaki kanıt örüntüsünü anlatır. Çocuğun gelişim yaşını, tanıyı veya standart test sonucunu temsil etmez. Gelişimle ilgili kalıcı, çok alanlı veya gerileme içeren bir endişede uygun sağlık/gelişim uzmanına yönlendirme ayrı bir süreçtir.</p></section></div>}</div></main>;
}
