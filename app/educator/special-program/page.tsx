'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Priority = {
  key: string;
  label: string;
  status: string;
  objective: string;
  successCriterion: string;
  activities: string[];
};

type Draft = {
  profileCode: string;
  profileLabel: string;
  assessmentSessionId: string;
  durationWeeks: 4;
  sessionsPerWeek: number;
  sessionMinutes: number;
  selectedPriorityKeys: string[];
  priorities: Priority[];
  weeks: { week: number; focus: string; educatorAction: string; measurement: string }[];
  reassessment: { week: number; rule: string };
  note: string;
};

type Preview = {
  ok: true;
  student: { id: string; name: string };
  draft: Draft;
  activeProgram?: null | { id: string; approved_at: string; ends_at: string };
};

function errorText(code: string) {
  if (code === 'student_not_linked_to_educator') return 'Bu öğrenci eğitimci hesabınıza bağlı değil.';
  if (code === 'special_assessment_not_found') return 'Tamamlanmış özel eğitim değerlendirmesi bulunamadı.';
  if (code === 'insufficient_special_evidence') return 'Bireysel program için yeterli değerlendirme kanıtı oluşmadı.';
  if (code === 'active_special_program_exists') return 'Bu profil için zaten aktif bir bireysel program var.';
  if (code === 'special_program_schema_unavailable') return 'Bireysel program veri katmanı henüz bu ortamda etkin değil.';
  if (code === 'educator_approval_required') return 'Programı kaydetmek için eğitimci onayı gerekir.';
  return 'Bireysel program şu anda hazırlanamadı.';
}

