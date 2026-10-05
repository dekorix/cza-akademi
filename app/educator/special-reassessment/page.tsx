'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Verdict='MATCH'|'PARTIAL'|'DIFFERENT'|'NO_RESPONSE';
type Support='INDEPENDENT'|'VERBAL_PROMPT'|'VISUAL_PROMPT'|'MODELED'|'PHYSICAL_ASSIST';

type PlanArea={
  key:string;
  label:string;
  baselineScore:number|null;
  baselineStatus:string;
  baselineIndependentRatio:number|null;
  probeCount:number;
  instruction:string;
};
type Preview={
  ok:true;
  student:{id:string;name:string};
  plan:{
    baselineSessionId:string;
    programId:string;
    profileCode:string;
    profileLabel:string;
    areas:PlanArea[];
    note:string;
  };
  existing?:null|{id:string;comparison:Comparison;completed_at:string};
};
type Comparison={
  overallOutcome:string;
  nextDecision:string;
  note:string;
  areas:{
    key:string;
    label:string;
    baselineScore:number|null;
    afterScore:number|null;
    baselineIndependentRatio:number|null;
    afterIndependentRatio:number|null;
    outcome:string;
    nextStep:string;
    recurringFlags:string[];
  }[];
};

type ProbeState={verdict:Verdict;support:Support;flags:string};

const verdicts:{value:Verdict;label:string}[]=[
  {value:'MATCH',label:'Hedefe uygun'},
  {value:'PARTIAL',label:'Kısmen'},
  {value:'DIFFERENT',label:'Farklı / hatalı'},
  {value:'NO_RESPONSE',label:'Yanıt yok'},
];
const supports:{value:Support;label:string}[]=[
  {value:'INDEPENDENT',label:'Bağımsız'},
  {value:'VERBAL_PROMPT',label:'Sözel ipucu'},
  {value:'VISUAL_PROMPT',label:'Görsel ipucu'},
  {value:'MODELED',label:'Model sonrası'},
  {value:'PHYSICAL_ASSIST',label:'Yoğun yardım'},
];

function outcomeLabel(value:string){
  if(value==='IMPROVED') return 'Belirgin gelişim';
  if(value==='PARTIAL_IMPROVEMENT') return 'Kısmi gelişim';
  if(value==='PERSISTENT_PRIORITY') return 'Öncelik sürüyor';
  if(value==='STABLE') return 'Benzer düzey';
  return 'Kanıt yetersiz';
}
function decisionLabel(value:string){
  if(value==='CLOSE_OR_MAINTAIN') return 'Hedefi kapat / bakım düzeyinde izle';
  if(value==='CONTINUE_TARGETED_SUPPORT') return 'Hedefli desteği kısa süre daha sürdür';
  if(value==='NEW_PROGRAM_REVIEW') return 'Yeni programı eğitimci gözden geçirsin';
  if(value==='EXPERT_REVIEW_CONSIDER') return 'Yetkili uzman değerlendirmesi düşünülebilir';
  return 'Ek kanıt topla';
}
function defaultProbe():ProbeState{
  return {verdict:'',support:'',flags:''} as unknown as ProbeState;
}

