'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpenCheck, CalendarDays, ChartNoAxesCombined, RefreshCw, ShieldCheck } from 'lucide-react';
import type { LearningProfile } from '@/lib/persistence/student-learning-profile';

function date(value: string | null) {
  return value ? new Date(value).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Yeterli kayıt yok';
}

function Badge({ value }: { value: 'SERVER_AUTHORITATIVE' | 'CLIENT_REPORTED' | 'MIXED' }) {
  const server = value === 'SERVER_AUTHORITATIVE';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${server ? 'bg-emerald-100 text-emerald-800' : value === 'CLIENT_REPORTED' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>
    {server ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}{server ? 'Sunucu kaydı' : value === 'CLIENT_REPORTED' ? 'İstemci bildirimi' : 'Karma kaynak'}
  </span>;
}

export function StudentLearningProfile({ endpoint, audience }: { endpoint: string; audience: 'student' | 'educator' }) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || data.ok !== true || !data.profile) throw new Error('profile_unavailable');
      if (!controller.signal.aborted) { setProfile(data.profile); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [endpoint]);

  if (state === 'loading') return <output className="block rounded-3xl border bg-white p-8 text-center text-sm font-semibold"><RefreshCw className="mx-auto mb-3 animate-spin" />Öğrenme profili hesaplanıyor…</output>;
  if (state === 'error' || !profile) return <p role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Öğrenme profili şu anda hazırlanamadı. Geçmiş kayıtları değiştirilmedi.</p>;
  const attempts = profile.coverage.attempts;
  return <section className="min-w-0 rounded-3xl border border-[#cddfd6] bg-[#f4faf7] p-5 shadow-sm sm:p-7" aria-labelledby={`learning-profile-${audience}`}>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-bold uppercase tracking-[.1em] text-[#276151]">Student Learning Profile özeti</p><h3 id={`learning-profile-${audience}`} className="mt-2 text-2xl font-black">Öğrenme Profili</h3><p className="mt-2 text-sm text-[#5b6d65]">{profile.student.name} · {date(profile.student.recordedFrom)} tarihinden itibaren kayıt · tek öğrenci, tek öğrenme geçmişi</p></div>
      <div className="text-right text-xs text-[#66766f]"><p>Hesaplama: {date(profile.calculatedAt)}</p><p>Veri sonu: {date(profile.dataThrough)}</p></div>
    </header>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[['Aktif ödev',profile.studyPattern.assignments.active],['Tamamlanan',profile.studyPattern.assignments.completed],['İptal',profile.studyPattern.assignments.cancelled],['Oturum',profile.studyPattern.sessions.total],['30 gün etkin gün',profile.studyPattern.sessions.activeDaysLast30]].map(([label,value])=><article key={label} className="rounded-2xl bg-white p-4"><b className="text-2xl">{value}</b><p className="mt-1 text-xs text-[#66766f]">{label}</p></article>)}
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl bg-white p-5"><div className="flex items-center gap-2"><ChartNoAxesCombined className="text-[#276151]"/><h4 className="font-black">Modüller ve kayıt kaynakları</h4></div><div className="mt-4 space-y-3">{profile.modules.map(module=><article key={module.moduleCode} className="min-w-0 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><b>{module.moduleName}</b><Badge value={module.provenance}/></div><p className="mt-2 text-sm text-[#52665e]">{module.assignments} ödev · {module.sessions} oturum · {module.records} öğrenme kaydı · {module.attempts} istemci attempt</p><p className="mt-1 break-words text-xs text-[#6b7c74]">Bildirilen doğruluk: {module.clientReportedAccuracy === null ? 'Yeterli kayıt yok' : `%${module.clientReportedAccuracy}`} · Kaynak: {module.sourceReferences.join(', ')}</p></article>)}{!profile.modules.length?<p className="text-sm text-[#66766f]">Henüz modül kaydı yok.</p>:null}</div></section>
      <section className="rounded-2xl bg-white p-5"><div className="flex items-center gap-2"><BookOpenCheck className="text-[#6652a8]"/><h4 className="font-black">Beceri ve öğrenme süreci</h4></div><div className="mt-4 space-y-3">{profile.skills.map(skill=><article key={`${skill.moduleCode}:${skill.skillCode}`} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><b>{skill.skillCode}</b><Badge value={skill.provenance}/></div><p className="mt-2 text-xs text-[#66766f]">{skill.moduleCode} · {skill.recordCount} kanıt · en fazla {skill.sourceReferences.length} kaynak referansı</p></article>)}{!profile.skills.length?<p className="text-sm text-[#66766f]">Yeterli beceri kanıtı yok; tamamlanan çalışma beceri kazanımı sayılmaz.</p>:null}</div><div className="mt-4 rounded-xl bg-[#f7f6fc] p-4 text-sm text-[#5f5872]"><b>Öğrenme süreci:</b> {profile.process.insufficiencyReason || `${profile.process.supportLevels.length} kayıtlı yardım düzeyi grubu var.`}<p className="mt-2 text-xs">Strateji, öz-düzeltme, tekrar ve transfer yalnız açıkça kaydedilmişse gösterilir; bu alanlar sonuçlardan tahmin edilmez.</p></div></section>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5"><h4 className="font-black">Sonuç ve hata geçmişi</h4><p className="mt-2 text-sm">{attempts ? `${attempts} istemci attempt kaydı` : 'Yeterli attempt kaydı yok; başarı %0 değildir.'}</p><div className="mt-3 space-y-2">{profile.errors.map(error=><div key={error.errorType} className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm"><span>{error.errorType} · {error.count}</span><Badge value={error.provenance}/></div>)}{!profile.errors.length?<p className="text-xs text-[#66766f]">Kayıtlı hata yok; bu durum otomatik başarı anlamına gelmez.</p>:null}</div></section>
      <section className="rounded-2xl bg-white p-5"><div className="flex items-center gap-2"><CalendarDays className="text-[#315f86]"/><h4 className="font-black">Zaman içindeki kayıt görünümü</h4></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{profile.periods.map(period=><article key={period.label} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><b>{period.label==='LAST_30_DAYS'?'Son 30 gün':'Önceki 30 gün'}</b><Badge value={period.provenance}/></div><p className="mt-2 text-sm">{period.sessions} oturum · {period.records} kayıt · {period.attempts} attempt</p><p className="mt-1 text-xs text-[#66766f]">İstemci doğruluğu: {period.clientReportedAccuracy===null?'Yeterli kayıt yok':`%${period.clientReportedAccuracy}`}</p></article>)}</div></section>
    </div>
    <footer className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-[#66766f]"><span>Kaynak detayları mevcut Geçmiş ve Rapor ekranlarından yetki kapsamında açılır.</span><span>Profil salt okunurdur; görüntüleme learning record veya evidence üretmez.</span></footer>
  </section>;
}
