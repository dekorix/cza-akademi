'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Grid3X3, Hand, Loader2, RotateCcw, Settings2, Timer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FingerHand } from '@/components/finger-hand';
import { Soroban } from '@/components/soroban';
import { emptyHand, readHand, readHands, transitionFinger, type FingerName, type HandPattern } from '@/lib/finger-engine';
import { coreStudent, friendlyCoreError, type CoreStudent } from '@/lib/core-client';
import {
  defaultArithmeticSettings,
  generateArithmeticQuestion,
  validateArithmeticSettings,
  type ArithmeticQuestion,
  type ArithmeticSettings,
} from '@/lib/arithmetic-engine';

type Phase = 'settings' | 'instructions' | 'active' | 'results';
type Tool = 'soroban' | 'finger';
type Result = {
  question: ArithmeticQuestion;
  answer: number | null;
  correct: boolean;
  status: 'correct' | 'wrong' | 'timeout';
  elapsedMs: number;
  tool: Tool | 'none';
};

async function core(action: string, values: Record<string, unknown> = {}) {
  const response = await fetch('/api/core', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok || body.ok === false) throw new Error(typeof body.error === 'string' ? body.error : 'core_unavailable');
  return body;
}

const digitOptions = [1,2,3,4,5,6,7,8,9];
const operationLabels = { addition: 'Sadece toplama', subtraction: 'Sadece çıkarma', mixed: 'Toplama ve çıkarma' } as const;
const Anchor = 'a' as const;

function DigitSelector({ title, values, onChange }: { title: string; values: number[]; onChange: (values: number[]) => void }) {
  return <fieldset className="rounded-2xl border border-border bg-white p-5"><legend className="px-2 text-lg font-bold">{title}</legend><div className="mt-2 grid grid-cols-9 gap-2">{digitOptions.map(digit => <label key={digit} className={`grid min-h-12 cursor-pointer place-items-center rounded-xl border text-lg font-bold transition active:translate-y-0.5 ${values.includes(digit) ? 'border-primary bg-primary text-white shadow-sm' : 'bg-[#fbf7ee]'}`}><input className="sr-only" type="checkbox" checked={values.includes(digit)} onChange={() => onChange(values.includes(digit) ? values.filter(value => value !== digit) : [...values,digit].sort((a,b) => a-b))} />{digit}</label>)}</div><div className="mt-3 flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onChange(digitOptions)}>Tümünü seç</Button><Button type="button" variant="outline" size="sm" onClick={() => onChange([])}>Temizle</Button></div></fieldset>;
}

