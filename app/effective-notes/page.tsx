'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpenCheck, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  effectiveNoteActivities,
  scoreEffectiveNoteTrial,
  effectiveNoteSummary,
  buildEffectiveNoteLearningRecord,
  type EffectiveNoteActivity,
  type EffectiveNoteTrialScore,
} from '@/lib/effective-notes';

type Stage='menu'|'first'|'transfer'|'result';

async function publishRecord(record:ReturnType<typeof buildEffectiveNoteLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{'content-type':'application/json','x-cza-contract-version':'1.0.0'},
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
}

function EffectiveNotesWorkshop(){
  const [stage,setStage]=useState<Stage>('menu');
  const [activity,setActivity]=useState<EffectiveNoteActivity|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [sessionStartedAt,setSessionStartedAt]=useState('');
  const [trialStartedAt,setTrialStartedAt]=useState(0);
  const [answers,setAnswers]=useState<number[]>([]);
  const [note,setNote]=useState('');
  const [firstScore,setFirstScore]=useState<EffectiveNoteTrialScore|null>(null);
  const [transferScore,setTransferScore]=useState<EffectiveNoteTrialScore|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const task=useMemo(()=>{
    if(!activity) return null;
    return stage==='transfer'?activity.transfer:activity.first;
  },[activity,stage]);

  async function start(item:EffectiveNoteActivity){
    setBusy(true); setError('');
    try{
      const startedAt=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'effective_notes',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-effective-notes-v1',
          mode:item.code,
          activityType:'effective_notes_'+item.code,
          rawNoteStored:false,
          transferEnabled:true,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setActivity(item);
      setSessionId(String(response.sessionId));
      setSessionStartedAt(startedAt);
      setAnswers([]);
      setNote('');
      setFirstScore(null);
      setTransferScore(null);
      setTrialStartedAt(performance.now());
      setStage('first');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function choose(promptIndex:number,optionIndex:number){
    setAnswers(current=>{
      const next=[...current];
      next[promptIndex]=optionIndex;
      return next;
    });
  }

  function scoreCurrent(){
    if(!task) return null;
    return scoreEffectiveNoteTrial({
      task,
      answers,
      note,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
    });
  }

  function finishFirst(){
    const score=scoreCurrent();
    if(!score) return;
    setFirstScore(score);
    setAnswers([]);
    setNote('');
    setTrialStartedAt(performance.now());
    setStage('transfer');
  }

  async function finishTransfer(){
    if(!activity||!firstScore||!sessionId||busy) return;
    const score=scoreCurrent();
    if(!score) return;
    setTransferScore(score);
    setBusy(true); setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildEffectiveNoteLearningRecord({
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
        questionCount:6,
      });
      setStage('result');
    }catch(cause){
      setError(cause instanceof Error&&cause.message==='learning_persistence_unavailable'
        ?'Not alma sonucu merkezi kayda işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function reset(){
    setStage('menu'); setActivity(null); setSessionId(''); setSessionStartedAt('');
    setAnswers([]); setNote(''); setFirstScore(null); setTransferScore(null); setError('');
  }

  const ready=task
    ? answers.filter(value=>Number.isInteger(value)).length===task.prompts.length && note.trim().length>=8
    : false;
  const summary=firstScore&&transferScore?effectiveNoteSummary({first:firstScore,transfer:transferScore}):null;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-5xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#eef5ea] text-[#55784b]"><BookOpenCheck size={28}/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#6f8b66]">Zihin Gelişim · Etkili Not Alma v1</p>
            <h1 className="mt-2 text-3xl font-semibold">Her şeyi yazma. İşe yarayanı yakala.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Ana fikri, güçlü anahtar kelimeleri ve kısa özeti seç. Yazdığın ham not merkezi kayda gönderilmez; yalnız öğrenme göstergeleri kaydedilir.</p>
          </div>
        </div>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {stage==='menu'&&<section className="mt-6 grid gap-4 md:grid-cols-2">
        {effectiveNoteActivities.map(item=><button key={item.code} type="button" disabled={busy} onClick={()=>void start(item)}
          className="rounded-2xl border border-[#dce4ed] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef5ea] text-[#55784b]"><BookOpenCheck size={21}/></span>
          <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.instruction}</p>
          <p className="mt-5 text-xs font-semibold text-[#55784b]">{busy?'Oturum hazırlanıyor…':'Çalışmayı başlat'}</p>
        </button>)}
      </section>}

      {activity&&task&&(stage==='first'||stage==='transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#6f8b66]">{activity.title} · {stage==='first'?'İlk çalışma':'Yeni konu / transfer'}</p>
        <h2 className="mt-3 text-2xl font-semibold">{task.title}</h2>
        <p className="mt-5 rounded-2xl bg-[#fbfcfa] p-5 text-base leading-8 text-[#304332]">{task.source}</p>

        <div className="mt-6 space-y-5">
          {task.prompts.map((prompt,pIndex)=><fieldset key={prompt.label} className="rounded-2xl border border-[#dce4ed] p-5">
            <legend className="px-2 text-sm font-semibold">{prompt.label}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {prompt.options.map((option,oIndex)=><button
                key={option}
                type="button"
                aria-pressed={answers[pIndex]===oIndex}
                onClick={()=>choose(pIndex,oIndex)}
                className={answers[pIndex]===oIndex
                  ?'rounded-xl border border-[#55784b] bg-[#eef5ea] p-3 text-sm font-semibold text-[#476440]'
                  :'rounded-xl border border-[#dce4ed] bg-white p-3 text-sm font-medium hover:bg-[#f8fafc]'}
              >{option}</button>)}
            </div>
          </fieldset>)}
        </div>

        <label className="mt-6 block text-sm font-semibold">
          Kendi kısa notun
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Metni kopyalama. Sana konuyu hatırlatacak kısa ve güçlü bir not yaz.</span>
          <textarea
            value={note}
            onChange={event=>setNote(event.target.value.slice(0,500))}
            className="mt-3 min-h-28 w-full resize-none rounded-xl border border-[#dce4ed] p-4 text-sm font-normal leading-6"
            placeholder="Örnek: ana fikir + 2-3 anahtar kelime..."
          />
        </label>

        <Button
          onClick={stage==='first'?finishFirst:()=>void finishTransfer()}
          disabled={!ready||busy}
          className="mt-6 h-12 w-full bg-[#55784b] hover:bg-[#486640]"
        >
          {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:stage==='first'?'İlk çalışmayı tamamla':'Transferi tamamla'}
        </Button>
        <p className="mt-3 text-[10px] leading-5 text-muted-foreground">Gizlilik: Yazdığın ham not saklanmaz. Yalnız not uzunluğu, sıkıştırma oranı ve görev performansı kaydedilir.</p>
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
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk seçim</span><b className="mt-1 block text-xl">%{Math.round(firstScore.selectionAccuracy*100)}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Transfer</span><b className="mt-1 block text-xl">%{Math.round(transferScore.selectionAccuracy*100)}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk not</span><b className="mt-1 block text-xl">{firstScore.noteWordCount} kelime</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Transfer notu</span><b className="mt-1 block text-xl">{transferScore.noteWordCount} kelime</b></div>
        </div>
        <p className="mt-5 rounded-xl bg-[#eef5ea] p-4 text-sm leading-6 text-[#476440]">
          {summary.band==='STRONG_TRANSFER'
            ?'Bilgiyi doğru seçip yeni konuda kısa ve işlevsel nota dönüştürebildin.'
            :summary.band==='DEVELOPING'
              ?'Not süzme becerin gelişiyor. Ana fikir ve anahtar kelimeyi biraz daha sıkıştırarak güçlendirebiliriz.'
              :'Bir sonraki çalışmada daha kısa kaynak ve örneklenmiş not şablonuyla ilerlemek uygun olur.'}
        </p>
        <Button onClick={reset} variant="outline" className="mt-6 h-11 w-full"><RotateCcw/> Başka bir not alma yöntemi seç</Button>
      </section>}
    </div>
  </main>;
}

export default function EffectiveNotesPage(){
  return <PackageAccessGate accessCode="effective_notes" label="Etkili Not Alma">
    <EffectiveNotesWorkshop/>
  </PackageAccessGate>;
}
