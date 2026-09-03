'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, ChevronRight, CircleHelp, Hand, Lightbulb, ListChecks, RotateCcw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Soroban } from '@/components/soroban';
import { lessons, evaluateLessonAnswer, guidanceForMove, lessonSummary, type BeadMove, type Lesson, type LessonAnswer, type LessonRecord, type TeachingTask } from '@/lib/soroban-curriculum';
import { readLessonRecords, saveLessonRecord } from '@/lib/lesson-session';

type Phase = 'intro' | 'guided' | 'practice' | 'summary';
const phases: {id:Phase;label:string}[] = [{id:'intro',label:'Anla'},{id:'guided',label:'Birlikte yap'},{id:'practice',label:'Kendin dene'},{id:'summary',label:'Gözden geçir'}];

function Solution({ task }: {task:TeachingTask}) {
  return <div className="rounded-xl border border-border bg-white p-5">
    <p className="text-sm font-semibold">Örnek çözüm yolu · {task.target}</p>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{task.rule}</p>
    <ol className="mt-4 space-y-3">{task.steps.map((s,i)=><li key={i} className="flex gap-3 text-xs leading-5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary">{i+1}</span><span>{s.instruction} <span className="text-muted-foreground">Ara sayı: {s.after}</span></span></li>)}</ol>
  </div>;
}

