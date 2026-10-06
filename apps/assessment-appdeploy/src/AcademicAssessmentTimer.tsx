import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { Clock3, Pause, Play } from 'lucide-react';

type TimerSession = {
  profileCode?: string;
  status: string;
  assessmentStartedAt?: string;
  assessmentPausedAt?: string;
  assessmentPausedTotalMs?: number;
  assessmentCompletedAt?: string;
  assessmentActiveDurationMs?: number;
};

function isAcademicProfile(profileCode?: string) {
  return /^P(?:[1-9]|10)$/.test(profileCode || '');
}

export function formatAcademicDuration(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  return [minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function activeDuration(session: TimerSession, now: number) {
  if (typeof session.assessmentActiveDurationMs === 'number') return session.assessmentActiveDurationMs;
  if (!session.assessmentStartedAt) return 0;
  const started = Date.parse(session.assessmentStartedAt);
  if (!Number.isFinite(started)) return 0;
  const stoppedAt = session.assessmentPausedAt ? Date.parse(session.assessmentPausedAt) : now;
  const paused = Math.max(0, session.assessmentPausedTotalMs || 0);
  return Math.max(0, stoppedAt - started - paused);
}

export default function AcademicAssessmentTimer({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<TimerSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    let live = true;
    const load = () => {
      void api.get('/api/session/' + sessionId).then((result) => {
        if (live) setSession(result.data as TimerSession);
      }).catch(() => undefined);
    };
    load();
    const poll = window.setInterval(load, 4000);
    return () => {
      live = false;
      window.clearInterval(poll);
    };
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = useMemo(() => session ? activeDuration(session, now) : 0, [session, now]);
  const minute = Math.max(1, Math.floor(elapsed / 60000) + 1);
  const paused = Boolean(session?.assessmentPausedAt && session.status === 'active');
  const completed = session?.status === 'completed';

  async function change(action: 'pause' | 'resume') {
    if (!sessionId || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/api/session/' + sessionId + '/' + action + '-assessment', {});
      setSession(result.data as TimerSession);
      setNow(Date.now());
    } catch {
      setError(action === 'pause' ? 'Mola başlatılamadı.' : 'Değerlendirmeye devam edilemedi.');
    } finally {
      setBusy(false);
    }
  }

  if (!session || !isAcademicProfile(session.profileCode) || !session.assessmentStartedAt) return null;

  return <>
    <aside className={'academic-timer ' + (paused ? 'paused ' : '') + (completed ? 'completed' : '')} aria-live='polite'>
      <div className='academic-timer-clock'><Clock3 size={18}/><span><small>{completed ? 'AKTİF DEĞERLENDİRME SÜRESİ' : 'TOPLAM AKTİF SÜRE'}</small><strong>{formatAcademicDuration(elapsed)}</strong></span></div>
      <div className='academic-timer-minute'>{completed ? 'Tamamlandı' : paused ? 'Mola verildi' : minute + '. dakikadasın'}</div>
      {!completed && <button type='button' disabled={busy} onClick={() => void change(paused ? 'resume' : 'pause')}>
        {paused ? <Play size={15}/> : <Pause size={15}/>} {paused ? 'Devam et' : 'Mola ver'}
      </button>}
      {error && <em>{error}</em>}
    </aside>
    {paused && <div className='academic-pause-layer'>
      <section>
        <div>☕</div>
        <h2>Mola verildi</h2>
        <p>Genel değerlendirme süresi şu anda ilerlemiyor. Hazır olduğunda kaldığın yerden devam edebilirsin.</p>
        <strong>Aktif süre: {formatAcademicDuration(elapsed)}</strong>
        <button type='button' disabled={busy} onClick={() => void change('resume')}><Play size={17}/> Değerlendirmeye Devam Et</button>
      </section>
    </div>}
  </>;
}
