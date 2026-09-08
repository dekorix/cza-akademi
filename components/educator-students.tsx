'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Student = { id: string; name: string; code: string | null; username: string | null };

export function EducatorStudents({ onReport }: { onReport: (code: string) => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  return <section className="rounded-2xl border border-border bg-white p-6">
    <h2 className="text-xl font-semibold">Öğrencilerim</h2>
    <p className="mt-2 text-sm text-muted-foreground">Takip yetkin bulunan öğrencilerin kayıtları.</p>
    {loading ? <p role="status" className="py-8">Öğrenciler yükleniyor…</p> : error ?
      <div className="py-6"><p role="alert">{error}</p><Button className="mt-3" onClick={() => setRetry(value => value + 1)}>Yeniden dene</Button></div> :
      <div className="mt-5 divide-y">{students.length ? students.map(student =>
        <div key={student.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div><h3 className="font-semibold">{student.name}</h3><p className="text-sm text-muted-foreground">{student.code ? `Öğrenci kodu: ${student.code}` : 'Kampüs kodu eşleştirmesi bekleniyor'}</p></div>
          <Button disabled={!student.code} onClick={() => { if (student.code) onReport(student.code); }}>Çalışma raporunu aç</Button>
          {student.username && <a className="font-semibold text-primary" href={`/paritmetik?from=educator&username=${encodeURIComponent(student.username)}`}>Öğrenci girişini aç</a>}
        </div>) : <p className="py-6">Bu sayfada bağlı öğrenci bulunmuyor.</p>}</div>}
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Önceki</Button>
      <span className="text-sm">Sayfa {page + 1}</span>
      <Button variant="outline" disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)}>Sonraki</Button>
    </div>
  </section>;
}
