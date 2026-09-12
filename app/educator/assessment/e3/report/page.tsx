'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Link2, Loader2, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildE3DeferredDevelopmentActions, buildE3WorkRecommendations, type E3WorkRecommendation } from '@/lib/e3-work-recommendations';
import type { E3SectionReport } from '@/lib/preschool-e3';

const statusLabel: Record<string,string> = {
  RELATIVE_STRENGTH: 'Göreli güçlü kanıt',
  DEVELOPING: 'Gelişen / karışık profil',
  WATCH_SUPPORT: 'Yakın destekle izlenecek',
  INSUFFICIENT: 'Kanıt yetersiz',
};
const priorityLabel = { HIGH: 'Öncelikli destek', MEDIUM: 'Güçlendir', MAINTAIN: 'Gücü koru' } as const;

type Report = {
  profileCode: string; ageMonths: number; ageBand: string; assessmentPurpose: string; childAssessed: number;
  sections: E3SectionReport[]; caregiver: Array<{code:string;category:string;question:string;answer:string}>;
  caregiverCoverage: number; disclaimer: string;
};
type Loaded = {
  session: { id?: string; student_id?: string; student_label?: string; status?: string; completed_at?: string; metadata?: Record<string,unknown> };
  report: Report;
};

async function loadReport(sessionId:string) {
  const response = await fetch('/api/assessment-e3',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'report',sessionId})});
  const data = await response.json();
  if(!response.ok||data.ok===false) throw new Error(data.error||'e3_report_unavailable');
  return data as Loaded;
}

function pct(value:number|null){ return value==null?'—':`%${Math.round(value*100)}`; }
function settingText(key:string,value:string|number|boolean){
  if(key==='practiceMode') return 'Rehberli çalışma';
  if(key==='countdownEnabled') return value?'Geri sayım açık':'Geri sayım yok';
  if(key.endsWith('Ms')&&typeof value==='number') return `${key}: ${value} ms`;
  if(key==='speechRate') return `Ses hızı: ${value}×`;
  if(key==='rounds') return `Tur: ${value}`;
  if(key==='terms') return `Uyaran: ${value}`;
  return `${key}: ${String(value)}`;
}

