'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const moduleLabels: Record<string, string> = {
  finger_read: 'Parmak Okuma',
  soroban_read: 'Soroban Okuma',
  soroban_write: 'Soroban Yazma',
  flash_anzan: 'Flash Anzan',
  audio_anzan: 'Sesli Anzan',
  arithmetic: 'Toplama / Çıkarma',
};
const assignableModules = new Set(['finger_read', 'soroban_read', 'soroban_write', 'flash_anzan', 'audio_anzan']);

export default function AssessmentPrescriptionPage() {
  const [studentId, setStudentId] = useState('');
  const [assessmentSessionId, setAssessmentSessionId] = useState('');
  const [recommendationId, setRecommendationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setStudentId(query.get('studentId') || '');
    setAssessmentSessionId(query.get('assessmentSessionId') || '');
    setRecommendationId(query.get('recommendationId') || '');
  }, []);

  const moduleCode = useMemo(() => recommendationId.split(':')[0] || '', [recommendationId]);
  const moduleLabel = moduleLabels[moduleCode] || 'CZA Çalışması';
  const canAssign = assignableModules.has(moduleCode);
  const ready = Boolean(studentId && assessmentSessionId && recommendationId);

  async function approve() {
    if (!ready || busy || !canAssign) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/educator-assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create_from_assessment',
          studentId,
          assessmentSessionId,
          recommendationId,
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; assignment?: { name?: string } };
      if (!response.ok || data.ok !== true) {
        if (data.error === 'active_assignment_exists') throw new Error('Bu öğrenci için aynı modülde zaten aktif bir çalışma bulunuyor.');
        if (data.error === 'recommendation_not_found') throw new Error('Öneri güncel değerlendirme kanıtlarıyla artık eşleşmiyor. Raporu yeniden aç.');
        if (data.error === 'assessment_not_found_for_student') throw new Error('Değerlendirme bu öğrenci dosyasıyla doğrulanamadı.');
        throw new Error('Çalışma öğrenciye atanamadı.');
      }
      setAssigned(true);
      setMessage(`${data.assignment?.name || moduleLabel} öğrenci dosyasına atandı. Çalışma, öğrencinin CZA Çalışma Panelinde görünecek.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Çalışma atanamadı.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f4f8f6] px-5 py-10">
    <div className="mx-auto max-w-2xl">
      <a href="/educator" className="inline-flex items-center gap-2 text-sm font-semibold text-[#315f50]"><ArrowLeft size={16}/> Eğitimci merkezine dön</a>
      <section className="mt-5 rounded-3xl border border-[#cfe4d9] bg-white p-7 shadow-sm md:p-9">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f5ed] text-[#226f60]"><ShieldCheck/></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8c7d]">Değerlendirme → Çalışma Paneli</p><h1 className="mt-2 text-2xl font-semibold">{moduleLabel} reçetesini onayla</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Bu çalışma, öğrencinin tamamlanmış değerlendirme kanıtından üretilen CZA önerisine dayanır. Sistem kendi kendine atama yapmaz; aşağıdaki onay eğitimcinin kararıdır.</p></div></div>

        {!ready && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">Öneri bağlantısı eksik. Öğrencinin merkezi raporundan yeniden aç.</p>}

        {ready && !canAssign && <div className="mt-6 rounded-2xl border border-[#eadbbd] bg-[#fffaf0] p-5"><p className="font-semibold text-[#7a5b28]">{moduleLabel} önerisi hazır.</p><p className="mt-2 text-sm leading-6 text-[#806f51]">Bu modül henüz otomatik öğrenci reçetesi hattına bağlanmadı. Şimdilik atölyeyi doğrudan açabilirsin; Student ID tabanlı aritmetik ataması ayrı entegrasyon adımında tamamlanacak.</p><a href="/arithmetic" className="mt-4 inline-flex rounded-lg bg-[#7a5b28] px-4 py-2 text-sm font-semibold text-white">Toplama / Çıkarma atölyesini aç</a></div>}

        {message && <p role={assigned ? 'status' : 'alert'} className={`mt-6 rounded-xl p-4 text-sm font-semibold ${assigned ? 'bg-[#e7f5ed] text-[#226f60]' : 'bg-[#fff4e7] text-[#8a5a25]'}`}>{message}</p>}

        {canAssign && !assigned && <Button onClick={approve} disabled={!ready || busy} className="mt-7 h-12 w-full bg-[#226f60] text-base hover:bg-[#195749]">{busy ? <><Loader2 className="animate-spin"/> Öğrenci dosyasına işleniyor…</> : 'Öneriyi onayla ve öğrenciye ata'}</Button>}
        {assigned && <div className="mt-7 flex flex-wrap gap-3"><a href="/educator" className="inline-flex h-11 items-center justify-center rounded-lg bg-[#226f60] px-5 text-sm font-semibold text-white">Eğitimci merkezine dön</a><span className="inline-flex items-center gap-2 text-sm font-semibold text-[#226f60]"><CheckCircle2 size={18}/> Tek Student ID altında kaydedildi</span></div>}
      </section>
    </div>
  </main>;
}
