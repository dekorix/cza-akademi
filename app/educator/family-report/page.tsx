'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Report={
  title:string;
  studentDisplayName:string;
  profileLabel:string;
  summary:string;
  strengths:string[];
  supportPriorities:string[];
  progress:{
    status:'NOT_STARTED'|'ACTIVE'|'COMPLETED';
    completedSessions:number;
    totalSessions:number;
    percent:number;
    currentWeek:number|null;
  };
  change:{
    available:boolean;
    headline:string;
    areas:{label:string;change:string;nextStep:string}[];
  };
  homeSupport:string[];
  educatorNote:string;
  disclaimer:string;
};

function progressText(report:Report){
  if(report.progress.status==='NOT_STARTED') return 'Bireysel çalışma programı henüz başlamadı.';
  if(report.progress.status==='COMPLETED') return `Program tamamlandı · ${report.progress.completedSessions}/${report.progress.totalSessions} oturum`;
  return `${report.progress.currentWeek}. hafta · ${report.progress.completedSessions}/${report.progress.totalSessions} oturum · %${report.progress.percent}`;
}

export default function FamilyReportPage(){
  const [studentId,setStudentId]=useState('');
  const [report,setReport]=useState<Report|null>(null);
  const [generatedAt,setGeneratedAt]=useState('');
  const [educatorNote,setEducatorNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    setStudentId(q.get('studentId')||'');
  },[]);

  async function load(note=educatorNote){
    if(!studentId) return;
    setBusy(true);
    setMessage('');
    try{
      const response=await fetch('/api/educator-special-family-report',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({studentId,educatorNote:note}),
      });
      const body=await response.json() as {ok?:boolean;error?:string;report?:Report;generatedAt?:string};
      if(!response.ok||body.ok!==true||!body.report) throw new Error(body.error||'report_failed');
      setReport(body.report);
      setGeneratedAt(body.generatedAt||new Date().toISOString());
    }catch(error){
      const code=error instanceof Error?error.message:'report_failed';
      setMessage(
        code==='student_not_linked_to_educator'
          ?'Bu öğrenci eğitimci hesabınıza bağlı değil.'
          : code==='special_assessment_not_found'
            ?'Bu öğrenci için tamamlanmış özel eğitim değerlendirmesi bulunamadı.'
            :'Veli raporu şu anda hazırlanamadı.'
      );
    }finally{
      setBusy(false);
    }
  }

  useEffect(()=>{
    if(studentId) void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[studentId]);

  return <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 print:bg-white print:p-0">
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href="/educator" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]">
          <ArrowLeft size={16}/> Eğitimci merkezine dön
        </a>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>load()} disabled={busy||!studentId}>
            {busy?<Loader2 className="animate-spin"/>:<RefreshCw/>} Raporu güncelle
          </Button>
          <Button onClick={()=>window.print()} disabled={!report} className="bg-[#385a78] hover:bg-[#2d4b66]">
            <Printer/> Yazdır / PDF kaydet
          </Button>
        </div>
      </div>

      {message&&<p role="alert" className="mb-5 rounded-xl bg-[#fff3e6] p-4 text-sm font-semibold text-[#8a5a25] print:hidden">{message}</p>}

      {busy&&!report&&<div className="grid min-h-[50vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-[#385a78]"/><p className="mt-3 text-sm font-semibold">Veli raporu hazırlanıyor…</p></div></div>}

      {report&&<article className="rounded-[28px] border border-[#d7e0e8] bg-white p-7 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none md:p-10">
        <header className="border-b border-[#dfe6ec] pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-[#69839d]">Çelik Zihin Akademisi</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#294b68]">{report.title.replace('Çelik Zihin Akademisi · ','')}</h1>
              <p className="mt-3 text-sm text-[#60798f]">{report.studentDisplayName} · {report.profileLabel}</p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef4fb] text-[#385a78] print:hidden"><FileText/></span>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-[#536b7f]">{report.summary}</p>
          <p className="mt-3 text-[10px] text-[#8293a1]">
            Hazırlanma: {generatedAt?new Date(generatedAt).toLocaleString('tr-TR'):'—'}
          </p>
        </header>

        <section className="mt-7 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-[#dce8e2] bg-[#f4faf6] p-5">
            <h2 className="text-lg font-semibold text-[#315f50]">Güçlü ve destekleyici alanlar</h2>
            <div className="mt-4 space-y-2">
              {report.strengths.map(item=><p key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-[#46675c]">✓ {item}</p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-5">
            <h2 className="text-lg font-semibold text-[#7b6124]">Yakın destek öncelikleri</h2>
            <div className="mt-4 space-y-2">
              {report.supportPriorities.map(item=><p key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-[#735f34]">• {item}</p>)}
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-[#dce4ed] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-[#69839d]">Bireysel çalışma programı</p>
              <h2 className="mt-2 text-lg font-semibold">Program ilerlemesi</h2>
            </div>
            <span className="rounded-full bg-[#eef4fb] px-3 py-1 text-xs font-bold text-[#385a78]">%{report.progress.percent}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e9eef4]">
            <div className="h-full rounded-full bg-[#557fa5]" style={{width:`${report.progress.percent}%`}}/>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{progressText(report)}</p>
        </section>

        <section className="mt-7 rounded-2xl border border-[#dce4ed] p-5">
          <p className="text-xs font-black uppercase tracking-[.12em] text-[#69839d]">Program sonrası değişim</p>
          <h2 className="mt-2 text-lg font-semibold">{report.change.headline}</h2>
          {report.change.available&&<div className="mt-4 grid gap-3 md:grid-cols-2">
            {report.change.areas.map(area=><div key={area.label} className="rounded-xl bg-[#f8fafc] p-4">
              <b className="text-sm">{area.label}</b>
              <p className="mt-1 text-xs font-semibold text-[#385a78]">{area.change}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{area.nextStep}</p>
            </div>)}
          </div>}
        </section>

        <section className="mt-7 rounded-2xl border border-[#dce8e2] bg-[#f7fbf8] p-5">
          <h2 className="text-lg font-semibold text-[#315f50]">Evde nasıl destekleyebilirsiniz?</h2>
          <div className="mt-4 space-y-3">
            {report.homeSupport.map((item,index)=><div key={item} className="flex gap-3 text-sm leading-6 text-[#536b61]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-black text-[#315f50]">{index+1}</span>
              <p>{item}</p>
            </div>)}
          </div>
        </section>

        <section className="mt-7 print:hidden">
          <label className="text-sm font-semibold">
            Eğitimciden veliye kısa not
            <textarea
              value={educatorNote}
              onChange={event=>setEducatorNote(event.target.value.slice(0,1000))}
              placeholder="Örneğin: Ev çalışmalarını kısa tutmanızı ve özellikle çabayı desteklemenizi öneriyorum."
              className="mt-2 min-h-24 w-full resize-none rounded-xl border border-border p-3 text-sm font-normal"
            />
          </label>
          <Button variant="outline" className="mt-3" onClick={()=>load(educatorNote)} disabled={busy}>
            {busy?<Loader2 className="animate-spin"/>:<RefreshCw/>} Notu rapora işle
          </Button>
        </section>

        {report.educatorNote&&<section className="mt-7 rounded-2xl border border-[#dce4ed] bg-[#fafbfc] p-5">
          <p className="text-xs font-black uppercase tracking-[.12em] text-[#69839d]">Eğitimcinin notu</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#536b7f]">{report.educatorNote}</p>
        </section>}

        <footer className="mt-8 border-t border-[#dfe6ec] pt-5">
          <p className="text-[10px] leading-5 text-[#7f8e9a]">{report.disclaimer}</p>
          <p className="mt-2 text-[10px] font-semibold text-[#69839d]">© Çelik Zihin Akademisi</p>
        </footer>
      </article>}
    </div>
  </main>;
}
