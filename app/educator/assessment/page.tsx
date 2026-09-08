'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BrainCircuit, Clipboard, FileText, RefreshCw, Sparkles, TrendingUp, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AssessmentTask, ObservationCode } from '@/lib/assessment-engine';
import { skillCatalog } from '@/lib/assessment-engine';

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

const observationOptions: { id: ObservationCode; label: string }[] = [
  ['PLANNED_RESPONSE','Planladı'],['VERBAL_REASONING','Düşüncesini açıkladı'],['SELF_CORRECTION','Kendini düzeltti'],
  ['CHANGED_STRATEGY','Strateji değiştirdi'],['PERSEVERED','Sebat etti'],['ASKED_FOR_HELP','Yardım istedi'],
  ['IMPULSIVE_RESPONSE','Aceleci yanıt'],['TRIAL_AND_ERROR','Deneme-yanılma'],['VISUAL_STRATEGY','Görsel strateji'],
].map(([id,label]) => ({ id: id as ObservationCode, label }));

function familyStatusLabel(status: string) {
  if (status === 'DIRECT_MASTERY') return 'Doğrudan yeterlilik';
  if (status === 'HIGH_RESPONSE') return 'Yüksek öğrenme tepkisi';
  if (status === 'MODERATE_RESPONSE') return 'Gelişen öğrenme tepkisi';
  if (status === 'NEEDS_SUPPORT') return 'Daha fazla destek gerekli';
  return 'Kanıt tamamlanıyor';
}

