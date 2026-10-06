'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, GitBranch, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  mindMapActivities,
  scoreMindMapTrial,
  mindMapSessionSummary,
  buildMindMapLearningRecord,
  type MindMapActivity,
  type MindMapTrialScore,
} from '@/lib/mind-maps';

type Stage='menu'|'first'|'transfer'|'result';

async function publishRecord(record:ReturnType<typeof buildMindMapLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{'content-type':'application/json','x-cza-contract-version':'1.0.0'},
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
}

function MindMapWorkshop(){
  const [stage,setStage]=useState<Stage>('menu');
  const [activity,setActivity]=useState<MindMapActivity|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [sessionStartedAt,setSessionStartedAt]=useState('');
  const [trialStartedAt,setTrialStartedAt]=useState(0);
  const [selections,setSelections]=useState<string[]>([]);
  const [firstScore,setFirstScore]=useState<MindMapTrialScore|null>(null);
  const [transferScore,setTransferScore]=useState<MindMapTrialScore|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const task=useMemo(()=>{
    if(!activity) return null;
    return stage==='transfer'?activity.transfer:activity.first;
  },[activity,stage]);

  async function start(item:MindMapActivity){
    setBusy(true); setError('');
    try{
      const startedAt=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'mind_maps',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-mind-map-v1',
          mode:item.code,
          branchCount:7,
          transferEnabled:true,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setActivity(item);
      setSessionId(String(response.sessionId));
      setSessionStartedAt(startedAt);
      setSelections(Array(7).fill(''));
      setFirstScore(null);
      setTransferScore(null);
      setTrialStartedAt(performance.now());
      setStage('first');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function choose(index:number,value:string){
    setSelections(current=>{
      const next=[...current];
      next[index]=value;
      return next;
    });
  }

  function finishFirst(){
    if(!activity||!task) return;
    const score=scoreMindMapTrial({
      task,
      selections,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
    });
    setFirstScore(score);
    setSelections(Array(7).fill(''));
    setTrialStartedAt(performance.now());
    setStage('transfer');
  }

  async function finishTransfer(){
    if(!activity||!task||!firstScore||!sessionId||busy) return;
    const score=scoreMindMapTrial({
      task,
      selections,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
    });
    setTransferScore(score);
    setBusy(true); setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildMindMapLearningRecord({
        trainingSessionId:sessionId,
        clientRecordId:crypto.randomUUID(),
        mode:activity.code,
        startedAt:sessionStartedAt,
        completedAt,
        first:firstScore,
        transfer:score,
      });
      await publishRecord(record);
      await core('finish',{
        sessionId,
        activeDurationMs:Math.max(0,Date.parse(completedAt)-Date.parse(sessionStartedAt)),
        questionCount:14,
      });
      setStage('result');
    }catch(cause){
      setError(cause instanceof Error&&cause.message==='learning_persistence_unavailable'
        ?'Zihin haritası sonucu merkezi kayda işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function reset(){
    setStage('menu'); setActivity(null); setSessionId(''); setSessionStartedAt('');
    setSelections([]); setFirstScore(null); setTransferScore(null); setError('');
  }

  const summary=firstScore&&transferScore?mindMapSessionSummary({first:firstScore,transfer:transferScore}):null;
  const ready=task&&selections.filter(Boolean).length===task.branches.length;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-6xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f1edf8] text-[#715c9b]"><GitBranch size={28}/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#79689e]">Zihin Gelişim · Zihin Haritaları v1</p>
            <h1 className="mt-2 text-3xl font-semibold">Bir merkez. Yedi dal. Net düşünce.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Merkez fikri yedi ana dala ayır, uzun cümleyi anahtar kelimeye sıkıştır ve aynı yapıyı yeni konuya taşı.</p>
          </div>
        </div>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {stage==='menu'&&<section className="mt-6 grid gap-4 md:grid-cols-2">
        {mindMapActivities.map(item=><button key={item.code} type="button" disabled={busy} onClick={()=>void start(item)}
          className="rounded-2xl border border-[#dce4ed] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1edf8] text-[#715c9b]"><GitBranch size={21}/></span>
          <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.instruction}</p>
          <p className="mt-5 text-xs font-semibold text-[#715c9b]">{busy?'Oturum hazırlanıyor…':'Haritayı kur'}</p>
        </button>)}
      </section>}

      {activity&&task&&(stage==='first'||stage==='transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#79689e]">{activity.title} · {stage==='first'?'İlk harita':'Yeni konu / transfer'}</p>
        <div className="mx-auto mt-5 grid h-28 w-28 place-items-center rounded-full border-4 border-[#cfc3e5] bg-[#f1edf8] p-3 text-center text-sm font-black text-[#5c477e]">{task.center}</div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {task.branches.map((branch,index)=><label key={branch.label} className="rounded-2xl border border-[#ddd6ea] bg-[#fcfbfe] p-4">
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#806fa3]">DAL {index+1} · {branch.label}</span>
            <span className="mt-2 block text-sm text-[#4d5660]">{branch.clue}</span>
            <select
              aria-label={'dal '+(index+1)+' '+branch.label}
              value={selections[index]||''}
              onChange={event=>choose(index,event.target.value)}
              className="mt-3 h-11 w-full rounded-xl border border-[#d7d1e2] bg-white px-3 text-sm font-semibold"
            >
              <option value="">Anahtar kelime seç</option>
              {branch.options.map(option=><option key={option} value={option}>{option}</option>)}
            </select>
          </label>)}
        </div>
        <Button
          onClick={stage==='first'?finishFirst:()=>void finishTransfer()}
          disabled={!ready||busy}
          className="mt-6 h-12 w-full bg-[#715c9b] hover:bg-[#604d86]"
        >
          {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:stage==='first'?'İlk 7 dalı tamamla':'Transfer haritasını tamamla'}
        </Button>
      </section>}

      {activity&&stage==='result'&&summary&&firstScore&&transferScore&&<section className="mt-6 rounded-3xl border border-[#c9dfd4] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#edf8f2] text-[#276151]"><CheckCircle2/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#4f786a]">Oturum merkezi kayda işlendi</p>
            <h2 className="mt-2 text-2xl font-semibold">{activity.title} tamamlandı.</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk harita</span><b className="mt-1 block text-xl">{firstScore.correctBranches}/7</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Yeni konu</span><b className="mt-1 block text-xl">{transferScore.correctBranches}/7</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Transfer tamlığı</span><b className="mt-1 block text-xl">%{Math.round(summary.transferCompleteness*100)}</b></div>
        </div>
        <p className="mt-5 rounded-xl bg-[#f1edf8] p-4 text-sm leading-6 text-[#5c477e]">
          {summary.band==='STRONG_TRANSFER'
            ?'Yedi dallı yapıyı yeni konuya güçlü biçimde taşıdın.'
            :summary.band==='DEVELOPING'
              ?'Harita mantığı oluşuyor. Anahtar kelimeleri daha kısa ve kapsayıcı seçmeye devam et.'
              :'Bir sonraki turda merkez fikir ve dal kategorilerini birlikte kurarak ilerlemek uygun olur.'}
        </p>
        <Button onClick={reset} variant="outline" className="mt-6 h-11 w-full"><RotateCcw/> Başka bir zihin haritası çalış</Button>
      </section>}
    </div>
  </main>;
}

export default function MindMapsPage(){
  return <PackageAccessGate accessCode="mind_maps" label="Zihin Haritaları">
    <MindMapWorkshop/>
  </PackageAccessGate>;
}
