'use client';
/* oxlint-disable next/no-html-link-for-pages -- Document navigation retains the canonical cookie session. */
import { useEffect, useState } from 'react';
import type { StudentWorkResult } from '@/lib/student-work-result';

function date(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function CompletedWorkResults({ sessionId }: { sessionId?: string }) {
  const [results, setResults] = useState<StudentWorkResult[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'login' | 'missing'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/core/work-results${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { setState('login'); return; }
        if (response.status === 404) { setState('missing'); return; }
        const data = await response.json();
        if (!response.ok || data.ok !== true || !Array.isArray(data.results)) throw new Error('results_unavailable');
        if (!controller.signal.aborted) { setResults(data.results); setState('ready'); }
      }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [sessionId, retry]);
  return <section aria-labelledby="persisted-results-heading" className="mt-6 min-w-0 space-y-4">
    <h2 id="persisted-results-heading" className="text-2xl font-black">Tamamlanan çalışma oturumları</h2>
    <p className="text-sm text-[#596d66]">Her çalışma ayrı gösterilir. Bu görünüm kayıtları değiştirmez veya yeni çalışma başlatmaz.</p>
    {state === 'loading' ? <output>Sonuçlar yükleniyor…</output> : null}
    {state === 'login' ? <p role="alert">Sonuç için öğrenci oturumu gerekli. <a href="/" className="underline">Giriş ekranına git</a></p> : null}
    {state === 'missing' ? <p role="alert">Bu çalışma sonucu bulunamadı veya erişim yetkin yok.</p> : null}
    {state === 'error' ? <div role="alert"><p>Çalışma sonuçları şu anda yüklenemedi. Kayıtların değiştirilmedi.</p><button type="button" className="mt-3 min-h-11 rounded-xl border px-4 font-bold" onClick={() => { setState('loading'); setRetry(value => value + 1); }}>Tekrar dene</button></div> : null}
    {state === 'ready' && !results.length ? <p>Henüz tamamlanmış atanmış çalışma oturumu yok.</p> : null}
    {state === 'ready' ? results.map(result => <article key={result.sessionId} data-session-id={result.sessionId} className="min-w-0 rounded-3xl border border-[#dcd7ec] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black">{result.assignmentTitle}</h3>
      <p className="mt-1">{result.moduleName} · Tamamlandı</p>
      <p className="mt-2 text-sm">Başlangıç: {date(result.startedAt)} · Tamamlanma: {date(result.completedAt)}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[[result.total, 'Soru'], [result.correct, 'Doğru'], [result.wrong, 'Yanlış']].map(([count, label]) => <div key={label} className="rounded-2xl bg-[#f3f6f5] p-3"><strong className="text-2xl">{count}</strong><p className="text-sm">{label}</p></div>)}
      </div>
      {!sessionId ? <a href={`/work/result?sessionId=${encodeURIComponent(result.sessionId)}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border px-4 font-bold">Sonucu Gör</a> : null}
      <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer font-bold">Kayıt ve kanıt bağlantıları</summary>
        <p className="break-all">Oturum: {result.sessionId}</p><p className="break-all">Atama: {result.assignmentId}</p>
        {result.records.map(record => <div key={`${record.recordId}:${record.evidenceId}`} className="mt-3 break-all rounded-xl bg-[#f3f6f5] p-3">
          <p>Öğrenme kaydı: {record.recordId}</p><p>Kaynak: {record.recordOrigin} · Kayıt doğrulaması: {record.verificationStatus}</p>
          <p>Kanıt: {record.evidenceId || 'Kayıtlı kanıt yok'} · Kanıt doğrulaması: {record.evidenceVerificationStatus || 'Yok'}</p>
          {record.verificationAuthority ? <p>Doğrulama kaynağı: {record.verificationAuthority}</p> : null}
        </div>)}
        <p className="mt-3 break-words">Kaynak: {result.sourceReference}</p>
        <p>Doğruluk, kayıtlı birincil cevaplardan hesaplanır; beceri kazanımı veya ölçülmemiş strateji çıkarımı yapılmaz.</p>
      </details>
    </article>) : null}
  </section>;
}
