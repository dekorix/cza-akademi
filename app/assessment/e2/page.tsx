'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Baby, CheckCircle2, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Task={
  id:string;section:string;kind:string;type:string;title:string;prompt:string;
  minAge:number;difficulty:number;tier:string;theme?:string;options?:string[];
  correct?:number;sample?:string;cue?:string;spoken?:string;visual?:string;
  instruction?:string;material?:string;observe?:string;metrics?:string[];
};
type Bundle={
  session:any;profile:any;currentTask:Task|null;sections:any[];bankSize:number;
  responses:any[];summary:any;needsAdaptiveProfile:boolean;childPhaseComplete:boolean;
  caregiverRequired:boolean;caregiverComplete:boolean;caregiverAnswered:number;caregiverTotal:number;
};
const SUPPORT=[
  ['independent','Bağımsız'],
  ['verbal_prompt','Sözel ipucu'],
  ['visual_prompt','Jest / görsel ipucu'],
  ['modeled','Model sonrası'],
  ['physical_assist','Fiziksel yardım'],
  ['not_observed','Henüz gözlenmedi'],
  ['not_assessed','Değerlendirilemedi'],
] as const;
const INTERESTS=[['animals','Hayvanlar'],['vehicles','Araçlar'],['kitchen','Mutfak / günlük yaşam'],['outdoor','Açık hava']] as const;

function visibleToken(value?:string){
  if(!value)return '';
  return value.startsWith('text:')?value.slice(5):value;
}
async function api(body:Record<string,unknown>){
  const response=await fetch('/api/assessment-e2',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok||data.ok===false)throw new Error(String(data.error||'e2_unavailable'));
  return data;
}
function friendly(code:string){
  if(code==='educator_session_required')return 'Eğitimci oturumu gerekli.';
  if(code==='student_not_linked_to_educator')return 'Bu öğrenci eğitimci hesabınıza bağlı değil.';
  if(code==='caregiver_incomplete')return 'Bakımveren görüşmesindeki tüm sorular yanıtlanmalı veya geçilmelidir.';
  if(code==='session_completed')return 'Bu E2 oturumu tamamlandı.';
  return code;
}

