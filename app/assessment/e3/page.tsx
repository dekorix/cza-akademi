'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Eye, HeartHandshake, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { E3SectionId, E3SupportLevel, E3Task } from '@/lib/preschool-e3';

type E3Section = { id: E3SectionId; label: string; purpose: string };
type CaregiverQuestion = readonly [string, string, string];
type GetResponse = {
  session: { id: string; status: string; current_task_code: string | null; student_label?: string; metadata?: Record<string, unknown> };
  task: E3Task | null;
  caregiverQuestion: CaregiverQuestion | null;
  sections: E3Section[];
  evidence: Array<{ taskId: string; sectionId: E3SectionId }>;
  caregiverAnswered: number;
  caregiverTotal: number;
};

const supportOptions: Array<[E3SupportLevel, string]> = [
  ['INDEPENDENT', 'Bağımsız'],
  ['VERBAL_PROMPT', 'Sözel ipucu'],
  ['VISUAL_PROMPT', 'Görsel ipucu'],
  ['MODELED', 'Model gösterildi'],
  ['PHYSICAL_ASSIST', 'Fiziksel yardım'],
  ['NOT_OBSERVED', 'Gözlenmedi'],
];

async function callE3(body: Record<string, unknown>) {
  const response = await fetch('/api/assessment-e3', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || 'e3_assessment_unavailable');
  return data;
}

