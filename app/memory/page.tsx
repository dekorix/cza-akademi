'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, BrainCircuit, CheckCircle2, Lightbulb, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  memoryTechniques,
  scoreMemoryTrial,
  memorySessionSummary,
  buildMemoryLearningRecord,
  type MemoryTechnique,
  type MemoryTrialScore,
} from '@/lib/memory-techniques';

type Stage='menu'|'study_first'|'recall_first'|'study_transfer'|'recall_transfer'|'result';

function choices(technique:MemoryTechnique,phase:'first'|'transfer'){
  const target=phase==='first'?technique.firstItems:technique.transferItems;
  const distractors=phase==='first'?technique.distractors:[...technique.distractors].reverse();
  return target.flatMap((item,index)=>[item,distractors[index%distractors.length]]).slice(0,target.length*2);
}

async function publishRecord(record:ReturnType<typeof buildMemoryLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-cza-contract-version':'1.0.0',
    },
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string;learningRecordId?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
  return body;
}

function MemoryWorkshop(){
  const [stage,setStage]=useState<Stage>('menu');
  const [technique,setTechnique]=useState<MemoryTechnique|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [sessionStartedAt,setSessionStartedAt]=useState('');
  const [trialStartedAt,setTrialStartedAt]=useState(0);
  const [selected,setSelected]=useState<string[]>([]);
  const [firstScore,setFirstScore]=useState<MemoryTrialScore|null>(null);
  const [transferScore,setTransferScore]=useState<MemoryTrialScore|null>(null);
  const [firstCue,setFirstCue]=useState(false);
  const [transferCue,setTransferCue]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const currentTarget=useMemo(()=>{
    if(!technique) return [];
    return stage==='study_transfer'||stage==='recall_transfer'?technique.transferItems:technique.firstItems;
  },[technique,stage]);

  const currentChoices=useMemo(()=>{
    if(!technique) return [];
    return choices(technique,stage==='recall_transfer'?'transfer':'first');
  },[technique,stage]);

  async function start(item:MemoryTechnique){
    setBusy(true);
    setError('');
    try{
      const startedAt=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'memory',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-memory-v1',
          technique:item.code,
          activityType:'memory_'+item.code,
          targetCount:item.firstItems.length,
          transferEnabled:true,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setTechnique(item);
      setSessionId(String(response.sessionId));
      setSessionStartedAt(startedAt);
      setSelected([]);
      setFirstScore(null);
      setTransferScore(null);
      setFirstCue(false);
      setTransferCue(false);
      setStage('study_first');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{
      setBusy(false);
    }
  }

  function beginRecall(){
    setSelected([]);
    setTrialStartedAt(performance.now());
    setStage(stage==='study_transfer'?'recall_transfer':'recall_first');
  }

  function toggle(item:string){
    if(!technique) return;
    const limit=currentTarget.length;
    setSelected(current=>{
      if(current.includes(item)) return current.filter(value=>value!==item);
      if(current.length>=limit) return current;
      return [...current,item];
    });
  }

  function useCue(){
    if(stage==='recall_first') setFirstCue(true);
    if(stage==='recall_transfer') setTransferCue(true);
  }

  function finishFirst(){
    if(!technique) return;
    const score=scoreMemoryTrial({
      technique:technique.code,
      phase:'first',
      selected,
      target:technique.firstItems,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
      cueUsed:firstCue,
    });
    setFirstScore(score);
    setSelected([]);
    setStage('study_transfer');
  }

  async function finishTransfer(){
    if(!technique||!firstScore||!sessionId||busy) return;
    const score=scoreMemoryTrial({
      technique:technique.code,
      phase:'transfer',
      selected,
      target:technique.transferItems,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
      cueUsed:transferCue,
    });
    setTransferScore(score);
    setBusy(true);
    setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildMemoryLearningRecord({
        trainingSessionId:sessionId,
        clientRecordId:crypto.randomUUID(),
        technique:technique.code,
        startedAt:sessionStartedAt,
        completedAt,
        first:firstScore,
        transfer:score,
        cueUsed:firstCue||transferCue,
      });
      await publishRecord(record);
      await core('finish',{
        sessionId,
        activeDurationMs:Math.max(0,Date.parse(completedAt)-Date.parse(sessionStartedAt)),
        questionCount:2,
      });
      setStage('result');
    }catch(cause){
      setError(cause instanceof Error&&cause.message==='learning_persistence_unavailable'
        ?'Hafıza sonucu merkezi kayda işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{
      setBusy(false);
    }
  }

  function reset(){
    setTechnique(null);
    setSessionId('');
    setSessionStartedAt('');
    setSelected([]);
    setFirstScore(null);
    setTransferScore(null);
    setFirstCue(false);
    setTransferCue(false);
    setError('');
    setStage('menu');
  }

  const summary=technique&&firstScore&&transferScore
    ?memorySessionSummary({technique:technique.code,first:firstScore,transfer:transferScore})
    :null;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-5xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#eeeaf8] text-[#6f5ca8]"><BrainCircuit size={28}/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#7868a4]">Zihin Gelişim · Hafıza Teknikleri v1</p>
            <h1 className="mt-2 text-3xl font-semibold">Ezberleme. Bir yöntem kullan.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Her çalışma sana farklı bir hatırlama yolu öğretir. Sistem yalnız kaç kelimeyi bildiğini değil, yeni örnekte aynı yöntemi kullanıp kullanamadığını da kaydeder.</p>
          </div>
        </div>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {stage==='menu'&&<section className="mt-6 grid gap-4 md:grid-cols-2">
        {memoryTechniques.map(item=><button key={item.code} type="button" onClick={()=>void start(item)} disabled={busy}
          className="rounded-2xl border border-[#dce4ed] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2eff9] text-[#6f5ca8]"><Sparkles size={21}/></span>
            <span className="rounded-full bg-[#f4f6f8] px-3 py-1 text-[10px] font-black text-[#66798a]">2 AŞAMALI</span>
          </div>
          <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.short}</p>
          <p className="mt-5 text-xs font-semibold text-[#6f5ca8]">{busy?'Oturum hazırlanıyor…':'Tekniği çalış'}</p>
        </button>)}
      </section>}

      {technique&&(stage==='study_first'||stage==='study_transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#7868a4]">{technique.title} · {stage==='study_first'?'İlk öğrenme':'Yeni örneğe transfer'}</p>
        <h2 className="mt-3 text-2xl font-semibold">{stage==='study_first'?technique.instruction:'Aynı tekniği şimdi tamamen yeni kelimelerde kullan.'}</h2>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {currentTarget.map((item,index)=><div key={item} className="rounded-2xl border border-[#e2e6ed] bg-[#fafbfc] p-5 text-center">
            <span className="text-[10px] font-black text-[#8291a0]">{index+1}</span>
            <p className="mt-2 text-lg font-semibold">{item}</p>
          </div>)}
        </div>
        <div className="mt-7 rounded-xl bg-[#f4f1fa] p-4 text-sm leading-6 text-[#62568b]"><b>Teknik:</b> {technique.coachPrompt}</div>
        <Button onClick={beginRecall} className="mt-6 h-12 w-full bg-[#66559d] text-base hover:bg-[#57488a]">Hazırım, kelimeleri gizle</Button>
      </section>}

      {technique&&(stage==='recall_first'||stage==='recall_transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#7868a4]">{stage==='recall_first'?'İlk hatırlama':'Transfer hatırlaması'}</p>
        <h2 className="mt-3 text-2xl font-semibold">Gördüklerini seç.</h2>
        <p className="mt-2 text-sm text-muted-foreground">En fazla {currentTarget.length} seçim yapabilirsin. Emin olmadığın nesneyi seçmek zorunda değilsin.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {currentChoices.map(item=>{
            const active=selected.includes(item);
            const classes=active
              ?'min-h-20 rounded-2xl border border-[#66559d] bg-[#eeeaf8] p-3 text-sm font-semibold text-[#51447e] transition'
              :'min-h-20 rounded-2xl border border-[#dce4ed] bg-white p-3 text-sm font-semibold transition hover:bg-[#f8fafc]';
            return <button key={item} type="button" onClick={()=>toggle(item)} className={classes}>{item}</button>;
          })}
        </div>

        {(stage==='recall_first'?firstCue:transferCue)&&<div className="mt-5 rounded-xl bg-[#fff8e9] p-4 text-sm leading-6 text-[#7b6124]"><b>Hatırlatma:</b> {technique.coachPrompt}</div>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={useCue} disabled={stage==='recall_first'?firstCue:transferCue} className="h-11 sm:flex-1"><Lightbulb/> Tekniği hatırlat</Button>
          <Button onClick={stage==='recall_first'?finishFirst:()=>void finishTransfer()} disabled={busy} className="h-11 bg-[#66559d] hover:bg-[#57488a] sm:flex-[2]">
            {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:stage==='recall_first'?'İlk denemeyi tamamla':'Transferi tamamla'}
          </Button>
        </div>
      </section>}

      {technique&&stage==='result'&&summary&&firstScore&&transferScore&&<section className="mt-6 rounded-3xl border border-[#c9dfd4] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#edf8f2] text-[#276151]"><CheckCircle2/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#4f786a]">Oturum merkezi kayda işlendi</p>
            <h2 className="mt-2 text-2xl font-semibold">{technique.title} tamamlandı.</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk hatırlama</span><b className="mt-1 block text-xl">{firstScore.recalled}/{firstScore.targetCount}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Yeni örnek</span><b className="mt-1 block text-xl">{transferScore.recalled}/{transferScore.targetCount}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Teknik kullanımı</span><b className="mt-1 block text-sm">{firstCue||transferCue?'Hatırlatmayla':'Bağımsız'}</b></div>
        </div>
        <p className="mt-5 rounded-xl bg-[#f4f1fa] p-4 text-sm leading-6 text-[#62568b]">
          {summary.band==='STRONG_TRANSFER'
            ?'Tekniği yeni örneğe güçlü biçimde taşıdın. Şimdi farklı türde bilgilerde kullanmaya başlayabilirsin.'
            :summary.band==='DEVELOPING'
              ?'Teknik işe yarıyor. Birkaç kısa tekrar daha yeni örneklerde daha rahat kullanmanı sağlar.'
              :'Tekniği öğrenme aşamasındasın. Bir sonraki çalışmada daha az kelime ve daha güçlü görselleştirme ile devam etmek iyi olur.'}
        </p>
        <Button onClick={reset} variant="outline" className="mt-6 h-11 w-full"><RotateCcw/> Başka bir hafıza tekniği çalış</Button>
        <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Bu sonuç eğitimsel çalışma verisidir; klinik hafıza testi veya tanı değildir.</p>
      </section>}
    </div>
  </main>;
}

export default function MemoryPage(){
  return <PackageAccessGate accessCode="memory" label="Hafıza Teknikleri">
    <MemoryWorkshop/>
  </PackageAccessGate>;
}