export default function E2AssessmentPage(){
  const [sessionId,setSessionId]=useState('');
  const [bundle,setBundle]=useState<Bundle|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [languageLevel,setLanguageLevel]=useState('two_word');
  const [attentionSpan,setAttentionSpan]=useState('medium');
  const [interests,setInterests]=useState<string[]>(['animals']);
  const [developmentalNote,setDevelopmentalNote]=useState('');
  const [rating,setRating]=useState('independent');
  const [answer,setAnswer]=useState('');
  const [note,setNote]=useState('');
  const [metrics,setMetrics]=useState<Record<string,number>>({});
  const shownAt=useRef(Date.now());
  const firstActionAt=useRef<number|null>(null);
  const [routeComplete,setRouteComplete]=useState(false);
  const [caregiverData,setCaregiverData]=useState<any|null>(null);
  const [caregiverIndex,setCaregiverIndex]=useState(0);
  const [caregiverAnswer,setCaregiverAnswer]=useState('');
  const [caregiverNote,setCaregiverNote]=useState('');
  const [report,setReport]=useState<any|null>(null);

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    setSessionId(q.get('session')||'');
  },[]);

  async function load(){
    if(!sessionId)return;
    setBusy(true);setError('');
    try{
      const data=await api({action:'get',sessionId});
      setBundle(data);
      setRouteComplete(Boolean(data.childPhaseComplete)||(!data.currentTask&&Boolean(data.profile)));
      if(data.caregiverComplete||data.session?.status==='completed'){
        const reportData=await api({action:'report',sessionId});
        setReport(reportData.report);
      }
    }catch(e){setError(friendly(e instanceof Error?e.message:'E2 açılamadı.'))}
    finally{setBusy(false);}
  }
  useEffect(()=>{void load()},[sessionId]);

  const current=bundle?.currentTask||null;
  useEffect(()=>{
    shownAt.current=Date.now();firstActionAt.current=null;setAnswer('');setNote('');setRating('independent');setMetrics({});
  },[current?.id]);

  function touch(){if(firstActionAt.current==null)firstActionAt.current=Date.now();}
  function toggleInterest(value:string){
    setInterests(rows=>rows.includes(value)?rows.filter(x=>x!==value):[...rows,value].slice(0,4));
  }

  async function configure(){
    if(!sessionId||!interests.length)return;
    setBusy(true);setError('');
    try{
      await api({action:'configure',sessionId,profile:{languageLevel,attentionSpan,interests,developmentalNote}});
      await load();
    }catch(e){setError(friendly(e instanceof Error?e.message:'Profil hazırlanamadı.'))}
    finally{setBusy(false)}
  }

  async function saveAttempt(){
    if(!current||busy)return;
    setBusy(true);setError('');
    try{
      const data=await api({
        action:'attempt',sessionId,taskCode:current.id,rating,answerText:answer,note,metrics,
        shownAt:shownAt.current,firstActionAt:firstActionAt.current,completedAt:Date.now(),
      });
      if(data.childRouteComplete)setRouteComplete(true);
      await load();
    }catch(e){setError(friendly(e instanceof Error?e.message:'Görev kaydedilemedi.'))}
    finally{setBusy(false)}
  }

  async function finishChild(){
    setBusy(true);setError('');
    try{await api({action:'finish_child',sessionId});await load();await loadCaregiver();}
    catch(e){setError(friendly(e instanceof Error?e.message:'Çocuk bölümü tamamlanamadı.'))}
    finally{setBusy(false)}
  }

  async function loadCaregiver(){
    if(!sessionId)return;
    setBusy(true);setError('');
    try{
      const data=await api({action:'caregiver_questions',sessionId});
      setCaregiverData(data);
      const answered=new Set<string>();
      for(const section of data.caregiver?.sections||[])for(const item of section.items||[])if(item.answer)answered.add(item.id);
      const first=data.questions.findIndex((q:any)=>!answered.has(q.id));
      setCaregiverIndex(first>=0?first:Math.max(0,data.questions.length-1));
    }catch(e){setError(friendly(e instanceof Error?e.message:'Bakımveren formu açılamadı.'))}
    finally{setBusy(false)}
  }

  async function saveCaregiver(){
    const question=caregiverData?.questions?.[caregiverIndex];
    if(!question||!caregiverAnswer.trim())return;
    setBusy(true);setError('');
    try{
      await api({action:'caregiver_response',sessionId,questionId:question.id,answer:caregiverAnswer,note:caregiverNote});
      setCaregiverAnswer('');setCaregiverNote('');
      await loadCaregiver();
      setCaregiverIndex(index=>Math.min(index+1,(caregiverData?.questions?.length||1)-1));
    }catch(e){setError(friendly(e instanceof Error?e.message:'Bakımveren yanıtı kaydedilemedi.'))}
    finally{setBusy(false)}
  }

  async function finishCaregiver(){
    setBusy(true);setError('');
    try{
      await api({action:'caregiver_finish',sessionId});
      const r=await api({action:'report',sessionId});
      setReport(r.report);await load();
    }catch(e){setError(friendly(e instanceof Error?e.message:'Bakımveren görüşmesi tamamlanamadı.'))}
    finally{setBusy(false)}
  }

  const sectionProgress=useMemo(()=>bundle?.summary?.sectionProgress||[],[bundle]);
  const caregiverQuestion=caregiverData?.questions?.[caregiverIndex]||null;

  if(!sessionId)return <main className="grid min-h-screen place-items-center p-6"><p>Geçerli E2 oturumu bulunamadı.</p></main>;
  if(busy&&!bundle)return <main className="grid min-h-screen place-items-center p-6"><Loader2 className="animate-spin"/></main>;

  return <main className="min-h-screen bg-[#f3f8f6] px-4 py-6 text-[#17323d]">
    <div className="mx-auto max-w-6xl">
      <a href="/educator/assessment" className="inline-flex items-center gap-2 text-sm font-semibold text-[#176b73]"><ArrowLeft size={16}/> Başlangıç Değerlendirmesine dön</a>

      <header className="mt-4 rounded-[2rem] bg-[linear-gradient(135deg,#103a4a,#16736e)] p-7 text-white shadow-sm md:p-9">
        <div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10"><Baby size={29}/></span><div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#d8eee9]">CZA E2 · 24–36 AY · ADAPTİF BÜTÜNCÜL DEĞERLENDİRME</p>
          <h1 className="mt-2 text-3xl font-semibold">{bundle?.session?.student_label||'Öğrenci'}</h1>
          <p className="mt-2 text-sm text-[#e9f7f4]">{bundle?.session?.metadata?.ageMonths??'—'} ay · {bundle?.session?.metadata?.ageBand||'24–35 ay'} · 138 görevlik özgün havuzdan adaptif seçim</p>
        </div></div>
      </header>

      {error&&<p role="alert" className="mt-4 rounded-xl border border-[#e6b9aa] bg-[#fff2ed] p-4 text-sm font-semibold text-[#8b3b2e]">{error}</p>}

      {bundle?.needsAdaptiveProfile&&<section className="mt-5 rounded-3xl border border-[#dce9e4] bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold">Ön ayar · Çocuğu bugünkü haliyle tanı</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bu bilgiler tanı veya sabit etiket değildir; adaptif görev seçimini düzenler.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Dil düzeyi<select value={languageLevel} onChange={e=>setLanguageLevel(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="single_word">Tek sözcük ağırlıklı</option><option value="two_word">İki sözcüklü ifadeler</option><option value="short_sentence">Kısa cümleler</option></select></label>
          <label className="text-sm font-semibold">Dikkat süresi<select value={attentionSpan} onChange={e=>setAttentionSpan(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="short">Kısa</option><option value="medium">Orta</option><option value="long">Uzun</option></select></label>
        </div>
        <div className="mt-5"><b className="text-sm">İlgi alanları</b><div className="mt-2 flex flex-wrap gap-2">{INTERESTS.map(([value,label])=><button key={value} type="button" onClick={()=>toggleInterest(value)} className={'rounded-full border px-4 py-2 text-sm font-semibold '+(interests.includes(value)?'border-[#176b73] bg-[#edf8f6] text-[#176b73]':'bg-white')}>{label}</button>)}</div></div>
        <label className="mt-5 block text-sm font-semibold">Kısa gelişim notu <span className="font-normal text-muted-foreground">(isteğe bağlı)</span><textarea value={developmentalNote} onChange={e=>setDevelopmentalNote(e.target.value.slice(0,600))} className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal"/></label>
        <Button onClick={()=>void configure()} disabled={busy||!interests.length} className="mt-5 h-12 w-full bg-[#176b73] hover:bg-[#125a60]">Adaptif rotayı hazırla</Button>
      </section>}

      {bundle?.profile&&!bundle.childPhaseComplete&&!routeComplete&&current&&<section className="mt-5 rounded-3xl border border-[#dce9e4] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#176b73]">{current.section} · {current.kind} · zorluk {current.difficulty}</p><h2 className="mt-2 text-2xl font-semibold">{current.title}</h2></div><span className="rounded-full bg-[#edf8f6] px-3 py-1 text-xs font-bold text-[#176b73]">{bundle.summary?.completedItems||0}/{bundle.summary?.targetTotal||'—'}</span></div>
        <p className="mt-4 rounded-2xl bg-[#eef8f5] p-5 text-lg font-semibold leading-7">{current.prompt}</p>
        {(current.sample||current.cue||current.visual||current.spoken)&&<div className="mt-4 rounded-2xl border border-[#dce9e4] bg-[#fbfdfc] p-5 text-center text-3xl">{visibleToken(current.sample||current.cue||current.visual||current.spoken)}</div>}
        {current.instruction&&<p className="mt-4 text-sm"><b>Uygulama:</b> {current.instruction}</p>}
        {current.material&&<p className="mt-2 text-sm"><b>Materyal:</b> {current.material}</p>}
        {current.observe&&<p className="mt-2 text-sm"><b>Gözlem:</b> {current.observe}</p>}

        {current.options?.length?<div className="mt-5 grid gap-3 sm:grid-cols-2">{current.options.map(option=><button key={option} type="button" onClick={()=>{touch();setAnswer(option)}} className={'min-h-16 rounded-2xl border p-3 text-lg font-semibold '+(answer===option?'border-[#176b73] bg-[#edf8f6]':'bg-white')}>{visibleToken(option)}</button>)}</div>:<textarea value={answer} onFocus={touch} onChange={e=>{touch();setAnswer(e.target.value)}} placeholder="Kısa yanıt / gözlem kaydı" className="mt-5 min-h-20 w-full rounded-xl border p-3 text-sm"/>}

        <div className="mt-6"><h3 className="font-semibold">Beceri hangi destek düzeyinde ortaya çıktı?</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{SUPPORT.map(([value,label])=><button key={value} type="button" onClick={()=>{touch();setRating(value)}} className={'rounded-xl border p-3 text-left text-sm font-semibold '+(rating===value?'border-[#176b73] bg-[#edf8f6]':'bg-white')}>{label}</button>)}</div></div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">{[['engaged','Katılım'],['avoidance','Kaçınma'],['frustration','Zorlanma'],['fatigue','Yorgunluk']].map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold"><input type="checkbox" checked={metrics[key]===1} onChange={e=>setMetrics(m=>({...m,[key]:e.target.checked?1:0}))}/>{label}</label>)}</div>
        <textarea value={note} onChange={e=>setNote(e.target.value.slice(0,1000))} placeholder="Eğitimci gözlem notu (isteğe bağlı)" className="mt-4 min-h-20 w-full rounded-xl border p-3 text-sm"/>
        <Button onClick={()=>void saveAttempt()} disabled={busy} className="mt-5 h-12 w-full bg-[#176b73] hover:bg-[#125a60]">{busy?'Kaydediliyor…':'Kaydet ve adaptif göreve geç →'}</Button>
      </section>}

      {bundle?.profile&&(routeComplete||bundle.childPhaseComplete)&&!bundle.caregiverComplete&&!caregiverData&&<section className="mt-5 rounded-3xl border border-[#dce9e4] bg-white p-7 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-[#176b73]" size={42}/><h2 className="mt-3 text-2xl font-semibold">Çocukla doğrudan değerlendirme bölümü hazır.</h2><p className="mt-2 text-sm text-muted-foreground">Şimdi ev yaşamındaki kanıtı ayrı tutmak için bakımveren görüşmesine geçeceğiz.</p>
        {!bundle.childPhaseComplete&&<Button onClick={()=>void finishChild()} className="mt-5 mr-2 bg-[#176b73] hover:bg-[#125a60]">Çocuk bölümünü tamamla</Button>}
        {bundle.childPhaseComplete&&<Button onClick={()=>void loadCaregiver()} className="mt-5 bg-[#176b73] hover:bg-[#125a60]">Bakımveren görüşmesini aç</Button>}
      </section>}

      {caregiverData&&!report&&caregiverQuestion&&<section className="mt-5 rounded-3xl border border-[#dce9e4] bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b73]">BAKIMVEREN GÖRÜŞMESİ · {caregiverIndex+1}/{caregiverData.questions.length}</p>
        <h2 className="mt-2 text-xl font-semibold">{caregiverQuestion.section}</h2><p className="mt-4 text-lg leading-7">{caregiverQuestion.label}</p>
        <div className="mt-4 flex flex-wrap gap-2">{['Evet','Hayır','Bazen','SKIP'].map(v=><button key={v} type="button" onClick={()=>setCaregiverAnswer(v)} className={'rounded-full border px-4 py-2 text-sm font-semibold '+(caregiverAnswer===v?'border-[#176b73] bg-[#edf8f6]':'bg-white')}>{v==='SKIP'?'Bilinmiyor / geç':v}</button>)}</div>
        <textarea value={caregiverAnswer} onChange={e=>setCaregiverAnswer(e.target.value.slice(0,1200))} placeholder="Yanıtı buraya yazabilir veya yukarıdan hızlı seçim yapabilirsiniz." className="mt-4 min-h-24 w-full rounded-xl border p-3 text-sm"/>
        <textarea value={caregiverNote} onChange={e=>setCaregiverNote(e.target.value.slice(0,500))} placeholder="Ek not (isteğe bağlı)" className="mt-3 min-h-16 w-full rounded-xl border p-3 text-sm"/>
        <div className="mt-5 flex gap-3"><Button variant="outline" onClick={()=>setCaregiverIndex(i=>Math.max(0,i-1))}>Geri</Button><Button onClick={()=>void saveCaregiver()} disabled={!caregiverAnswer.trim()||busy} className="flex-1 bg-[#176b73] hover:bg-[#125a60]">Kaydet ve ilerle <ChevronRight/></Button></div>
        {caregiverData.caregiver?.answered===caregiverData.caregiver?.total&&<Button onClick={()=>void finishCaregiver()} className="mt-3 h-11 w-full bg-[#294b68] hover:bg-[#203c53]">Bakımveren görüşmesini tamamla ve raporu oluştur</Button>}
      </section>}

      {report&&<section className="mt-5 rounded-3xl border border-[#dce9e4] bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3"><ShieldCheck className="text-[#176b73]"/><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#176b73]">MERKEZİ CZA E2 RAPORU</p><h2 className="mt-1 text-2xl font-semibold">{report.studentLabel}</h2><p className="mt-1 text-sm text-muted-foreground">{report.ageMonths} ay · {report.ageBand}</p></div></div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(report.summary?.categoryPerformance||[]).map((row:any)=><article key={row.code} className="rounded-2xl border p-4"><b>{row.title}</b><p className="mt-2 text-2xl font-semibold">%{row.independentRate??'—'}</p><small className="text-muted-foreground">{row.assessed} kanıt · {row.supported} destekle</small></article>)}</div>
        {report.caregiver?.redFlags?.length>0&&<div className="mt-5 rounded-xl border border-[#e6b9aa] bg-[#fff2ed] p-4"><b>Yönlendirme için dikkat</b>{report.caregiver.redFlags.map((x:string)=><p key={x} className="mt-2 text-sm">• {x}</p>)}<small className="mt-2 block">Bu bulgular tanı değildir; uygun sağlık/gelişim uzmanına yönlendirme gereksinimini değerlendirmeye yardımcı olur.</small></div>}
        <div className="mt-5 rounded-xl bg-[#eef8f5] p-5"><b>İlk eğitim planı öncelikleri</b>{report.recommendations.map((x:string,i:number)=><p key={x} className="mt-2 text-sm"><b className="mr-2">{i+1}.</b>{x}</p>)}</div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">{report.interpretationNote}</p>
        <Button variant="outline" onClick={()=>window.print()} className="mt-5 w-full">Yazdır / PDF olarak kaydet</Button>
      </section>}

      {sectionProgress.length>0&&<section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{sectionProgress.map((s:any)=><article key={s.id} className="rounded-2xl border border-[#dce9e4] bg-white p-4"><b>{s.title}</b><p className="mt-2 text-sm text-muted-foreground">{s.completed}/{s.total} · {s.status}</p></article>)}</section>}
    </div>
  </main>;
}
