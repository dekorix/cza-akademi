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

function assessmentError(code: string) {
  if (code === 'birth_date_required') return 'E3 için doğum tarihi gerekli.';
  if (code === 'invalid_birth_date') return 'Doğum tarihi geçerli görünmüyor.';
  if (code === 'e3_age_out_of_range') return 'E3 yalnız 36–47 tamamlanmış ay aralığı için açılır.';
  if (code === 'student_not_linked_to_educator') return 'Bu öğrenci eğitimci yetkinle eşleşmiyor.';
  return code || 'Değerlendirme başlatılamadı.';
}

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
  const [e3BusyId, setE3BusyId] = useState('');
  const [e3BirthDate, setE3BirthDate] = useState<Record<string,string>>({});
  const [e3Sessions, setE3Sessions] = useState<Record<string,string>>({});
  const [e3Message, setE3Message] = useState('');
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
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studentId: student.id }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || !data.session?.id) throw new Error(data.error || 'Değerlendirme oturumu oluşturulamadı.');
      const sessionId = String(data.session.id);
      setAssessmentSessions(current => ({ ...current, [student.id]: sessionId }));
      setAssessmentMessage(`${student.name} için P2 değerlendirmesi merkezi öğrenci dosyasına bağlandı.`);
      const opened = window.open(`/assessment?session=${encodeURIComponent(sessionId)}`, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = `/assessment?session=${encodeURIComponent(sessionId)}`;
    } catch (error) {
      setAssessmentMessage(error instanceof Error ? error.message : 'Değerlendirme başlatılamadı.');
    } finally { setAssessmentBusyId(''); }
  }

  async function startE3Assessment(student: Student) {
    if (e3BusyId) return;
    const birthDate = (e3BirthDate[student.id] || '').trim();
    if (!birthDate) { setE3Message(`${student.name}: E3 için doğum tarihini gir.`); return; }
    setE3BusyId(student.id); setE3Message('');
    try {
      const response = await fetch('/api/assessment-e3-linked', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, birthDate, assessmentPurpose: 'GENERAL' }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || !data.session?.id) throw new Error(assessmentError(String(data.error || '')));
      const sessionId = String(data.session.id);
      setE3Sessions(current => ({ ...current, [student.id]: sessionId }));
      setE3Message(`${student.name}: E3 ${data.ageMonths} ay / ${data.ageBand} bandında gerçek Student ID ile oluşturuldu.`);
      const opened = window.open(`/assessment/e3?session=${encodeURIComponent(sessionId)}`, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = `/assessment/e3?session=${encodeURIComponent(sessionId)}`;
    } catch (error) {
      setE3Message(error instanceof Error ? error.message : 'E3 değerlendirmesi başlatılamadı.');
    } finally { setE3BusyId(''); }
  }

  async function assignWork(student: Student) {
    if (assignmentBusyId) return;
    const moduleCode = assignmentModule[student.id] || 'finger_read';
    setAssignmentBusyId(student.id); setAssignmentMessage('');
    try {
      const response = await fetch('/api/educator-assignments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', studentId: student.id, moduleCode }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        if (data.error === 'active_assignment_exists') throw new Error('Bu öğrenci için aynı modülde zaten aktif bir çalışma var.');
        throw new Error(data.error || 'Çalışma atanamadı.');
      }
      const label = assignmentModules.find(([code]) => code === moduleCode)?.[1] || moduleCode;
      setAssignmentMessage(`${student.name} için ${label} gerçek öğrenci dosyasına atandı. Çalışma, öğrencinin Çalışma Panelinde görünecek.`);
    } catch (error) { setAssignmentMessage(error instanceof Error ? error.message : 'Çalışma atanamadı.'); }
    finally { setAssignmentBusyId(''); }
  }

  return <section className="rounded-2xl border border-border bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Öğrencilerim</h2><p className="mt-2 text-sm text-muted-foreground">Takip yetkin bulunan öğrencilerin merkezi CZA kayıtları.</p></div><span className="rounded-full border border-[#b9daca] bg-[#edf8f2] px-3 py-2 text-xs font-semibold text-[#276151]">Tek Student ID · CZA Core</span></div>
    {assessmentMessage && <p role="status" className="mt-4 rounded-xl bg-[#f4f9f6] p-3 text-sm text-[#315f50]">{assessmentMessage}</p>}
    {e3Message && <p role="status" className="mt-4 rounded-xl border border-[#d6dfef] bg-[#f5f7fc] p-3 text-sm font-semibold text-[#39556d]">{e3Message}</p>}
    {assignmentMessage && <p role="status" className="mt-4 rounded-xl border border-[#c9dfd4] bg-[#edf8f2] p-3 text-sm font-semibold text-[#315f50]">{assignmentMessage}</p>}
    {loading ? <p role="status" className="py-8">Öğrenciler yükleniyor…</p> : error ?
      <div className="py-6"><p role="alert">{error}</p><Button className="mt-3" onClick={() => setRetry(value => value + 1)}>Yeniden dene</Button></div> :
      <div className="mt-5 divide-y">{students.length ? students.map(student => {
        const assessmentSessionId = assessmentSessions[student.id];
        const e3SessionId = e3Sessions[student.id];
        return <div key={student.id} className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-[220px] flex-1"><h3 className="font-semibold">{student.name}</h3><p className="text-sm text-muted-foreground">{student.code ? `Öğrenci kodu: ${student.code}` : 'Kampüs kodu eşleştirmesi bekleniyor'}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">Student ID: {student.id}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => onReport(student.id)}>Çalışma raporu</Button>
              <Button variant="outline" disabled={Boolean(assessmentBusyId)} onClick={() => void startLinkedAssessment(student)}>{assessmentBusyId === student.id ? 'Bağlanıyor…' : 'P2 değerlendirme'}</Button>
              {assessmentSessionId && <a className="rounded-md border border-[#c9d9d1] bg-white px-3 py-2 text-sm font-semibold text-[#315f50]" href={`/educator/assessment/report?session=${encodeURIComponent(assessmentSessionId)}`} target="_blank" rel="noreferrer">P2 raporu</a>}
              {student.username && <a className="font-semibold text-primary" href={`/paritmetik?from=educator&username=${encodeURIComponent(student.username)}`}>Öğrenci girişini aç</a>}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[#d6dfef] bg-[#f7f9fd] p-3">
            <div className="flex flex-wrap items-center gap-2"><div className="min-w-[180px] flex-1"><label className="text-xs font-semibold text-[#39556d]" htmlFor={`e3-birth-${student.id}`}>E3 · 36–48 ay doğum tarihi</label><input id={`e3-birth-${student.id}`} type="date" value={e3BirthDate[student.id] || ''} onChange={event=>setE3BirthDate(current=>({...current,[student.id]:event.target.value}))} className="mt-1 min-h-10 w-full rounded-lg border border-[#ccd7e7] bg-white px-3 text-sm"/></div><Button variant="outline" disabled={Boolean(e3BusyId)} onClick={()=>void startE3Assessment(student)}>{e3BusyId===student.id?'E3 hazırlanıyor…':'36–48 Ay E3 başlat'}</Button>{e3SessionId&&<a className="rounded-md border border-[#ccd7e7] bg-white px-3 py-2 text-sm font-semibold text-[#39556d]" href={`/educator/assessment/e3/report?session=${encodeURIComponent(e3SessionId)}`} target="_blank" rel="noreferrer">E3 raporu</a>}</div><p className="mt-2 text-[11px] leading-5 text-[#607187]">Backend tamamlanmış ayı doğrular. 36–47 ay dışında E3 oturumu açılmaz; çocuk ve bakımveren kanıtı ayrı tutulur.</p>
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
