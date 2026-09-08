'use client';

import { BrainCircuit, FileText, Gauge, Lightbulb, Printer, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CzaAssessmentReport, SkillReport } from '@/lib/assessment-report';

function statusLabel(status: SkillReport['status']) {
  if (status === 'RELATIVE_STRENGTH') return 'Göreli güçlü';
  if (status === 'DEVELOPING') return 'Gelişiyor';
  if (status === 'NEEDS_SUPPORT') return 'Destekle izlenmeli';
  return 'Kanıt yetersiz';
}

function confidenceLabel(confidence: SkillReport['confidence']) {
  if (confidence === 'HIGH') return 'Yüksek kanıt';
  if (confidence === 'MEDIUM') return 'Orta kanıt';
  if (confidence === 'LOW') return 'Sınırlı kanıt';
  return 'Henüz yetersiz';
}

function statusClass(status: SkillReport['status']) {
  if (status === 'RELATIVE_STRENGTH') return 'border-[#b9daca] bg-[#edf8f2] text-[#276151]';
  if (status === 'DEVELOPING') return 'border-[#e7d7a9] bg-[#fff8e5] text-[#7a6428]';
  if (status === 'NEEDS_SUPPORT') return 'border-[#ebc8c8] bg-[#fff2f2] text-[#8a4141]';
  return 'border-[#dfe5e2] bg-[#f7f9f8] text-[#66736f]';
}

function familyInitialLabel(value: string) {
  if (value === 'correct') return 'Bağımsız doğru';
  if (value === 'incorrect') return 'İlk yanıtta zorlandı';
  if (value === 'review') return 'Eğitmen incelemesi';
  return 'Henüz görülmedi';
}

