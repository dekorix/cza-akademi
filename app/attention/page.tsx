'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Crosshair, Lightbulb, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  attentionActivities,
  scoreAttentionTrial,
  attentionSessionSummary,
  buildAttentionLearningRecord,
  type AttentionActivity,
  type AttentionTrialScore,
} from '@/lib/attention-focus';

type Stage='menu'|'first'|'transfer'|'result';

async function publishRecord(record:ReturnType<typeof buildAttentionLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{'content-type':'application/json','x-cza-contract-version':'1.0.0'},
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
}

function FocusWorkshop(){
  const [stage,setStage]=useState<Stage>('menu');
  const [activity,setActivity]=useState<AttentionActivity|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [sessionStartedAt,setSessionStartedAt]=useState('');
  const [trialStartedAt,setTrialStartedAt]=useState(0);
  const [selected,setSelected]=useState<number[]>([]);
  const [firstScore,setFirstScore]=useState<AttentionTrialScore|null>(null);
  const [transferScore,setTransferScore]=useState<AttentionTrialScore|null>(null);
  const [firstCue,setFirstCue]=useState(false);
  const [transferCue,setTransferCue]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const current=useMemo(()=>{
    if(!activity) return null;
    return stage==='transfer'?activity.transfer:activity.first;
  },[activity,stage]);

  async function start(item:AttentionActivity){
    setBusy(true); setError('');
    try{
      const startedAt=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'attention_focus',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-attention-v1',
          mode:item.code,
          activityType:'attention_'+item.code,
          transferEnabled:true,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setActivity(item);
      setSessionId(String(response.sessionId));
      setSessionStartedAt(startedAt);
      setSelected([]);
      setFirstScore(null);
      setTransferScore(null);
      setFirstCue(false);
      setTransferCue(false);
      setTrialStartedAt(performance.now());
      setStage('first');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function toggle(index:number){
    setSelected(currentSelection=>
      currentSelection.includes(index)
        ?currentSelection.filter(value=>value!==index)
        :[...currentSelection,index]
    );
  }

  function useCue(){
    if(stage==='first') setFirstCue(true);
    if(stage==='transfer') setTransferCue(true);
  }

  function finishFirst(){
    if(!activity||!current) return;
    const score=scoreAttentionTrial({
      mode:activity.code,
      phase:'first',
      items:current.items,
      targets:current.targets,
      selectedIndexes:selected,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
      cueUsed:firstCue,
    });
    setFirstScore(score);
    setSelected([]);
    setTrialStartedAt(performance.now());
    setStage('transfer');
  }

  async function finishTransfer(){
    if(!activity||!current||!firstScore||!sessionId||busy) return;
    const score=scoreAttentionTrial({
      mode:activity.code,
      phase:'transfer',
      items:current.items,
      targets:current.targets,
      selectedIndexes:selected,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
      cueUsed:transferCue,
    });
    setTransferScore(score);
    setBusy(true); setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildAttentionLearningRecord({
        trainingSessionId:sessionId,
        clientRecordId:crypto.randomUUID(),
        mode:activity.code,
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
        ?'Dikkat sonucu merkezi kayda işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function reset(){
    setStage('menu'); setActivity(null); setSessionId(''); setSessionStartedAt('');
    setSelected([]); setFirstScore(null); setTransferScore(null);
    setFirstCue(false); setTransferCue(false); setError('');
  }

  const summary=activity&&firstScore&&transferScore
    ?attentionSessionSummary({mode:activity.code,first:firstScore,transfer:transferScore})
    :null;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-5xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e8f3f2] text-[#26766e]"><Crosshair size={28}/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#4f817c]">Zihin Gelişim · Dikkat & Derin Odak v1</p>
            <h1 className="mt-2 text-3xl font-semibold">Hedefi gör. Kuralı koru. Dürtüyü yönet.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Sistem yalnız doğru sayısını değil; yanlış alarmı, kaçırmayı, kural değişimindeki uyumu ve yeni örneğe transferi de kaydeder.</p>
          </div>
        </div>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {stage==='menu'&&<section className="mt-6 grid gap-4 md:grid-cols-2">
        {attentionActivities.map(item=><button key={item.code} type="button" disabled={busy} onClick={()=>void start(item)}
          className="rounded-2xl border border-[#dce4ed] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f3f2] text-[#26766e]"><ShieldCheck size={21}/></span>
            <span className="rounded-full bg-[#f4f6f8] px-3 py-1 text-[10px] font-black text-[#66798a]">İLK + TRANSFER</span>
          </div>
          <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.instruction}</p>
          <p className="mt-5 text-xs font-semibold text-[#26766e]">{busy?'Oturum hazırlanıyor…':'Çalışmayı başlat'}</p>
        </button>)}
      </section>}

      {activity&&current&&(stage==='first'||stage==='transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#4f817c]">{activity.title} · {stage==='first'?'İlk kural':'Yeni kural / transfer'}</p>
        <h2 className="mt-3 text-2xl font-semibold">{current.rule}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Hedef olduğunu düşündüğün hücrelere dokun. Emin değilsen boş bırakabilirsin.</p>

        <div className="mt-7 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {current.items.map((item,index)=>{
            const active=selected.includes(index);
            const cls=active
              ?'grid min-h-20 place-items-center rounded-2xl border-2 border-[#26766e] bg-[#e8f3f2] text-2xl shadow-sm'
              :'grid min-h-20 place-items-center rounded-2xl border border-[#dce4ed] bg-white text-2xl transition hover:bg-[#f8fafc]';
            return <button
              key={index}
              type="button"
              aria-label={'hücre '+(index+1)+' '+item}
              aria-pressed={active}
              onClick={()=>toggle(index)}
              className={cls}
            >{item}</button>;
          })}
        </div>

        {(stage==='first'?firstCue:transferCue)&&<div className="mt-5 rounded-xl bg-[#eef7f6] p-4 text-sm leading-6 text-[#315f5a]"><b>Kural hatırlatması:</b> {current.rule}</div>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={useCue} disabled={stage==='first'?firstCue:transferCue} className="h-11 sm:flex-1"><Lightbulb/> Kuralı hatırlat</Button>
          <Button onClick={stage==='first'?finishFirst:()=>void finishTransfer()} disabled={busy} className="h-11 bg-[#26766e] hover:bg-[#205f59] sm:flex-[2]">
            {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:stage==='first'?'İlk turu tamamla':'Transferi tamamla'}
          </Button>
        </div>
      </section>}

      {activity&&stage==='result'&&summary&&firstScore&&transferScore&&<section className="mt-6 rounded-3xl border border-[#c9dfd4] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#edf8f2] text-[#276151]"><CheckCircle2/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#4f786a]">Oturum merkezi kayda işlendi</p>
            <h2 className="mt-2 text-2xl font-semibold">{activity.title} tamamlandı.</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk doğruluk</span><b className="mt-1 block text-xl">%{Math.round(firstScore.accuracy*100)}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Transfer</span><b className="mt-1 block text-xl">%{Math.round(transferScore.accuracy*100)}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Yanlış alarm</span><b className="mt-1 block text-xl">{summary.falseAlarmTotal}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Kaçırma</span><b className="mt-1 block text-xl">{summary.omissionTotal}</b></div>
        </div>
        <p className="mt-5 rounded-xl bg-[#eef7f6] p-4 text-sm leading-6 text-[#315f5a]">
          {summary.band==='STRONG_CONTROL'
            ?'Kuralı güçlü biçimde korudun ve yeni kurala aktarabildin.'
            :summary.band==='DEVELOPING'
              ?'Dikkat kontrolün gelişiyor. Kısa ve düzenli tekrarlarla yanlış alarm ve kaçırmaları azaltabiliriz.'
              :'Bu beceriyi daha kısa setler ve daha belirgin kurallarla rehberli çalışmak uygun olur.'}
        </p>
        <Button onClick={reset} variant="outline" className="mt-6 h-11 w-full"><RotateCcw/> Başka bir dikkat çalışması seç</Button>
        <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Bu sonuç eğitimsel egzersiz verisidir; klinik dikkat testi veya tanı değildir.</p>
      </section>}
    </div>
  </main>;
}

export default function AttentionPage(){
  return <PackageAccessGate accessCode="attention_focus" label="Dikkat & Derin Odak">
    <FocusWorkshop/>
  </PackageAccessGate>;
}
