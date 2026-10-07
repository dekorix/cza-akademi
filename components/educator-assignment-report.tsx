'use client';

import { useEffect, useState } from 'react';

type Detail = {
  student: { id: string };
  work: {
    completed: Array<{
      id: string;
      name: string;
      source: string;
      session: null | {
        id: string;
        status: string;
        completedAt: string | null;
      };
    }>;
  };
  attempts: Array<{ id: string; sessionId: string }>;
  history: Array<{ id: string; sessionId: string }>;
  evidence: Array<{
    id: string;
    learningRecordId: string;
    verificationStatus: string;
  }>;
};

export function EducatorAssignmentReport({ studentId }: { studentId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/educator-student-detail?studentId=${encodeURIComponent(studentId)}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (response) => {
        const data = (await response.json()) as Detail & { ok?: boolean };
        if (
          !response.ok ||
          data.ok !== true ||
          data.student?.id !== studentId ||
          !Array.isArray(data.work?.completed) ||
          !Array.isArray(data.attempts) ||
          !Array.isArray(data.history) ||
          !Array.isArray(data.evidence)
        )
          throw Error('detail_not_authorized');
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [studentId]);

  const works = detail?.work.completed.filter(
    (work) =>
      work.source === 'teacher_assignment' &&
      work.session?.status === 'completed',
  );

  return (
    <section
      aria-label="Ödev oturum sonuç dökümü"
      className="rounded-xl border border-border bg-white p-6"
    >
      <h3 className="font-semibold">Ödev → oturum → sonuç</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Yetkili öğrenci detayının son kayıtları. Öğrenci geneli toplamları
        yukarıda ayrıca gösterilir.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-amber-800">
          Ödev ve oturum dökümü yetkili öğrenci kaydından alınamadı.
        </p>
      )}
      {works?.map((work) => {
        const session = work.session!;
        const attempts = detail!.attempts.filter(
          (item) => item.sessionId === session.id,
        );
        const records = detail!.history.filter(
          (item) => item.sessionId === session.id,
        );
        const recordIds = new Set(records.map((item) => item.id));
        const evidence = detail!.evidence.filter((item) =>
          recordIds.has(item.learningRecordId),
        );
        return (
          <article
            key={work.id}
            data-assignment-id={work.id}
            className="mt-4 rounded-lg border border-border p-4"
          >
            <h4 className="font-semibold">{work.name}</h4>
            <p className="mt-2 break-all text-xs">Ödev: {work.id}</p>
            <p className="mt-1 break-all text-xs">
              Oturum: {session.id} · Tamamlandı
              {session.completedAt
                ? ` · ${new Date(session.completedAt).toLocaleString('tr-TR')}`
                : ''}
            </p>
            <p className="mt-3 text-sm font-semibold">
              Bu oturum: {attempts.length} deneme / {records.length} öğrenme
              kaydı / {evidence.length} kanıt
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deneme: istemci bildirimi · Kanıt:{' '}
              {
                evidence.filter(
                  (item) => item.verificationStatus === 'server_verified',
                ).length
              }{' '}
              sunucu doğrulamalı
            </p>
          </article>
        );
      })}
      {detail && !works?.length && (
        <p className="mt-4 text-sm text-muted-foreground">
          Tamamlanmış ödev oturumu bulunmuyor.
        </p>
      )}
    </section>
  );
}
