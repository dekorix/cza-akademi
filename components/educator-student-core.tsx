'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, BookOpenCheck, CheckCircle2, Clock3,
  RefreshCw, Search, ShieldCheck, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Student = {
  id: string;
  name: string;
  code: string | null;
  username: string | null;
};

type Work = {
  id: string;
  name: string;
  moduleCode: string;
  source: string;
  active: boolean;
  session: null | {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    progress: Record<string, unknown>;
  };
};

type Detail = {
  student: { id: string; name: string; username: string | null; campusCode: string | null };
  work: { active: Work[]; completed: Work[] };
  attempts: Array<{
    id: string; moduleCode: string; questionIndex: number; isCorrect: boolean;
    errorType: string; responseTimeMs: number | null; createdAt: string | null;
    provenance: 'client_reported';
  }>;
  errors: Array<{
    id: string; moduleCode: string; questionIndex: number; errorType: string;
    errorDetail: string | null; createdAt: string | null; provenance: 'client_reported';
  }>;
  evidence: Array<{
    id: string; type: string; verificationStatus: string;
    verificationAuthority: string | null; skillCode: string | null; observedAt: string | null;
  }>;
  history: Array<{
    id: string; moduleCode: string; recordOrigin: string; verificationStatus: string;
    completedAt: string | null; performance: Record<string, unknown>; skills: string[];
  }>;
  learningProfile: {
    clientReportedSkills: string[];
    serverVerifiedSkills: string[];
    clientReportedRecordCount: number;
    serverVerifiedEvidenceCount: number;
  };
};

function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString('tr-TR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : 'Henüz yok';
}

