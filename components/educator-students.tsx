'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Student = { id: string; name: string; code: string | null; username: string | null };

const assignmentModules = [
  ['finger_read', 'Parmak Okuma'],
  ['soroban_read', 'Soroban Okuma'],
  ['soroban_write', 'Soroban Yazma'],
  ['flash_anzan', 'Flash Anzan'],
  ['audio_anzan', 'Sesli Anzan'],
] as const;

export function EducatorStudents({ onReport }: { onReport: (studentId: string) => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assessmentBusyId, setAssessmentBusyId] = useState('');
  const [assessmentSessions, setAssessmentSessions] = useState<Record<string,string>>({});
  const [assessmentMessage, setAssessmentMessage] = useState('');
  const [assignmentBusyId, setAssignmentBusyId] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignmentModule, setAssignmentModule] = useState<Record<string,string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setStudents([]); setHasMore(false);
    void fetch(`/api/educator-students?page=${page}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) throw new Error('Oturumun sona erdi. Sayfayı yenileyerek yeniden giriş yap.');
        const data = await response.json();
        if (!response.ok || data.ok !== true || !Array.isArray(data.students)) throw new Error('Öğrenci listesi alınamadı. Yeniden dene.');
        if (!controller.signal.aborted) { setStudents(data.students); setHasMore(data.hasMore === true); }
      })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Liste alınamadı.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);

  async function startLinkedAssessment(student: Student) {
    if (assessmentBusyId) return;
    setAssessmentBusyId(student.id);
    setAssessmentMessage('');
    try {
      const response = await fetch('/api/assessment-linked', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || !data.session?.id) throw new Error(data.error || 'Değerlendirme oturumu oluşturulamadı.');
      const sessionId = String(data.session.id);
      setAssessmentSessions(current => ({ ...current, [student.id]: sessionId }));
      setAssessmentMessage(`${student.name} için değerlendirme merkezi öğrenci dosyasına bağlandı.`);
      const opened = window.open(`/assessment?session=${encodeURIComponent(sessionId)}`, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = `/assessment?session=${encodeURIComponent(sessionId)}`;
    } catch (error) {
      setAssessmentMessage(error instanceof Error ? error.message : 'Değerlendirme başlatılamadı.');
    } finally {
      setAssessmentBusyId('');
    }
  }

  async function assignWork(student: Student) {
    if (assignmentBusyId) return;
    const moduleCode = assignmentModule[student.id] || 'finger_read';
    setAssignmentBusyId(student.id);
    setAssignmentMessage('');
    try {
      const response = await fetch('/api/educator-assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', studentId: student.id, moduleCode }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        if (data.error === 'active_assignment_exists') throw new Error('Bu öğrenci için aynı modülde zaten aktif bir çalışma var.');
        throw new Error(data.error || 'Çalışma atanamadı.');
      }
      const label = assignmentModules.find(([code]) => code === moduleCode)?.[1] || moduleCode;
      setAssignmentMessage(`${student.name} için ${label} gerçek öğrenci dosyasına atandı. Çalışma, öğrencinin Çalışma Panelinde görünecek.`);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Çalışma atanamadı.');
    } finally {
      setAssignmentBusyId('');
    }
  }

  return <section className="rounded-2xl border border-border bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Öğrencilerim</h2><p className="mt-2 text-sm text-muted-foreground">Takip yetkin bulunan öğrencilerin merkezi CZA kayıtları.</p></div><span className="rounded-full border border-[#b9daca] bg-[#edf8f2] px-3 py-2 text-xs font-semibold text-[#276151]">Tek Student ID · CZA Core</span></div>
    {assessmentMessage && <p role="status" className="mt-4 rounded-xl bg-[#f4f9f6] p-3 text-sm text-[#315f50]">{assessmentMessage}</p>}
    {assignmentMessage && <p role="status" className="mt-4 rounded-xl border border-[#c9dfd4] bg-[#edf8f2] p-3 text-sm font-semibold text-[#315f50]">{assignmentMessage}</p>}
    {loading ? <p role="status" className="py-8">Öğrenciler yükleniyor…</p> : error ?
      <div className="py-6"><p role="alert">{error}</p><Button className="mt-3" onClick={() => setRetry(value => value + 1)}>Yeniden dene</Button></div> :
      <div className="mt-5 divide-y">{students.length ? students.map(student => {
        const assessmentSessionId = assessmentSessions[student.id];
        return <div key={student.id} className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-[220px] flex-1"><h3 className="font-semibold">{student.name}</h3><p className="text-sm text-muted-foreground">{student.code ? `Öğrenci kodu: ${student.code}` : 'Kampüs kodu eşleştirmesi bekleniyor'}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">Student ID: {student.id}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => onReport(student.id)}>Çalışma raporu</Button>
              <Button variant="outline" disabled={Boolean(assessmentBusyId)} onClick={() => void startLinkedAssessment(student)}>{assessmentBusyId === student.id ? 'Bağlanıyor…' : 'Değerlendirme başlat'}</Button>
              {assessmentSessionId && <a className="rounded-md border border-[#c9d9d1] bg-white px-3 py-2 text-sm font-semibold text-[#315f50]" href={`/educator/assessment/report?session=${encodeURIComponent(assessmentSessionId)}`} target="_blank" rel="noreferrer">Değerlendirme raporu</a>}
              {student.username && <a className="font-semibold text-primary" href={`/paritmetik?from=educator&username=${encodeURIComponent(student.username)}`}>Öğrenci girişini aç</a>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#dce9e2] bg-[#f8fbf9] p-3">
            <label className="text-xs font-semibold text-[#315f50]" htmlFor={`assignment-${student.id}`}>Gerçek çalışma ata</label>
            <select id={`assignment-${student.id}`} value={assignmentModule[student.id] || 'finger_read'} onChange={event => setAssignmentModule(current => ({ ...current, [student.id]: event.target.value }))} className="min-h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm">
              {assignmentModules.map(([code,label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <Button disabled={Boolean(assignmentBusyId)} onClick={() => void assignWork(student)}>{assignmentBusyId === student.id ? 'Atanıyor…' : 'Öğrenciye ata'}</Button>
          </div>
        </div>;
      }) : <p className="py-6">Bu sayfada bağlı öğrenci bulunmuyor.</p>}</div>}
    <div className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Önceki</Button><span className="text-sm">Sayfa {page + 1}</span><Button variant="outline" disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)}>Sonraki</Button></div>
  </section>;
}
