'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AssessmentTask } from '@/lib/assessment-engine';

async function callAssessment(body: Record<string, unknown>) {
  const response = await fetch('/api/assessment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || 'assessment_unavailable');
  return data;
}

export default function AssessmentStudentPage() {
  const [sessionId, setSessionId] = useState('');
  const [tasks, setTasks] = useState<AssessmentTask[]>([]);
  const [currentCode, setCurrentCode] = useState('');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [verbal, setVerbal] = useState(false);
  const shownAt = useRef(Date.now());
  const firstActionAt = useRef<number | undefined>(undefined);
  const answerChanges = useRef(0);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session') || '';
    if (!id) {
      setError('Değerlendirme bağlantısı eksik. Eğitmeninin gönderdiği bağlantıyı aç.');
      setStatus('error');
      return;
    }
    setSessionId(id);
    callAssessment({ action: 'get', sessionId: id })
      .then((data) => {
        setTasks(data.tasks || []);
        setCurrentCode(data.session?.current_task_code || data.tasks?.[0]?.id || '');
        setStatus(data.session?.status === 'completed' ? 'done' : 'ready');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Bağlantı açılamadı.');
        setStatus('error');
      });
  }, []);

  const task = useMemo(() => tasks.find((item) => item.id === currentCode), [tasks, currentCode]);
  const index = task ? tasks.findIndex((item) => item.id === task.id) : -1;

  function touch() {
    if (!firstActionAt.current) firstActionAt.current = Date.now();
  }

  async function next() {
    if (!task) return;
    touch();
    const completedAt = Date.now();
    const nextTask = tasks[index + 1];
    try {
      await callAssessment({
        action: 'attempt',
        sessionId,
        taskCode: task.id,
        shownAt: shownAt.current,
        firstActionAt: firstActionAt.current,
        completedAt,
        answerText: verbal && !answer.trim() ? '[Sözlü cevap]' : answer,
        answerChanges: answerChanges.current,
        supportLevel: 0,
        selfCorrected: answerChanges.current > 0,
        rubricScores: {},
        nextTaskCode: nextTask?.id,
      });
      if (!nextTask) {
        await callAssessment({ action: 'finish', sessionId });
        setStatus('done');
        return;
      }
      setCurrentCode(nextTask.id);
      setAnswer('');
      setVerbal(false);
      shownAt.current = Date.now();
      firstActionAt.current = undefined;
      answerChanges.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cevap kaydedilemedi.');
      setStatus('error');
    }
  }

  if (status === 'loading') return <main className="flex min-h-screen items-center justify-center bg-[#f7fbf8] text-sm text-muted-foreground">CZA değerlendirme alanı hazırlanıyor…</main>;
  if (status === 'error') return <main className="flex min-h-screen items-center justify-center bg-[#f7fbf8] p-6"><div className="max-w-lg rounded-3xl border bg-white p-8 text-center"><p className="text-xl font-semibold">Bağlantıyı açamadık</p><p className="mt-3 text-sm text-muted-foreground">{error}</p></div></main>;
  if (status === 'done') return <main className="flex min-h-screen items-center justify-center bg-[#f7fbf8] p-6"><div className="max-w-xl rounded-3xl border border-[#c7e5d5] bg-white p-9 text-center shadow-sm"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e5f6ed] text-[#226f60]"><CheckCircle2 size={34}/></span><h1 className="mt-5 text-3xl font-bold text-[#18372f]">Harika bir keşif yaptık!</h1><p className="mt-3 text-base leading-7 text-muted-foreground">Burada doğru ya da yanlış olmaktan çok, nasıl düşündüğün önemliydi. Şimdi eğitmenin senin güçlü yönlerine bakacak.</p></div></main>;

  if (!task) return null;
  const isProbe = task.role === 'CZA_PROBE';

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef8f2,transparent_42%),linear-gradient(#fbfdfc,#f5faf7)] px-4 py-6 md:px-8 md:py-10">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#18372f] text-xs font-black text-white">CZA</span><div><p className="font-semibold text-[#18372f]">Zihin Keşif Yolculuğu</p><p className="text-xs text-muted-foreground">Isınma ve tanışma</p></div></div>
        <div className="rounded-full border bg-white px-4 py-2 text-xs font-semibold text-[#45685e]">{Math.max(1,index + 1)} / {tasks.length}</div>
      </header>

      <section className="overflow-hidden rounded-[2rem] border border-[#d7e9df] bg-white shadow-[0_18px_60px_rgba(39,97,81,0.08)]">
        <div className={`px-6 py-5 md:px-9 ${isProbe ? 'bg-[#fff6df]' : 'bg-[#eaf6ef]'}`}>
          <div className="flex items-center gap-2 text-sm font-bold text-[#276151]">{isProbe ? <Sparkles size={18}/> : <span className="text-lg">☀️</span>}{isProbe ? 'CZA Zihin Sorusu' : 'Kolay Başlangıç'}</div>
          <p className="mt-1 text-xs text-[#5b776f]">Aklına geleni söyleyebilirsin. Burada tek bir doğru cevap yok.</p>
        </div>
        <div className="px-6 py-8 md:px-10 md:py-12">
          <p className="text-sm font-semibold uppercase tracking-[.14em] text-[#8a9f98]">{task.title}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight text-[#18372f] md:text-5xl">{task.childInstruction}</h1>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_auto]">
            <textarea
              value={answer}
              onFocus={touch}
              onChange={(e) => { touch(); answerChanges.current += 1; setAnswer(e.target.value); }}
              placeholder="İstersen buraya yazabilirsin…"
              className="min-h-40 w-full resize-none rounded-2xl border border-[#d8e7df] bg-[#fbfdfc] p-5 text-lg outline-none transition focus:border-[#75af98] focus:ring-4 focus:ring-[#dcefe6]"
            />
            <button
              type="button"
              onClick={() => { touch(); setVerbal((value) => !value); }}
              className={`flex min-h-28 min-w-44 flex-col items-center justify-center rounded-2xl border px-6 font-semibold transition ${verbal ? 'border-[#69a789] bg-[#e6f5ed] text-[#226f60]' : 'border-[#eadfbf] bg-[#fff9e9] text-[#856f32]'}`}
            >
              <Mic size={28}/><span className="mt-2">{verbal ? 'Sözlü cevap verdim ✓' : 'Sözlü cevap vereceğim'}</span>
            </button>
          </div>
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-[#edf2ef] pt-6">
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">Acele etmene gerek yok. Düşünceni anlatman, cevabın kendisi kadar değerli.</p>
            <Button onClick={next} className="min-h-12 rounded-xl bg-[#226f60] px-7 text-base hover:bg-[#195749]">Devam et <ArrowRight/></Button>
          </div>
        </div>
      </section>
    </div>
  </main>;
}
