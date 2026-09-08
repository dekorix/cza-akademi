'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssessmentReport } from '@/components/assessment-report';
import type { CzaAssessmentReport } from '@/lib/assessment-report';

async function loadReport(sessionId: string) {
  const response = await fetch('/api/assessment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'report', sessionId }),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || 'report_unavailable');
  return data;
}

export default function EducatorAssessmentReportPage() {
  const [sessionId,setSessionId] = useState('');
  const [studentLabel,setStudentLabel] = useState('Öğrenci');
  const [report,setReport] = useState<CzaAssessmentReport | null>(null);
  const [status,setStatus] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [message,setMessage] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session') || '';
    if (!id) return;
    setSessionId(id);
    void openReport(id);
  }, []);

  async function openReport(id = sessionId) {
    if (!id.trim()) {
      setMessage('Önce değerlendirme oturum kimliğini gir.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const data = await loadReport(id.trim());
      setStudentLabel(data.session?.student_label || 'Öğrenci');
      setReport(data.report || null);
      setStatus('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rapor açılamadı.');
      setStatus('error');
    }
  }

  return <main className="min-h-screen bg-[#f3f7f5] print:bg-white">
    <header className="print:hidden bg-[#182739] px-5 text-white md:px-9"><div className="mx-auto flex h-20 max-w-[1380px] items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d8eeac] text-xs font-black text-[#182739]">CZA</span><div><p className="text-sm font-semibold">Değerlendirme rapor merkezi</p><p className="text-[10px] text-[#9db0c3]">KANIT TEMELLİ · DİNAMİK RAPOR</p></div></div><a href="/educator/assessment" className="flex items-center gap-2 text-xs text-[#cfdfec]"><ArrowLeft size={15}/> Canlı değerlendirme</a></div></header>

    <div className="mx-auto max-w-[1380px] px-5 py-8 md:px-9 print:max-w-none print:px-0 print:py-0">
      <section className="print:hidden mb-7 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-end"><div className="flex-1"><div className="flex items-center gap-2"><FileText size={18} className="text-[#226f60]"/><label className="text-sm font-semibold">Değerlendirme oturumu</label></div><Input value={sessionId} onChange={event=>setSessionId(event.target.value)} placeholder="Oturum UUID" className="mt-2 h-11"/></div><Button onClick={()=>openReport()} disabled={status==='loading'} className="h-11 bg-[#226f60] hover:bg-[#195749]">{status==='loading'?<><RefreshCw className="animate-spin"/> Hazırlanıyor</>:<><FileText/> Raporu üret</>}</Button></div>{message&&<p className="mt-3 text-sm text-[#8b4b4b]">{message}</p>}<p className="mt-3 text-xs leading-5 text-muted-foreground">Rapor her açılışta ham görev verileri, eğitmen rubrikleri ve öğrenme tepkisi verilerinden yeniden hesaplanır. Böylece algoritma güncellense bile ham kanıt korunur.</p></section>

      {status==='idle'&&<section className="rounded-3xl border border-dashed bg-white p-12 text-center"><FileText className="mx-auto text-[#7e9c91]" size={36}/><h1 className="mt-4 text-2xl font-semibold">CZA Bütüncül Değerlendirme Raporu</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Bir değerlendirme oturumu seçildiğinde 14 beceri kanıtı, matematik derin taraması, öğrenme tepkisi, strateji profili ve veliye anlaşılır öneriler tek raporda oluşturulur.</p></section>}
      {status==='loading'&&<section className="rounded-3xl border bg-white p-12 text-center"><RefreshCw className="mx-auto animate-spin text-[#226f60]" size={32}/><p className="mt-4 text-sm text-muted-foreground">Ham kanıtlar rapora dönüştürülüyor…</p></section>}
      {status==='ready'&&report&&<AssessmentReport report={report} studentLabel={studentLabel}/>} 
    </div>
  </main>;
}
