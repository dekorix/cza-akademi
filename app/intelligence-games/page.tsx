'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lightbulb, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  intelligenceGameActivities,
  scoreIntelligenceTrial,
  intelligenceSessionSummary,
  buildIntelligenceLearningRecord,
  type IntelligenceGameActivity,
  type IntelligenceTrialScore,
} from '@/lib/intelligence-games';

type Stage='menu'|'first'|'transfer'|'result';

async function publishRecord(record:ReturnType<typeof buildIntelligenceLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{'content-type':'application/json','x-cza-contract-version':'1.0.0'},
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
}

function IntelligenceWorkshop(){
  const [stage,setStage]=useState<Stage>('menu');
  const [activity,setActivity]=useState<IntelligenceGameActivity|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [sessionStartedAt,setSessionStartedAt]=useState('');
  const [trialStartedAt,setTrialStartedAt]=useState(0);
  const [answers,setAnswers]=useState<number[]>([]);
  const [revisions,setRevisions]=useState<number[]>([]);
  const [firstScore,setFirstScore]=useState<IntelligenceTrialScore|null>(null);
  const [transferScore,setTransferScore]=useState<IntelligenceTrialScore|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const puzzles=useMemo(()=>{
    if(!activity) return [];
    return stage==='transfer'?activity.transfer:activity.first;
  },[activity,stage]);

  async function start(item:IntelligenceGameActivity){
    setBusy(true); setError('');
    try{
      const startedAt=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'intelligence_games',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-intelligence-games-v1',
          mode:item.code,
          puzzleCount:3,
          transferEnabled:true,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setActivity(item);
      setSessionId(String(response.sessionId));
      setSessionStartedAt(startedAt);
      setAnswers([]);
      setRevisions([0,0,0]);
      setFirstScore(null);
      setTransferScore(null);
      setTrialStartedAt(performance.now());
      setStage('first');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function choose(questionIndex:number,optionIndex:number){
    setAnswers(current=>{
      const next=[...current];
      if(Number.isInteger(next[questionIndex])&&next[questionIndex]!==optionIndex){
        setRevisions(currentRevisions=>{
          const updated=[...currentRevisions];
          updated[questionIndex]=(updated[questionIndex]||0)+1;
          return updated;
        });
      }
      next[questionIndex]=optionIndex;
      return next;
    });
  }

  function finishFirst(){
    if(!activity) return;
    const score=scoreIntelligenceTrial({
      puzzles:activity.first,
      answers,
      revisions,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
    });
    setFirstScore(score);
    setAnswers([]);
    setRevisions([0,0,0]);
    setTrialStartedAt(performance.now());
    setStage('transfer');
  }

  async function finishTransfer(){
    if(!activity||!firstScore||!sessionId||busy) return;
    const score=scoreIntelligenceTrial({
      puzzles:activity.transfer,
      answers,
      revisions,
      startedAt:trialStartedAt,
      completedAt:performance.now(),
    });
    setTransferScore(score);
    setBusy(true); setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildIntelligenceLearningRecord({
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
        ?'Zekâ oyunu sonucu merkezi kayda işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function reset(){
    setStage('menu'); setActivity(null); setSessionId(''); setSessionStartedAt('');
    setAnswers([]); setRevisions([]); setFirstScore(null); setTransferScore(null); setError('');
  }

  const summary=firstScore&&transferScore?intelligenceSessionSummary({first:firstScore,transfer:transferScore}):null;
  const ready=answers.filter(value=>Number.isInteger(value)).length===3;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-5xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#fff2e8] text-[#9a6230]"><Lightbulb size={28}/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#9b724d]">Zihin Gelişim · Zekâ Oyunları v1</p>
            <h1 className="mt-2 text-3xl font-semibold">Kuralı bul. Çözümü dene. Yeni probleme taşı.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Örüntü, sınıflama, mantıksal çıkarım ve planlama ayrı beceriler olarak izlenir. Sonuç bir IQ veya zekâ puanı değildir.</p>
          </div>
        </div>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {stage==='menu'&&<section className="mt-6 grid gap-4 md:grid-cols-2">
        {intelligenceGameActivities.map(item=><button key={item.code} type="button" disabled={busy} onClick={()=>void start(item)}
          className="rounded-2xl border border-[#dce4ed] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff2e8] text-[#9a6230]"><Lightbulb size={21}/></span>
          <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.instruction}</p>
          <p className="mt-5 text-xs font-semibold text-[#9a6230]">{busy?'Oturum hazırlanıyor…':'Oyunu başlat'}</p>
        </button>)}
      </section>}

      {activity&&(stage==='first'||stage==='transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#9b724d]">{activity.title} · {stage==='first'?'İlk set':'Yeni problemler / transfer'}</p>
        <div className="mt-6 space-y-5">
          {puzzles.map((puzzle,qIndex)=><fieldset key={puzzle.prompt} className="rounded-2xl border border-[#eadfd5] bg-[#fffdfa] p-5">
            <legend className="px-2 text-sm font-semibold">{qIndex+1}. {puzzle.prompt}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {puzzle.options.map((option,oIndex)=><button
                key={option}
                type="button"
                aria-pressed={answers[qIndex]===oIndex}
                onClick={()=>choose(qIndex,oIndex)}
                className={answers[qIndex]===oIndex
                  ?'rounded-xl border border-[#9a6230] bg-[#fff2e8] p-3 text-sm font-semibold text-[#7f4e26]'
                  :'rounded-xl border border-[#e4d8ce] bg-white p-3 text-sm font-medium hover:bg-[#fffaf5]'}
              >{option}</button>)}
            </div>
          </fieldset>)}
        </div>
        <Button
          onClick={stage==='first'?finishFirst:()=>void finishTransfer()}
          disabled={!ready||busy}
          className="mt-6 h-12 w-full bg-[#9a6230] hover:bg-[#805126]"
        >
          {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:stage==='first'?'İlk seti tamamla':'Transfer setini tamamla'}
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
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk set</span><b className="mt-1 block text-xl">{firstScore.correct}/3</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Yeni set</span><b className="mt-1 block text-xl">{transferScore.correct}/3</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Cevap revizyonu</span><b className="mt-1 block text-xl">{summary.totalRevisions}</b></div>
        </div>
        <p className="mt-5 rounded-xl bg-[#fff5ed] p-4 text-sm leading-6 text-[#7f4e26]">
          {summary.band==='STRONG_TRANSFER'
            ?'Çözüm kuralını yeni problemlere güçlü biçimde taşıdın.'
            :summary.band==='DEVELOPING'
              ?'Akıl yürütme gelişiyor. Çözümden önce kuralı sözle ifade etmek bir sonraki adım olabilir.'
              :'Bir sonraki turda daha az seçenek ve birlikte kural keşfiyle ilerlemek uygun olur.'}
        </p>
        <Button onClick={reset} variant="outline" className="mt-6 h-11 w-full"><RotateCcw/> Başka bir zekâ oyunu seç</Button>
        <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Bu bölüm eğitimsel problem çözme verisi üretir; IQ, zekâ yaşı veya klinik tanı üretmez.</p>
      </section>}
    </div>
  </main>;
}

export default function IntelligenceGamesPage(){
  return <PackageAccessGate accessCode="intelligence_games" label="Zekâ Oyunları">
    <IntelligenceWorkshop/>
  </PackageAccessGate>;
}