export default function E3ReportPage(){
  const [sessionId,setSessionId]=useState('');
  const [session,setSession]=useState<Loaded['session']|null>(null);
  const [student,setStudent]=useState('Öğrenci');
  const [report,setReport]=useState<Report|null>(null);
  const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [message,setMessage]=useState('');
  const [assignmentBusy,setAssignmentBusy]=useState('');
  const [assigned,setAssigned]=useState<Record<string,boolean>>({});

  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('session')||'';if(!id)return;setSessionId(id);void open(id)},[]);
  async function open(id=sessionId){if(!id.trim()){setMessage('Oturum kimliği gerekli.');setStatus('error');return;}setStatus('loading');setMessage('');try{const data=await loadReport(id.trim());setSession(data.session);setStudent(data.session?.student_label||'Öğrenci');setReport(data.report);setStatus('ready')}catch(error){setMessage(error instanceof Error?error.message:'Rapor açılamadı.');setStatus('error')}}

  const recommendations = useMemo(()=>report?buildE3WorkRecommendations(report.sections,report.ageMonths,4):[],[report]);
  const developmentalActions = useMemo(()=>report?buildE3DeferredDevelopmentActions(report.sections):[],[report]);

  async function approve(recommendation:E3WorkRecommendation){
    if(!session?.student_id||!sessionId||assignmentBusy)return;
    setAssignmentBusy(recommendation.id);setMessage('');
    try{
      const response=await fetch('/api/educator-e3-assignments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({studentId:session.student_id,assessmentSessionId:sessionId,recommendationId:recommendation.id})});
      const data=await response.json();
      if(!response.ok||data.ok!==true){
        if(data.error==='active_assignment_exists') throw new Error('Bu modülde zaten aktif bir gerçek çalışma var. Önce mevcut çalışmayı tamamla veya kapat.');
        throw new Error(data.error||'E3 önerisi öğrenciye atanamadı.');
      }
      setAssigned(current=>({...current,[recommendation.id]:true}));
      setMessage(`${recommendation.moduleLabel} E3 kanıtına bağlı gerçek çalışma reçetesi olarak öğrencinin Çalışma Paneline atandı.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Atama yapılamadı.')}finally{setAssignmentBusy('')}
  }

  return <main className="min-h-screen bg-[#f3f7f5] print:bg-white"><header className="print:hidden bg-[#18372f] px-5 text-white md:px-9"><div className="mx-auto flex h-20 max-w-[1380px] items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d8eeac] text-xs font-black text-[#18372f]">CZA</span><div><p className="text-sm font-semibold">36–48 Ay Gelişim Raporu · E3</p><p className="text-[10px] text-[#bad4ca]">ÇOCUK KANITI + BAKIMVEREN + ÇALIŞMA KÖPRÜSÜ</p></div></div><a href="/educator" className="flex items-center gap-2 text-xs text-[#d5e8e0]"><ArrowLeft size={15}/> Eğitimci Merkezi</a></div></header><div className="mx-auto max-w-[1380px] px-5 py-8 md:px-9 print:max-w-none print:px-0 print:py-0">
    <section className="print:hidden mb-7 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-end"><div className="flex-1"><label className="text-sm font-semibold">E3 oturum kimliği</label><input value={sessionId} onChange={e=>setSessionId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"/></div><Button onClick={()=>void open()} disabled={status==='loading'} className="h-11 bg-[#226f60]">{status==='loading'?<><RefreshCw className="animate-spin"/> Hazırlanıyor</>:<><FileText/> Raporu aç</>}</Button></div>{message&&<p role="status" className="mt-3 rounded-xl bg-[#f4f9f6] p-3 text-sm text-[#315f50]">{message}</p>}</section>
    {status==='ready'&&report&&<div className="space-y-6">
      <section className="rounded-3xl border bg-white p-7 shadow-sm print:shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b8b80]">CZA · E3 · 36–48 Ay</p><h1 className="mt-2 text-3xl font-bold text-[#18372f]">{student}</h1><p className="mt-2 text-sm text-muted-foreground">{report.ageMonths} tamamlanmış ay · yaş bandı {report.ageBand} · amaç {report.assessmentPurpose}</p></div><Button variant="outline" className="print:hidden" onClick={()=>window.print()}><Printer/> Yazdır / PDF</Button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#eef8f2] p-4"><b className="text-2xl text-[#226f60]">{report.childAssessed}</b><p className="mt-1 text-xs text-muted-foreground">yorumlanan doğrudan çocuk kanıtı</p></div><div className="rounded-2xl bg-[#f7f3e8] p-4"><b className="text-2xl text-[#725f31]">%{report.caregiverCoverage}</b><p className="mt-1 text-xs text-muted-foreground">bakımveren kaynak kapsamı</p></div><div className="rounded-2xl bg-[#f2f5f8] p-4"><b className="text-2xl text-[#39556d]">10</b><p className="mt-1 text-xs text-muted-foreground">gelişimsel kanıt alanı</p></div></div><p className="mt-6 rounded-2xl border border-[#d9e6e0] bg-[#f8fbf9] p-4 text-sm leading-6 text-[#48675e]">{report.disclaimer}</p></section>

      <section className="rounded-3xl border bg-white p-7 shadow-sm print:shadow-none"><h2 className="text-xl font-bold text-[#18372f]">Alan bazlı kanıt profili</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Alan</th><th className="p-3">Kanıt</th><th className="p-3">Bağımsızlık</th><th className="p-3">İlk eşleşme</th><th className="p-3">Ort. tepki</th><th className="p-3">Yorum</th></tr></thead><tbody>{report.sections.map(section=><tr key={section.sectionId} className="border-b last:border-0"><td className="p-3 font-semibold">{section.label}<div className="mt-1 text-[11px] font-normal text-muted-foreground">Bağımsız {section.independent} · destekli {section.supported} · gözlenmedi {section.notObserved}</div></td><td className="p-3">{section.assessed}</td><td className="p-3">{pct(section.independenceRate)}</td><td className="p-3">{pct(section.firstMatchRate)}</td><td className="p-3">{section.averageLatencyMs==null?'—':`${(section.averageLatencyMs/1000).toFixed(1)} sn`}</td><td className="p-3"><span className="rounded-full border bg-[#f8fbf9] px-3 py-1 text-xs font-semibold text-[#315f50]">{statusLabel[section.status]||section.status}</span></td></tr>)}</tbody></table></div></section>

      <section className="print:hidden rounded-3xl border border-[#c9ded4] bg-[#f5faf7] p-7 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#226f60]"><Link2 size={19}/><p className="text-xs font-black uppercase tracking-[.14em]">E3 → CZA Çalışma Paneli</p></div><h2 className="mt-2 text-xl font-bold text-[#18372f]">Yaşa uygun çalışma reçeteleri</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">E3, okul çağı değerlendirmesinin küçültülmüş hali değildir. Sistem yalnız mevcut CZA modülüyle pedagojik olarak savunulabilir bir eşleşme varsa öneri üretir; tüm çalışmalar rehberli, kısa ve süre baskısızdır. Eğitimci onayı olmadan öğrenciye hiçbir şey atanmaz.</p></div><span className="rounded-full border bg-white px-3 py-2 text-xs font-semibold text-[#315f50]">{report.ageMonths} ay için yaş kapılı</span></div>
        {recommendations.length?<div className="mt-5 grid gap-4 lg:grid-cols-2">{recommendations.map(item=><article key={item.id} className="rounded-2xl border border-[#d5e5dd] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-[#226f60]">{priorityLabel[item.priority]}</p><h3 className="mt-1 text-lg font-bold text-[#18372f]">{item.moduleLabel}</h3></div><Button disabled={Boolean(assignmentBusy)||assigned[item.id]||session?.status!=='completed'||!session?.student_id} onClick={()=>void approve(item)} className="bg-[#226f60] hover:bg-[#195749]">{assignmentBusy===item.id?<><Loader2 className="animate-spin"/> Atanıyor</>:assigned[item.id]?'Atandı ✓':'Onayla ve ata'}</Button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.reason}</p><p className="mt-3 text-xs font-semibold text-[#4a6b61]">Kaynak: {item.sourceSections.join(', ')}</p><p className="mt-2 rounded-lg bg-[#fff8e8] px-3 py-2 text-xs font-semibold text-[#705d31]">Yaş kapısı: {item.ageGate}</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(item.suggestedSettings).map(([key,value])=><span key={key} className="rounded-md bg-[#f1f5f3] px-2 py-1 text-[10px] text-[#567067]">{settingText(key,value)}</span>)}</div></article>)}</div>:<p className="mt-5 rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Bu oturumda mevcut Parmak/Soroban/Anzan modüllerine yaş ve kanıt açısından güvenli bir doğrudan eşleşme oluşmadı. Sistem sırf atama üretmek için gelişim alanlarını sayısal modüllere zorlamaz.</p>}
        {session?.status!=='completed'&&<p className="mt-4 rounded-xl bg-[#fff4dc] p-3 text-xs font-semibold text-[#765f2d]">Çalışma reçetesi ancak çocuk kanıtı ve bakımveren kaynağı tamamlanıp E3 oturumu kapandıktan sonra atanabilir.</p>}
      </section>

      {developmentalActions.length>0&&<section className="rounded-3xl border border-[#e8d9c2] bg-[#fffaf2] p-7"><h2 className="text-xl font-bold text-[#6a552a]">Dijital modüle zorlanmayan gelişim alanları</h2><p className="mt-2 text-sm leading-6 text-[#766641]">Dil, sosyal oyun, motor ve özbakım gibi alanlarda doğru sonraki adım gerçek yaşam/oyun temelli çalışmadır. Bu nedenle sistem bu alanları Anzan veya Soroban reçetesine dönüştürmez.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{developmentalActions.map(item=><article key={item.sectionId} className="rounded-2xl border border-[#eadfcf] bg-white p-4"><h3 className="font-bold text-[#594a2b]">{item.sectionLabel}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.reason}</p><p className="mt-3 text-sm font-semibold text-[#705d31]">{item.nextAction}</p></article>)}</div></section>}

      <section className="rounded-3xl border bg-white p-7 shadow-sm print:shadow-none"><h2 className="text-xl font-bold text-[#18372f]">Bakımveren kaynağı</h2><p className="mt-2 text-sm text-muted-foreground">Bu yanıtlar çocuk görevlerinden ayrı tutulur; doğrudan performans kanıtının yerine geçmez.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{report.caregiver.map(item=><article key={item.code} className="rounded-2xl border border-[#e0e9e4] p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#6b8b80]">{item.category}</p><p className="mt-2 text-sm font-semibold text-[#29483f]">{item.question}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p></article>)}</div></section>
      <section className="rounded-3xl border border-[#eadfbd] bg-[#fffaf0] p-6"><h2 className="font-bold text-[#6c5828]">Yorumlama sınırı</h2><p className="mt-2 text-sm leading-6 text-[#725f31]">Bu raporda “göreli güçlü”, “gelişen” ve “yakın destekle izlenecek” ifadeleri yalnız bu CZA oturumundaki kanıt örüntüsünü anlatır. Çocuğun gelişim yaşını, tanıyı veya standart test sonucunu temsil etmez. Gelişimle ilgili kalıcı, çok alanlı veya gerileme içeren bir endişede uygun sağlık/gelişim uzmanına yönlendirme ayrı bir süreçtir.</p></section>
    </div>}
  </div></main>;
}
