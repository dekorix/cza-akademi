import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { CheckCircle2, Clipboard, FileText, PlayCircle, RefreshCw, Search, UserRound } from 'lucide-react';
import { ASSESSMENT_PURPOSE_LABELS, CZA_PROFILE_LABELS } from './ProfileIntake';

type SessionSummary = {
  id: string;
  studentLabel: string;
  status: string;
  startStation: string;
  attemptCount: number;
  evidenceCount?: number;
  childResponseCount?: number;
  caregiverResponseCount?: number;
  currentTaskId: string | null;
  currentTitle: string | null;
  currentStation: string | null;
  completedTitles: string[];
  createdAt: string;
  profileCode?: string;
  ageMonths?: number | null;
  assessmentPurpose?: string;
  reportStatus?: string;
  earlyVersion?: string | null;
};

function dateLabel(value: string) {
  try {
    return new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function childUrl(id: string) {
  return `${location.origin}${location.pathname}#/assessment?session=${id}`;
}

function purposeLabel(item: SessionSummary) {
  return ASSESSMENT_PURPOSE_LABELS[item.assessmentPurpose || 'GENERAL'] || item.assessmentPurpose || 'Genel';
}

export default function SessionArchivePanel() {
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [q, setQ] = useState('');
  const [profile, setProfile] = useState('ALL');
  const [purpose, setPurpose] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  async function load() {
    setBusy(true);
    setErr('');
    try {
      const response = await api.get('/api/sessions/recent');
      setItems((response.data as { items?: SessionSummary[] }).items || []);
    } catch {
      setErr('Öğrenci kayıtları yüklenemedi. Yenile düğmesine basıp tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('tr-TR');
    return items.filter((item) => {
      if (query && !item.studentLabel.toLocaleLowerCase('tr-TR').includes(query)) return false;
      if (profile !== 'ALL' && (item.profileCode || 'P2') !== profile) return false;
      if (purpose !== 'ALL' && (item.assessmentPurpose || 'GENERAL') !== purpose) return false;
      if (status !== 'ALL' && item.status !== status) return false;
      return true;
    });
  }, [items, profile, purpose, q, status]);

  const groups = useMemo(() => {
    const order = ['E2', 'P2'];
    const map = new Map<string, SessionSummary[]>();
    for (const item of filtered) {
      const code = item.profileCode || 'P2';
      map.set(code, [...(map.get(code) || []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }, [filtered]);

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(childUrl(id));
      setCopied(id);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setErr('Bağlantı kopyalanamadı.');
    }
  }

  return <section className='cza-card' style={{ padding: 22, marginBottom: 22, border: '1px solid #d7e9e3', background: 'linear-gradient(180deg,#ffffff,#f8fcfa)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 15, display: 'grid', placeItems: 'center', background: '#e5f4ee', color: '#226f60' }}><UserRound /></div>
        <div><div className='cza-kicker'>KAYIT VE RAPOR MERKEZİ</div><h2 style={{ margin: '4px 0 0', fontSize: 24 }}>Değerlendirmeleri profil ve amaca göre yönet</h2></div>
      </div>
      <button className='cza-btn cza-soft' onClick={() => void load()} disabled={busy}><RefreshCw size={16}/> Yenile</button>
    </div>

    <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
      <label style={{ position: 'relative', display: 'block' }}><Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6d7d77' }}/><input className='cza-input' value={q} onChange={(event) => setQ(event.target.value)} placeholder='Öğrenci ara — örn. Mete Şahinoğlu' aria-label='Öğrenci ara' style={{ paddingLeft: 42, minHeight: 50, fontSize: 16 }}/></label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['ALL','Tüm Profiller'],['E2','24–36 Ay · E2'],['P2','1→2. Sınıf · P2']].map(([value,label]) => <button type='button' key={value} className={'cza-btn ' + (profile === value ? 'cza-primary' : 'cza-soft')} onClick={() => setProfile(value)}>{label}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['ALL','Tüm Amaçlar'],['GENERAL','Genel Bütüncül'],['LANGUAGE','Dil ve İletişim']].map(([value,label]) => <button type='button' key={value} className={'cza-btn ' + (purpose === value ? 'cza-primary' : 'cza-soft')} onClick={() => setPurpose(value)}>{label}</button>)}
        {[['ALL','Tüm Durumlar'],['active','Devam Eden'],['completed','Tamamlanan']].map(([value,label]) => <button type='button' key={value} className={'cza-btn ' + (status === value ? 'cza-primary' : 'cza-soft')} onClick={() => setStatus(value)}>{label}</button>)}
        <span className='cza-pill' style={{ alignSelf: 'center' }}>{filtered.length} kayıt</span>
      </div>
    </div>

    {err && <div className='cza-error' style={{ marginTop: 12 }}>{err}</div>}
    <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
      {busy ? <div className='cza-muted' style={{ padding: 18 }}>Öğrenci kayıtları yükleniyor…</div> : groups.length === 0 ? <div style={{ padding: 20, borderRadius: 16, background: '#f5f9f7', border: '1px dashed #cbded6' }}><strong>Bu filtrelerde kayıt bulunamadı.</strong><div className='cza-muted' style={{ fontSize: 13, marginTop: 5 }}>Arama veya kategori filtresini değiştir.</div></div> : groups.map(([code, sessions]) => <section key={code} style={{ padding: 14, borderRadius: 18, background: code === 'E2' ? '#f4fbff' : '#fffaf0', border: '1px solid ' + (code === 'E2' ? '#d9eaf4' : '#eadfbe') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}><div><div className='cza-kicker'>{code === 'E2' ? 'ERKEN GELİŞİM KAYITLARI' : code === 'P2' ? 'OKUL ÇAĞI KAYITLARI' : 'DİĞER PROFİL'}</div><h3 style={{ margin: '3px 0 0' }}>{CZA_PROFILE_LABELS[code] || code}</h3></div><span className='cza-pill'>{sessions.length} değerlendirme</span></div>
        <div style={{ display: 'grid', gap: 12 }}>{sessions.map((session) => <article key={session.id} style={{ padding: 17, borderRadius: 17, border: '1px solid #dce9e4', background: 'white', boxShadow: '0 8px 24px rgba(26,62,54,.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ fontSize: 19 }}>{session.studentLabel}</strong><span className={'cza-pill ' + (session.status === 'completed' ? 'cza-badge-good' : 'cza-badge-mid')}>{session.status === 'completed' ? 'Tamamlandı' : 'Devam ediyor'}</span><span className='cza-pill'>{purposeLabel(session)}</span>{session.ageMonths != null && <span className='cza-pill'>{session.ageMonths} ay</span>}</div><div className='cza-muted' style={{ fontSize: 12, marginTop: 6 }}>{dateLabel(session.createdAt)} · {session.profileCode === 'E2' ? `${session.childResponseCount || 0} çocuk + ${session.caregiverResponseCount || 0} veli kanıtı` : `${session.attemptCount} görev kaydı`}</div></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {session.status !== 'completed' && <a className='cza-btn cza-primary' style={{ textDecoration: 'none', padding: '9px 12px' }} href={'#/assessment?session=' + session.id}><PlayCircle size={16}/> Değerlendirmeye Devam</a>}
              <a className='cza-btn cza-soft' target='_blank' rel='noreferrer' style={{ textDecoration: 'none', padding: '9px 12px' }} href={'#/report?session=' + session.id}><FileText size={16}/> {session.profileCode === 'E2' ? 'Erken Gelişim Raporu / PDF' : '14 Alan Raporu / PDF'}</a>
              {session.profileCode !== 'E2' && <a className='cza-btn cza-primary' target='_blank' rel='noreferrer' style={{ textDecoration: 'none', padding: '9px 12px' }} href={'#/veli-rapor?session=' + session.id}><FileText size={16}/> Veli Raporu</a>}
              <button className='cza-btn cza-soft' style={{ padding: '9px 12px' }} onClick={() => void copy(session.id)}><Clipboard size={16}/> {copied === session.id ? 'Kopyalandı' : 'Linki Kopyala'}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 13 }}>
            <div style={{ padding: 12, borderRadius: 13, background: session.status === 'completed' ? '#edf8f1' : '#fff8e7' }}><div className='cza-kicker'>{session.status === 'completed' ? 'SON DURUM' : 'KALDIĞI YER'}</div><strong style={{ display: 'block', marginTop: 4 }}>{session.status === 'completed' ? 'Değerlendirme akışı tamamlandı' : session.profileCode === 'E2' ? 'E2 bütüncül değerlendirme devam ediyor' : session.currentTitle || 'Sonraki görev hazırlanıyor'}</strong>{session.currentStation && session.profileCode !== 'E2' && <small className='cza-muted' style={{ display: 'block', marginTop: 3 }}>{session.currentStation}</small>}</div>
            <div style={{ padding: 12, borderRadius: 13, background: '#f4f9f7' }}><div className='cza-kicker'>{session.profileCode === 'E2' ? 'KANIT KAYNAKLARI' : 'TAMAMLANANLAR'}</div>{session.profileCode === 'E2' ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}><span className='cza-pill'>Çocuk {session.childResponseCount || 0}</span><span className='cza-pill'>Veli {session.caregiverResponseCount || 0}</span><span className='cza-pill'>{session.earlyVersion || 'E2'}</span></div> : session.completedTitles.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{session.completedTitles.slice(-4).reverse().map((title, index) => <span key={title + index} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 9, background: 'white', border: '1px solid #dbe7e2' }}><CheckCircle2 size={12} style={{ verticalAlign: '-2px', marginRight: 4, color: '#2d806b' }}/>{title}</span>)}</div> : <small className='cza-muted' style={{ display: 'block', marginTop: 5 }}>Henüz tamamlanan bölüm yok.</small>}</div>
          </div>
        </article>)}</div>
      </section>)}
    </div>
    <div className='cza-muted' style={{ fontSize: 11, lineHeight: 1.55, marginTop: 12 }}>Son 100 değerlendirme; öğrenci, profil, amaç ve durum kategorileriyle tutulur. E2 raporu erken gelişim formatına, P2 raporları 14 alan ve veli formatına yönlenir.</div>
  </section>;
}
