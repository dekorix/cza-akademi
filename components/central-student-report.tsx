'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, KeyRound, Loader2, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { educatorAuthRequest, educatorAuthError } from '@/lib/educator-auth-client';

type WorkRecommendation = {
  id: string;
  moduleCode: string;
  moduleLabel: string;
  priority: 'HIGH' | 'MEDIUM' | 'MAINTAIN';
  sourceSkills: string[];
  reason: string;
  suggestedSettings: Record<string, string | number | boolean>;
  launchPath: string;
  educatorApprovalRequired: true;
};

type Report = {
  student: { id?: string; campusCode: string; name: string };
  summary: {
    total: number;
    correct: number;
    wrong: number;
    accuracy: number;
    rejectedTouches?: number;
  };
  modules: { module_code: string; total: number; correct: number }[];
  recent: {
    module_code: string;
    target_number: number | null;
    student_numeric_answer: number | null;
    is_correct: boolean;
    error_type: string | null;
    error_detail: string | null;
    total_response_time_ms: number | null;
    created_at: string;
    metadata?: { sequence?: number[] };
  }[];
  assessmentRouting?: null | {
    sessionId: string;
    templateCode: string;
    completedAt: string | null;
    evidenceCoverage: number;
    recommendations: WorkRecommendation[];
    note: string;
  };
};
const labels: Record<string, string> = {
  flash_anzan: 'Flash Anzan',
  audio_anzan: 'Sesli Anzan',
  soroban_read: 'Soroban Okuma',
  soroban_write: 'Soroban Yazma',
  finger_read: 'Parmak Okuma',
  finger_press: 'Parmak Basma',
  arithmetic: 'Toplama / Çıkarma',
};
const priorityLabels = { HIGH: 'Öncelikli destek', MEDIUM: 'Güçlendir', MAINTAIN: 'Gücü koru' } as const;
function message(code: string) {
  if (
    code === 'educator_session_required' ||
    code === 'educator_session_invalid'
  )
    return 'Eğitimci Kampüsü oturumu geçersiz veya süresi dolmuş.';
  if (code === 'student_mapping_missing' || code === 'student_not_found')
    return 'Bu öğrenci kodu merkezi kayıtta eşleştirilemedi.';
  if (code === 'campus_unavailable')
    return 'Eğitimci Kampüsü doğrulamasına ulaşılamıyor.';
  if (code === 'rate_limited')
    return 'Çok fazla rapor isteği yapıldı. Lütfen kısa süre sonra yeniden dene.';
  return 'Merkezi rapor şu anda açılamadı.';
}
function settingValue(key: string, value: string | number | boolean) {
  if (key === 'practiceMode') return value === 'guided_practice' ? 'Rehberli çalışma' : value === 'performance' ? 'Performans' : String(value);
  if (key === 'countdownEnabled') return value ? 'Açık' : 'Kapalı';
  if (key.endsWith('Ms') && typeof value === 'number') return `${value} ms`;
  if (key === 'speechRate' && typeof value === 'number') return `${value}×`;
  return String(value);
}