export default function E3AssessmentPage() {
  const [sessionId, setSessionId] = useState('');
  const [data, setData] = useState<GetResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState('');
  const [supportLevel, setSupportLevel] = useState<E3SupportLevel>('INDEPENDENT');
  const [saving, setSaving] = useState(false);
  const shownAt = useRef(Date.now());
  const firstActionAt = useRef<number | null>(null);
  const answerChanges = useRef(0);
  const touches = useRef(0);

  async function load(id = sessionId) {
    const next = await callE3({ action: 'get', sessionId: id });
    setData(next);
    if (next.session?.status === 'completed') setStatus('done');
    else setStatus('ready');
    setAnswer(''); setNote(''); setSelected(''); setSupportLevel('INDEPENDENT');
    shownAt.current = Date.now(); firstActionAt.current = null; answerChanges.current = 0; touches.current = 0;
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session') || '';
    if (!id) { setError('E3 değerlendirme bağlantısı eksik.'); setStatus('error'); return; }
    setSessionId(id);
    void load(id).catch((cause) => { setError(cause instanceof Error ? cause.message : 'Bağlantı açılamadı.'); setStatus('error'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const task = data?.task ?? null;
  const caregiver = data?.caregiverQuestion ?? null;
  const section = useMemo(() => data?.sections.find((item) => item.id === task?.sectionId) ?? null, [data?.sections, task?.sectionId]);
  const ageMonths = Number(data?.session?.metadata?.ageMonths ?? 0);

  function touch() { if (firstActionAt.current == null) firstActionAt.current = Date.now(); }

  function choose(value: string) {
    touch(); touches.current += 1; answerChanges.current += 1; setSelected(value); setAnswer(value);
  }

  async function saveTask(skip = false) {
    if (!task || saving) return;
    setSaving(true); setError('');
    try {
      const finalSupport: E3SupportLevel = skip ? 'NOT_ASSESSED' : supportLevel;
      await callE3({
        action: 'attempt', sessionId, taskCode: task.id,
        shownAt: shownAt.current, firstActionAt: firstActionAt.current ?? undefined, completedAt: Date.now(),
        answerText: answer, answerChanges: answerChanges.current, touches: touches.current,
        supportLevel: finalSupport, selfCorrected: answerChanges.current > 1, note,
      });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Görev kaydedilemedi.'); }
    finally { setSaving(false); }
  }

  async function saveCaregiver(value?: string) {
    if (!caregiver || saving) return;
    const final = (value ?? answer).trim();
    if (!final) { setError('Bakımveren yanıtını kaydetmeden ilerlemeyelim.'); return; }
    setSaving(true); setError('');
    try {
      await callE3({ action: 'caregiver', sessionId, questionCode: caregiver[0], answerText: final });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bakımveren yanıtı kaydedilemedi.'); }
    finally { setSaving(false); }
  }

  async function finish() {
    if (saving) return;
    setSaving(true); setError('');
    try { await callE3({ action: 'finish', sessionId }); setStatus('done'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Değerlendirme tamamlanamadı.'); }
    finally { setSaving(false); }
  }

  if (status === 'loading') return <main className="grid min-h-screen place-items-center bg-[#f7fbf8] text-sm text-muted-foreground">36–48 ay gelişim alanı hazırlanıyor…</main>;
  if (status === 'error') return <main className="grid min-h-screen place-items-center bg-[#f7fbf8] p-6"><div className="max-w-lg rounded-3xl border bg-white p-8 text-center"><h1 className="text-xl font-bold">E3 alanı açılamadı</h1><p className="mt-3 text-sm text-muted-foreground">{error}</p></div></main>;
  if (status === 'done') return <main className="grid min-h-screen place-items-center bg-[#f7fbf8] p-6"><div className="max-w-2xl rounded-3xl border border-[#c7e5d5] bg-white p-10 text-center shadow-sm"><CheckCircle2 className="mx-auto text-[#226f60]" size={52}/><h1 className="mt-5 text-3xl font-bold text-[#18372f]">36–48 ay gelişim keşfi tamamlandı</h1><p className="mt-3 leading-7 text-muted-foreground">Çocuk performansı ve bakımveren kaynağı ayrı tutuldu. Sonuçlar norm veya tanı değil; eğitimsel kanıt profilidir.</p><a className="mt-6 inline-flex rounded-xl bg-[#226f60] px-5 py-3 font-semibold text-white" href={`/educator/assessment/e3/report?session=${encodeURIComponent(sessionId)}`}>E3 raporunu aç</a></div></main>;
  if (!data) return null;

  if (!task && !caregiver) return <main className="grid min-h-screen place-items-center bg-[#f7fbf8] p-6"><div className="max-w-xl rounded-3xl border bg-white p-8 text-center"><ClipboardList className="mx-auto text-[#226f60]" size={42}/><h1 className="mt-4 text-2xl font-bold">İki kaynak da tamamlandı</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Çocuk görevleri ve {data.caregiverTotal} bakımveren sorusu kaydedildi. Şimdi oturumu değişmez rapor aşamasına kapatabilirsin.</p>{error&&<p className="mt-3 text-sm text-red-700">{error}</p>}<Button disabled={saving} onClick={finish} className="mt-6 bg-[#226f60]">{saving?'Kaydediliyor…':'Değerlendirmeyi tamamla'}</Button></div></main>;

  if (caregiver) {
    return <main className="min-h-screen bg-[#f7fbf8] px-4 py-8 md:px-8"><div className="mx-auto max-w-4xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#6b8b80]">CZA · E3 · İkinci Kanıt Kaynağı</p><h1 className="mt-2 text-2xl font-bold text-[#18372f]">Bakımveren görüşmesi</h1></div><span className="rounded-full border bg-white px-4 py-2 text-sm font-semibold">{data.caregiverAnswered + 1}/{data.caregiverTotal}</span></header><section className="rounded-[2rem] border border-[#d7e9df] bg-white p-7 shadow-sm md:p-10"><div className="flex items-center gap-2 text-sm font-bold text-[#226f60]"><HeartHandshake size={19}/>{caregiver[1]}</div><h2 className="mt-5 text-3xl font-bold leading-tight text-[#18372f]">{caregiver[2]}</h2><div className="mt-7 flex flex-wrap gap-2">{['Evet','Bazen','Henüz değil','Gözlemlemedim / emin değilim'].map((value)=><button key={value} onClick={()=>{setAnswer(value);void saveCaregiver(value);}} disabled={saving} className="rounded-xl border border-[#cfe0d8] bg-[#f8fbf9] px-4 py-3 text-sm font-semibold text-[#315f50] hover:bg-[#eaf6ef]">{value}</button>)}</div><textarea value={answer} onChange={(event)=>setAnswer(event.target.value)} placeholder="İstersen bakımverenin kendi cümlesini veya örneğini yaz…" className="mt-5 min-h-32 w-full rounded-2xl border border-[#d8e7df] bg-[#fbfdfc] p-4 outline-none focus:ring-4 focus:ring-[#dcefe6]"/>{error&&<p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end"><Button disabled={saving||!answer.trim()} onClick={()=>void saveCaregiver()} className="bg-[#226f60]">Kaydet ve devam et <ArrowRight/></Button></div></section></div></main>;
  }

  if (!task || !section) return null;
  const answeredInSection = data.evidence.filter((item) => item.sectionId === task.sectionId).length;
  const currentSectionIndex = data.sections.findIndex((item) => item.id === task.sectionId) + 1;
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#edf8f2,transparent_38%),linear-gradient(#fbfdfc,#f5faf7)] px-4 py-6 md:px-8 md:py-9"><div className="mx-auto max-w-6xl"><header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#18372f] text-xs font-black text-white">CZA</span><div><p className="font-bold text-[#18372f]">36–48 Ay Gelişim Keşfi · E3</p><p className="text-xs text-muted-foreground">{ageMonths} ay · Bölüm {currentSectionIndex}/10 · bu alanda {answeredInSection} kanıt</p></div></div><span className="rounded-full border bg-white px-4 py-2 text-xs font-semibold text-[#45685e]">{section.label}</span></header><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="overflow-hidden rounded-[2rem] border border-[#d7e9df] bg-white shadow-[0_18px_60px_rgba(39,97,81,.08)]"><div className="bg-[#eaf6ef] px-7 py-5"><div className="flex items-center gap-2 text-sm font-bold text-[#276151]"><Sparkles size={18}/>Çocuğun gördüğü alan</div><p className="mt-1 text-xs text-[#5b776f]">Doğru/yanlış rengi, puan veya performans baskısı gösterilmez.</p></div><div className="p-7 md:p-10"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8a9f98]">{task.title}</p><h1 className="mt-4 text-3xl font-bold leading-tight text-[#18372f] md:text-5xl">{task.childInstruction}</h1>{task.options?.length?<div className="mt-8 grid gap-3 sm:grid-cols-2">{task.options.map((option)=><button key={option} type="button" onClick={()=>choose(option)} className={`min-h-20 rounded-2xl border px-5 text-left text-lg font-bold transition ${selected===option?'border-[#4f9c7d] bg-[#e7f5ed] text-[#18372f] shadow-sm':'border-[#d8e7df] bg-[#fbfdfc] text-[#315f50]'}`}>{option}</button>)}</div>:<textarea value={answer} onFocus={touch} onChange={(event)=>{touch();answerChanges.current+=1;setAnswer(event.target.value)}} placeholder={task.responseMode==='SPEAK'?'Çocuğun sözlü yanıtını kısa biçimde kaydet…':'Gözlenen yanıtı veya yapılanı kısa biçimde kaydet…'} className="mt-8 min-h-36 w-full rounded-2xl border border-[#d8e7df] bg-[#fbfdfc] p-5 text-lg outline-none focus:ring-4 focus:ring-[#dcefe6]"/>}{task.materials?.length?<p className="mt-5 rounded-xl bg-[#fff8e8] px-4 py-3 text-sm text-[#725f31]">Gerçek materyal: {task.materials.join(', ')}</p>:null}</div></section><aside className="rounded-[2rem] border border-[#d7e9df] bg-white p-6 shadow-sm"><div className="flex items-center gap-2 text-sm font-bold text-[#226f60]"><Eye size={18}/>Eğitmen kayıt alanı</div><p className="mt-3 text-sm leading-6 text-muted-foreground">{task.educatorInstruction}</p><div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-[#6b8b80]">Yardım düzeyi</p><div className="mt-2 grid gap-2">{supportOptions.map(([value,label])=><button key={value} type="button" onClick={()=>setSupportLevel(value)} className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${supportLevel===value?'border-[#4f9c7d] bg-[#e7f5ed] text-[#234f42]':'border-[#dce7e1] bg-white text-[#5b776f]'}`}>{label}</button>)}</div></div><textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Strateji, öz-düzeltme, dikkat, spontan açıklama gibi kısa gözlem notu…" className="mt-5 min-h-28 w-full rounded-xl border border-[#d8e7df] p-3 text-sm outline-none focus:ring-4 focus:ring-[#dcefe6]"/><div className="mt-5 rounded-xl bg-[#f5f8f6] p-3 text-xs leading-5 text-muted-foreground"><b>Kanıt odağı:</b> {task.evidenceFocus.join(' · ')}{task.neutralProbe?<><br/><b>Not:</b> Bu tavan/keşif görevi zayıflık oranına katılmaz.</>:null}</div>{error&&<p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 grid gap-2"><Button disabled={saving} onClick={()=>void saveTask(false)} className="min-h-11 bg-[#226f60]">{saving?'Kaydediliyor…':'Kaydet ve sonraki göreve geç'} <ArrowRight/></Button><Button disabled={saving} variant="outline" onClick={()=>void saveTask(true)} className="min-h-11">Görevi nötr geç · değerlendirilemedi</Button></div></aside></div></div></main>;
}
