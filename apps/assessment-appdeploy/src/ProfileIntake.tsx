import { useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { Baby, Brain, CalendarDays, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';

type ProfileOption = {
  code: string;
  label: string;
  group: string;
  needsBirthDate?: boolean;
  live?: boolean;
};

export const CZA_PROFILE_LABELS: Record<string, string> = {
  E0: '0–12 ay · Erken Gelişim',
  E1: '12–24 ay · Erken Gelişim',
  E2: '24–36 ay · Erken Gelişim',
  E3: '36–48 ay · Erken Gelişim',
  E4: '48–60 ay · Erken Gelişim',
  E5: '60–72 ay · Okula Hazırlık',
  P1: '1. Sınıf',
  P2: '1. sınıf sonu / 2. sınıf başlangıcı',
  P3: '3. Sınıf',
  P4: '4. Sınıf',
  P5: '5. Sınıf',
  P6: '6. Sınıf',
  P7: '7. Sınıf · LGS Ön Hazırlık',
  P8: '8. Sınıf · LGS',
  P9: '9–10. Sınıf · Lise Öğrenme Sistemi',
  P10: '11–12 / Mezun · YKS-TYT',
};

export const ASSESSMENT_PURPOSE_LABELS: Record<string, string> = {
  GENERAL: 'Genel Bütüncül Değerlendirme',
  LANGUAGE: 'Dil ve İletişim',
  SCHOOL_READINESS: 'Okula Hazırlık',
  ACADEMIC: 'Akademik Değerlendirme',
  COGNITIVE: 'Bilişsel Profil',
  LGS: 'LGS Hazırlık ve Koçluk',
  YKS: 'YKS / TYT Performans ve Koçluk',
  REASSESSMENT: 'Yeniden Ölçüm',
};

const profiles: ProfileOption[] = [
  { code: 'E0', label: CZA_PROFILE_LABELS.E0, group: 'Erken Gelişim', needsBirthDate: true },
  { code: 'E1', label: CZA_PROFILE_LABELS.E1, group: 'Erken Gelişim', needsBirthDate: true },
  { code: 'E2', label: CZA_PROFILE_LABELS.E2, group: 'Erken Gelişim', needsBirthDate: true, live: true },
  { code: 'E3', label: CZA_PROFILE_LABELS.E3, group: 'Erken Gelişim', needsBirthDate: true },
  { code: 'E4', label: CZA_PROFILE_LABELS.E4, group: 'Erken Gelişim', needsBirthDate: true },
  { code: 'E5', label: CZA_PROFILE_LABELS.E5, group: 'Erken Gelişim', needsBirthDate: true },
  { code: 'P1', label: CZA_PROFILE_LABELS.P1, group: 'Okul Çağı' },
  { code: 'P2', label: CZA_PROFILE_LABELS.P2, group: 'Okul Çağı', live: true },
  { code: 'P3', label: CZA_PROFILE_LABELS.P3, group: 'Okul Çağı' },
  { code: 'P4', label: CZA_PROFILE_LABELS.P4, group: 'Okul Çağı' },
  { code: 'P5', label: CZA_PROFILE_LABELS.P5, group: 'Ortaokul' },
  { code: 'P6', label: CZA_PROFILE_LABELS.P6, group: 'Ortaokul' },
  { code: 'P7', label: CZA_PROFILE_LABELS.P7, group: 'Sınav Hazırlık' },
  { code: 'P8', label: CZA_PROFILE_LABELS.P8, group: 'Sınav Hazırlık' },
  { code: 'P9', label: CZA_PROFILE_LABELS.P9, group: 'Lise' },
  { code: 'P10', label: CZA_PROFILE_LABELS.P10, group: 'Lise' },
];

const profileIcons: Record<string, string> = {
  E0: '🍼', E1: '🐣', E2: '🐰', E3: '🐥', E4: '🦊', E5: '🦁',
  P1: '✏️', P2: '🌟', P3: '📘', P4: '🧭', P5: '🧠', P6: '🔎', P7: '🎯', P8: '🏆', P9: '🚀', P10: '🎓',
};

const purposes = Object.entries(ASSESSMENT_PURPOSE_LABELS);

function completedAgeMonths(value: string) {
  if (!value) return null;
  const birth = new Date(value + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  return months >= 0 ? months : null;
}

function expectedRange(code: string) {
  const ranges: Record<string, [number, number]> = {
    E0: [0, 11],
    E1: [12, 23],
    E2: [24, 35],
    E3: [36, 47],
    E4: [48, 59],
    E5: [60, 71],
  };
  return ranges[code] ?? null;
}

export default function ProfileIntake() {
  const [name, setName] = useState('');
  const [profileCode, setProfileCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [purpose, setPurpose] = useState('GENERAL');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selectedProfile = profiles.find((profile) => profile.code === profileCode);
  const ageMonths = useMemo(() => completedAgeMonths(birthDate), [birthDate]);
  const range = expectedRange(profileCode);
  const ageMismatch = Boolean(range && ageMonths != null && (ageMonths < range[0] || ageMonths > range[1]));
  const currentPilot = (profileCode === 'P2' && purpose === 'GENERAL') || (profileCode === 'E2' && (purpose === 'GENERAL' || purpose === 'LANGUAGE'));
  const ready = name.trim().length >= 2 && Boolean(profileCode) && Boolean(purpose) && (!selectedProfile?.needsBirthDate || Boolean(birthDate)) && !ageMismatch;

  async function start() {
    if (!ready || busy) return;
    if (!currentPilot) {
      setMessage('Bu profil CZA çekirdeğine eklendi. Yaşa özel görev paketi henüz canlıya açılmadığı için mevcut 1–2. sınıf soruları yanlışlıkla başlatılmayacak.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await api.post('/api/parent/sessions', {
        studentLabel: name.trim().slice(0, 40),
        startStation: 'FULL',
        profileCode,
        birthDate: birthDate || undefined,
        assessmentPurpose: purpose,
      });
      const id = String((result.data as { id?: string }).id || '');
      if (!id) throw new Error('missing session');
      window.location.hash = '#/assessment?session=' + id;
    } catch {
      setMessage('Değerlendirme profili oluşturulamadı. Bilgileri kontrol edip yeniden deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='profile-shell'>
      <header className='profile-top'>
        <div className='profile-brand'><b>CZA</b><span>Çelik Zihin Akademisi</span></div>
        <div className='profile-top-actions'>
          <span className='profile-top-pill'>Yaş · Sınıf · Amaç</span>
          <a className='profile-educator-link' href='#/educator'>🎓 Eğitimci Merkezine Geç</a>
        </div>
      </header>
      <main className='profile-main'>
        <section className='profile-hero'>
          <div>
            <span className='profile-eyebrow'>CZA SİHİRLİ DÜNYA · BÜTÜNCÜL DEĞERLENDİRME</span>
            <h1>Doğru değerlendirme, doğru gelişim düzeyinden başlar.</h1>
            <p>Önce öğrencinin gelişim profilini belirliyoruz. Sistem daha sonra yaşa, sınıfa ve değerlendirme amacına uygun görev rotasını kullanacak.</p>
          </div>
          <div className='profile-hero-icon'><Brain size={44}/><div className='profile-mascots' aria-hidden='true'><span>🦊</span><span>🐻</span><span>🐰</span></div><small>Keşfet · Oyna · Geliş</small></div>
        </section>

        <section className='profile-card'>
          <div className='profile-section-title'><Sparkles/><div><strong>1 · Öğrenci bilgisi</strong><small>Yalnız değerlendirme için gerekli bilgileri gir.</small></div></div>
          <label className='profile-field'>
            <span>Öğrencinin adı</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder='Örn. Mete' maxLength={40}/>
          </label>

          <div className='profile-section-title profile-space'><GraduationCap/><div><strong>2 · Hangi dünyaya yolculuk?</strong><small>Erken gelişimde ay düzeyini, okul çağında sınıf düzeyini seç. Canlı olmayan dünyalar yanlış soru açmamak için kilitlidir.</small></div></div>
          <div className='profile-grid'>
            {profiles.map((profile) => (
              <button type='button' key={profile.code} disabled={!profile.live} aria-disabled={!profile.live} aria-pressed={profileCode === profile.code} className={'profile-option ' + (profile.group === 'Erken Gelişim' ? 'early-world ' : 'school-world ') + (profile.live ? 'live ' : 'locked ') + (profileCode === profile.code ? 'active' : '')} onClick={() => { if (!profile.live) return; setProfileCode(profile.code); setMessage(''); }}>
                <div className='profile-world-icon' aria-hidden='true'>{profileIcons[profile.code] || '✨'}</div>
                <span>{profile.group}</span>
                <strong>{profile.label}</strong>
                <small>{profile.live ? '✅ AKTİF' : '🔒 HAZIRLANIYOR'}</small>
              </button>
            ))}
          </div>

          {selectedProfile?.needsBirthDate && (
            <label className='profile-field profile-space'>
              <span><CalendarDays size={17}/> Doğum tarihi</span>
              <input type='date' value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthDate(event.target.value)}/>
              <small>{ageMonths == null ? 'Erken gelişimde kronolojik yaş ay olarak hesaplanır.' : 'Kronolojik yaş: ' + ageMonths + ' ay'}</small>
              {ageMismatch && <em>Doğum tarihi seçilen yaş bandıyla uyuşmuyor. Yaş bandını veya doğum tarihini kontrol et.</em>}
            </label>
          )}

          <div className='profile-section-title profile-space'><Baby/><div><strong>3 · Değerlendirme amacı</strong><small>Aynı yaşta bile başvuru nedenine göre değerlendirme yoğunluğu değişebilir.</small></div></div>
          <label className='profile-field'>
            <span>Değerlendirme türü</span>
            <select value={purpose} onChange={(event) => { setPurpose(event.target.value); setMessage(''); }}>
              {purposes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          {profileCode && (
            <div className={'profile-status ' + (currentPilot ? 'live' : 'planned')}>
              <ShieldCheck/>
              <div>
                <strong>{currentPilot ? 'Bu profil şu anda kullanılabilir.' : 'Bu profil ana matrise bağlandı.'}</strong>
                <small>{currentPilot ? profileCode === 'E2' ? '24–36 ay E2 paketi Genel Erken Gelişim ve Dil-İletişim amaçlarında uygulayıcı gözlem modu ile canlıdır.' : 'Mevcut pilot, 1. sınıfı tamamlayıp 2. sınıfa başlayan öğrenci düzeyine kalibre edilmiştir.' : 'Yaşa özel görev bankası tamamlanmadan başka yaş grubunun soruları açılmaz. Bu güvenlik kuralı kalıcıdır.'}</small>
              </div>
            </div>
          )}

          {message && <div className='profile-message'>{message}</div>}
          <button type='button' className='profile-start' disabled={!ready || busy} onClick={() => void start()}>
            {busy ? 'Profil hazırlanıyor…' : currentPilot ? 'Değerlendirme Planını Gör →' : 'Profili Kontrol Et →'}
          </button>
        </section>
      </main>
    </div>
  );
}
