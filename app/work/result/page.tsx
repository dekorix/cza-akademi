'use client';
/* oxlint-disable next/no-html-link-for-pages -- Document navigation retains the canonical cookie session. */
import { useEffect, useState } from 'react';
import { CompletedWorkResults } from '@/components/completed-work-results';
export default function WorkResultPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setSessionId(new URLSearchParams(window.location.search).get('sessionId') || 'invalid'), 0); return () => window.clearTimeout(timer); }, []);
  return <main className="mx-auto min-h-screen max-w-4xl bg-[#f4f8f5] p-5 text-[#233d3c] sm:p-8">
    <nav className="flex flex-wrap gap-4"><a href="/work" className="inline-flex min-h-11 items-center font-bold">Çalışma Merkezim</a><a href="/#profile" className="inline-flex min-h-11 items-center font-bold">Öğrenme Profilim</a><a href="/#history" className="inline-flex min-h-11 items-center font-bold">Geçmişim</a></nav>
    <h1 className="mt-5 text-3xl font-black">Çalışma Sonucu</h1>
    {sessionId ? <CompletedWorkResults sessionId={sessionId} /> : <output>Sonuç yükleniyor…</output>}
  </main>;
}
