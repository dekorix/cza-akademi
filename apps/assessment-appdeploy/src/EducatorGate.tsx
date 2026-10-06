import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@appdeploy/client';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import './report-workflow.css';

type GateState = 'loading' | 'setup' | 'login' | 'owner';

const fieldStyle = {
  width: '100%',
  minHeight: 48,
  marginTop: 8,
  border: '1px solid #d7e3dd',
  borderRadius: 12,
  padding: '0 14px',
  fontSize: 17,
  boxSizing: 'border-box' as const,
};

export default function EducatorGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [bootstrapCode, setBootstrapCode] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [msg, setMsg] = useState('');

  async function check() {
    try {
      await api.get('/api/educator/me');
      setState('owner');
      setMsg('');
      return;
    } catch {
      try {
        const r = await api.get('/api/educator/setup-status');
        const data = r.data as { configured: boolean };
        setState(data.configured ? 'login' : 'setup');
      } catch {
        setState('login');
        setMsg('Giriş sistemi kontrol edilemedi. Sayfayı yenileyip yeniden deneyin.');
      }
    }
  }

  useEffect(() => {
    void check();
  }, []);

  async function setup() {
    if (busy) return;
    if (!bootstrapCode.trim()) {
      setMsg('Tek kullanımlık kurulum kodunu yazın.');
      return;
    }
    if (!/^\d{6,8}$/.test(pin)) {
      setMsg('PIN yalnız rakamlardan oluşan 6–8 haneli bir sayı olmalıdır.');
      return;
    }
    if (pin !== pinAgain) {
      setMsg('İki PIN aynı değil.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/educator/setup', { bootstrapCode: bootstrapCode.trim(), pin });
      setPin('');
      setPinAgain('');
      setBootstrapCode('');
      await check();
    } catch {
      setMsg('Kurulum kodu geçersiz veya kurulum daha önce tamamlanmış.');
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    if (busy) return;
    if (!/^\d{6,8}$/.test(pin)) {
      setMsg('6–8 haneli CZA PIN’inizi yazın.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/educator/login', { pin });
      setPin('');
      await check();
    } catch {
      setMsg('PIN doğrulanamadı. Yeniden deneyin.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/educator/logout');
      setState('login');
      setRecovering(false);
      setBootstrapCode('');
      setPin('');
      setPinAgain('');
      setMsg('Oturum kapatıldı. PIN ile yeniden giriş yapabilir veya PIN’inizi sıfırlayabilirsiniz.');
    } catch {
      setMsg('Çıkış yapılamadı. Sayfayı yenileyip yeniden deneyin.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPin() {
    if (busy) return;
    if (!bootstrapCode.trim()) {
      setMsg('Kurulum kurtarma kodunu yazın.');
      return;
    }
    if (!/^\d{6,8}$/.test(pin)) {
      setMsg('Yeni PIN yalnız rakamlardan oluşan 6–8 haneli bir sayı olmalıdır.');
      return;
    }
    if (pin !== pinAgain) {
      setMsg('İki PIN aynı değil.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/educator/reset-pin', { bootstrapCode: bootstrapCode.trim(), pin });
      setBootstrapCode('');
      setPin('');
      setPinAgain('');
      setRecovering(false);
      await check();
    } catch {
      setMsg('Kurtarma kodu doğrulanamadı veya PIN güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'owner') {
    return (
      <>
        <button
          type='button'
          onClick={() => void logout()}
          disabled={busy}
          style={{
            position: 'fixed',
            top: 14,
            right: 14,
            zIndex: 1000,
            border: '1px solid #cfe0d8',
            borderRadius: 10,
            background: '#ffffff',
            color: '#226f60',
            padding: '9px 12px',
            fontWeight: 800,
            boxShadow: '0 6px 20px rgba(20, 60, 48, .12)',
            cursor: 'pointer',
          }}
        >
          {busy ? 'Çıkış yapılıyor…' : 'Çıkış yap / PIN değiştir'}
        </button>
        {children}
      </>
    );
  }

  return (
    <div className='wf-gate'>
      <div className='wf-gate-card'>
        <div className='wf-lock'><LockKeyhole /></div>
        <span>CZA GÜVENLİ EĞİTMEN ALANI</span>
        <h1>{state === 'setup' ? 'CZA girişini bir kez kur.' : recovering ? 'CZA PIN’ini sıfırla.' : 'CZA PIN ile giriş yap.'}</h1>
        <p>
          {state === 'setup'
            ? 'E-posta doğrulaması kullanılmaz. Tek kullanımlık kurulum koduyla kendi PIN’inizi belirleyin; bu cihaz 30 gün açık kalır.'
            : recovering
              ? 'Kurulum kurtarma kodunu doğrulayarak yeni bir 6–8 haneli CZA PIN belirleyin.'
              : 'E-posta kodu veya açılır pencere yok. Bu cihazda oturum 30 gün korunur; süre dolduğunda yalnız CZA PIN’iniz istenir.'}
        </p>
        {state === 'loading' ? (
          <button disabled>Giriş kontrol ediliyor…</button>
        ) : state === 'setup' ? (
          <div style={{ width: '100%', display: 'grid', gap: 10 }}>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              Tek kullanımlık kurulum kodu
              <input
                style={fieldStyle}
                value={bootstrapCode}
                onChange={(e) => setBootstrapCode(e.target.value)}
                autoComplete='off'
                placeholder='Kurulum kodunu yazın'
              />
            </label>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              Yeni CZA PIN
              <input
                style={fieldStyle}
                type='password'
                inputMode='numeric'
                value={pin}
                maxLength={8}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoComplete='new-password'
                placeholder='6–8 haneli PIN'
              />
            </label>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              PIN tekrar
              <input
                style={fieldStyle}
                type='password'
                inputMode='numeric'
                value={pinAgain}
                maxLength={8}
                onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, ''))}
                autoComplete='new-password'
                placeholder='PIN’i tekrar yazın'
              />
            </label>
            <button onClick={() => void setup()} disabled={busy}>
              <ShieldCheck /> {busy ? 'Kuruluyor…' : 'CZA girişini etkinleştir'}
            </button>
          </div>
        ) : recovering ? (
          <div style={{ width: '100%', display: 'grid', gap: 10 }}>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              Kurulum kurtarma kodu
              <input style={fieldStyle} value={bootstrapCode} onChange={(e) => setBootstrapCode(e.target.value)} autoComplete='off' placeholder='Kurtarma kodunu yazın' />
            </label>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              Yeni CZA PIN
              <input style={fieldStyle} type='password' inputMode='numeric' value={pin} maxLength={8} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete='new-password' placeholder='6–8 haneli PIN' />
            </label>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              PIN tekrar
              <input style={fieldStyle} type='password' inputMode='numeric' value={pinAgain} maxLength={8} onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, ''))} autoComplete='new-password' placeholder='PIN’i tekrar yazın' />
            </label>
            <button onClick={() => void resetPin()} disabled={busy}><ShieldCheck /> {busy ? 'Güncelleniyor…' : 'PIN’i sıfırla'}</button>
            <button type='button' onClick={() => { setRecovering(false); setMsg(''); setBootstrapCode(''); setPin(''); setPinAgain(''); }} disabled={busy}>Giriş ekranına dön</button>
          </div>
        ) : (
          <div style={{ width: '100%', display: 'grid', gap: 12 }}>
            <label style={{ textAlign: 'left', fontWeight: 800 }}>
              CZA PIN
              <input
                style={fieldStyle}
                type='password'
                inputMode='numeric'
                value={pin}
                maxLength={8}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void login();
                }}
                autoComplete='current-password'
                placeholder='PIN’inizi yazın'
              />
            </label>
            <button onClick={() => void login()} disabled={busy}>
              <KeyRound /> {busy ? 'Kontrol ediliyor…' : 'PIN ile giriş yap'}
            </button>
            <button type='button' onClick={() => { setRecovering(true); setMsg(''); setPin(''); }}>PIN’i unuttum / sıfırla</button>
          </div>
        )}
        {msg && <small>{msg}</small>}
      </div>
    </div>
  );
}