export function CentralStudentReport({ children, initialCode = '' }: { children?: ReactNode; initialCode?: string } = {}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email] = useState('celikzihin.akademisi@gmail.com');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => {
    let active = true;
    void educatorAuthRequest({ action: 'me' })
      .then(() => { if (active) setAuthenticated(true); })
      .catch(() => { if (active) setAuthenticated(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function logout() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await educatorAuthRequest({ action: 'logout' });
      setAuthenticated(false);
      setReport(null);
    } catch (error) { setError(educatorAuthError(error)); }
    finally { setLoading(false); }
  }
  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await educatorAuthRequest({ action: 'login', email, password });
      setAuthenticated(true);
      setPassword('');
    } catch (error) {
      setError(educatorAuthError(error));
    } finally { setLoading(false); }
  }
  async function reset() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await educatorAuthRequest({ action: 'request-reset', email });
      setError('Parola bağlantısı isteği alındı. E-postanın gelen kutusunu kontrol et.');
    } catch (error) {
      setError(educatorAuthError(error));
    } finally { setLoading(false); }
  }
  async function load(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch('/api/educator-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentCode: code }),
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok || data.ok === false)
        throw Error(typeof data.error === 'string' ? data.error : 'report_unavailable');
      setReport(data as Report);
    } catch (e) {
      setError(message(e instanceof Error ? e.message : 'report_unavailable'));
    } finally {
      setLoading(false);
    }
  }
  if (checking) return <p role="status" className="p-8 text-center">Eğitimci oturumu kontrol ediliyor…</p>;
  if (!authenticated)
    return (
      <form
        onSubmit={login}
        className="mx-auto max-w-lg rounded-xl border border-border bg-white p-6"
      >
        <p className="eyebrow text-primary">Güvenli eğitimci girişi</p>
        <h2 className="mt-2 text-xl font-semibold">CZA Eğitimci girişi</h2>
        <label
          className="mt-5 block text-xs font-semibold"
          htmlFor="educatorEmail"
        >
          E-posta
        </label>
        <Input
          id="educatorEmail"
          type="email"
          required
          readOnly
          autoComplete="username"
          value={email}
          className="mt-2 bg-muted/40"
        />
        <label
          className="mt-4 block text-xs font-semibold"
          htmlFor="educatorPassword"
        >
          Parola
        </label>
        <Input
          id="educatorPassword"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2"
        />
        <Button className="mt-5 w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <KeyRound />} Giriş
          yap
        </Button>
        <button
          type="button"
          onClick={reset}
          disabled={loading}
          className="mt-4 w-full text-sm font-semibold text-primary"
        >
          İlk parolamı oluştur
        </button>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    );
  if (children) return <>
    <div className="flex flex-wrap items-center justify-end gap-3 bg-white p-3">
      {error && <p role="alert">{error}</p>}
      <Button variant="outline" onClick={logout} disabled={loading}>Güvenli çıkış</Button>
    </div>
    {children}
  </>;
  return (
    <div className="space-y-5">
      <form
        onSubmit={load}
        className="rounded-xl border border-border bg-white p-6"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="studentCode" className="text-xs font-semibold">
              Öğrenci kodu / Student ID
            </label>
            <Input
              id="studentCode"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))
              }
              className="mt-2 h-10"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-10">
            {loading ? <Loader2 className="animate-spin" /> : <Search />} Gerçek
            kaydı getir
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
      {report && (
        <>
          <section className="rounded-xl border border-border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-primary">Gerçek öğrenci kaydı</p>
                <h2 className="mt-2 text-xl font-semibold">
                  {report.student.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.student.campusCode ? `Öğrenci kodu ${report.student.campusCode}` : 'Merkezi Student ID ile bağlı'}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  ['Soru', report.summary.total],
                  ['Doğru', report.summary.correct],
                  ['Yanlış', report.summary.wrong],
                  ['Başarı', `%${report.summary.accuracy}`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-20 rounded-lg bg-secondary/50 p-3"
                  >
                    <b className="block text-lg">{value}</b>
                    <span className="text-[10px] text-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {report.modules.map((m) => (
                <span
                  key={m.module_code}
                  className="rounded-full border border-border px-3 py-1 text-xs"
                >
                  {labels[m.module_code] || m.module_code}: {m.correct}/
                  {m.total}
                </span>
              ))}
              {Number(report.summary.rejectedTouches) > 0 && (
                <span className="rounded-full bg-[#fbf1df] px-3 py-1 text-xs text-[#8b632b]">
                  Reddedilen parmak dokunuşu: {report.summary.rejectedTouches}
                </span>
              )}
            </div>
          </section>

          {report.assessmentRouting && (
            <section className="rounded-xl border border-[#c9d9d1] bg-[#f5faf7] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-primary">Değerlendirme → çalışma köprüsü</p>
                  <h3 className="mt-2 text-lg font-semibold">Önerilen sonraki çalışmalar</h3>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">{report.assessmentRouting.note}</p>
                </div>
                <span className="rounded-full border border-[#bad5c8] bg-white px-3 py-1 text-xs font-semibold text-[#315f50]">
                  Kanıt kapsamı %{report.assessmentRouting.evidenceCoverage}
                </span>
              </div>
              {report.assessmentRouting.recommendations.length ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {report.assessmentRouting.recommendations.map((recommendation) => (
                    <article key={recommendation.id} className="rounded-lg border border-[#d6e4dc] bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{priorityLabels[recommendation.priority]}</p>
                          <h4 className="mt-1 font-semibold">{recommendation.moduleLabel}</h4>
                        </div>
                        <a href={recommendation.launchPath} className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white">Atölyeyi aç</a>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">{recommendation.reason}</p>
                      <p className="mt-3 text-[11px] font-semibold">Kanıt: {recommendation.sourceSkills.join(', ')}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(recommendation.suggestedSettings).map(([key, value]) => (
                          <span key={key} className="rounded-md bg-secondary/60 px-2 py-1 text-[10px] text-muted-foreground">{key}: {settingValue(key, value)}</span>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] text-muted-foreground">Eğitimci onayı gerekir · otomatik atama yapılmaz.</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-lg bg-white p-4 text-sm text-muted-foreground">Bu değerlendirmeden mevcut Çalışma Paneli modüllerine güvenli yönlendirme üretecek kadar uygun kanıt oluşmadı.</p>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border p-5">
              <h3 className="font-semibold">Son soru kayıtları</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Gösterilen işlem, verilen cevap, doğru cevap, hata türü ve cevap
                süresi.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="p-3">Tarih</th>
                    <th className="p-3">Çalışma</th>
                    <th className="p-3">İşlem</th>
                    <th className="p-3">Verilen / doğru cevap</th>
                    <th className="p-3">Süre</th>
                    <th className="p-3">Sonuç</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recent.map((row, index) => (
                    <tr
                      key={`${row.created_at}-${index}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="p-3">
                        {new Date(row.created_at).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3">
                        {labels[row.module_code] || row.module_code}
                      </td>
                      <td className="p-3 font-mono">
                        {row.metadata?.sequence
                          ?.map((n, i) => `${i && n > 0 ? '+' : ''}${n}`)
                          .join(' ') || '—'}
                      </td>
                      <td className="p-3">
                        {row.student_numeric_answer ?? '—'} /{' '}
                        {row.target_number ?? '—'}
                      </td>
                      <td className="p-3">
                        {row.total_response_time_ms == null
                          ? '—'
                          : `${(row.total_response_time_ms / 1000).toFixed(1)} sn`}
                      </td>
                      <td className="p-3">
                        {row.is_correct ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 size={14} /> Doğru
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[#a46332]"
                            title={row.error_detail || ''}
                          >
                            <XCircle size={14} /> {row.error_type || 'Yanlış'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