export default function EducatorAssessmentPage() {
  const [studentLabel,setStudentLabel] = useState('Pilot öğrenci');
  const [sessionId,setSessionId] = useState('');
  const [session,setSession] = useState<any>(null);
  const [tasks,setTasks] = useState<AssessmentTask[]>([]);
  const [attempts,setAttempts] = useState<any[]>([]);
  const [observations,setObservations] = useState<any[]>([]);
  const [learningResponse,setLearningResponse] = useState<any>(null);
  const [selectedCodes,setSelectedCodes] = useState<ObservationCode[]>([]);
  const [rubricScores,setRubricScores] = useState<Record<string,number>>({});
  const [note,setNote] = useState('');
  const [confidence,setConfidence] = useState(3);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);

  const currentTask = useMemo(() => tasks.find(t => t.id === session?.current_task_code), [tasks,session]);
  const lastAttempt = attempts.at(-1);
  const lastTaskCode = lastAttempt?.task_code || currentTask?.id || '';
  const lastTask = tasks.find(t => t.id === lastTaskCode);

  useEffect(() => {
    setRubricScores((lastAttempt?.rubric_scores || {}) as Record<string,number>);
  }, [lastAttempt?.id]);

  async function refresh(id = sessionId) {
    if (!id) return;
    try {
      const data = await callAssessment({ action:'get', sessionId:id });
      setSession(data.session);
      setTasks(data.tasks || []);
      setAttempts(data.attempts || []);
      setObservations(data.observations || []);
      setLearningResponse(data.learningResponse || null);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Oturum okunamadı.'); }
  }

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  async function createSession() {
    setBusy(true); setMessage('');
    try {
      const data = await callAssessment({ action:'create', studentLabel });
      setSessionId(data.session.id); setSession(data.session); setTasks(data.tasks || []); setAttempts([]); setObservations([]); setLearningResponse(null);
      setMessage('Oturum hazır. Öğrenci bağlantısını paylaşabilirsin.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Oturum oluşturulamadı.'); }
    finally { setBusy(false); }
  }

  async function saveObservation() {
    if (!sessionId || !lastTaskCode) return;
    setBusy(true);
    try {
      await callAssessment({ action:'observe', sessionId, taskCode:lastTaskCode, observationCodes:selectedCodes, educatorNote:note, confidence });
      setSelectedCodes([]); setNote(''); setMessage('Eğitmen gözlemi kaydedildi.'); await refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Gözlem kaydedilemedi.'); }
    finally { setBusy(false); }
  }

  async function saveRubric() {
    if (!sessionId || !lastAttempt?.id || !lastTask) return;
    setBusy(true);
    try {
      await callAssessment({
        action:'score',
        sessionId,
        attemptId:lastAttempt.id,
        taskCode:lastTask.id,
        rubricScores,
      });
      setMessage('Görev rubriği kaydedildi; öğrenme tepkisi yeniden hesaplandı.');
      await refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Rubrik kaydedilemedi.'); }
    finally { setBusy(false); }
  }

  function childUrl() {
    if (!sessionId || typeof window === 'undefined') return '';
    return `${window.location.origin}/assessment?session=${sessionId}`;
  }

  function reportUrl() {
    if (!sessionId) return '/educator/assessment/report';
    return `/educator/assessment/report?session=${encodeURIComponent(sessionId)}`;
  }

  async function copyLink() {
    const url = childUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setMessage('Öğrenci bağlantısı kopyalandı.');
  }

  const evidence = useMemo(() => {
    const counts = new Map<string,number>();
    for (const attempt of attempts) {
      const task = tasks.find(t => t.id === attempt.task_code);
      for (const sw of task?.skillWeights || []) counts.set(sw.skillId,(counts.get(sw.skillId)||0)+1);
    }
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
  },[attempts,tasks]);

  const responseFamilies = (learningResponse?.families || []).filter((family: any) => family.index != null).slice(-8).reverse();

  return <main className="min-h-screen bg-[#f4f8f6]">
    <header className="bg-[#182739] px-5 text-white md:px-9"><div className="mx-auto flex h-20 max-w-[1380px] items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d8eeac] text-xs font-black text-[#182739]">CZA</span><div><p className="text-sm font-semibold">Canlı değerlendirme merkezi</p><p className="text-[10px] text-[#9db0c3]">1 → 2. SINIF GEÇİŞ PİLOTU</p></div></div><a href="/educator" className="flex items-center gap-2 text-xs text-[#cfdfec]"><ArrowLeft size={15}/> Eğitimci merkezi</a></div></header>

    <div className="mx-auto max-w-[1380px] px-5 py-8 md:px-9">
      <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#5d8c7d]">CZA Değerlendirme Motoru v1.0</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Çocuğun cevabını değil, düşünme sürecini izle.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Isınma, matematik, Türkçe ve bilişsel görevlerde başlangıç performansı, destek ihtiyacı, destek sonrası başarı ve transfer aynı oturumda izlenir.</p></div>

      {!sessionId ? <section className="max-w-2xl rounded-2xl border bg-white p-7 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e7f5ed] text-[#226f60]"><UserRoundCheck/></span><div><h2 className="text-xl font-semibold">Yeni değerlendirme başlat</h2><p className="text-xs text-muted-foreground">Pilot için yalnız görünen öğrenci adı yeterli.</p></div></div><div className="mt-6 flex gap-3"><Input value={studentLabel} onChange={e=>setStudentLabel(e.target.value)} className="h-11"/><Button onClick={createSession} disabled={busy} className="h-11 bg-[#226f60] hover:bg-[#195749]">{busy?'Hazırlanıyor…':'Oturumu oluştur'}</Button></div>{message&&<p className="mt-4 text-sm text-[#55766b]">{message}</p>}</section> : <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_.85fr]">

        <div className="space-y-6">
          <section className="rounded-2xl border border-[#cfe4d9] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8c7d]">Aktif oturum</p><h2 className="mt-1 text-2xl font-semibold">{session?.student_label || studentLabel}</h2><p className="mt-1 text-xs text-muted-foreground">Durum: {session?.status} · {attempts.length} görev tamamlandı</p></div><div className="flex flex-wrap gap-2"><a href={reportUrl()} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#c9d9d1] bg-white px-3 text-sm font-semibold text-[#315f50] transition hover:bg-[#f3f8f5]"><FileText size={15}/> Raporu aç</a><Button variant="outline" onClick={()=>refresh()}><RefreshCw/> Yenile</Button></div></div><div className="mt-5 rounded-xl bg-[#f4f9f6] p-4"><p className="text-xs font-semibold text-[#4c6f64]">Öğrenci bağlantısı</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border bg-white px-3 py-3 text-xs">{childUrl()}</code><Button onClick={copyLink} variant="outline"><Clipboard/> Kopyala</Button></div></div></section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Sparkles className="text-[#c69428]"/><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#9c7c39]">Şu anda çocuk ekranında</p><h2 className="mt-1 text-xl font-semibold">{currentTask?.title || (session?.status==='completed'?'Değerlendirme tamamlandı':'Görev bekleniyor')}</h2></div></div>{currentTask&&<><p className="mt-5 rounded-xl bg-[#fff9e9] p-5 text-lg font-semibold leading-7 text-[#463f2a]">“{currentTask.childInstruction}”</p><div className="mt-4 rounded-xl border border-[#d8e7df] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#5d8c7d]">Eğitmene özel yönerge</p><p className="mt-2 text-sm leading-6">{currentTask.educatorInstruction}</p></div></>}</section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Canlı süreç kayıtları</h2><div className="mt-4 space-y-3">{attempts.length===0?<p className="text-sm text-muted-foreground">Henüz tamamlanmış görev yok.</p>:attempts.map((a,i)=><div key={a.id || `${a.task_code}-${i}`} className="grid gap-2 rounded-xl border p-4 md:grid-cols-[1fr_auto]"><div><p className="font-semibold">{tasks.find(t=>t.id===a.task_code)?.title || a.task_code}</p><p className="mt-1 text-sm text-muted-foreground">{a.answer_text || 'Sözlü / boş cevap'}</p>{a.answer_payload?.supportTriggered&&<p className="mt-1 text-xs font-semibold text-[#866b26]">Destek dalı açıldı</p>}</div><div className="text-right text-xs text-muted-foreground"><p>İlk tepki: {a.response_latency_ms==null?'—':`${(a.response_latency_ms/1000).toFixed(1)} sn`}</p><p>Toplam: {a.total_response_time_ms==null?'—':`${(a.total_response_time_ms/1000).toFixed(1)} sn`}</p><p>Değişiklik: {a.answer_changes}</p><p>Destek: {a.support_level || 0}/5</p></div></div>)}</div></section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[#cfe4d9] bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f5ed] text-[#226f60]"><TrendingUp size={21}/></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8c7d]">CZA Öğrenme Tepkisi İndeksi</p><div className="mt-1 flex items-end gap-3"><span className="text-4xl font-semibold text-[#18372f]">{learningResponse?.index ?? '—'}</span>{learningResponse?.index!=null&&<span className="pb-1 text-xs text-muted-foreground">/100</span>}</div><p className="mt-1 text-sm font-semibold text-[#45685e]">{learningResponse?.label || 'Kanıt birikmesi bekleniyor'}</p></div></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#f3f8f5] p-3"><p className="text-xl font-semibold">{learningResponse?.directMasteryFamilies ?? 0}</p><p className="mt-1 text-[10px] text-muted-foreground">Doğrudan yeterli</p></div><div className="rounded-xl bg-[#f3f8f5] p-3"><p className="text-xl font-semibold">{learningResponse?.responsiveFamilies ?? 0}</p><p className="mt-1 text-[10px] text-muted-foreground">Desteğe yanıt</p></div><div className="rounded-xl bg-[#fff8e8] p-3"><p className="text-xl font-semibold">{learningResponse?.needsSupportFamilies ?? 0}</p><p className="mt-1 text-[10px] text-muted-foreground">İzlenecek alan</p></div></div>{responseFamilies.length>0&&<div className="mt-5 space-y-2 border-t pt-4">{responseFamilies.map((family:any)=><div key={family.groupId} className="flex items-center justify-between gap-3 text-xs"><div><p className="font-semibold">{family.groupId}</p><p className="text-muted-foreground">{familyStatusLabel(family.status)} · kanıt %{family.evidenceCompleteness}</p></div><span className="rounded-full bg-[#eef6f2] px-2.5 py-1 font-bold text-[#39705f]">{family.index ?? '—'}</span></div>)}</div>}<p className="mt-4 text-[10px] leading-4 text-muted-foreground">İndeks tanı koymaz; başlangıç performansı, destek miktarı, destek sonrası başarı ve bağımsız transfer kanıtlarını birlikte özetler.</p></section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8c7d]">Eğitmen gözlemi ve rubrik</p><h2 className="mt-1 text-xl font-semibold">{lastTask?.title || 'Görev tamamlanmasını bekliyor'}</h2><div className="mt-5 flex flex-wrap gap-2">{observationOptions.map(o=><button key={o.id} onClick={()=>setSelectedCodes(v=>v.includes(o.id)?v.filter(x=>x!==o.id):[...v,o.id])} className={`rounded-full border px-3 py-2 text-xs font-semibold ${selectedCodes.includes(o.id)?'border-[#70a890] bg-[#e7f5ed] text-[#226f60]':'bg-white text-[#65746f]'}`}>{o.label}</button>)}</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Kısa eğitmen notu…" className="mt-4 min-h-24 w-full rounded-xl border p-3 text-sm outline-none focus:border-[#70a890]"/><div className="mt-4"><label className="text-xs font-semibold text-muted-foreground">Gözlem güveni: {confidence}/5</label><input type="range" min="1" max="5" value={confidence} onChange={e=>setConfidence(Number(e.target.value))} className="mt-2 w-full"/></div><Button onClick={saveObservation} disabled={busy||!lastTaskCode} variant="outline" className="mt-4 w-full">Gözlemi kaydet</Button>

          {lastAttempt&&lastTask&&<div className="mt-5 border-t pt-5"><div className="mb-3 flex items-center gap-2"><BrainCircuit size={17} className="text-[#5d8c7d]"/><p className="text-sm font-semibold">Görev performans rubriği</p></div><div className="space-y-4">{lastTask.rubric.map(dimension=><div key={dimension.id}><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold">{dimension.label}</span><span className="text-xs text-muted-foreground">{rubricScores[dimension.id] ?? '—'} / {dimension.max}</span></div><div className="flex flex-wrap gap-1.5">{Array.from({length:dimension.max+1},(_,value)=><button key={value} type="button" onClick={()=>setRubricScores(prev=>({...prev,[dimension.id]:value}))} className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold ${rubricScores[dimension.id]===value?'border-[#70a890] bg-[#e7f5ed] text-[#226f60]':'bg-white text-[#65746f]'}`}>{value}</button>)}</div></div>)}</div><Button onClick={saveRubric} disabled={busy} className="mt-5 w-full bg-[#226f60] hover:bg-[#195749]">Rubriği kaydet ve indeksi güncelle</Button></div>}{message&&<p className="mt-3 text-xs text-[#55766b]">{message}</p>}</section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">14 beceri kanıtı</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Tek sorudan etiket üretmek yerine her beceri için farklı görevlerden kanıt biriktirilir.</p><div className="mt-4 space-y-3">{evidence.length===0?<p className="text-sm text-muted-foreground">Görevler tamamlandıkça burada kanıt birikecek.</p>:evidence.map(([id,count])=><div key={id} className="flex items-center justify-between gap-3"><span className="text-sm">{skillCatalog[id as keyof typeof skillCatalog]?.label || id}</span><span className="rounded-full bg-[#eef6f2] px-2.5 py-1 text-xs font-bold text-[#39705f]">{count} kanıt</span></div>)}</div></section>
        </aside>
      </div>}
    </div>
  </main>;
}