export default function ArithmeticPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [student, setStudent] = useState<CoreStudent | null>(null);
  const [username, setUsername] = useState('zeynep7');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [phase, setPhase] = useState<Phase>('settings');
  const [settings, setSettings] = useState<ArithmeticSettings>(defaultArithmeticSettings);
  const [questions, setQuestions] = useState<ArithmeticQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [answer, setAnswer] = useState('');
  const [activeTool, setActiveTool] = useState<Tool>('soroban');
  const [sorobanValue, setSorobanValue] = useState(0);
  const [left, setLeft] = useState<HandPattern>(emptyHand);
  const [right, setRight] = useState<HandPattern>(emptyHand);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const questionStarted = useRef(0);
  const deadline = useRef<number | null>(null);
  const eventSequence = useRef(0);
  const interactionQueue = useRef<Record<string, unknown>[]>([]);
  const pendingAttemptId = useRef<string | null>(null);
  const validation = useMemo(() => validateArithmeticSettings(settings), [settings]);
  const current = questions[index];

  const update = <K extends keyof ArithmeticSettings>(key: K, value: ArithmeticSettings[K]) => setSettings(previous => ({ ...previous, [key]: value }));

  useEffect(() => {
    core('me').then(data => setStudent(coreStudent(data))).catch(() => setStudent(null)).finally(() => setAuthLoading(false));
  }, []);

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setAuthLoading(true);
    try {
      const data = await core('login', { username: username.trim(), pin: pin.trim() });
      setStudent(coreStudent(data));
      setPin('');
    } catch (cause) {
      setLoginError(friendlyCoreError(cause));
    } finally {
      setAuthLoading(false);
    }
  }

  function resetWorkspace() {
    setAnswer('');
    setSorobanValue(0);
    setLeft(emptyHand());
    setRight(emptyHand());
    questionStarted.current = performance.now();
    deadline.current = settings.transitionSeconds > 0 ? performance.now() + settings.transitionSeconds * 1000 : null;
    setRemainingMs(settings.transitionSeconds * 1000);
  }

  async function begin() {
    setError('');
    try {
      if (!student) throw new Error('session_required');
      const generated = Array.from({ length: settings.questionCount }, () => generateArithmeticQuestion(settings));
      const response = await core('start', { moduleCode: 'arithmetic', source: 'free_practice', clientSessionId: crypto.randomUUID(), recipeId: null, settings: { engine: 'cza-arithmetic-v1', ...settings } });
      setSessionId(String(response.sessionId));
      setQuestions(generated);
      setResults([]);
      setIndex(0);
      setActiveTool(settings.toolMode === 'finger' ? 'finger' : 'soroban');
      setPhase('active');
      window.setTimeout(resetWorkspace, 0);
    } catch (cause) {
      if (cause instanceof Error && (cause.message === 'session_required' || cause.message === 'invalid_session')) {
        setStudent(null);
        setLoginError(friendlyCoreError(cause));
      } else {
        setError(cause instanceof Error && cause.message !== 'core_unavailable' ? cause.message : 'Merkezi kayıt bağlantısı kurulamadı. Çalışma başlatılmadı.');
      }
    }
  }

  const record = useCallback(async (eventType: string, payload: Record<string, unknown>) => {
    if (!sessionId || !current) return;
    eventSequence.current += 1;
    const interaction = { sessionId, clientEventId: crypto.randomUUID(), questionIndex: index + 1, sequenceNo: eventSequence.current, eventType, screenArea: 'arithmetic_workspace', elapsedMs: Math.round(performance.now() - questionStarted.current), payload: { questionId: current.id, ...payload } };
    try { await core('interaction', interaction); } catch { interactionQueue.current.push(interaction); setError('Bir etkileşim kaydı bağlantı bekliyor; cevap gönderiminde yeniden doğrulanacak.'); }
  }, [sessionId, current, index]);

  async function flushInteractions() {
    while (interactionQueue.current.length) {
      const interaction = interactionQueue.current[0];
      await core('interaction', interaction);
      interactionQueue.current.shift();
    }
  }

  function addDigit(digit: string) {
    setAnswer(value => (value + digit).replace(/^(-?)0+(?=\d)/, '$1').slice(0, 8));
    void record('answer_digit', { digit });
  }

  function deleteDigit() {
    setAnswer(value => value.slice(0, -1));
    void record('answer_delete', {});
  }

  async function submit(value: number | null, source: 'answer' | 'timeout') {
    if (!current || !sessionId || saving) return;
    setSaving(true);
    setError('');
    const elapsedMs = Math.round(performance.now() - questionStarted.current);
    const correct = value === current.finalAnswer;
    const result: Result = { question: current, answer: value, correct, status: source === 'timeout' ? 'timeout' : correct ? 'correct' : 'wrong', elapsedMs, tool: settings.toolMode === 'none' ? 'none' : activeTool };
    const attempt = {
      clientAttemptId: pendingAttemptId.current ??= crypto.randomUUID(), questionIndex: index + 1, questionId: current.id,
      targetNumber: current.finalAnswer, studentNumericAnswer: value, patternValid: true, isCorrect: correct,
      errorType: source === 'timeout' ? 'ARITH_TIMEOUT' : correct ? 'OK' : 'ARITH_WRONG_RESULT',
      errorDetail: source === 'timeout' ? 'Süre doldu.' : correct ? 'Doğru cevap' : 'Girilen cevap işlem sonucuyla eşleşmedi.',
      stimulusDurationMs: settings.transitionSeconds * 1000, responseLatencyMs: elapsedMs, totalResponseTimeMs: elapsedMs,
      learningMode: 'practice', difficultyLevel: current.metadata.difficultyScore, attemptNumber: 1,
      metadata: { engine: 'cza-arithmetic-v1', module: 'arithmetic', operationMode: settings.operationMode, sequence: [current.initialValue, ...current.steps.map(step => step.operator === '+' ? step.operand : -step.operand)], question: current, status: result.status, toolUsed: result.tool, sorobanValue, fingerValue: readHands(left,right).valid ? readHands(left,right).value : null },
    };
    try {
      try { await flushInteractions(); } catch { /* Sabit kimlikli olaylar bellekte beklemeyi sürdürür. */ }
      await core('attempt', { sessionId, payload: attempt });
      pendingAttemptId.current = null;
      const nextResults = [...results, result];
      setResults(nextResults);
      if (index + 1 >= questions.length) {
        await core('finish', { sessionId, questionCount: nextResults.length, correctCount: nextResults.filter(item => item.correct).length, timeoutCount: nextResults.filter(item => item.status === 'timeout').length });
        setSessionId(null);
        setPhase('results');
      } else {
        setIndex(valueIndex => valueIndex + 1);
        resetWorkspace();
      }
    } catch {
      setError('Cevap kaydedilemedi. Bağlantı gelince yeniden göndermek için yanıt korunuyor.');
    } finally { setSaving(false); }
  }

  // The deadline must not restart when answer text or helper-tool state changes.
  // oxlint-disable react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'active' || settings.transitionSeconds <= 0 || !current || saving) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const next = Math.max(0, (deadline.current ?? performance.now()) - performance.now());
      setRemainingMs(next);
      if (next === 0) {
        window.clearInterval(timer);
        void submit(null, 'timeout');
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, settings.transitionSeconds, current?.id, saving]);

  // Keyboard listeners are replaced only when the visible answer or question changes.
  useEffect(() => {
    if (phase !== 'active' || settings.inputMode === 'keypad') return;
    const keydown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) addDigit(event.key);
      else if (event.key === 'Backspace') deleteDigit();
      else if (event.key === 'Enter') void submit(answer === '' ? null : Number(answer), 'answer');
      else if (event.key === '-' && settings.allowNegativeResults) setAnswer(value => value.startsWith('-') ? value : '-' + value);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [phase, settings.inputMode, settings.allowNegativeResults, answer, current?.id]);
  // oxlint-enable react-hooks/exhaustive-deps

  async function finishEarly() {
    if (!sessionId || saving) return;
    setSaving(true);
    try {
      await core('finish', { sessionId, questionCount: results.length, correctCount: results.filter(item => item.correct).length, timeoutCount: results.filter(item => item.status === 'timeout').length, aborted: true });
      setSessionId(null);
      setPhase('results');
    } catch { setError('Çalışma kapatılamadı. Bitir düğmesine yeniden dokun.'); }
    finally { setSaving(false); }
  }

  function finger(side: 'left' | 'right', fingerName: FingerName) {
    const currentHand = side === 'left' ? left : right;
    const transition = transitionFinger(currentHand, fingerName, 'guided');
    const next = transition.state;
    const currentDigit = readHand(currentHand);
    if (side === 'left') setLeft(next); else setRight(next);
    void record('finger_toggle', { side, finger: fingerName, active: next[fingerName] });
    const autoCorrected = Object.keys(next).some(name => next[name as FingerName] !== transition.candidate[name as FingerName]);
    if (autoCorrected) void record('finger_rule_violation', { fingerId: fingerName, attemptedFinger: fingerName, currentDigit: currentDigit.valid ? currentDigit.value : null, ruleMode: 'guided', autoCorrected: true, timestamp: new Date().toISOString() });
  }

  const summary = useMemo(() => {
    const correct = results.filter(result => result.correct).length;
    const timeout = results.filter(result => result.status === 'timeout').length;
    return { correct, wrong: results.length - correct - timeout, timeout, accuracy: results.length ? Math.round(correct / results.length * 100) : 0, average: results.length ? Math.round(results.reduce((sum,result) => sum + result.elapsedMs, 0) / results.length / 1000) : 0 };
  }, [results]);

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-[#fbf7ee]"><div className="flex items-center gap-3 font-semibold text-muted-foreground"><Loader2 className="animate-spin"/> Öğrenci oturumu kontrol ediliyor…</div></div>;

  if (!student) return <main className="min-h-screen bg-[#fbf7ee] px-5 py-12"><form onSubmit={login} className="mx-auto mt-[7vh] max-w-md rounded-3xl border bg-white p-8 shadow-lg"><Anchor href="/" className="inline-flex items-center gap-2 font-semibold text-muted-foreground"><ArrowLeft size={18}/> Çalışma merkezim</Anchor><p className="eyebrow mt-7 text-primary">ÇELİK ZİHİN AKADEMİSİ</p><h1 className="mt-3 text-3xl font-bold">Öğrenci girişi</h1><p className="mt-2 text-base leading-7 text-muted-foreground">Toplama ve çıkarma sonuçların kendi öğrenci kaydına işlensin.</p><label className="mt-7 block font-semibold" htmlFor="arithmetic-username">Kullanıcı adı</label><Input id="arithmetic-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="mt-2 h-12 text-lg"/><label className="mt-4 block font-semibold" htmlFor="arithmetic-pin">PIN</label><Input id="arithmetic-pin" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g,''))} className="mt-2 h-12 text-lg"/>{loginError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 font-semibold text-red-800">{loginError}</p>}<Button type="submit" className="mt-6 h-12 w-full text-lg" disabled={!username.trim() || !pin.trim()}>Giriş yap</Button></form></main>;

  if (phase === 'settings') return <main className="min-h-screen bg-[#fbf7ee] px-4 py-8"><div className="mx-auto max-w-5xl"><Anchor href="/" className="inline-flex items-center gap-2 font-semibold text-muted-foreground"><ArrowLeft /> Çalışma merkezim</Anchor><div className="mt-5 rounded-3xl border bg-white p-6 shadow-sm"><p className="eyebrow text-primary">ÇELİK ANZAN</p><h1 className="mt-2 text-3xl font-bold">Toplama / Çıkarma Ayarları</h1><div className="mt-6 grid gap-5 lg:grid-cols-2"><fieldset className="rounded-2xl border p-5"><legend className="px-2 text-lg font-bold">İşlem türü</legend>{Object.entries(operationLabels).map(([value,label]) => <label key={value} className="mt-2 flex min-h-12 items-center gap-3 rounded-xl p-3 hover:bg-secondary"><input type="radio" name="operation" checked={settings.operationMode === value} onChange={() => update('operationMode', value as ArithmeticSettings['operationMode'])}/>{label}</label>)}</fieldset><div className="grid grid-cols-2 gap-3 rounded-2xl border p-5">{([['questionCount','Soru sayısı',1,30],['operationsPerQuestion','İşlem sayısı',1,20],['minDigits','Minimum hane',1,5],['maxDigits','Maksimum hane',1,5]] as const).map(([key,label,min,max]) => <label key={key} className="font-semibold">{label}<input className="mt-2 h-12 w-full rounded-xl border px-3 text-lg" type="number" min={min} max={max} value={settings[key]} onChange={event => update(key, Number(event.target.value))}/></label>)}<label className="font-semibold">Geçiş süresi (sn.)<input className="mt-2 h-12 w-full rounded-xl border px-3 text-lg" type="number" min="0" max="60" value={settings.transitionSeconds} onChange={event => update('transitionSeconds', Number(event.target.value))}/></label><label className="font-semibold">Maksimum değer<input className="mt-2 h-12 w-full rounded-xl border px-3 text-lg" type="number" min="1" max="99999" value={settings.maxValue ?? ''} onChange={event => update('maxValue', event.target.value ? Number(event.target.value) : null)}/></label><label className="font-semibold">Soroban basamak sayısı<select className="mt-2 h-12 w-full rounded-xl border bg-white px-3 text-lg" value={settings.sorobanRodCount} onChange={event => update('sorobanRodCount', Number(event.target.value) as ArithmeticSettings['sorobanRodCount'])}>{[4,5,6,7].map(count => <option key={count} value={count}>{count} basamak</option>)}</select></label></div><DigitSelector title="Toplamada kullanılacak rakamlar" values={settings.additionDigits} onChange={values => update('additionDigits', values)}/><DigitSelector title="Çıkarmada kullanılacak rakamlar" values={settings.subtractionDigits} onChange={values => update('subtractionDigits', values)}/><fieldset className="rounded-2xl border p-5"><legend className="px-2 text-lg font-bold">Kurallar</legend><label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={settings.allowDirectAddition} onChange={event => update('allowDirectAddition',event.target.checked)}/>Doğrudan toplama işlemleri</label><label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={settings.allowDirectSubtraction} onChange={event => update('allowDirectSubtraction',event.target.checked)}/>Doğrudan çıkarma işlemleri</label><label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={settings.firstNumberRespectMaxValue} onChange={event => update('firstNumberRespectMaxValue',event.target.checked)}/>İlk sayı maksimum değere göre verilsin</label><label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={settings.allowNegativeResults} onChange={event => update('allowNegativeResults',event.target.checked)}/>Negatif sonuçlara izin ver</label></fieldset><fieldset className="rounded-2xl border p-5"><legend className="px-2 text-lg font-bold">Çözüm desteği</legend>{([['both','Soroban ve Parmak'],['soroban','Yalnız Soroban'],['finger','Yalnız Parmak'],['none','Zihinden']] as const).map(([value,label]) => <label key={value} className="flex min-h-12 items-center gap-3"><input type="radio" name="tool" checked={settings.toolMode === value} onChange={() => update('toolMode',value)}/>{label}</label>)}</fieldset></div>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 font-semibold text-red-800">{error}</p>}<Button className="mt-6 h-12 w-full text-lg" onClick={() => setPhase('instructions')}>Ayarları kontrol et</Button></div></div></main>;

  if (phase === 'instructions') return <main className="grid min-h-screen place-items-center bg-[#fbf7ee] p-5"><section className="w-full max-w-2xl rounded-3xl border bg-white p-7 shadow-lg"><Settings2 className="text-primary" size={38}/><h1 className="mt-4 text-3xl font-bold">{validation.valid ? 'Ayarlar hazır' : 'Ayarları düzeltmelisin'}</h1><div className="mt-5 space-y-3">{[...validation.errors,...validation.warnings,...validation.suggestions].map(item => <div key={item.code} className={`rounded-xl border p-4 ${item.severity === 'error' ? 'border-red-200 bg-red-50' : item.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}><strong>{item.title}</strong><p className="mt-1">{item.description}</p></div>)}</div>{validation.valid && <div className="mt-5 rounded-xl bg-emerald-50 p-4 leading-7"><p>{settings.questionCount} soru, her soruda {settings.operationsPerQuestion} işlem hazırlanacak.</p><p>{settings.transitionSeconds === 0 ? 'Cevabını gönderene kadar soru ekranda kalacak.' : `Her soru için ${settings.transitionSeconds} saniyen olacak; süre dolarsa cevap boş olarak kaydedilecek.`}</p><p>Geçilen soruya geri dönülmez.</p></div>}{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}<div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setPhase('settings')}>Ayarları düzenle</Button><Button className="flex-1" disabled={!validation.valid} onClick={begin}>Çalışmayı başlat</Button></div></section></main>;

  if (phase === 'results') return <main className="min-h-screen bg-emerald-50 p-5"><section className="mx-auto max-w-4xl rounded-3xl border bg-white p-7 shadow-lg"><p className="eyebrow text-primary">SEANS TAMAMLANDI</p><h1 className="mt-2 text-3xl font-bold">Çalışma Performansı</h1><p className="mt-2 text-lg">{results.length} sorudan {summary.correct} tanesini doğru cevapladın.</p><div className="my-7 grid grid-cols-2 gap-3 md:grid-cols-5">{[['Soru',results.length],['Doğru',summary.correct],['Yanlış',summary.wrong],['Cevapsız',summary.timeout],['Başarı',`%${summary.accuracy}`]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#edf5f0] p-4 text-center"><strong className="text-3xl">{value}</strong><p>{label}</p></div>)}</div><p className="text-center text-lg font-bold">Ortalama cevaplama süresi: {summary.average} saniye</p><div className="mt-6 flex flex-wrap gap-2">{results.map((result,resultIndex) => <button key={result.question.id} className={`grid h-12 w-12 place-items-center rounded-xl font-bold text-white ${result.status === 'correct' ? 'bg-emerald-600' : result.status === 'timeout' ? 'bg-slate-500' : 'bg-amber-600'}`} aria-label={`${resultIndex+1}. soru ayrıntısını aç`} onClick={() => setSelectedResult(result)}>{resultIndex+1}</button>)}</div>{selectedResult && <dialog open aria-label="Soru ayrıntısı" className="fixed inset-0 z-50 m-0 grid h-full max-h-none w-full max-w-none place-items-center border-0 bg-slate-900/50 p-4"><section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Soru ayrıntısı</h2><Button variant="outline" onClick={() => setSelectedResult(null)}>Kapat</Button></div><div className="mt-5 rounded-xl bg-[#f7f5ef] p-5 font-mono text-2xl font-bold">{selectedResult.question.initialValue}{selectedResult.question.steps.map(step => <div key={step.order}>{step.operator}{step.operand}</div>)}</div><dl className="mt-5 grid grid-cols-2 gap-3"><div><dt>Doğru cevap</dt><dd className="text-2xl font-bold">{selectedResult.question.finalAnswer}</dd></div><div><dt>Verilen cevap</dt><dd className="text-2xl font-bold">{selectedResult.answer ?? 'Cevapsız'}</dd></div><div><dt>Süre</dt><dd className="font-bold">{(selectedResult.elapsedMs/1000).toFixed(1)} sn</dd></div><div><dt>Kullanılan araç</dt><dd className="font-bold">{selectedResult.tool === 'soroban' ? 'Soroban' : selectedResult.tool === 'finger' ? 'Parmak' : 'Zihinden'}</dd></div></dl></section></dialog>}<div className="mt-7 flex gap-3"><Button variant="outline" onClick={() => setPhase('settings')}>Ayarlar</Button><Button onClick={() => setPhase('instructions')}>Yeni çalışma</Button><Anchor href="/" className="inline-flex min-h-11 items-center rounded-xl border px-5 font-semibold">Bitir</Anchor></div></section></main>;

  const sequence = current ? [{ operator: '', value: current.initialValue }, ...current.steps.map(step => ({ operator: step.operator, value: step.operand }))] : [];
  return <main className="min-h-screen bg-[#f8f4eb] p-4"><div className="mx-auto max-w-7xl"><header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-primary">TOPLAMA / ÇIKARMA</p><h1 className="text-2xl font-bold">Soru {index+1} / {questions.length}</h1></div><div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 font-bold shadow-sm"><Timer/> {settings.transitionSeconds ? `${Math.ceil(remainingMs/1000)} sn` : 'Süre yok'}</div></header>{error && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}<div className="grid gap-4 lg:grid-cols-[220px_1fr_420px]"><aside className="rounded-2xl bg-[#17334d] p-5 text-white"><p className="font-bold">İlerleme</p><p className="mt-3 text-4xl font-black">{index+1}<span className="text-lg opacity-70">/{questions.length}</span></p><div className="mt-5 h-3 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-[#7bd8bd]" style={{width:`${((index+1)/questions.length)*100}%`}}/></div><p className="mt-5 text-sm leading-6 text-[#d8e7f0]">İşlemi zihninden çözebilir, Soroban veya Parmak desteğini kullanabilirsin.</p></aside><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-center text-lg font-bold text-muted-foreground">İŞLEM</h2><div className="mx-auto mt-5 w-fit min-w-48 border-b-4 border-[#315a83] pb-3 text-right font-mono text-6xl font-black leading-[1.08] md:text-7xl text-[#173f75]">{sequence.map((item,stepIndex) => <div key={stepIndex}><span className="mr-3 inline-block w-8 text-primary">{item.operator}</span>{item.value}</div>)}</div><div className="mx-auto mt-7 max-w-sm"><div className="focus-number min-h-16 rounded-xl border-2 border-[#315a83] bg-[#eef5fb] p-3 text-center text-4xl font-bold">{answer || '—'}</div>{settings.inputMode !== 'keyboard' && <div className="mt-4 grid grid-cols-3 gap-2">{[1,2,3,4,5,6,7,8,9].map(digit => <button key={digit} className="arithmetic-key" onClick={() => addDigit(String(digit))}>{digit}</button>)}<button className="arithmetic-key arithmetic-key-danger" aria-label="Girilen cevabı temizle" onClick={() => {setAnswer('');void record('answer_clear',{});}}><X className="mx-auto" size={28}/></button><button className="arithmetic-key" onClick={() => addDigit('0')}>0</button><button className="arithmetic-key arithmetic-key-confirm" aria-label="Yanıtı kontrol et ve gönder" onClick={() => void submit(answer === '' ? null : Number(answer),'answer')}><CheckCircle2 className="mx-auto"/></button></div>}</div></section>{settings.toolMode !== 'none' && <aside className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 flex rounded-xl border bg-[#f7f5ef] p-1">{settings.toolMode !== 'finger' && <button className={`flex flex-1 items-center justify-center gap-2 rounded-lg p-3 font-bold ${activeTool === 'soroban' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground'}`} onClick={() => {setActiveTool('soroban');void record('tool_switch',{tool:'soroban'});}}><Grid3X3 size={19}/> Soroban</button>}{settings.toolMode !== 'soroban' && <button className={`flex flex-1 items-center justify-center gap-2 rounded-lg p-3 font-bold ${activeTool === 'finger' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground'}`} onClick={() => {setActiveTool('finger');void record('tool_switch',{tool:'finger'});}}><Hand size={19}/> Parmak</button>}</div>{activeTool === 'soroban' && settings.toolMode !== 'finger' ? <div><Soroban value={sorobanValue} digits={settings.sorobanRodCount} onChange={value => {setSorobanValue(value);void record('soroban_bead_move',{value});}}/><Button variant="outline" className="mt-5 w-full" onClick={() => {setSorobanValue(0);void record('soroban_reset',{before:sorobanValue});}}><RotateCcw/> Sorobanı sıfırla</Button></div> : <div className="grid grid-cols-2"><FingerHand side="left" pattern={left} interactive onFinger={fingerName => finger('left',fingerName)}/><FingerHand side="right" pattern={right} interactive onFinger={fingerName => finger('right',fingerName)}/></div>}</aside>}</div><div className="mt-4 flex justify-end"><Button variant="outline" disabled={saving} onClick={finishEarly}>Çalışmayı bitir ve kaydet</Button></div></div></main>;
}
