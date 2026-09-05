'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Delete, Hand, LogOut, RefreshCw, Settings, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FingerHand } from '@/components/finger-hand';
import { digitPattern, emptyHand, numberPattern, readHand, readHands, transitionFinger, type FingerName, type HandPattern, type PressMode } from '@/lib/finger-engine';

type Mode = 'read' | 'press';
type HandMode = 'left' | 'right' | 'two';
type Student = { name?: string; fullName?: string; grade?: string; className?: string; username?: string };

async function core(action: string, values: Record<string, unknown> = {}) {
  const response = await fetch('/api/core', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
  });
  const data = (await response.json()) as Record<string, unknown>;
  const error = typeof data.error === 'string' ? data.error : 'core_unavailable';
  if (!response.ok || data.ok === false) throw new Error(error);
  return data;
}

function friendlyError(error: unknown) {
  const code = error instanceof Error ? error.message : 'unknown';
  if (code === 'invalid_credentials') return 'Kullanıcı adı veya PIN hatalı.';
  if (code === 'session_required' || code === 'invalid_session') return 'Oturumun sona erdi. Yeniden giriş yap.';
  if (code === 'request_origin_rejected') return 'Güvenlik doğrulaması tamamlanamadı.';
  return 'Learning Core’a şu anda ulaşılamıyor. Biraz sonra yeniden dene.';
}

function StudyPerformance({ stats }: { stats: { total: number; correct: number; wrong: number } }) {
  const accuracy = stats.total ? Math.round(stats.correct / stats.total * 100) : 0;
  return <section aria-label="Çalışma Performansı" className="mx-auto mt-5 max-w-xl overflow-hidden rounded-2xl border border-teal-200 bg-teal-50 text-slate-900">
    <h2 className="bg-teal-700 px-4 py-3 text-center text-lg font-bold text-white">Çalışma Performansı</h2>
    <div className="p-4" aria-live="polite" aria-atomic="true">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-sm">Soru Sayısı</dt><dd className="mt-1 text-3xl font-bold tabular-nums">{stats.total}</dd></div>
        <div><dt className="text-sm">Doğru Sayısı</dt><dd className="mt-1 text-3xl font-bold tabular-nums text-teal-800">{stats.correct}</dd></div>
        <div><dt className="text-sm">Yanlış Sayısı</dt><dd className="mt-1 text-3xl font-bold tabular-nums text-amber-800">{stats.wrong}</dd></div>
      </dl>
      <p className="mb-2 mt-4 text-center text-lg font-bold">Başarı Oranı: %{accuracy}</p>
      <div role="progressbar" aria-label="Başarı oranı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={accuracy} className="h-5 overflow-hidden rounded-full border border-teal-200 bg-white"><div className="h-full rounded-full bg-teal-600" style={{ width: accuracy + '%' }} /></div>
      <p className="mt-2 text-center text-sm text-slate-600">Bu çalışmada tamamladığın soruların özeti.</p>
    </div>
  </section>;
}