export function AssessmentReport({ report, studentLabel }: { report: CzaAssessmentReport; studentLabel: string }) {
  const usableSkills = report.skills.filter((skill) => skill.status !== 'INSUFFICIENT');
  const completedMath = report.math.families.filter((family) => family.initial !== 'not_seen');

  return <section className="space-y-6 print:space-y-4">
    <section className="overflow-hidden rounded-3xl border border-[#d8e7df] bg-white shadow-sm print:shadow-none">
      <div className="bg-[#18372f] px-6 py-7 text-white md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b9d7c9]">Çelik Zihin Akademisi</p>
            <h2 className="mt-2 text-3xl font-semibold">Bütüncül Değerlendirme Raporu</h2>
            <p className="mt-2 text-sm text-[#d9e7e1]">{studentLabel} · 1. sınıf sonu → 2. sınıf başlangıcı geçiş profili</p>
          </div>
          <Button onClick={() => window.print()} className="print:hidden bg-white text-[#18372f] hover:bg-[#edf4f0]"><Printer/> Yazdır / PDF</Button>
        </div>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
        {[
          ['Kanıt kapsamı', `%${report.evidenceCoverage}`, 'Birden fazla görev ailesinden oluşan profil', ShieldCheck],
          ['Öğrenme tepkisi', report.learningResponse.index == null ? '—' : `${report.learningResponse.index}/100`, report.learningResponse.label, Gauge],
          ['Tamamlanan görev', String(report.process.completedTaskCount), `${report.process.supportTaskCount} destek görevi açıldı`, Target],
          ['Öz-düzeltme', String(report.process.selfCorrectionCount), 'Cevap/strateji değişim işareti', Sparkles],
        ].map(([label, value, caption, Icon]) => <div key={String(label)} className="rounded-2xl border border-[#e0ebe5] bg-[#f9fcfa] p-5">
          <div className="flex items-center gap-2 text-[#477565]"><Icon size={18}/><p className="text-xs font-bold uppercase tracking-[.1em]">{label}</p></div>
          <p className="mt-3 text-2xl font-semibold text-[#18372f]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{caption}</p>
        </div>)}
      </div>
      <div className="border-t border-[#e5ece8] px-6 py-5 md:px-8"><p className="text-sm leading-6 text-[#52665f]">{report.evidenceNote}</p></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-3xl border bg-white p-6 md:p-8">
        <div className="flex items-center gap-3"><BrainCircuit className="text-[#226f60]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#5c8679]">14 beceri profili</p><h3 className="text-xl font-semibold">Puan değil, kanıt yoğunluğu ve göreli görünüm</h3></div></div>
        <div className="mt-6 space-y-3">{report.skills.map((skill) => <div key={skill.skillId} className="rounded-2xl border border-[#e7ece9] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{skill.label}</p><p className="mt-1 text-xs text-muted-foreground">{skill.cluster} · {skill.evidenceCount} kanıt / {skill.groupCount} görev ailesi</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(skill.status)}`}>{statusLabel(skill.status)}</span></div>
          <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full rounded-full bg-[#6fa58f]" style={{ width: `${skill.score ?? 0}%` }}/></div><span className="w-12 text-right text-sm font-semibold">{skill.score == null ? '—' : skill.score}</span></div>
          <p className="mt-2 text-[11px] text-muted-foreground">{confidenceLabel(skill.confidence)} · Destek içeren kanıt oranı %{skill.supportRate}</p>
        </div>)}</div>
      </div>

      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-6 md:p-8"><div className="flex items-center gap-3"><Sparkles className="text-[#b18429]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#9b7a36]">Göreli güçlü alanlar</p><h3 className="text-xl font-semibold">Şu an en güçlü görünen kanıtlar</h3></div></div><div className="mt-5 space-y-3">{report.strengths.length ? report.strengths.slice(0,5).map((skill) => <div key={skill.skillId} className="rounded-xl bg-[#edf8f2] px-4 py-3"><p className="font-semibold text-[#276151]">{skill.label}</p><p className="mt-1 text-xs text-[#58766c]">{skill.evidenceCount} kanıt · skor {skill.score}</p></div>) : <p className="text-sm text-muted-foreground">Henüz güçlü alan sınıflaması için yeterli çoklu kanıt oluşmadı.</p>}</div></section>
        <section className="rounded-3xl border bg-white p-6 md:p-8"><div className="flex items-center gap-3"><Lightbulb className="text-[#9b7721]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#9b7a36]">Gelişim alanları</p><h3 className="text-xl font-semibold">Öğretimle güçlendirilecek alanlar</h3></div></div><div className="mt-5 space-y-3">{[...report.needsSupport, ...report.developing].slice(0,6).map((skill) => <div key={skill.skillId} className="rounded-xl border border-[#eadfbf] bg-[#fffaf0] px-4 py-3"><p className="font-semibold text-[#6f5d2b]">{skill.label}</p><p className="mt-1 text-xs text-[#7d745c]">{statusLabel(skill.status)} · {skill.evidenceCount} kanıt</p></div>)}</div></section>
      </div>
    </section>

    <section className="rounded-3xl border bg-white p-6 md:p-8">
      <div className="flex items-center gap-3"><Target className="text-[#226f60]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#5c8679]">Matematik derin tarama</p><h3 className="text-xl font-semibold">Alan bazında başlangıç → destek → transfer</h3></div></div>
      <p className="mt-4 rounded-2xl bg-[#f4f9f6] p-4 text-sm leading-6 text-[#4f685f]">{report.math.summary}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{report.math.families.map((family) => <div key={family.groupId} className="rounded-2xl border border-[#e6ece8] p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{family.label}</p><p className="mt-1 text-xs text-muted-foreground">{familyInitialLabel(family.initial)}{family.supportTriggered ? ' · destek dalı açıldı' : ''}</p></div><span className="rounded-full bg-[#f2f6f4] px-2.5 py-1 text-xs font-semibold">{family.groupId}</span></div><p className="mt-4 text-sm leading-6 text-[#52665f]">{family.interpretation}</p><div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">{family.transferScore != null && <span className="rounded-full border px-2.5 py-1">Transfer {family.transferScore}</span>}{family.strategyScore != null && <span className="rounded-full border px-2.5 py-1">Strateji {family.strategyScore}</span>}{family.independenceScore != null && <span className="rounded-full border px-2.5 py-1">Bağımsızlık {family.independenceScore}</span>}</div></div>)}</div>
      {!completedMath.length && <p className="mt-5 text-sm text-muted-foreground">Matematik görevleri tamamlandıkça bu bölüm otomatik oluşacak.</p>}
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-6 md:p-8"><div className="flex items-center gap-3"><Gauge className="text-[#226f60]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#5c8679]">Öğrenme tepkisi</p><h3 className="text-xl font-semibold">Destek sonrası ne oldu?</h3></div></div><p className="mt-4 text-3xl font-semibold text-[#18372f]">{report.learningResponse.index == null ? '—' : `${report.learningResponse.index}/100`}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{report.learningResponse.label}</p><div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-xl bg-[#edf8f2] p-3 text-center"><p className="text-xl font-semibold">{report.learningResponse.directMasteryFamilies}</p><p className="mt-1 text-[10px] text-muted-foreground">Doğrudan yeterli</p></div><div className="rounded-xl bg-[#fff8e8] p-3 text-center"><p className="text-xl font-semibold">{report.learningResponse.responsiveFamilies}</p><p className="mt-1 text-[10px] text-muted-foreground">Desteğe yanıtlı</p></div><div className="rounded-xl bg-[#fff1f1] p-3 text-center"><p className="text-xl font-semibold">{report.learningResponse.needsSupportFamilies}</p><p className="mt-1 text-[10px] text-muted-foreground">Ek destek</p></div></div></section>
      <section className="rounded-3xl border bg-white p-6 md:p-8"><div className="flex items-center gap-3"><BrainCircuit className="text-[#226f60]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#5c8679]">Strateji profili</p><h3 className="text-xl font-semibold">Çocuk nasıl çalışıyor?</h3></div></div><div className="mt-5 space-y-3">{report.strategyProfile.topSignals.length ? report.strategyProfile.topSignals.map((signal) => <div key={signal} className="rounded-xl bg-[#f4f9f6] px-4 py-3 text-sm font-medium text-[#3d6255]">{signal}</div>) : <p className="text-sm text-muted-foreground">Eğitmen gözlemleri kaydedildikçe strateji profili oluşur.</p>}</div><div className="mt-5 text-xs leading-5 text-muted-foreground">Aceleci yanıt: {report.strategyProfile.impulsive} · Deneme-yanılma: {report.strategyProfile.trialAndError} · Yardım isteme: {report.strategyProfile.helpSeeking}</div></section>
    </section>

    <section className="rounded-3xl border bg-white p-6 md:p-8"><div className="flex items-center gap-3"><FileText className="text-[#226f60]"/><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#5c8679]">Veliye anlaşılır özet</p><h3 className="text-xl font-semibold">Bu profil bize ne söylüyor?</h3></div></div><div className="mt-5 space-y-3">{report.parentSummary.map((line, index) => <p key={index} className="rounded-2xl bg-[#f7faf8] p-4 text-sm leading-7 text-[#465d54]">{line}</p>)}</div></section>

    <section className="grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border bg-white p-6 md:p-8"><h3 className="text-lg font-semibold">Önerilen eğitim yaklaşımı</h3><div className="mt-4 space-y-3">{report.recommendations.map((item,index) => <div key={index} className="flex gap-3 text-sm leading-6"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#6fa58f]"/><p>{item}</p></div>)}</div></section><section className="rounded-3xl border border-[#e2e7e4] bg-[#fafbfa] p-6 md:p-8"><h3 className="text-lg font-semibold">Yorumlama sınırları</h3><div className="mt-4 space-y-3">{report.cautions.map((item,index) => <div key={index} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#9ba9a3]"/><p>{item}</p></div>)}</div></section></section>

    {report.educatorNotes.length > 0 && <section className="rounded-3xl border bg-white p-6 md:p-8"><h3 className="text-lg font-semibold">Eğitmen notları</h3><div className="mt-4 space-y-2">{report.educatorNotes.map((note,index) => <p key={index} className="rounded-xl bg-[#f7faf8] p-4 text-sm leading-6">{note}</p>)}</div></section>}

    <p className="pb-6 text-center text-[11px] leading-5 text-muted-foreground">Rapor motoru v{report.version}. Puanlar ham görev verileri ve eğitmen rubriklerinden anlık hesaplanır; tek bir sorudan kalıcı beceri etiketi üretilmez. Kullanılabilir beceri alanı: {usableSkills.length}/14.</p>
  </section>;
}