function LessonWorkspace({ lesson, onRecord, onBusy, onNext, last }: {lesson:Lesson;onRecord:(r:LessonRecord)=>void;onBusy:(busy:boolean)=>void;onNext:()=>void;last:boolean}) {
  const [phase,setPhase] = useState<Phase>('intro');
  const [exampleIndex,setExampleIndex] = useState(0);
  const [stepIndex,setStepIndex] = useState(0);
  const [value,setValue] = useState(lesson.examples[0].start);
  const [feedback,setFeedback] = useState('');
  const [corrections,setCorrections] = useState(0);
  const [questionIndex,setQuestionIndex] = useState(0);
  const [moves,setMoves] = useState<BeadMove[]>([]);
  const [hintUsed,setHintUsed] = useState(false);
  const [answers,setAnswers] = useState<LessonAnswer[]>([]);
  const [answer,setAnswer] = useState<LessonAnswer|null>(null);
  const [record,setRecord] = useState<LessonRecord|null>(null);
  const [saved,setSaved] = useState(false);
  const [showSolution,setShowSolution] = useState(false);
  const [reviewIndex,setReviewIndex] = useState(0);
  const example = lesson.examples[exampleIndex];
  const expected = example.steps[stepIndex];
  const question = lesson.practice[questionIndex];
  useEffect(()=>{ onBusy(phase === 'guided' || phase === 'practice'); },[phase,onBusy]);

  function startGuided() {
    setPhase('guided');setExampleIndex(0);setStepIndex(0);setValue(lesson.examples[0].start);setFeedback('');setCorrections(0);
  }
  function guidedMove(move: BeadMove) {
    if (!expected) return;
    if (move.before === expected.before && move.after === expected.after) {
      setValue(move.after);setStepIndex(i=>i+1);setFeedback('Adım tamam. Şimdi bir sonraki hareketi incele.');
    } else { setCorrections(c=>c+1);setFeedback(guidanceForMove(expected,move)); }
  }
  function nextExample() {
    if (exampleIndex + 1 < lesson.examples.length) {
      const next = exampleIndex+1;setExampleIndex(next);setStepIndex(0);setValue(lesson.examples[next].start);setFeedback('');
    } else {
      setPhase('practice');setQuestionIndex(0);setValue(lesson.practice[0].start);setMoves([]);setAnswers([]);setAnswer(null);setHintUsed(false);setFeedback('');setShowSolution(false);
    }
  }
  function practiceMove(move: BeadMove) {
    if (answer) return;
    if (moves.length >= 500) { setFeedback('Bu soruda hareket sınırına ulaşıldı. Yanıtını kontrol edebilir veya dersi baştan çalışabilirsin.');return; }
    setValue(move.after);setMoves(previous=>[...previous,move]);setFeedback('');
  }
  function submit() {
    if (answer) return;
    const result = evaluateLessonAnswer(question,value,moves,hintUsed);
    setAnswer(result);setAnswers(previous=>[...previous,result]);setFeedback('');
  }
  function nextQuestion() {
    if (!answer) return;
    if (questionIndex + 1 < lesson.practice.length) {
      const next = questionIndex+1;setQuestionIndex(next);setValue(lesson.practice[next].start);setMoves([]);setHintUsed(false);setAnswer(null);setShowSolution(false);setFeedback('');
    } else {
      const completed:LessonRecord = {id:crypto.randomUUID(),lessonId:lesson.id,at:new Date().toISOString(),answers,guidedCorrections:corrections};
      setRecord(completed);setSaved(saveLessonRecord(completed));onRecord(completed);setPhase('summary');setReviewIndex(0);
    }
  }
  const phaseIndex = phases.findIndex(p=>p.id===phase);
  return <div className="min-w-0">
    <nav aria-label="Ders aşamaları" className="mb-6 grid grid-cols-4 gap-1 rounded-xl border border-border bg-white p-2 sm:gap-2">{phases.map((p,i)=><div key={p.id} aria-current={p.id===phase?'step':undefined} className={`flex flex-col items-center gap-2 rounded-lg px-1 py-3 text-center sm:flex-row sm:justify-center ${p.id===phase?'bg-secondary text-primary':'text-muted-foreground'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${p.id===phase?'bg-primary text-white':'bg-muted'}`}>{i<phaseIndex?<Check size={13}/>:i+1}</span><span className="text-[10px] font-semibold sm:text-xs">{p.label}</span></div>)}</nav>

    {phase==='intro' && <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="bg-[#e4eee8] p-6 md:p-9"><p className="eyebrow text-primary">Soroban temel öğretim · Ders {lessons.indexOf(lesson)+1}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#21493f]">{lesson.title}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-[#55766b]">{lesson.goal}</p><div className="mt-5 flex flex-wrap gap-3 text-xs font-medium text-[#44675b]"><span>{lesson.examples.length} rehberli örnek</span><span>·</span><span>{lesson.practice.length} bağımsız deneme</span><span>·</span><span>Süre baskısı yok</span></div></div>
      <div className="grid gap-8 p-6 md:p-9 xl:grid-cols-[1fr_270px]"><div><h3 className="text-lg font-semibold">Önce mantığını anlayalım.</h3><ol className="mt-6 space-y-5">{lesson.ideas.map((idea,i)=><li key={idea} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{i+1}</span><p className="text-sm leading-7 text-muted-foreground">{idea}</p></li>)}</ol><Button className="mt-8 h-12 px-6" onClick={startGuided}>Birlikte yapmaya başla <ArrowRight/></Button></div>
      <aside className="rounded-xl border border-[#e7decc] bg-[#fbf7ee] p-5"><Hand size={24} className="mb-4 text-[#88704d]"/><h3 className="text-sm font-semibold text-[#715b3d]">Ekrandan gerçek sorobana</h3><p className="mt-3 text-xs leading-6 text-[#887553]">{lesson.educatorNote}</p><p className="mt-4 border-t border-[#e7decc] pt-4 text-[11px] leading-6 text-[#887553]">İpucu: Bu dersteki çerçeveli boncuk, rehberin önerdiği dokunuşu gösterir. Yardım yalnızca öğretim bölümündedir.</p></aside></div>
    </section>}

    {phase==='guided' && <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5"><div><p className="eyebrow text-primary">Birlikte yap · Örnek {exampleIndex+1} / {lesson.examples.length}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{example.prompt}</h2></div><Button variant="outline" className="h-10" onClick={()=>{setStepIndex(0);setValue(example.start);setFeedback('Örnek başlangıca döndü.');}}><RotateCcw/> Örneği başa al</Button></div>
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(250px,.9fr)_1.1fr]">
        <div className="rounded-xl bg-[#f7f5ef] px-3 py-7"><Soroban value={value} digits={example.digits} teaching reveal onMove={expected?guidedMove:undefined} highlight={expected?.action}/><p className="mx-auto mt-6 max-w-xs text-center text-xs leading-6 text-muted-foreground">Başlangıç: {example.start}. Çerçeveli boncuğa dokun; sayı adım adım değişsin.</p></div>
        <div className="flex flex-col"><div className="rounded-xl bg-secondary/60 p-5"><div className="flex items-center gap-2 font-semibold text-primary"><Lightbulb size={18}/><span className="text-sm">Neden böyle yapıyoruz?</span></div><p className="mt-3 text-sm leading-7">{example.rule}</p></div>
          <ol className="my-6 space-y-3">{example.steps.map((step,i)=><li key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${i===stepIndex?'border-primary/40 bg-secondary/30':'border-border'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i<stepIndex?'bg-primary text-white':'bg-muted text-muted-foreground'}`}>{i<stepIndex?<Check size={14}/>:i+1}</span><div><p className="text-sm leading-6">{step.instruction}</p>{i===stepIndex&&<p className="mt-2 text-xs leading-5 text-primary">{step.finger}</p>}</div></li>)}</ol>
          <div role="status" aria-live="polite" className="mb-4 min-h-12 text-sm leading-6 text-primary">{expected?feedback:<span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 shrink-0" size={19}/> Örnek tamamlandı. Sorobanda {example.target} görünüyor.</span>}</div>
          <Button className="mt-auto h-12 w-full" disabled={Boolean(expected)} onClick={nextExample}>{exampleIndex+1<lesson.examples.length?'Sıradaki örnek':'Şimdi kendin dene'} <ArrowRight/></Button>
        </div>
      </div>
    </section>}

    {phase==='practice' && <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="border-b border-border p-6"><div className="flex items-center justify-between gap-3"><p className="eyebrow text-primary">Kendin dene · {questionIndex+1} / {lesson.practice.length}</p><span className="text-xs text-muted-foreground">{lesson.title}</span></div><Progress className="mt-4" value={questionIndex/lesson.practice.length*100} aria-label={`${questionIndex} soru yanıtlandı`}/></div>
      <div className="grid gap-7 p-5 sm:p-7 xl:grid-cols-[minmax(250px,.9fr)_1.1fr]">
        <div className="rounded-xl bg-[#f7f5ef] px-3 py-7"><Soroban value={value} digits={question.digits} teaching reveal onMove={answer?undefined:practiceMove}/><p className="mt-5 text-center text-xs text-muted-foreground">Başlangıç sayısı: {question.start}</p></div>
        <div className="flex flex-col"><p className="eyebrow text-muted-foreground">Sorobanda göster</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{question.prompt}</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Boncuklarla işlemi yap. Hazır olduğunda yanıtını kontrol et. Çözüm yolu, yanıt verdikten sonra açılacak.</p>
          {!answer && <><Button variant="outline" className="mt-6 h-10 self-start" onClick={()=>setHintUsed(true)} disabled={hintUsed}><CircleHelp/> {hintUsed?'İpucu açıldı':'Yöntemi hatırlat'}</Button>{hintUsed&&<p role="status" className="mt-4 rounded-xl bg-[#fbf7ee] p-4 text-sm leading-7 text-[#806942]">{question.rule}<span className="mt-2 block text-xs">Bu soruda yardım aldığın sonuç özetinde belirtilecek.</span></p>}<p role="status" className="mt-3 text-xs leading-6 text-muted-foreground">{feedback}</p><Button className="mt-7 h-12 w-full" onClick={submit}>Yanıtımı kontrol et <Check/></Button></>}
          {answer&&<div className="mt-6 space-y-4"><div role="status" className={`rounded-xl border p-5 ${answer.correct?'border-primary/20 bg-secondary/60':'border-[#e7decc] bg-[#fbf7ee]'}`}><p className="flex items-center gap-2 font-semibold">{answer.correct?<CheckCircle2 size={19}/>:<RotateCcw size={19}/>} {answer.correct?'Sonuç doğru.':'Bu işlemi yeniden çalışalım.'}</p><p className="mt-3 text-sm leading-6">Senin sonucun: <strong>{answer.given}</strong> · Beklenen: <strong>{question.target}</strong></p><p className="mt-2 text-xs leading-6 text-muted-foreground">{answer.correct?(answer.routeMatch?'Dijital hareket sıran bu dersin örnek yoluyla da eşleşti.':'Doğru sonuca farklı bir yoldan ulaştın. Bu tek başına hata değildir; hareketlerini eğitimcinle karşılaştır.'):'Örnek çözümde basamak ve boncuk değişimlerini incele.'}</p></div><Button variant="outline" className="h-10 w-full" onClick={()=>setShowSolution(!showSolution)} aria-expanded={showSolution}>{showSolution?'Örnek çözümü kapat':'Örnek çözüm yolunu incele'}</Button>{showSolution&&<Solution task={question}/>}<Button className="h-12 w-full" onClick={nextQuestion}>{questionIndex+1<lesson.practice.length?'Sıradaki deneme':'Ders özetini aç'} <ArrowRight/></Button></div>}
          <p className="mt-5 text-[11px] leading-6 text-muted-foreground">Her soru için ilk gönderdiğin yanıt kaydedilir. Bu çalışma bir seviye sınavı değildir.</p>
        </div>
      </div>
    </section>}

    {phase==='summary'&&record&&<section className="space-y-5">
      <div className="rounded-2xl border border-border bg-white p-6 md:p-8"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><BookOpenCheck size={25}/></span><p className="eyebrow mt-5 text-primary">Çalışma tamamlandı</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Bir adımı daha görünür kıldın.</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{lesson.title} · Sonuç ve izlediğin yol birlikte değerlendirildi. Bu özet yalnızca bu denemeyi anlatır; ustalık veya seviye onayı vermez.</p>
        <div className="my-7 grid gap-4 sm:grid-cols-3">{[{label:'Doğru sonuç',value:`${lessonSummary(record).correct} / ${record.answers.length}`},{label:'İpucusuz doğru',value:`${lessonSummary(record).withoutHint} / ${record.answers.length}`},{label:'Örnek yolla eşleşen',value:`${lessonSummary(record).matchingRoutes} / ${record.answers.length}`}].map(m=><div key={m.label} className="rounded-xl bg-[#f7f5ef] p-5"><p className="text-xs text-muted-foreground">{m.label}</p><p className="mt-3 text-2xl font-semibold">{m.value}</p></div>)}</div>
        <div className="rounded-xl bg-secondary/50 p-5"><p className="text-sm font-semibold">Sıradaki çalışma önerisi</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{record.answers.some(a=>!a.correct||a.hintUsed)?'Hata veya ipucu bulunan soruları aşağıdan incele. Dersi yeniden çalışırken önce mantığını sesli anlat.':'Bu turda sonuçlar ipucusuz doğru. Farklı bir zamanda ve gerçek sorobanda tekrar ederek eğitimcinle tekniği kontrol et.'}</p></div>
        <p role="status" className="mt-4 text-xs leading-6 text-muted-foreground">{saved?'Bu sekmenin deneme kaydına eklendi; eğitimci görünümünde de açabilirsin. Sekme kapanınca kayıt kaybolabilir.':'Tarayıcı kayda izin vermedi. Özet şu an ekranda, fakat başka sayfaya geçince kaybolabilir.'}</p>
        <div className="mt-6 flex flex-wrap gap-3"><Button className="h-11 px-5" onClick={startGuided}><RotateCcw/> Dersi yeniden çalış</Button>{!last&&<Button variant="outline" className="h-11 px-5" onClick={onNext}>Sonraki dersi keşfet <ArrowRight/></Button>}<Link href="/educator?tab=teaching" className="inline-flex h-11 items-center gap-2 px-3 text-sm font-semibold text-primary">Eğitimci görünümü <ChevronRight size={16}/></Link></div>
      </div>
      <div className="rounded-2xl border border-border bg-white p-6"><h3 className="text-lg font-semibold">Soru ve hareket incelemesi</h3><div className="my-5 flex flex-wrap gap-2">{record.answers.map((a,i)=><Button key={a.taskId} variant={reviewIndex===i?'default':'outline'} className="h-10" onClick={()=>setReviewIndex(i)} aria-pressed={reviewIndex===i}>{i+1}. soru {a.correct?<Check size={13}/>:<RotateCcw size={13}/>}</Button>)}</div><div className="mb-5 rounded-xl bg-[#f7f5ef] p-5"><p className="font-semibold">{lesson.practice[reviewIndex].prompt}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">Yanıt: {record.answers[reviewIndex].given} · {record.answers[reviewIndex].hintUsed?'İpucu kullanıldı':'İpucu kullanılmadı'}</p><p className="mt-2 break-words text-sm leading-7"><span className="text-muted-foreground">Senin sayı yolun: </span>{[lesson.practice[reviewIndex].start,...record.answers[reviewIndex].moves.map(m=>m.after)].join(' → ')}</p></div><Solution task={lesson.practice[reviewIndex]}/></div>
    </section>}
  </div>;
}

export default function Learn() {
  const [selected,setSelected] = useState(0);
  const [records,setRecords] = useState<LessonRecord[]>([]);
  const [busy,setBusy] = useState(false);
  const [showMethod,setShowMethod] = useState(false);
  useEffect(()=>{setRecords(readLessonRecords());const index=lessons.findIndex(l=>l.id===new URLSearchParams(window.location.search).get('lesson'));if(index>=0)setSelected(index);},[]);
  useEffect(()=>{
    if (!busy) return;
    const warn = (event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[busy]);
  const completed = new Set(records.map(r=>r.lessonId));
  function choose(index: number) {
    if (index===selected) return;
    if (busy&&!window.confirm('Bu dersteki tamamlanmamış çalışma kaydedilmeyecek. Diğer derse geçilsin mi?')) return;
    setBusy(false);setSelected(index);
    window.history.replaceState(null,'',`/learn?lesson=${lessons[index].id}`);
  }
  return <div className="min-h-screen bg-background">
    <header className="bg-[#182739] px-5 text-white md:px-9"><div className="mx-auto flex min-h-20 max-w-[1400px] flex-wrap items-center justify-between gap-3 py-4"><Link href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d8eeac] text-xs font-black text-[#182739]">CZA</span><div><p className="text-sm font-semibold">Soroban öğrenme yolu</p><p className="mt-0.5 text-[10px] tracking-widest text-[#aebdcd]">EGZERSİZ AKADEMİSİ</p></div></Link><Link href="/" className="flex items-center gap-2 text-xs text-[#cfdfec]"><ArrowLeft size={15}/> Çalışma merkezim</Link></div></header>
    <main className="mx-auto max-w-[1472px] px-4 py-7 md:px-9">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow mb-2 text-primary">Sayıdan tekniğe, adım adım</p><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Önce anla. Sonra ellerinle düşün.</h1></div><span className="rounded-lg border border-[#dfd5bd] bg-[#fbf6e9] px-3 py-2 text-xs text-[#786337]">Öğretim pilotu · sekme-yerel kayıt</span></div>
      <div className="grid items-start gap-6 lg:grid-cols-[255px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-5"><div className="rounded-2xl border border-border bg-white p-4"><div className="px-2 pb-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">8 derslik temel rota</p><ListChecks size={18} className="text-primary"/></div><p className="mt-2 text-xs text-muted-foreground">{completed.size} / 8 ders bu sekmede çalışıldı</p><Progress value={completed.size/8*100} aria-label={`${completed.size} ders çalışıldı`} className="mt-3"/></div><nav aria-label="Soroban dersleri" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">{lessons.map((lesson,i)=><button key={lesson.id} aria-current={selected===i?'page':undefined} onClick={()=>choose(i)} className={`flex w-56 shrink-0 items-start gap-3 rounded-xl p-3 text-left lg:w-full ${selected===i?'bg-[#e4eee8] text-[#21493f]':'hover:bg-muted'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${completed.has(lesson.id)?'bg-primary text-white':selected===i?'bg-white':'bg-muted text-muted-foreground'}`}>{completed.has(lesson.id)?<Check size={14}/>:String(i+1).padStart(2,'0')}</span><span><span className="block text-xs font-semibold leading-5">{lesson.title}</span><span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{lesson.subtitle}</span></span></button>)}</nav></div><p className="mt-4 px-2 text-[11px] leading-6 text-muted-foreground">Dersler sırayla önerilir. Eğitimci incelemesi için tümü açık. “Çalışıldı”, seviye geçildi anlamına gelmez.</p><Button variant="ghost" className="mt-2 h-10 w-full justify-start text-xs" onClick={()=>setShowMethod(!showMethod)} aria-expanded={showMethod}><CircleHelp/> Yöntem ve kapsam</Button></aside>
        <div className="min-w-0">{selected>0&&!completed.has(lessons[selected-1].id)&&<div className="mb-4 flex items-start gap-3 rounded-xl border border-[#e7decc] bg-[#fbf7ee] p-4"><Target size={18} className="mt-1 shrink-0 text-[#88704d]"/><p className="text-xs leading-6 text-[#806942]">Önerilen ön çalışma: <button className="font-semibold underline underline-offset-2" onClick={()=>choose(selected-1)}>{lessons[selected-1].title}</button>. Bu kayıtta henüz tamamlanmadı; yine de dersi inceleyebilirsin.</p></div>}
          <LessonWorkspace key={selected} lesson={lessons[selected]} onBusy={setBusy} onRecord={r=>setRecords(previous=>[r,...previous.filter(item=>item.id!==r.id)].slice(0,40))} onNext={()=>choose(Math.min(selected+1,lessons.length-1))} last={selected===lessons.length-1}/>
        </div>
      </div>
      {showMethod&&<section className="mt-7 rounded-xl border border-border bg-white p-6"><h2 className="font-semibold">Yöntem, kaynak ve sınırlar</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Dersler CZA için yazılmış başlangıç örnekleridir; bir kurumun lisanslı müfredatının kopyası veya sertifikalı programı değildir. Parmak tekniği için <a href="https://www.shuzan.jp/english/preliminary/" target="_blank" rel="noreferrer" className="text-primary underline">Japonya Soroban Birliği temel kılavuzu</a>, tamamlayıcı işlemler için <a href="https://www.sorobanexam.org/basics/add.html" target="_blank" rel="noreferrer" className="text-primary underline">toplama</a> ve <a href="https://www.sorobanexam.org/basics/subtract.html" target="_blank" rel="noreferrer" className="text-primary underline">çıkarma açıklamaları</a> kontrol edildi.</p><p className="mt-3 text-sm leading-7 text-muted-foreground">Dijital hareket sırası öğretim örneğiyle karşılaştırılır; fiziksel parmak, duruş ve eşzamanlı hareket ölçülmez. Alternatif doğru yollar otomatik olarak yanlış sayılmaz. İç içe tamamlamalar ve çok basamaklı elde/bozma henüz eklenmedi. Kayıtlar gerçek öğrenciye veya CZA’nın 14 beceri puanına bağlanmaz.</p></section>}
      <footer className="mt-9 border-t border-border pt-5 text-[11px] leading-6 text-muted-foreground">Öğretim bölümünde adım geri bildirimi açıktır. Egzersiz stüdyosundaki seanslar cevapları seans sonunda gösterir. Bu ayrım öğrenme ile değerlendirmeyi birbirinden ayırır.</footer>
    </main>
  </div>;
}