function Provenance({ status }: { status: string }) {
  const verified = status === 'server_verified';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
      verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
    }`}>
      {verified ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
      {verified ? 'Sunucu doğrulamalı' : 'Öğrenci/istemci bildirimi'}
    </span>
  );
}

function WorkList({ title, items, empty }: { title: string; items: Work[]; empty: string }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="font-bold text-[#18372f]">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((work) => (
          <article key={work.id} className="rounded-xl border border-[#dfe9e4] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{work.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{work.moduleCode} · {work.source}</p>
              </div>
              <span className="rounded-full bg-[#edf7f2] px-2.5 py-1 text-[11px] font-bold text-[#276151]">
                {work.session?.status === 'completed' ? 'Tamamlandı' : work.session ? 'Devam ediyor' : 'Başlanmadı'}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {work.session ? `Son hareket: ${date(work.session.completedAt || work.session.startedAt)}` : 'Oturum bekleniyor'}
            </p>
          </article>
        )) : <p className="text-sm text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

export function EducatorStudentCore() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [message, setMessage] = useState('');

  const loadStudents = useCallback(async (search = '') => {
    setLoadingList(true);
    setMessage('');
    try {
      const response = await fetch(`/api/educator-students?page=0&search=${encodeURIComponent(search)}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || !Array.isArray(data.students)) {
        throw new Error(response.status === 401 ? 'Eğitmen oturumu gerekli.' : 'Öğrenci listesi alınamadı.');
      }
      setStudents(data.students);
      if (data.students[0]?.id) {
        setSelectedId((current) => current || String(data.students[0].id));
      } else setLoadingDetail(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Öğrenci listesi alınamadı.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadStudents(), 0);
    return () => window.clearTimeout(task);
  }, [loadStudents]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void fetch(`/api/educator-student-detail?studentId=${encodeURIComponent(selectedId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.ok !== true) {
          throw new Error(response.status === 403 ? 'Bu öğrenci için görüntüleme yetkin yok.' : 'Öğrenci detayı alınamadı.');
        }
        if (!controller.signal.aborted) setDetail(data as Detail);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDetail(null);
          setMessage(error instanceof Error ? error.message : 'Öğrenci detayı alınamadı.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDetail(false);
      });
    return () => controller.abort();
  }, [selectedId]);

  return (
    <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="self-start rounded-2xl border bg-white p-5 shadow-sm xl:sticky xl:top-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f2ec] text-[#276151]"><UserRound /></span>
          <div><h2 className="font-bold">Yetkili öğrencilerim</h2><p className="text-xs text-muted-foreground">Yalnız görüntüleme yetkin olan kayıtlar</p></div>
        </div>
        <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadStudents(query); }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, kod veya kullanıcı adı" aria-label="Öğrenci ara" />
          <Button type="submit" size="icon" aria-label="Ara"><Search size={17} /></Button>
        </form>
        <div className="mt-4 space-y-2">
          {loadingList ? <output className="block py-5 text-sm">Öğrenciler yükleniyor…</output> :
            students.length ? students.map((student) => (
              <button key={student.id} type="button" onClick={() => { setLoadingDetail(true); setMessage(''); setSelectedId(student.id); }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === student.id ? 'border-[#5f927e] bg-[#edf7f2]' : 'border-[#e2e8e5] hover:bg-[#f7faf8]'
                }`}>
                <span className="block font-semibold">{student.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{student.code || student.username || 'Merkezî öğrenci kaydı'}</span>
              </button>
            )) : <p className="py-5 text-sm text-muted-foreground">Aramayla eşleşen yetkili öğrenci yok.</p>}
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</p>}
        {loadingDetail ? <div className="grid min-h-72 place-items-center rounded-2xl border bg-white"><output className="flex items-center gap-2"><RefreshCw className="animate-spin" size={18} /> Öğrenci dosyası hazırlanıyor…</output></div> :
        detail ? <>
          <header className="rounded-3xl bg-[#18372f] p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b9d7ca]">Merkezî öğrenci dosyası</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{detail.student.name}</h2>
            <p className="mt-2 text-sm text-[#d5e8e0]">{detail.student.campusCode || detail.student.username || 'Tek Student ID'} · {detail.student.id}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Aktif çalışma', detail.work.active.length],
                ['Tamamlanan', detail.work.completed.length],
                ['Sonuç kaydı', detail.history.length],
                ['Doğrulanmış kanıt', detail.learningProfile.serverVerifiedEvidenceCount],
              ].map(([label, value]) => <div key={label} className="rounded-xl bg-white/10 p-3"><b className="text-2xl">{value}</b><p className="mt-1 text-xs text-[#d5e8e0]">{label}</p></div>)}
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <WorkList title="Aktif ve devam eden çalışmalar" items={detail.work.active} empty="Aktif çalışma bulunmuyor." />
            <WorkList title="Tamamlanan çalışmalar" items={detail.work.completed} empty="Tamamlanmış çalışma bulunmuyor." />
          </div>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Activity className="text-[#276151]" /><h3 className="font-bold text-[#18372f]">Son attempt ve sonuçlar</h3></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {detail.attempts.slice(0, 12).map((attempt) => (
                <article key={attempt.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{attempt.moduleCode} · Soru {attempt.questionIndex}</b>
                    <Provenance status={attempt.provenance} />
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${attempt.isCorrect ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {attempt.isCorrect ? 'İstemcinin bildirdiği doğru' : `Hata: ${attempt.errorType}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{date(attempt.createdAt)}{attempt.responseTimeMs ? ` · ${attempt.responseTimeMs} ms` : ''}</p>
                </article>
              ))}
              {!detail.attempts.length && <p className="text-sm text-muted-foreground">Attempt kaydı bulunmuyor.</p>}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><AlertTriangle className="text-amber-700" /><h3 className="font-bold">Hata görünümü</h3></div>
              <div className="mt-4 space-y-3">
                {detail.errors.map((error) => <article key={error.id} className="rounded-xl bg-amber-50 p-4"><b className="text-sm">{error.errorType}</b><p className="mt-1 text-xs text-amber-900">{error.errorDetail || 'İstemci hata detayı bildirmedi.'}</p><div className="mt-2"><Provenance status={error.provenance} /></div></article>)}
                {!detail.errors.length && <p className="text-sm text-muted-foreground">Hata kaydı bulunmuyor.</p>}
              </div>
            </section>
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700" /><h3 className="font-bold">Evidence görünümü</h3></div>
              <div className="mt-4 space-y-3">
                {detail.evidence.map((item) => <article key={item.id} className="rounded-xl border p-4"><b className="text-sm">{item.type}</b><p className="mt-1 text-xs text-muted-foreground">{item.skillCode || 'Genel aktivite kanıtı'} · {date(item.observedAt)}</p><div className="mt-2"><Provenance status={item.verificationStatus} /></div></article>)}
                {!detail.evidence.length && <p className="text-sm text-muted-foreground">Sunucu doğrulamalı evidence bulunmuyor. İstemci sonuçları evidence olarak gösterilmez.</p>}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Clock3 className="text-[#276151]" /><h3 className="font-bold">Kronolojik öğrenci geçmişi</h3></div>
            <div className="mt-4 space-y-3">
              {detail.history.map((record) => <article key={record.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><b>{record.moduleCode}</b><p className="mt-1 text-xs text-muted-foreground">{date(record.completedAt)} · {record.skills.join(', ') || 'Beceri etiketi yok'}</p></div><Provenance status={record.verificationStatus} /></article>)}
              {!detail.history.length && <p className="text-sm text-muted-foreground">Geçmiş kaydı bulunmuyor.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-[#c9dfd4] bg-[#f3f9f6] p-5">
            <div className="flex items-center gap-2"><BookOpenCheck className="text-[#276151]" /><h3 className="font-bold text-[#18372f]">Student Learning Profile özeti</h3></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4"><Provenance status="client_reported" /><p className="mt-3 text-sm">{detail.learningProfile.clientReportedSkills.join(', ') || 'Bildirilen beceri yok'}</p><p className="mt-2 text-xs text-muted-foreground">{detail.learningProfile.clientReportedRecordCount} client-reported geçmiş kaydı</p></div>
              <div className="rounded-xl bg-white p-4"><Provenance status="server_verified" /><p className="mt-3 text-sm">{detail.learningProfile.serverVerifiedSkills.join(', ') || 'Doğrulanmış beceri kanıtı yok'}</p><p className="mt-2 text-xs text-muted-foreground">{detail.learningProfile.serverVerifiedEvidenceCount} server-verified evidence</p></div>
            </div>
          </section>
        </> : <div className="grid min-h-72 place-items-center rounded-2xl border bg-white text-center"><div><CheckCircle2 className="mx-auto text-[#7aa28f]" /><p className="mt-3 font-semibold">Detayını görmek için yetkili bir öğrenci seç.</p></div></div>}
      </div>
    </section>
  );
}
