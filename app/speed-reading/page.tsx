'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpenCheck, CheckCircle2, Gauge, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  speedReadingActivities,
  scoreReadingTrial,
  speedReadingSummary,
  buildSpeedReadingLearningRecord,
  type SpeedReadingActivity,
  type ReadingTrialScore,
} from '@/lib/speed-reading';

type Stage='menu'|'read_first'|'quiz_first'|'read_transfer'|'quiz_transfer'|'result';

async function publishRecord(record:ReturnType<typeof buildSpeedReadingLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{'content-type':'application/json','x-cza-contract-version':'1.0.0'},
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
}

function SpeedReadingWorkshop(){
  const [stage,setStage]=useState<Stage>('menu');
  const [activity,setActivity]=useState<SpeedReadingActivity|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [sessionStartedAt,setSessionStartedAt]=useState('');
  const [readStartedAt,setReadStartedAt]=useState(0);
  const [readDurationMs,setReadDurationMs]=useState(0);
  const [answers,setAnswers]=useState<number[]>([]);
  const [firstScore,setFirstScore]=useState<ReadingTrialScore|null>(null);
  const [transferScore,setTransferScore]=useState<ReadingTrialScore|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const currentPassage=useMemo(()=>{
    if(!activity) return null;
    return stage==='read_transfer'||stage==='quiz_transfer'?activity.transfer:activity.first;
  },[activity,stage]);

  async function start(item:SpeedReadingActivity){
    setBusy(true); setError('');
    try{
      const startedAt=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'speed_reading',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-speed-reading-v1',
          mode:item.code,
          activityType:'speed_reading_'+item.code,
          comprehensionGuard:true,
          transferEnabled:true,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setActivity(item);
      setSessionId(String(response.sessionId));
      setSessionStartedAt(startedAt);
      setAnswers([]);
      setFirstScore(null);
      setTransferScore(null);
      setReadStartedAt(performance.now());
      setStage('read_first');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function finishReading(){
    setReadDurationMs(Math.max(1000,performance.now()-readStartedAt));
    setAnswers([]);
    setStage(stage==='read_transfer'?'quiz_transfer':'quiz_first');
  }

  function answer(questionIndex:number,optionIndex:number){
    setAnswers(current=>{
      const next=[...current];
      next[questionIndex]=optionIndex;
      return next;
    });
  }

  function finishFirstQuiz(){
    if(!activity) return;
    const score=scoreReadingTrial({
      text:activity.first.text,
      durationMs:readDurationMs,
      answers,
      correctAnswers:activity.first.questions.map(item=>item.correctIndex),
    });
    setFirstScore(score);
    setAnswers([]);
    setReadStartedAt(performance.now());
    setStage('read_transfer');
  }

  async function finishTransferQuiz(){
    if(!activity||!firstScore||!sessionId||busy) return;
    const score=scoreReadingTrial({
      text:activity.transfer.text,
      durationMs:readDurationMs,
      answers,
      correctAnswers:activity.transfer.questions.map(item=>item.correctIndex),
    });
    setTransferScore(score);
    setBusy(true); setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildSpeedReadingLearningRecord({
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
        questionCount:4,
      });
      setStage('result');
    }catch(cause){
      setError(cause instanceof Error&&cause.message==='learning_persistence_unavailable'
        ?'Hızlı okuma sonucu merkezi kayda işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function reset(){
    setStage('menu'); setActivity(null); setSessionId(''); setSessionStartedAt('');
    setAnswers([]); setFirstScore(null); setTransferScore(null); setError('');
  }

  const summary=firstScore&&transferScore?speedReadingSummary({first:firstScore,transfer:transferScore}):null;
  const quizReady=currentPassage&&answers.filter(value=>Number.isInteger(value)).length===currentPassage.questions.length;

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-5xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e9f0f8] text-[#3e658c]"><Gauge size={28}/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#587b9e]">Zihin Gelişim · Hızlı Okuma v1</p>
            <h1 className="mt-2 text-3xl font-semibold">Hızlanırken anlamı yanında tut.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Okuma süresi ve anlama birlikte izlenir. Daha hızlı bitirmek, anlam kaybı varsa başarı sayılmaz.</p>
          </div>
        </div>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {stage==='menu'&&<section className="mt-6 grid gap-4 md:grid-cols-2">
        {speedReadingActivities.map(item=><button key={item.code} type="button" disabled={busy} onClick={()=>void start(item)}
          className="rounded-2xl border border-[#dce4ed] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f0f8] text-[#3e658c]"><BookOpenCheck size={21}/></span>
          <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.instruction}</p>
          <p className="mt-5 text-xs font-semibold text-[#3e658c]">{busy?'Oturum hazırlanıyor…':'Çalışmayı başlat'}</p>
        </button>)}
      </section>}

      {activity&&currentPassage&&(stage==='read_first'||stage==='read_transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-10">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#587b9e]">{activity.title} · {stage==='read_first'?'İlk metin':'Yeni metin / transfer'}</p>
        <h2 className="mt-3 text-2xl font-semibold">{currentPassage.title}</h2>
        <p className="mt-6 rounded-2xl bg-[#fbfcfe] p-6 text-lg leading-9 text-[#263746]">{currentPassage.text}</p>
        <p className="mt-4 text-xs text-muted-foreground">Metni doğal biçimde oku. Bitirdiğinde düğmeye bas; süre o anda durur.</p>
        <Button onClick={finishReading} className="mt-5 h-12 w-full bg-[#3e658c] hover:bg-[#345677]">Metni okudum</Button>
      </section>}

      {activity&&currentPassage&&(stage==='quiz_first'||stage==='quiz_transfer')&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#587b9e]">Anlama kontrolü</p>
        <h2 className="mt-3 text-2xl font-semibold">Metne bakmadan cevapla.</h2>
        <div className="mt-6 space-y-6">
          {currentPassage.questions.map((question,qIndex)=><fieldset key={question.prompt} className="rounded-2xl border border-[#dce4ed] p-5">
            <legend className="px-2 text-sm font-semibold">{qIndex+1}. {question.prompt}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {question.options.map((option,oIndex)=><button
                key={option}
                type="button"
                aria-pressed={answers[qIndex]===oIndex}
                onClick={()=>answer(qIndex,oIndex)}
                className={answers[qIndex]===oIndex
                  ?'rounded-xl border border-[#3e658c] bg-[#e9f0f8] p-3 text-sm font-semibold text-[#2e557a]'
                  :'rounded-xl border border-[#dce4ed] bg-white p-3 text-sm font-medium hover:bg-[#f8fafc]'}
              >{option}</button>)}
            </div>
          </fieldset>)}
        </div>
        <Button
          onClick={stage==='quiz_first'?finishFirstQuiz:()=>void finishTransferQuiz()}
          disabled={!quizReady||busy}
          className="mt-6 h-12 w-full bg-[#3e658c] hover:bg-[#345677]"
        >
          {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:stage==='quiz_first'?'İlk metni tamamla':'Transferi tamamla'}
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
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk tempo</span><b className="mt-1 block text-xl">{firstScore.wpm} k/dk</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Yeni metin</span><b className="mt-1 block text-xl">{transferScore.wpm} k/dk</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">İlk anlama</span><b className="mt-1 block text-xl">%{Math.round(firstScore.comprehension*100)}</b></div>
          <div className="rounded-xl bg-[#f8fafc] p-4"><span className="text-xs text-muted-foreground">Transfer anlama</span><b className="mt-1 block text-xl">%{Math.round(transferScore.comprehension*100)}</b></div>
        </div>
        <p className="mt-5 rounded-xl bg-[#edf3f9] p-4 text-sm leading-6 text-[#365b7c]">
          {summary.band==='BALANCED_TRANSFER'
            ?'Okuma temposu ve anlama yeni metinde dengeli biçimde korundu.'
            :summary.band==='COMPREHENSION_FIRST'
              ?'Bu turda öncelik anlamayı korumak. Hızı artırmadan önce metindeki temel bilgiyi daha güvenli yakalamaya odaklanacağız.'
              :'Akıcılık gelişiyor. Tempo ile anlamayı birlikte koruyan kısa tekrarlar uygun olur.'}
        </p>
        <Button onClick={reset} variant="outline" className="mt-6 h-11 w-full"><RotateCcw/> Başka bir hızlı okuma çalışması seç</Button>
        <p className="mt-4 text-[10px] leading-5 text-muted-foreground">k/dk yalnız bu metindeki kelime/dakika değeridir. Yaşa göre norm, klinik yorum veya tanı üretilmez.</p>
      </section>}
    </div>
  </main>;
}

export default function SpeedReadingPage(){
  return <PackageAccessGate accessCode="speed_reading" label="Hızlı Okuma">
    <SpeedReadingWorkshop/>
  </PackageAccessGate>;
}