export default function ParitmetikPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [educatorHandoff, setEducatorHandoff] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mode, setMode] = useState<Mode>('read');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pressMode, setPressMode] = useState<PressMode>('semi');
  const [handMode, setHandMode] = useState<HandMode>('two');
  const handModeRef = useRef<HandMode>('two');
  const [transitionMs, setTransitionMs] = useState(6000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [ruleHint, setRuleHint] = useState('');
  const [rejected, setRejected] = useState<{ side: 'left' | 'right'; finger: FingerName } | null>(null);
  const [target, setTarget] = useState(2);
  const [left, setLeft] = useState<HandPattern>(emptyHand);
  const [right, setRight] = useState<HandPattern>(emptyHand);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [sync, setSync] = useState<'ready' | 'saving' | 'error'>('ready');
  const [stats, setStats] = useState({ total: 0, correct: 0, wrong: 0 });
  const questionStarted = useRef(0);
  const firstAction = useRef<number | null>(null);
  const sequence = useRef(0);
  const nextTimer = useRef<number | null>(null);
  const busy = useRef(false);
  const submitted = useRef(false);
  const pendingAttempt = useRef<Record<string, unknown> | null>(null);
  const interactions = useRef<Record<string, unknown>[]>([]);
  const flushing = useRef<Promise<void> | null>(null);
  const questionId = useRef('');
  const questionIndex = useRef(0);
  const [saveError, setSaveError] = useState('');
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(0);

  async function flushInteractions() {
    if (flushing.current) return flushing.current;
    const job = (async () => {
      while (interactions.current.length) {
        await core('interaction', interactions.current[0]);
        interactions.current.shift();
      }
    })();
    flushing.current = job;
    try { await job; } finally { flushing.current = null; }
  }

  const newQuestion = useCallback(() => {
    if (busy.current || pendingAttempt.current) return;
    submitted.current = false;
    questionId.current = crypto.randomUUID();
    questionIndex.current += 1;
    setSaveError('');
    setPaused(false);
    if (nextTimer.current) clearTimeout(nextTimer.current);
    setTarget(Math.floor(Math.random() * (handModeRef.current === 'two' ? 100 : 10)));
    setLeft(emptyHand());
    setRight(emptyHand());
    setAnswer('');
    setFeedback(null);
    setRuleHint('');
    setRejected(null);
    questionStarted.current = performance.now();
    firstAction.current = null;
  }, []);

  useEffect(() => {
    if (!feedback || sync !== 'ready' || transitionMs === 0 || paused || settingsOpen) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(now - last, 250);
      last = now;
      if (!document.hidden) setRemaining(value => Math.max(0, value - delta));
    }, 100);
    return () => window.clearInterval(timer);
  }, [feedback, sync, transitionMs, paused, settingsOpen]);

  useEffect(() => {
    if (sessionId && !sessionEnded && feedback && remaining === 0 && transitionMs > 0 && sync === 'ready' && !settingsOpen && !paused) newQuestion();
  }, [sessionId, sessionEnded, feedback, remaining, transitionMs, sync, settingsOpen, paused, newQuestion]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pendingAttempt.current || interactions.current.length || busy.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const startSession = useCallback(async (selectedMode: Mode) => {
    setSync('saving');
    try {
      const result = await core('start', {
        moduleCode: selectedMode === 'read' ? 'finger_read' : 'finger_press',
        source: 'free_practice',
        clientSessionId: crypto.randomUUID(),
        recipeId: null,
        settings: { engine: 'cza-handengine-v13', handMode: 'two', pressMode: 'semi' },
      });
      setSessionId(String(result.sessionId));
      setMode(selectedMode);
      setSync('ready');
      newQuestion();
    } catch (error) {
      setSaveError(friendlyError(error));
      setSync('error');
    }
  }, [newQuestion]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const comesFromEducator = params.get('from') === 'educator';
    const selectedUsername = params.get('username') || '';
    core('me')
      .then(async (data) => {
        setStudent((data.student || data.user || data) as Student);
        await startSession('read');
      })
      .catch(() => setStudent(null))
      .finally(() => {
        if (comesFromEducator) {
          setEducatorHandoff(true);
          setUsername(selectedUsername);
        }
        setLoading(false);
      });
  }, [startSession]);

  async function changeMode(selectedMode: Mode) {
    if (selectedMode === mode && sessionId) return;
    if (busy.current || pendingAttempt.current) return;
    if (sessionId) {
      try { await flushInteractions(); await core('finish', { sessionId }); } catch { setSaveError('Çalışma kaydedilemedi. Mod değiştirmeden önce kaydı yeniden dene.'); setSync('error'); return; }
      setSessionId(null);
    }
    await startSession(selectedMode);
  }

  function changeHandMode(value: HandMode) {
    if (submitted.current || busy.current) return;
    handModeRef.current = value;
    setHandMode(value);
  }

  async function finishStudy() {
    if (!sessionId || sessionEnded || busy.current || pendingAttempt.current) return;
    busy.current = true;
    setSync('saving');
    try {
      await flushInteractions();
      await core('finish', { sessionId });
      setSessionEnded(true);
      setSessionId(null);
      setSync('ready');
    } catch { setSync('error'); setSaveError('Çalışma kapatılamadı. Bitir düğmesiyle yeniden dene.'); }
    finally { busy.current = false; }
  }

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const data = await core('login', { username: username.trim(), pin: pin.trim() });
      setStudent((data.student || data.user || data) as Student);
      setPin('');
      await startSession('read');
    } catch (error) {
      setLoginError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (busy.current || pendingAttempt.current) return;
    if (sessionId) {
      try { await flushInteractions(); await core('finish', { sessionId }); } catch { setSync('error'); setSaveError('Kayıt tamamlanamadığı için çıkış yapılmadı.'); return; }
    }
    try { await core('logout'); } catch { /* Çerez sunucu yanıtında yine temizlenir. */ }
    setStudent(null);
    setSessionId(null);
    setStats({ total: 0, correct: 0, wrong: 0 });
  }

  async function touch(side: 'left' | 'right', finger: FingerName) {
    if (!sessionId || mode !== 'press' || busy.current || submitted.current || settingsOpen) return;
    if (firstAction.current === null) firstAction.current = performance.now();
    try { navigator.vibrate?.(15); } catch { /* Titreşim desteklenmeyebilir. */ }
    const current = side === 'left' ? left : right;
    const transition = transitionFinger(current, finger, pressMode);
    setRuleHint('');
    setRejected(null);
    if (transition.rejected) {
      setRuleHint(transition.evaluation.message);
      setRejected({ side, finger });
      try { navigator.vibrate?.([28, 28, 28]); } catch { /* Desteklenmeyebilir. */ }
      window.setTimeout(() => { setRuleHint(''); setRejected(null); }, 1500);
    } else if (side === 'left') setLeft(transition.state);
    else setRight(transition.state);
    sequence.current += 1;
    setSync('saving');
    try {
      interactions.current.push({
        sessionId,
        clientEventId: crypto.randomUUID(),
        questionIndex: questionIndex.current,
        sequenceNo: sequence.current,
        eventType: transition.rejected ? 'rejected_touch' : 'finger_touch',
        screenArea: side,
        finger,
        previousState: current[finger],
        newState: transition.state[finger],
        elapsedMs: Math.round(performance.now() - questionStarted.current),
        payload: { targetNumber: target, engine: 'cza-handengine-v13', surface: 'academy', pressMode, patternValid: transition.evaluation.valid, errorType: transition.evaluation.valid ? null : transition.evaluation.code, rejected: transition.rejected, previousPattern: current, attemptedPattern: transition.candidate, newPattern: transition.state, autoCompleted: pressMode === 'guided' },
      });
      await flushInteractions();
      setSync('ready');
    } catch {
      setSync('error');
      setSaveError('Dokunuş kaydı bekliyor. Sonuç kaydedilirken yeniden gönderilecek.');
    }
  }

  async function checkAnswer() {
    if (!sessionId || busy.current || (submitted.current && !pendingAttempt.current) || (mode === 'read' && answer === '')) return;
    busy.current = true;
    submitted.current = true;
    const patterns = handMode === 'left' ? { left: digitPattern(target), right: emptyHand() } : handMode === 'right' ? { left: emptyHand(), right: digitPattern(target) } : numberPattern(target);
    const handResult = handMode === 'left' ? readHand(left) : handMode === 'right' ? readHand(right) : readHands(left, right);
    let numericAnswer: number | null = null;
    let patternValid = true;
    let correct = false;
    let errorType = 'OK';
    let message = 'Doğru temsil.';

    if (mode === 'read') {
      numericAnswer = answer === '' ? null : Number(answer);
      correct = numericAnswer === target;
      if (!correct) {
        errorType = 'E01';
        message = 'Parmak kodu hedef sayı ile eşleşmedi.';
      }
    } else if (!handResult.valid) {
      patternValid = false;
      errorType = handResult.code;
      message = handResult.message;
    } else {
      numericAnswer = handResult.value;
      correct = numericAnswer === target;
      if (!correct) {
        const reversed = handMode === 'two' ? Number(String(target).padStart(2, '0').split('').reverse().join('')) : null;
        if (reversed !== null && numericAnswer === reversed) {
          errorType = 'F09';
          message = 'Onlar ve birler alanları ters.';
        } else if (handMode === 'two' && target % 10 === 0 && numericAnswer === Math.floor(target / 10)) {
          errorType = 'F10';
          message = 'Sıfır basamağı kayboldu.';
        } else {
          errorType = 'F12';
          message = 'Parmak temsili hedef sayı ile eşleşmedi.';
        }
      }
    }

    setSync('saving');
    setSaveError('');
    setFeedback({ correct, message });
    setRemaining(transitionMs);
    try {
      pendingAttempt.current ??= {
          clientAttemptId: crypto.randomUUID(),
          questionIndex: questionIndex.current,
          questionId: questionId.current,
          targetNumber: target,
          tensDigit: handMode === 'two' ? Math.floor(target / 10) : null,
          onesDigit: handMode === 'two' ? target % 10 : target,
          screenLeftTargetPattern: patterns.left,
          screenRightTargetPattern: patterns.right,
          studentNumericAnswer: numericAnswer,
          screenLeftStudentPattern: mode === 'press' ? left : null,
          screenRightStudentPattern: mode === 'press' ? right : null,
          patternValid,
          isCorrect: correct,
          errorType: correct ? 'OK' : errorType,
          errorDetail: correct ? 'Doğru' : message,
          stimulusDurationMs: 0,
          responseLatencyMs: firstAction.current === null ? null : Math.round(firstAction.current - questionStarted.current),
          totalResponseTimeMs: Math.round(performance.now() - questionStarted.current),
          handMode,
          pressMode: mode === 'press' ? pressMode : null,
          learningMode: 'practice',
          difficultyLevel: 8,
          attemptNumber: 1,
          metadata: { engine: 'cza-handengine-v13', surface: 'academy', resultScreen: 'comparison-v1' },
      };
      await flushInteractions();
      await core('attempt', { sessionId, payload: pendingAttempt.current });
      pendingAttempt.current = null;
      setStats(current => ({ total: current.total + 1, correct: current.correct + (correct ? 1 : 0), wrong: current.wrong + (correct ? 0 : 1) }));
      setSync('ready');
    } catch {
      setSync('error');
      setSaveError('Cevabın korunuyor. Kaydı yeniden dene; kayıt tamamlanmadan yeni soruya geçilmeyecek.');
    } finally { busy.current = false; }
  }

  const livePattern = handMode === 'left' ? readHand(left) : handMode === 'right' ? readHand(right) : readHands(left, right);
  const visiblePattern = handMode === 'left' ? { left: digitPattern(target), right: emptyHand() } : handMode === 'right' ? { left: emptyHand(), right: digitPattern(target) } : numberPattern(target);
  const displayName = student?.name || student?.fullName || student?.username || username || 'Öğrenci';
  const grade = student?.grade || student?.className;

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-background"><p className="text-sm text-muted-foreground">Çalışma alanın açılıyor…</p></main>;
  }

  if (!student) {
    return (
      <main className="paritmetik-login grid min-h-screen place-items-center px-5 py-10">
        <section className="w-full max-w-md rounded-3xl border border-border bg-white p-7 shadow-xl md:p-9">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3"><a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16} /> Akademiye dön</a>{educatorHandoff && <a href="/educator" className="text-sm font-semibold text-primary">Eğitmen ekranı</a>}</div>
          <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8eeac] font-black text-[#1c3d32]">CZA</span><div><p className="font-semibold">Egzersiz Akademisi</p><p className="text-xs text-muted-foreground">Learning Core bağlantısı</p></div></div>
          <h1 className="text-3xl font-semibold tracking-tight">Çalışmanı aç</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">CZA öğrenci kullanıcı adın ve PIN’inle devam et.</p>
          {educatorHandoff && <div className="mt-5 rounded-xl border border-[#b9daca] bg-[#edf8f2] p-4 text-sm leading-6 text-[#345f52]"><strong>Eğitmen ekranından Zeynep hesabı seçildi.</strong><p>Kullanıcı adı hazır. Geçici test PIN’ini girerek öğrenci çalışmasını aç.</p></div>}
          <form className="mt-7 space-y-4" onSubmit={login}>
            <div><label htmlFor="username" className="mb-2 block text-sm font-semibold">Kullanıcı adı</label><Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required className="h-12" /></div>
            <div><label htmlFor="pin" className="mb-2 block text-sm font-semibold">PIN</label><Input id="pin" type="password" inputMode="numeric" autoComplete="current-password" minLength={4} maxLength={6} pattern="[0-9]*" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} required className="h-12 text-lg tracking-[.3em]" /></div>
            {loginError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{loginError}</p>}
            <Button type="submit" className="h-12 w-full text-base">Giriş yap</Button>
          </form>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">Oturum bilgilerin tarayıcı koduna açılmaz; Akademi ile Learning Core arasında güvenli olarak taşınır.</p>
        </section>
      </main>
    );
  }

  if (sessionEnded) {
    const success = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    return <main className="grid min-h-screen place-items-center bg-background px-5"><section className="w-full max-w-xl rounded-3xl border border-border bg-white p-8 text-center shadow-lg"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 /></span><h1 className="mt-5 text-3xl font-semibold">Çalışma bitti</h1><p className="mt-2 text-muted-foreground">Bütün soruların, doğru ve yanlışların, parmak dokunuşların kaydedildi.</p><div className="mt-7 grid grid-cols-4 gap-2 rounded-2xl bg-[#edf4ef] p-5"><div><strong className="text-2xl">{stats.total}</strong><p className="text-xs">Soru</p></div><div><strong className="text-2xl text-primary">{stats.correct}</strong><p className="text-xs">Doğru</p></div><div><strong className="text-2xl text-amber-700">{stats.wrong}</strong><p className="text-xs">Yanlış</p></div><div><strong className="text-2xl">%{success}</strong><p className="text-xs">Başarı</p></div></div><a href="/" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-white">Çalışma merkezine dön</a></section></main>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#182739] px-5 text-white md:px-9"><div className="mx-auto flex min-h-20 max-w-[1280px] items-center justify-between gap-4 py-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8eeac] text-sm font-black text-[#182739]">CZA</span><div><p className="text-sm font-semibold">Paritmetik stüdyosu</p><p className="text-xs text-[#aebdcd]">{displayName}{grade ? ` · ${grade}` : ''}</p></div></div><div className="flex items-center gap-2"><span className={`hidden items-center gap-2 text-xs sm:flex ${sync === 'error' ? 'text-amber-200' : 'text-[#cfe8dc]'}`}>{sync === 'error' ? <WifiOff size={15} /> : <Wifi size={15} />}{sync === 'saving' ? 'Kaydediliyor…' : sync === 'error' ? 'Senkron bekliyor' : 'Neon senkron aktif'}</span><Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={logout}><LogOut /> Çıkış</Button></div></div></header>
      <main className="mx-auto max-w-[1280px] px-5 py-7 md:px-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16} /> Çalışma merkezim</a><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings /> Ayarlar</Button><Button variant="outline" onClick={newQuestion}>Devam</Button><Button variant="outline" onClick={finishStudy}>Bitir</Button><div className="flex rounded-xl border border-border bg-white p-1"><button className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'read' ? 'bg-primary text-white' : 'text-muted-foreground'}`} onClick={() => changeMode('read')}>Parmak Okuma</button><button className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'press' ? 'bg-primary text-white' : 'text-muted-foreground'}`} onClick={() => changeMode('press')}>Parmak Basma</button></div></div></div>

        {settingsOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#102034]/45 p-4" role="dialog" aria-modal="true" aria-label="Paritmetik ayarları"><section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Paritmetik Ayarları</h2><button className="rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => setSettingsOpen(false)}>Kapat</button></div><fieldset className="mt-5 rounded-2xl border p-4"><legend className="px-2 font-semibold">Soru tipi</legend>{([['right','Sağ el çalışması'],['left','Sol el çalışması'],['two','İki el çalışması']] as const).map(([value,label]) => <label key={value} className="mr-5 inline-flex items-center gap-2 py-2"><input type="radio" name="handMode" checked={handMode === value} onChange={() => changeHandMode(value)} />{label}</label>)}</fieldset>{mode === 'press' && <fieldset className="mt-4 rounded-2xl border p-4"><legend className="px-2 font-semibold">Parmak basma modu</legend>{([['free','Serbest'],['guided','Kurallı'],['semi','Yarı Kurallı']] as const).map(([value,label]) => <label key={value} className="mr-5 inline-flex items-center gap-2 py-2"><input type="radio" name="settingsPressMode" checked={pressMode === value} onChange={() => { if (!submitted.current && !busy.current) setPressMode(value); }} />{label}</label>)}</fieldset>}<fieldset className="mt-4 rounded-2xl border p-4"><legend className="px-2 font-semibold">Soru geçiş hızı</legend><select className="w-full rounded-xl border p-3" value={transitionMs} onChange={(event) => setTransitionMs(Number(event.target.value))}><option value="0">Süre kısıtlaması yok</option><option value="3000">3 saniye</option><option value="6000">6 saniye</option><option value="10000">10 saniye</option><option value="15000">15 saniye</option></select></fieldset><Button className="mt-5 w-full" onClick={() => { setSettingsOpen(false); newQuestion(); }}>Tamam</Button></section></div>}

        {saveError && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4">{saveError}<Button className="ml-3" onClick={() => { if (pendingAttempt.current) void checkAnswer(); else void flushInteractions().then(() => { setSync('ready'); setSaveError(''); }).catch(() => setSync('error')); }}>Kaydı yeniden dene</Button></div>}
        <section className="paritmetik-stage rounded-3xl border border-border bg-white p-5 shadow-sm md:p-8">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-primary">{mode === 'read' ? 'GÖR · OKU · YAZ' : 'GÖR · PARMAKLARINLA GÖSTER'}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{mode === 'read' ? 'Eller hangi sayıyı gösteriyor?' : 'Bu sayıyı ellerinle oluştur.'}</h1></div><Button variant="outline" onClick={newQuestion}><RefreshCw /> Yeni soru</Button></div>

          <fieldset disabled={!!feedback || sync === 'saving'} hidden={!!feedback}>
          {mode === 'press' && <><div className="focus-number mb-3 text-center text-6xl font-extrabold text-[#173f75] md:text-7xl">{String(target).padStart(2, '0')}</div><div className="mx-auto mb-4 flex w-fit flex-wrap justify-center rounded-xl border border-border bg-[#f5f8f6] p-1">{([['guided','Kurallı'],['semi','Yarı Kurallı'],['free','Serbest']] as const).map(([value,label]) => <button key={value} className={`rounded-lg px-4 py-2 text-sm font-semibold ${pressMode === value ? 'bg-primary text-white' : 'text-muted-foreground'}`} onClick={() => { if (!submitted.current && !busy.current) { setPressMode(value); setLeft(emptyHand()); setRight(emptyHand()); } }}>{label}</button>)}</div></>}
          {mode === 'read' && <div className="mb-3 focus-number min-h-14 text-center text-5xl font-bold text-[#173f75]">{answer || '—'}</div>}

          <div className={`mx-auto grid max-w-[760px] items-end gap-2 md:gap-8 ${handMode === 'two' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {handMode !== 'right' && <div><p className="mb-1 text-center text-xs font-semibold text-muted-foreground">{handMode === 'two' ? 'ONLAR' : 'SOL EL'}</p><FingerHand side="left" pattern={mode === 'read' ? visiblePattern.left : left} interactive={mode === 'press'} rejectedFinger={rejected?.side === 'left' ? rejected.finger : null} onFinger={(finger) => touch('left', finger)} /></div>}
            {handMode !== 'left' && <div><p className="mb-1 text-center text-xs font-semibold text-muted-foreground">{handMode === 'two' ? 'BİRLER' : 'SAĞ EL'}</p><FingerHand side="right" pattern={mode === 'read' ? visiblePattern.right : right} interactive={mode === 'press'} rejectedFinger={rejected?.side === 'right' ? rejected.finger : null} onFinger={(finger) => touch('right', finger)} /></div>}
          </div>

          {mode === 'read' ? (
            <div className="mx-auto mt-3 max-w-xl"><div className="grid grid-cols-6 gap-2 rounded-2xl bg-[#d8e9f7] p-3">{[1,2,3,4,5,6,7,8,9,0].map((digit) => <button key={digit} className="min-h-12 rounded-xl bg-[#315a83] text-xl font-semibold text-white transition-transform active:translate-y-0.5" onClick={() => { if (firstAction.current === null) firstAction.current = performance.now(); setAnswer((value) => (value + digit).slice(0, 2)); }}>{digit}</button>)}<button aria-label="Son rakamı sil" className="min-h-12 rounded-xl bg-white text-[#315a83]" onClick={() => setAnswer((value) => value.slice(0, -1))}><Delete className="mx-auto" /></button><button aria-label="Cevabı kontrol et" className="min-h-12 rounded-xl bg-primary text-white" onClick={checkAnswer}><CheckCircle2 className="mx-auto" /></button></div></div>
          ) : (
            <div className="mx-auto mt-3 max-w-xl space-y-3"><div role="status" aria-live="polite" className={`rounded-xl p-3 text-sm ${ruleHint ? 'bg-amber-50 text-amber-900' : livePattern.valid ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-800'}`}><strong>{ruleHint ? 'Dokunuş kabul edilmedi:' : 'Canlı analiz:'}</strong> {ruleHint || (pressMode === 'free' ? 'Deseni istediğin gibi kur. Kontrol Et ile değerlendir.' : livePattern.valid ? `Desen geçerli · ${String(livePattern.value).padStart(2, '0')}` : livePattern.message)}</div><div className="flex gap-3"><Button variant="outline" className="h-11 flex-1" onClick={() => { setLeft(emptyHand()); setRight(emptyHand()); setFeedback(null); setRuleHint(''); }}>Temizle</Button><Button className="h-11 flex-1" onClick={checkAnswer}>Kontrol et</Button></div><p className="text-center text-xs text-muted-foreground">{pressMode === 'guided' ? 'Kurallı: seçtiğin parmağa kadar sıra otomatik tamamlanır.' : pressMode === 'semi' ? 'Yarı Kurallı: yanlış sıra reddedilir; elin durumu değişmez.' : 'Serbest: geçersiz desen kurulabilir; Kontrol Et sırasında hata gösterilir.'}</p></div>
          )}

          </fieldset>
          {feedback && <output className={`mx-auto mt-5 block max-w-xl rounded-xl p-4 text-sm ${feedback.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}><strong>{feedback.correct ? 'Doğru' : 'Yanlış'}</strong><p className="mt-1">{feedback.message}</p><p className="mt-2 font-semibold">Doğru cevap: {handMode === 'two' ? String(target).padStart(2, '0') : target}</p>{mode === 'press' && <p className="mt-3">Yanıtını doğru gösterimle karşılaştır.</p>}{mode === 'press' && <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white/70 p-3"><figure className="m-0 text-center"><figcaption className="mb-1 text-sm font-semibold">Doğru Gösterim</figcaption><div className="grid grid-cols-2">{handMode !== 'right' && <FingerHand side="left" pattern={visiblePattern.left} />}{handMode !== 'left' && <FingerHand side="right" pattern={visiblePattern.right} />}</div></figure><figure className="m-0 text-center"><figcaption className="mb-1 text-sm font-semibold">Senin Gösterimin</figcaption><div className="grid grid-cols-2">{handMode !== 'right' && <FingerHand side="left" pattern={left} />}{handMode !== 'left' && <FingerHand side="right" pattern={right} />}</div></figure></div>}{mode === 'read' && <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white/70 p-3 text-center"><div><p className="text-xs font-semibold">Doğru cevap</p><p className="mt-1 text-2xl font-bold">{target}</p></div><div><p className="text-xs font-semibold">Girilen cevap</p><p className="mt-1 text-2xl font-bold">{answer || '—'}</p></div></div>}<StudyPerformance stats={stats} />{transitionMs > 0 ? <div><p className="mt-2 text-xs">{sync !== 'ready' ? 'Yeni soru kayıt tamamlandıktan sonra açılacak.' : paused ? 'İnceleme süresi durduruldu.' : `${Math.ceil(remaining / 1000)} saniye sonra yeni soru açılacak.`}</p><Button onClick={() => setPaused(value => !value)}>{paused ? 'Otomatik geçişi sürdür' : 'Daha uzun incele'}</Button></div> : <Button size="sm" className="mt-3" onClick={newQuestion}>Devam</Button>}</output>}

          {!feedback && <StudyPerformance stats={stats} />}
        </section>
        <aside className="mt-5 flex items-start gap-3 rounded-2xl bg-[#e4eee8] p-5 text-sm leading-6 text-[#345f52]"><Hand className="mt-0.5 shrink-0" size={20} /><p>İşaret, orta, yüzük ve serçe parmakları sırayla kullan. Bir parmağı atladığında Learning Core bunu <strong>F01</strong> olarak işaretler ve çalışma kaydına ekler.</p></aside>
      </main>
    </div>
  );
}