export default function SpecialReassessmentPage(){
  const [studentId,setStudentId]=useState('');
  const [programId,setProgramId]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null);
  const [probes,setProbes]=useState<Record<string,ProbeState[]>>({});
  const [comparison,setComparison]=useState<Comparison|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    setStudentId(q.get('studentId')||'');
    setProgramId(q.get('programId')||'');
  },[]);

  useEffect(()=>{
    if(!studentId||!programId) return;
    let active=true;
    setBusy(true);
    void fetch('/api/educator-special-reassessment',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'preview',studentId,programId}),
    }).then(async response=>{
      const data=await response.json() as Preview & {error?:string};
      if(!response.ok||data.ok!==true) throw new Error(data.error||'preview_failed');
      if(!active) return;
      setPreview(data);
      if(data.existing?.comparison) setComparison(data.existing.comparison);
      const initial:Record<string,ProbeState[]>={};
      data.plan.areas.forEach(area=>{
        initial[area.key]=Array.from({length:3},()=>defaultProbe());
      });
      setProbes(initial);
    }).catch(error=>{
      if(active) setMessage(error instanceof Error?error.message:'preview_failed');
    }).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[studentId,programId]);

  const complete=useMemo(()=>{
    if(!preview) return false;
    return preview.plan.areas.every(area=>
      (probes[area.key]||[]).length===3 &&
      (probes[area.key]||[]).every(probe=>Boolean(probe.verdict)&&Boolean(probe.support))
    );
  },[preview,probes]);

  function updateProbe(areaKey:string,index:number,patch:Partial<ProbeState>){
    setProbes(current=>{
      const next={...current};
      const rows=[...(next[areaKey]||[])];
      rows[index]={...rows[index],...patch};
      next[areaKey]=rows;
      return next;
    });
  }

  async function finish(){
    if(!preview||!complete||busy) return;
    setBusy(true);
    setMessage('');
    try{
      const areas=preview.plan.areas.map(area=>({
        key:area.key,
        label:area.label,
        probes:(probes[area.key]||[]).map(probe=>({
          verdict:probe.verdict,
          support:probe.support,
          flags:probe.flags.split(',').map(v=>v.trim()).filter(Boolean),
        })),
      }));
      const response=await fetch('/api/educator-special-reassessment',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'complete',studentId,programId,areas}),
      });
      const body=await response.json() as {ok?:boolean;error?:string;comparison?:Comparison};
      if(!response.ok||body.ok!==true||!body.comparison) throw new Error(body.error||'complete_failed');
      setComparison(body.comparison);
    }catch(error){
      setMessage(error instanceof Error?error.message:'complete_failed');
    }finally{
      setBusy(false);
    }
  }

  if(busy&&!preview) return <main className="grid min-h-screen place-items-center bg-[#f5f7fb] p-6"><div className="text-center"><Loader2 className="mx-auto animate-spin text-[#385a78]"/><p className="mt-4 text-sm font-semibold">Yeniden ölçüm hazırlanıyor…</p></div></main>;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-9">
    <div className="mx-auto max-w-5xl">
      <a href="/educator" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Eğitimci merkezine dön</a>

      <section className="mt-5 rounded-3xl border border-[#d5dfeb] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef4fb] text-[#385a78]"><RefreshCcw/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.13em] text-[#69839d]">4. Hafta · Yeniden Ölçüm</p>
            <h1 className="mt-2 text-2xl font-semibold">Başlangıçla şimdi arasındaki farkı ölç</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Aynı soruları tekrar kullanma. Her hedefte daha önce görülmemiş 3 yeni örnek uygula; ilk yanıtı ve yardım düzeyini kaydet.</p>
          </div>
        </div>

        {message&&<p role="alert" className="mt-6 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{message}</p>}

        {comparison&&<div className="mt-8">
          <div className="rounded-2xl border border-[#b9daca] bg-[#edf8f2] p-6 text-[#276151]">
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0"/><div><h2 className="text-xl font-semibold">{outcomeLabel(comparison.overallOutcome)}</h2><p className="mt-2 text-sm leading-6">{decisionLabel(comparison.nextDecision)}</p></div></div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {comparison.areas.map(area=><article key={area.key} className="rounded-xl border border-[#dce4ed] bg-white p-5">
              <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{area.label}</h3><span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-bold text-[#536f87]">{outcomeLabel(area.outcome)}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-[#f8fafc] p-3"><span className="text-muted-foreground">Başlangıç</span><b className="mt-1 block">{area.baselineScore==null?'—':area.baselineScore.toFixed(2)}</b></div>
                <div className="rounded-lg bg-[#f8fafc] p-3"><span className="text-muted-foreground">Şimdi</span><b className="mt-1 block">{area.afterScore==null?'—':area.afterScore.toFixed(2)}</b></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">{area.nextStep}</p>
            </article>)}
          </div>
          <p className="mt-5 text-[10px] leading-5 text-muted-foreground">{comparison.note}</p>
        </div>}

        {preview&&!comparison&&<>
          <div className="mt-7 rounded-xl border border-[#dce4ed] bg-[#f8fafc] p-4 text-sm">
            <b>{preview.student.name}</b> · {preview.plan.profileLabel}
            <p className="mt-1 text-xs text-muted-foreground">{preview.plan.note}</p>
          </div>

          <div className="mt-6 space-y-6">
            {preview.plan.areas.map(area=><section key={area.key} className="rounded-2xl border border-[#dce4ed] bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold">{area.label}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{area.instruction}</p></div>
                <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[10px] font-bold text-[#536f87]">Başlangıç: {area.baselineScore==null?'—':area.baselineScore.toFixed(2)}</span>
              </div>

              <div className="mt-5 space-y-3">
                {(probes[area.key]||[]).map((probe,index)=><div key={index} className="grid gap-3 rounded-xl border border-[#e1e7ee] bg-[#fbfcfe] p-4 md:grid-cols-[80px_1fr_1fr_1.2fr] md:items-center">
                  <b className="text-sm">{index+1}. örnek</b>
                  <select value={probe.verdict} onChange={event=>updateProbe(area.key,index,{verdict:event.target.value as Verdict})} className="min-h-10 rounded-lg border border-border bg-white px-3 text-sm">
                    <option value="">Sonuç seç</option>
                    {verdicts.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <select value={probe.support} onChange={event=>updateProbe(area.key,index,{support:event.target.value as Support})} className="min-h-10 rounded-lg border border-border bg-white px-3 text-sm">
                    <option value="">Yardım düzeyi seç</option>
                    {supports.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <input value={probe.flags} onChange={event=>updateProbe(area.key,index,{flags:event.target.value})} className="min-h-10 rounded-lg border border-border bg-white px-3 text-sm" placeholder="Varsa hata işareti, virgülle"/>
                </div>)}
              </div>
            </section>)}
          </div>

          <Button onClick={finish} disabled={!complete||busy} className="mt-7 h-12 w-full bg-[#385a78] text-base hover:bg-[#2d4b66]">
            {busy?<><Loader2 className="animate-spin"/> Karşılaştırılıyor…</>:'Yeniden ölçümü tamamla ve karşılaştır'}
          </Button>
          {!complete&&<p className="mt-3 text-center text-xs text-muted-foreground">Her hedef alanında 3 yeni örneğin sonuç ve yardım düzeyini doldur.</p>}
        </>}
      </section>
    </div>
  </main>;
}