export default function SpecialEducationProgramPage() {
  const [studentId, setStudentId] = useState('');
  const [assessmentSessionId, setAssessmentSessionId] = useState('');
  const [prioritySeed, setPrioritySeed] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(25);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setStudentId(query.get('studentId') || '');
    setAssessmentSessionId(query.get('assessmentSessionId') || '');
    setPrioritySeed(query.get('priorities') || '');
  }, []);

  useEffect(() => {
    if (!studentId || !assessmentSessionId) return;
    let active = true;
    setBusy(true);
    setMessage('');
    void fetch('/api/educator-special-programs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'preview',
        studentId,
        assessmentSessionId,
        selectedPriorityKeys: prioritySeed.split(',').map(value => value.trim()).filter(Boolean).slice(0, 4),
      }),
    })
      .then(async response => {
        const data = await response.json() as Preview & { error?: string };
        if (!response.ok || data.ok !== true) throw new Error(data.error || 'preview_failed');
        if (!active) return;
        setPreview(data);
        setSelected(data.draft.selectedPriorityKeys);
        setSessionsPerWeek(data.draft.sessionsPerWeek);
        setSessionMinutes(data.draft.sessionMinutes);
      })
      .catch(error => {
        if (active) setMessage(errorText(error instanceof Error ? error.message : 'preview_failed'));
      })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [studentId, assessmentSessionId, prioritySeed]);

  const selectedPriorities = useMemo(
    () => preview?.draft.priorities.filter(priority => selected.includes(priority.key)) || [],
    [preview, selected],
  );

  function togglePriority(key: string) {
    setSelected(current => {
      if (current.includes(key)) return current.length === 1 ? current : current.filter(item => item !== key);
      if (current.length >= 4) return current;
      return [...current, key];
    });
    setApproved(false);
  }

  async function saveProgram() {
    if (!preview || !approved || busy || preview.activeProgram) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/educator-special-programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          studentId,
          assessmentSessionId,
          sessionsPerWeek,
          sessionMinutes,
          selectedPriorityKeys: selected,
          confirm: true,
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; program?: { version?: number } };
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'create_failed');
      setSaved(true);
      setMessage(`Bireysel çalışma programı v${data.program?.version || 1} merkezi öğrenci dosyasına kaydedildi.`);
    } catch (error) {
      setMessage(errorText(error instanceof Error ? error.message : 'create_failed'));
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-10">
    <div className="mx-auto max-w-5xl">
      <a href="/educator" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]">
        <ArrowLeft size={16}/> Eğitimci merkezine dön
      </a>

      <section className="mt-5 rounded-3xl border border-[#d6dfeb] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef3fa] text-[#385a78]">
            <ClipboardCheck/>
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#69839d]">Öğrenme Profili → Bireysel Program</p>
            <h1 className="mt-2 text-2xl font-semibold">Eğitimci onaylı 4 haftalık çalışma programı</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Sistem değerlendirme kanıtından taslak üretir. Öncelikleri ve çalışma yükünü eğitimci belirler. Açık onay verilmeden öğrenci dosyasına hiçbir program yazılmaz.
            </p>
          </div>
        </div>

        {busy && !preview && <p role="status" className="mt-8 flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={17}/> Program taslağı hazırlanıyor…</p>}
        {message && <p role={saved ? 'status' : 'alert'} className={`mt-6 rounded-xl p-4 text-sm font-semibold ${saved ? 'bg-[#edf8f2] text-[#276151]' : 'bg-[#fff4e7] text-[#8a5a25]'}`}>{message}</p>}

        {preview && <>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[#dbe4ef] bg-[#f8fafd] p-4"><span className="text-[10px] font-bold text-[#69839d]">ÖĞRENCİ</span><b className="mt-1 block">{preview.student.name}</b></div>
            <div className="rounded-xl border border-[#dbe4ef] bg-[#f8fafd] p-4"><span className="text-[10px] font-bold text-[#69839d]">PROFİL</span><b className="mt-1 block">{preview.draft.profileLabel}</b></div>
            <div className="rounded-xl border border-[#dbe4ef] bg-[#f8fafd] p-4"><span className="text-[10px] font-bold text-[#69839d]">SÜRE</span><b className="mt-1 block">4 hafta · yeniden ölçümle kapanır</b></div>
          </div>

          {preview.activeProgram && <div className="mt-6 rounded-xl border border-[#e7c9a9] bg-[#fff8ee] p-4 text-sm text-[#7f5a2c]">
            Bu profil için aktif bir program zaten bulunuyor. Aynı anda ikinci aktif program açılamaz.
          </div>}

          <div className="mt-8">
            <h2 className="text-lg font-semibold">1. Eğitim önceliklerini seç</h2>
            <p className="mt-1 text-xs text-muted-foreground">En az 1, en fazla 4 alan. Sistem ilk önerileri seçili getirir.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {preview.draft.priorities.map(priority => {
                const active = selected.includes(priority.key);
                return <button key={priority.key} type="button" onClick={() => togglePriority(priority.key)}
                  className={`rounded-xl border p-4 text-left transition ${active ? 'border-[#557ba0] bg-[#f0f5fb]' : 'border-border bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <b>{priority.label}</b>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? 'bg-[#385a78] text-white' : 'bg-muted text-muted-foreground'}`}>{active ? 'SEÇİLDİ' : 'SEÇ'}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{priority.objective}</p>
                </button>;
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="rounded-xl border border-border bg-white p-4 text-sm font-semibold">
              Haftalık oturum
              <select value={sessionsPerWeek} onChange={event => { setSessionsPerWeek(Number(event.target.value)); setApproved(false); }}
                className="mt-2 min-h-11 w-full rounded-lg border border-border bg-white px-3">
                {[2,3,4,5].map(value => <option key={value} value={value}>{value} oturum / hafta</option>)}
              </select>
            </label>
            <label className="rounded-xl border border-border bg-white p-4 text-sm font-semibold">
              Oturum süresi
              <select value={sessionMinutes} onChange={event => { setSessionMinutes(Number(event.target.value)); setApproved(false); }}
                className="mt-2 min-h-11 w-full rounded-lg border border-border bg-white px-3">
                {[15,20,25,30,35,40,45].map(value => <option key={value} value={value}>{value} dakika</option>)}
              </select>
            </label>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold">2. Seçilen hedeflerin çalışma içeriği</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {selectedPriorities.map(priority => <article key={priority.key} className="rounded-xl border border-[#dce4ef] bg-white p-5">
                <h3 className="font-semibold">{priority.label}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground"><b>Başarı ölçütü:</b> {priority.successCriterion}</p>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                  {priority.activities.map(activity => <li key={activity}>• {activity}</li>)}
                </ul>
              </article>)}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold">3. Dört haftalık ilerleme</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {preview.draft.weeks.map(week => <article key={week.week} className="rounded-xl border border-[#dce4ef] bg-[#f9fbfd] p-4">
                <span className="text-[10px] font-black text-[#69839d]">{week.week}. HAFTA</span>
                <h3 className="mt-1 font-semibold">{week.focus}</h3>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{week.educatorAction}</p>
                <p className="mt-3 text-[11px] font-semibold text-[#385a78]">{week.measurement}</p>
              </article>)}
            </div>
            <div className="mt-4 rounded-xl border border-[#cdddeb] bg-[#f3f8fc] p-4 text-sm text-[#385a78]">
              <b>4. hafta yeniden ölçüm:</b> {preview.draft.reassessment.rule}
            </div>
          </div>

          {!saved && !preview.activeProgram && <div className="mt-8 rounded-2xl border border-[#cbd9e6] bg-[#f7f9fc] p-5">
            <label className="flex items-start gap-3 text-sm leading-6">
              <input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} className="mt-1 h-4 w-4"/>
              <span><b>Eğitimci onayı:</b> Bu taslağı, seçilen öncelikleri ve çalışma yükünü inceledim. Programın öğrencinin merkezi dosyasına 4 haftalık aktif plan olarak kaydedilmesini onaylıyorum.</span>
            </label>
            <Button onClick={saveProgram} disabled={!approved || busy || selected.length === 0} className="mt-5 h-12 w-full bg-[#385a78] text-base hover:bg-[#2d4b66]">
              {busy ? <><Loader2 className="animate-spin"/> Kaydediliyor…</> : <><ShieldCheck/> Onayla ve bireysel programı oluştur</>}
            </Button>
          </div>}

          {saved && <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-[#b9daca] bg-[#edf8f2] p-5 text-[#276151]">
            <CheckCircle2 size={20}/><b>Program merkezi öğrenci dosyasına kaydedildi.</b>
            <a href="/educator" className="ml-auto rounded-lg bg-[#276151] px-4 py-2 text-sm font-semibold text-white">Eğitimci merkezine dön</a>
          </div>}

          <p className="mt-6 text-[10px] leading-5 text-muted-foreground">{preview.draft.note}</p>
        </>}
      </section>
    </div>
  </main>;
}
