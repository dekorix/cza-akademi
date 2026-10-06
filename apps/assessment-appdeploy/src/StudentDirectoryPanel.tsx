import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import { History, PlayCircle, RefreshCw, TrendingUp, UserRound } from 'lucide-react';
import { ASSESSMENT_PURPOSE_LABELS, CZA_PROFILE_LABELS } from './ProfileIntake';
import './report-workflow.css';

type SessionMeta = { id:string; status:string; reportStatus:string; createdAt:string; profileCode?:string; assessmentPurpose?:string; ageMonths?:number|null };
type Student = { id:string; name:string; createdAt:string; sessionCount:number; lastSession:null|SessionMeta };
type Hist = { student:{id:string;name:string}; sessions:Array<SessionMeta & { areas:Array<{id:number;title:string;score:number|null;status:string}> }> };

export default function StudentDirectoryPanel() {
  const [items, setItems] = useState<Student[]>([]);
  const [open, setOpen] = useState<Hist|null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setBusy(true);
    try {
      const response = await api.get('/api/students');
      setItems((response.data as {items:Student[]}).items || []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function history(id:string) {
    const response = await api.get('/api/student/' + id + '/history');
    setOpen(response.data as Hist);
  }

  async function follow(id:string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await api.post('/api/student/' + id + '/followup');
      location.hash = '#/assessment?session=' + (response.data as {id:string}).id;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Yeni ölçüm açılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return <section className='wf-directory'>
    <div className='wf-dir-head'><div><span>KALICI ÖĞRENCİ DOSYALARI</span><h2>Gelişimi profil bazında zaman içinde izle</h2></div><button onClick={() => void load()} disabled={busy}><RefreshCw/> Yenile</button></div>
    {message && <div className='cza-error' style={{marginBottom:12}}>{message}</div>}
    {items.length === 0 ? <p className='wf-empty'>Henüz kalıcı öğrenci dosyası yok. Bir raporu öğrenci dosyasına bağladığınızda burada görünür.</p> : <div className='wf-students'>{items.map((student) => <article key={student.id}><div><UserRound/><div><b>{student.name}</b><small>{student.sessionCount} değerlendirme oturumu</small>{student.lastSession && <small>{CZA_PROFILE_LABELS[student.lastSession.profileCode || 'P2']} · {ASSESSMENT_PURPOSE_LABELS[student.lastSession.assessmentPurpose || 'GENERAL']}</small>}</div></div><div className='wf-student-actions'><button onClick={() => void history(student.id)}><History/> Geçmiş</button><button onClick={() => void follow(student.id)} disabled={busy}><PlayCircle/> Aynı profilde yeni ölçüm</button></div></article>)}</div>}
    {open && <div className='wf-history'><div className='wf-history-title'><TrendingUp/><div><b>{open.student.name}</b><small>Profil ve ölçüm geçmişi</small></div><button onClick={() => setOpen(null)}>Kapat</button></div>{open.sessions.map((session, index) => {const previous = index > 0 ? open.sessions[index - 1] : null;const comparable = session.areas.filter((area) => area.score != null);const changes = previous ? comparable.map((area) => {const prior = previous.areas.find((item) => item.id === area.id)?.score;return prior == null || area.score == null ? null : {title:area.title,delta:area.score-prior};}).filter((item):item is {title:string;delta:number} => Boolean(item)).sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta)).slice(0,3) : [];return <article key={session.id}><b>{index+1}. ölçüm · {new Date(session.createdAt).toLocaleDateString('tr-TR')}</b><small>{CZA_PROFILE_LABELS[session.profileCode || 'P2']} · {ASSESSMENT_PURPOSE_LABELS[session.assessmentPurpose || 'GENERAL']}{session.ageMonths != null ? ' · ' + session.ageMonths + ' ay' : ''}</small><small>{session.reportStatus === 'approved' ? 'Final rapor onaylı' : session.status === 'completed' ? 'Eğitmen incelemesinde' : 'Değerlendirme sürüyor'}</small>{changes.length > 0 && session.profileCode !== 'E2' && <p>{changes.map((item) => item.title + ' ' + (item.delta > 0 ? '+' : '') + item.delta).join(' · ')}</p>}<a href={'#/report?session=' + session.id}>{session.profileCode === 'E2' ? 'Erken Gelişim Raporunu aç' : '14 Alan Raporunu aç'}</a></article>;})}</div>}
  </section>;
}
