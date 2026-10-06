'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, PlayCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { core, friendlyCoreError } from '@/lib/core-client';
import { PackageAccessGate } from '@/components/package-access-gate';
import {
  fullLearningStages,
  fullStudyAlias,
  phaseLabel,
  fullLearningProgress,
  buildFullLearningRecord,
  type FullLearningStage,
} from '@/lib/full-learning-37';

type View='roadmap'|'stage'|'done';

async function publishRecord(record:ReturnType<typeof buildFullLearningRecord>){
  const response=await fetch('/api/core',{
    method:'POST',
    headers:{'content-type':'application/json','x-cza-contract-version':'1.0.0'},
    body:JSON.stringify({action:'module_record',record}),
  });
  const body=await response.json() as {ok?:boolean;error?:string};
  if(!response.ok||body.ok===false) throw new Error(body.error||'learning_persistence_unavailable');
}

function wordCount(text:string){
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function FullStudyWorkshop(){
  const [view,setView]=useState<View>('roadmap');
  const [topic,setTopic]=useState('');
  const [selectedStage,setSelectedStage]=useState<FullLearningStage|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [startedAt,setStartedAt]=useState('');
  const [evidence,setEvidence]=useState('');
  const [confidence,setConfidence]=useState(3);
  const [independent,setIndependent]=useState(true);
  const [transferApplied,setTransferApplied]=useState(false);
  const [completed,setCompleted]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const grouped=useMemo(()=>{
    const phases=['prepare','learn','deepen','practice','mastery'] as const;
    return phases.map(phase=>({
      phase,
      title:phaseLabel(phase),
      stages:fullLearningStages.filter(stage=>stage.phase===phase),
    }));
  },[]);

  const progress=fullLearningProgress(completed);

  async function openStage(stage:FullLearningStage){
    if(!topic.trim()){
      setError('Önce çalışacağın konuyu yaz.');
      return;
    }
    setBusy(true); setError('');
    try{
      const started=new Date().toISOString();
      const response=await core('start',{
        moduleCode:'full_learning_37',
        source:'free_practice',
        clientSessionId:crypto.randomUUID(),
        recipeId:null,
        settings:{
          engine:'cza-full-learning-37-v1',
          alias:stage.alias,
          stageIndex:stage.index,
          phase:stage.phase,
          superCommand:fullStudyAlias,
          rawEvidenceStored:false,
        },
      });
      if(!response.sessionId) throw new Error('session_not_created');
      setSelectedStage(stage);
      setSessionId(String(response.sessionId));
      setStartedAt(started);
      setEvidence('');
      setConfidence(3);
      setIndependent(true);
      setTransferApplied(false);
      setView('stage');
    }catch(cause){
      setError(friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  async function completeStage(){
    if(!selectedStage||!sessionId||busy) return;
    if(wordCount(evidence)<3){
      setError('Bu aşamayı tamamlamak için en az birkaç kelimelik bir öğrenme çıktısı yaz.');
      return;
    }
    setBusy(true); setError('');
    try{
      const completedAt=new Date().toISOString();
      const record=buildFullLearningRecord({
        trainingSessionId:sessionId,
        clientRecordId:crypto.randomUUID(),
        alias:selectedStage.alias,
        topic,
        startedAt,
        completedAt,
        evidenceWordCount:wordCount(evidence),
        confidence,
        independent,
        transferApplied,
      });
      await publishRecord(record);
      await core('finish',{
        sessionId,
        activeDurationMs:Math.max(0,Date.parse(completedAt)-Date.parse(startedAt)),
        questionCount:1,
      });
      setCompleted(current=>Array.from(new Set([...current,selectedStage.alias])));
      setEvidence('');
      setView('done');
    }catch(cause){
      setError(cause instanceof Error&&cause.message==='learning_persistence_unavailable'
        ?'Tam Öğrenme kaydı merkezi öğrenme hafızasına işlenemedi. Oturum kapatılmadı; yeniden deneyebilirsin.'
        :friendlyCoreError(cause));
    }finally{setBusy(false);}
  }

  function backToRoadmap(){
    setSelectedStage(null);
    setSessionId('');
    setStartedAt('');
    setEvidence('');
    setView('roadmap');
  }

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
    <div className="mx-auto max-w-6xl">
      <a href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]"><ArrowLeft size={16}/> Çalışma merkezime dön</a>

      <header className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <p className="text-xs font-black uppercase tracking-[.14em] text-[#765f9d]">Zihin Gelişim · {fullStudyAlias}</p>
        <h1 className="mt-2 text-3xl font-semibold">Tam Öğrenme Sistemi · 37 Adım</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Konuyu yalnız çalışıp geçme. Hazırla, öğren, derinleştir, uygula ve kalıcılaştır. Her canonical istasyon merkezi öğrenme hafızasına ayrı kanıt bırakır.</p>
      </header>

      {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{error}</p>}

      {view==='roadmap'&&<>
        <section className="mt-6 rounded-2xl border border-[#dce4ed] bg-white p-5">
          <label className="text-sm font-semibold">
            Çalışacağın konu
            <input
              value={topic}
              onChange={event=>setTopic(event.target.value.slice(0,120))}
              className="mt-2 h-12 w-full rounded-xl border border-[#dce4ed] px-4 text-sm font-normal"
              placeholder="Örnek: Su döngüsü, kesirler, fiiller..."
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span><b>{progress.completed}/37</b> istasyon bu oturumda tamamlandı</span>
            <span className="rounded-full bg-[#f3eef8] px-3 py-1 text-xs font-bold text-[#6e5796]">
              Sıradaki: {progress.next?progress.next.alias:'Tamamlandı'}
            </span>
          </div>
        </section>

        <div className="mt-6 space-y-6">
          {grouped.map(group=><section key={group.phase} className="rounded-2xl border border-[#dce4ed] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <span className="text-xs text-muted-foreground">{group.stages.length} adım</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.stages.map(stage=>{
                const done=completed.includes(stage.alias);
                return <button key={stage.alias} type="button" disabled={busy} onClick={()=>void openStage(stage)}
                  className={done
                    ?'rounded-xl border border-[#b9daca] bg-[#edf8f2] p-4 text-left'
                    :'rounded-xl border border-[#dce4ed] bg-[#fbfcfd] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm'}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-black text-[#8090a0]">{stage.index.toString().padStart(2,'0')}</span>
                    {done&&<CheckCircle2 size={17} className="text-[#276151]"/>}
                  </div>
                  <p className="mt-2 font-mono text-xs font-bold text-[#6e5796]">{stage.alias}</p>
                  <p className="mt-1 text-sm font-semibold">{stage.title}</p>
                </button>;
              })}
            </div>
          </section>)}
        </div>
      </>}

      {view==='stage'&&selectedStage&&<section className="mt-6 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold text-[#765f9d]">{selectedStage.alias} · {selectedStage.index}/37</p>
            <h2 className="mt-2 text-2xl font-semibold">{selectedStage.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{phaseLabel(selectedStage.phase)} · Konu: {topic}</p>
          </div>
          <span className="rounded-full bg-[#f3eef8] px-3 py-1 text-xs font-bold text-[#6e5796]">{fullStudyAlias}</span>
        </div>

        <div className="mt-6 rounded-2xl bg-[#faf8fd] p-5 text-sm leading-7 text-[#584774]">{selectedStage.prompt}</div>

        <label className="mt-6 block text-sm font-semibold">
          Bu aşamadaki kendi öğrenme çıktın
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Kendi cümlen, kısa açıklaman, soru-cevap notun veya planın olabilir. Ham metin merkezi kayda gönderilmez.</span>
          <textarea
            value={evidence}
            onChange={event=>setEvidence(event.target.value.slice(0,1200))}
            className="mt-3 min-h-40 w-full resize-none rounded-xl border border-[#dce4ed] p-4 text-sm font-normal leading-6"
            placeholder="Bu aşamada ne ürettin?"
          />
        </label>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="rounded-xl border border-[#dce4ed] p-4 text-sm">
            <b>Güven düzeyim</b>
            <input type="range" min={1} max={5} value={confidence} onChange={event=>setConfidence(Number(event.target.value))} className="mt-3 w-full"/>
            <span className="mt-1 block text-xs text-muted-foreground">{confidence}/5</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-[#dce4ed] p-4 text-sm">
            <input type="checkbox" checked={independent} onChange={event=>setIndependent(event.target.checked)} className="mt-1"/>
            <span><b>Bağımsız yaptım</b><span className="mt-1 block text-xs text-muted-foreground">Belirgin ipucu veya model almadan.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-[#dce4ed] p-4 text-sm">
            <input type="checkbox" checked={transferApplied} onChange={event=>setTransferApplied(event.target.checked)} className="mt-1"/>
            <span><b>Yeni örneğe uyguladım</b><span className="mt-1 block text-xs text-muted-foreground">Aynı bilgiyi farklı örnek veya durumda kullandım.</span></span>
          </label>
        </div>

        <Button onClick={()=>void completeStage()} disabled={busy||wordCount(evidence)<3} className="mt-6 h-12 w-full bg-[#6e5796] hover:bg-[#5c487e]">
          {busy?<><Loader2 className="animate-spin"/> Merkezi kayda işleniyor…</>:<><PlayCircle/> Bu istasyonu tamamla</>}
        </Button>
        <p className="mt-3 text-[10px] leading-5 text-muted-foreground">Merkezi kayıtta yalnız aşama, kelime sayısı, güven, bağımsızlık ve transfer kanıtı tutulur; ham öğrenci metni saklanmaz.</p>
      </section>}

      {view==='done'&&selectedStage&&<section className="mt-6 rounded-3xl border border-[#c9dfd4] bg-white p-7 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-[#276151]" size={42}/>
        <h2 className="mt-4 text-2xl font-semibold">{selectedStage.alias} tamamlandı.</h2>
        <p className="mt-2 text-sm text-muted-foreground">{selectedStage.title} kanıtı merkezi öğrenme hafızasına işlendi.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button onClick={backToRoadmap} variant="outline"><RotateCcw/> 37 adımlı haritaya dön</Button>
          <Button
            onClick={()=>{
              const next=fullLearningProgress(completed).next;
              if(next) void openStage(next);
            }}
            disabled={!fullLearningProgress(completed).next||busy}
            className="bg-[#6e5796] hover:bg-[#5c487e]"
          >
            Sıradaki canonical adıma geç
          </Button>
        </div>
      </section>}
    </div>
  </main>;
}

export default function FullStudyPage(){
  return <PackageAccessGate accessCode="full_learning_37" label="Tam Öğrenme Sistemi">
    <FullStudyWorkshop/>
  </PackageAccessGate>;
}
