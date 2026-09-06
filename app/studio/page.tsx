'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, CheckCircle2, ChevronRight, CircleHelp, Loader2, LogOut, Maximize2, Moon, Pause, Play, RotateCcw, Settings2, Sun, Target, Volume2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ExerciseSettings } from '@/components/exercise-settings';
import { ExerciseLaunchSequence } from '@/components/exercise-launch-sequence';
import { ExerciseNumberDisplay } from '@/components/exercise-number-display';
import { FingerHand } from '@/components/finger-hand';
import { Soroban } from '@/components/soroban';
import { SorobanAnswerComparison } from '@/components/soroban-answer-comparison';
import { createQuestion, defaultConfig, modeLabels, score, validateConfig, type Attempt, type ExerciseConfig, type ExerciseQuestion } from '@/lib/exercise-engine';
import { numberPattern } from '@/lib/finger-engine';
import { durationLabel, progressionSuggestion } from '@/lib/timed-stimulus';
import { readDemoProgram, saveDemoResult } from '@/lib/demo-session';
import { registerAcademyTools } from '@/lib/webmcp';
import { core, coreStudent, friendlyCoreError, studentName, type CoreStudent } from '@/lib/core-client';
import { attemptPayload, moduleCodeByMode, trainingSettings } from '@/lib/core-records';
import { feedbackModeFor, isMeasuredMode, practiceModeLabels, shouldShowCountdown } from '@/lib/practice-mode';
import { compareSorobanStates, serializeSorobanState } from '@/lib/soroban-comparison';

type Phase = 'ready' | 'countdown' | 'prepare' | 'stimulus' | 'sequence' | 'answer' | 'feedback' | 'finished';

export default function Studio() {
  const [authLoading, setAuthLoading] = useState(true);
  const [student, setStudent] = useState<CoreStudent | null>(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sync, setSync] = useState<'ready' | 'saving' | 'error'>('ready');
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [config, setConfig] = useState<ExerciseConfig>({...defaultConfig});
  const [runConfig, setRunConfig] = useState<ExerciseConfig>({...defaultConfig});
  const [phase, setPhase] = useState<Phase>('ready');
  const [questions, setQuestions] = useState<ExerciseQuestion[]>([]);
  const [round, setRound] = useState(0);
  const [term, setTerm] = useState(0);
  const [paused, setPaused] = useState(false);
  const [answer, setAnswer] = useState('');
  const [abacusValue, setAbacusValue] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saved, setSaved] = useState(false);
  const [feedbackAttempt, setFeedbackAttempt] = useState<Attempt | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<Attempt | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [darkStage, setDarkStage] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [answerRemainingMs, setAnswerRemainingMs] = useState(0);
  const responseStart = useRef(0);
  const sessionStart = useRef(0);
  const presentationStartedAt = useRef('');
  const presentationEndedAt = useRef('');
  const answerStartedAt = useRef('');
  const answerDeadline = useRef(0);
  const timeoutTriggered = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const active = !['ready','finished'].includes(phase);
  const current = questions[round];
  const mental = runConfig.mode === 'flash' || runConfig.mode === 'audio';
  const timedReading = runConfig.mode === 'finger-read' || runConfig.mode === 'soroban-read';
  const practiceMode = runConfig.practiceMode ?? 'free_practice';
  const measured = isMeasuredMode(practiceMode);
  const snapshot = useRef({ config, phase });
  snapshot.current = { config, phase };

  useEffect(() => {
    core('me').then(data => setStudent(coreStudent(data))).catch(() => setStudent(null)).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    setAudioAvailable('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'flash' || mode === 'audio') setConfig(c => ({...c, mode, digits: 1}));
    if (mode === 'fingers') setConfig(c => ({...c, mode: 'finger-read', digits: Math.min(2,c.digits), minDigits: 1, maxDigits: Math.min(2,c.digits)}));
    if (new URLSearchParams(window.location.search).get('program') === 'demo') {
      const program = readDemoProgram();
      if (program) { setConfig(program); setInfo('Eğitimci ekranında hazırladığın deneme programı yüklendi. Bu, gerçek bir öğrenci ataması değildir.'); }
    }
    return registerAcademyTools([
      { name: 'read_exercise_setup', title: 'Egzersiz ayarlarını oku', description: 'Seçili egzersiz ayarlarını ve akış durumunu okur; aktif sorunun doğru cevabını vermez.', inputSchema: {type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false}, execute: () => snapshot.current },
      { name: 'configure_exercise', title: 'Deneme egzersizini ayarla', description: 'Hazır durumdaki deneme ayarlarını değiştirir; seans başlatmaz veya öğrenciye atama yapmaz.', inputSchema:{type:'object',properties:{mode:{enum:['finger-read','soroban-read','soroban-write','flash','audio']},digits:{type:'integer',minimum:1,maximum:7},minDigits:{type:'integer',minimum:1,maximum:7},maxDigits:{type:'integer',minimum:1,maximum:7},presentationDurationMs:{type:'integer',minimum:80,maximum:10000},answerDurationMs:{type:'integer',minimum:0,maximum:60000},countdownEnabled:{type:'boolean'},rods:{enum:[4,5,6,7]},minValue:{type:'integer',minimum:0,maximum:9999999},terms:{type:'integer',minimum:2,maximum:30},rounds:{type:'integer',minimum:1,maximum:100},interval:{type:'number',minimum:0,maximum:10},operation:{enum:['add','subtract','mixed']},pool:{type:'array',items:{type:'integer',minimum:1,maximum:9},minItems:1},additionPool:{type:'array',items:{type:'integer',minimum:1,maximum:9},minItems:1},subtractionPool:{type:'array',items:{type:'integer',minimum:1,maximum:9},minItems:1},maxValue:{type:'integer',minimum:1,maximum:9999999},firstWithinMax:{type:'boolean'},showNumbers:{type:'boolean'},fontSize:{type:'integer',minimum:48,maximum:180},backgroundColor:{type:'string'},textColor:{type:'string'},freePractice:{type:'boolean'}},additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:false}, execute: async input => {
        if (!['ready','finished'].includes(snapshot.current.phase)) throw new Error('Önce mevcut seansı bitirin.');
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ayar nesnesi bekleniyor.');
        const allowed = ['mode','presentationDurationMs','answerDurationMs','countdownEnabled','rods','minValue','digits','minDigits','maxDigits','terms','rounds','interval','operation','pool','additionPool','subtractionPool','maxValue','firstWithinMax','showNumbers','fontSize','backgroundColor','textColor','freePractice'];
        if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Bilinmeyen ayar.');
        const next = {...snapshot.current.config,...input} as ExerciseConfig; validateConfig(next); createQuestion(next);
        setConfig(next); setPhase('ready');
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return {status:'configured', config: next};
      } },
    ]);
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden && ['countdown','sequence'].includes(phase)) setPaused(true); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  // Cross-page links use document navigation; protect unfinished session work.
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  const advance = useCallback(() => {
    if (!current) return;
    if (term + 1 < current.sequence.length) setTerm(v => v+1);
    else { setPhase('answer'); responseStart.current = performance.now(); answerStartedAt.current = new Date().toISOString(); }
  }, [current, term]);

  const openQuestion = useCallback(() => {
    if (timedReading && measured) setPhase('stimulus');
    else if (mental) setPhase('sequence');
    else { responseStart.current = performance.now(); answerStartedAt.current = new Date().toISOString(); setPhase('answer'); }
  }, [measured, mental, timedReading]);

  useEffect(() => {
    if (phase !== 'prepare') return;
    const timeout = window.setTimeout(openQuestion, 520);
    return () => window.clearTimeout(timeout);
  }, [phase, openQuestion]);

  useEffect(() => {
    if (phase !== 'stimulus' || paused || !current) return;
    presentationStartedAt.current = new Date().toISOString();
    const started = performance.now();
    const timeout = window.setTimeout(() => {
      presentationEndedAt.current = new Date().toISOString();
      answerStartedAt.current = new Date().toISOString();
      responseStart.current = performance.now();
      const answerLimit = runConfig.answerDurationMs ?? 0;
      answerDeadline.current = answerLimit ? performance.now() + answerLimit : 0;
      timeoutTriggered.current = false;
      setAnswerRemainingMs(answerLimit);
      setPhase('answer');
    }, Math.max(0, (runConfig.presentationDurationMs ?? 1000) - (performance.now() - started)));
    return () => window.clearTimeout(timeout);
  }, [phase, paused, current, runConfig.presentationDurationMs, runConfig.answerDurationMs]);

  useEffect(() => {
    if (phase !== 'sequence' || paused || !current) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (runConfig.mode === 'audio') {
      const number = current.sequence[term];
      const speech = new SpeechSynthesisUtterance(term === 0 ? String(number) : `${number < 0 ? 'eksi' : 'artı'} ${Math.abs(number)}`);
      speech.lang = 'tr-TR'; speech.rate = .85;
      const turkish = speechSynthesis.getVoices().find(v => v.lang.startsWith('tr'));
      if (turkish) speech.voice = turkish;
      speech.onend = () => { if (runConfig.interval > 0) timeout = setTimeout(advance, runConfig.interval * 1000); };
      speech.onerror = event => { if (!['interrupted','canceled'].includes(event.error)) { setError('Ses oynatılamadı. Cihazının sesini ve Türkçe konuşma desteğini kontrol et veya Flash Anzan seç.'); setPaused(true); } };
      speechSynthesis.cancel(); speechSynthesis.speak(speech);
    } else if (runConfig.interval > 0) timeout = setTimeout(advance, runConfig.interval * 1000);
    return () => { clearTimeout(timeout); if (runConfig.mode === 'audio') speechSynthesis.cancel(); };
  }, [phase, paused, current, term, runConfig, advance]);

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError(''); setAuthLoading(true);
    try { const data = await core('login', {username:username.trim(),pin:pin.trim()}); setStudent(coreStudent(data)); setPin(''); }
    catch (e) { setLoginError(friendlyCoreError(e)); }
    finally { setAuthLoading(false); }
  }
  async function logout() {
    if (sessionId) { try { await core('finish',{sessionId}); } catch { /* Kaydedilmiş sorular sunucuda kalır. */ } }
    try { await core('logout'); } catch { /* Sunucu rotası çerezi yine temizler. */ }
    setStudent(null); setSessionId(null); setPhase('ready'); setAttempts([]);
  }
  async function start() {
    try {
      if (!student) throw new Error('session_required');
      validateConfig(config);
      if (config.mode === 'audio' && !audioAvailable) throw new Error('Bu tarayıcıda sesli çalışma desteklenmiyor. Flash Anzan kullanabilirsin.');
      const generated = Array.from({length:config.rounds}, () => createQuestion(config));
      setSync('saving');
      const selectedPracticeMode = config.practiceMode ?? 'free_practice';
      const central = await core('start', {moduleCode:moduleCodeByMode[config.mode],source:'free_practice',clientSessionId:crypto.randomUUID(),recipeId:null,settings:trainingSettings(config)});
      if (!central.sessionId) throw new Error('session_not_created');
      setSessionId(String(central.sessionId)); setSync('ready');
      const countdown = shouldShowCountdown({practiceMode:selectedPracticeMode,exerciseType:config.mode,timed:['finger-read','soroban-read','flash','audio'].includes(config.mode),assessmentMode:selectedPracticeMode==='assessment',countdownEnabled:config.countdownEnabled});
      setQuestions(generated); setRunConfig({...defaultConfig,...config, practiceMode:selectedPracticeMode, feedbackMode:config.feedbackMode??feedbackModeFor(selectedPracticeMode), pool:[...config.pool], additionPool:[...(config.additionPool ?? config.pool)], subtractionPool:[...(config.subtractionPool ?? config.pool)]}); setRound(0); setTerm(0); setAttempts([]); setFeedbackAttempt(null); setReviewAttempt(null); setRetrying(false); setAnswer(''); setAbacusValue(0); setPaused(false); setError(''); setSaved(false); setAnswerRemainingMs(0); setPhase(countdown ? 'countdown' : (['finger-read','soroban-read'].includes(config.mode) && isMeasuredMode(selectedPracticeMode) ? 'stimulus' : ['flash','audio'].includes(config.mode) ? 'sequence' : 'answer')); if (!countdown && (!['finger-read','soroban-read'].includes(config.mode) || !isMeasuredMode(selectedPracticeMode)) && !['flash','audio'].includes(config.mode)) { responseStart.current = performance.now(); answerStartedAt.current = new Date().toISOString(); } setSettingsOpen(false); sessionStart.current = Date.now();
    } catch (e) { setSync('error'); setError(e instanceof Error && !e.message.includes('_') ? e.message : friendlyCoreError(e)); }
  }
  async function submit(timedOut = false) {
    if (!current || phase !== 'answer' || !sessionId || savingAttempt) return;
    if (!timedOut && runConfig.mode !== 'soroban-write' && !/^\d+$/.test(answer.trim())) { setError('Lütfen sıfır veya pozitif bir tam sayı yaz.'); return; }
    const given = timedOut ? -1 : runConfig.mode === 'soroban-write' ? abacusValue : Number(answer);
    if (!Number.isSafeInteger(given)) { setError('Geçerli bir sayı yaz.'); return; }
    const completedAt = Date.now();
    const elapsedMs = Math.max(0, Math.round(performance.now()-responseStart.current));
    const comparison = runConfig.mode.startsWith('soroban') ? compareSorobanStates(given, current.answer, runConfig.rods ?? 5) : null;
    const attempt: Attempt = { sequence: current.sequence, expected: current.answer, given, correct: !timedOut && given === current.answer, timeout: timedOut, elapsedMs, responseLatencyMs: elapsedMs, stimulusDurationMs: timedReading && measured ? runConfig.presentationDurationMs ?? 1000 : 0, answerDurationLimitMs: measured ? runConfig.answerDurationMs ?? 0 : 0, presentationStartedAt: presentationStartedAt.current || undefined, presentationEndedAt: presentationEndedAt.current || undefined, answerStartedAt: answerStartedAt.current || undefined, answeredAt: new Date(completedAt).toISOString(), attemptType: retrying ? 'RETRY_AFTER_FEEDBACK' : 'PRIMARY', studentSorobanState: comparison ? serializeSorobanState(given,runConfig.rods??5) : undefined, targetSorobanState: comparison ? serializeSorobanState(current.answer,runConfig.rods??5) : undefined, differingRods: comparison?.differingRods };
    setSavingAttempt(true); setSync('saving'); setError('');
    try {
      await core('attempt',{sessionId,payload:attemptPayload(attempt,runConfig,round+1,{attemptId:crypto.randomUUID(),questionId:`${moduleCodeByMode[runConfig.mode]}-${Date.now()}-${round+1}`})});
      const all = [...attempts, attempt]; setAttempts(all); setFeedbackAttempt(attempt); setRetrying(false); setSaved(saveDemoResult({ id: sessionId, at: new Date().toISOString(), config: runConfig, attempts: all, durationMs: completedAt-sessionStart.current })); setSync('ready');
      if ((runConfig.feedbackMode ?? feedbackModeFor(practiceMode)) === 'immediate') setPhase('feedback');
      else if (round + 1 < runConfig.rounds) nextQuestion();
      else { await core('finish',{sessionId}); setPhase('finished'); }
    } catch (e) { setSync('error'); setError(`${friendlyCoreError(e)} Cevabın ekranda tutuldu; “Yanıtı kaydet” ile yeniden dene.`); }
    finally { setSavingAttempt(false); }
  }

  useEffect(() => {
    if (phase !== 'answer' || !timedReading || (runConfig.answerDurationMs ?? 0) === 0 || savingAttempt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, answerDeadline.current - performance.now());
      setAnswerRemainingMs(remaining);
      if (remaining === 0 && !timeoutTriggered.current) {
        timeoutTriggered.current = true;
        window.clearInterval(timer);
        void submit(true);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, timedReading, runConfig.answerDurationMs, savingAttempt]);
  function nextQuestion() { setRound(v=>v+1); setTerm(0); setAnswer(''); setAbacusValue(0); setFeedbackAttempt(null); setAnswerRemainingMs(0); presentationStartedAt.current=''; presentationEndedAt.current=''; answerStartedAt.current=''; setPhase('prepare'); }
  useEffect(() => {
    if (phase !== 'feedback') return;
    if (runConfig.mode.startsWith('soroban') && feedbackAttempt && !feedbackAttempt.correct) return;
    const timeout = window.setTimeout(async () => {
      if (round + 1 < runConfig.rounds) nextQuestion();
      else if (sessionId) {
        try { setSync('saving'); await core('finish',{sessionId}); setSync('ready'); setPhase('finished'); }
        catch (e) { setSync('error'); setError(`${friendlyCoreError(e)} “Bitir ve kaydet” ile yeniden dene.`); }
      }
    }, 1700);
    return () => window.clearTimeout(timeout);
  }, [phase, round, runConfig.mode, runConfig.rounds, sessionId, feedbackAttempt]);
  async function finishSession() {
    if (!sessionId || savingAttempt) return;
    try { setSync('saving'); await core('finish',{sessionId}); setSync('ready'); setPhase('finished'); setPaused(false); setError(''); }
    catch (e) { setSync('error'); setError(`${friendlyCoreError(e)} Çalışma kapatılmadı; tekrar dene.`); }
  }
  function reset() { setSessionId(null); setPhase('ready'); setPaused(false); setError(''); setAttempts([]); setFeedbackAttempt(null); setSettingsOpen(true); }
  function retryQuestion() { setAnswer(''); setAbacusValue(0); setFeedbackAttempt(null); setRetrying(true); setAnswerRemainingMs(0); openQuestion(); }
  function addAnswerDigit(digit: number) { setAnswer(value => `${value}${digit}`.slice(0, 8)); }
  const result = score(attempts);

  if (phase === 'finished' && !measured) return <main className="min-h-screen bg-[#f5faf7] p-5"><section className="mx-auto max-w-5xl rounded-3xl border bg-white p-7 text-center shadow-lg"><p className="eyebrow text-[#16836e]">{practiceModeLabels[practiceMode]} tamamlandı</p><h1 className="mt-3 text-3xl font-black">Harika, {result.total} soru çalıştın.</h1><p className="mt-3 text-lg text-muted-foreground">İstersen aynı çalışmayı pekiştirebilir veya farklı bir çalışma seçebilirsin.</p><div className="mx-auto my-7 grid max-w-xl grid-cols-3 gap-3"><div className="rounded-2xl bg-[#edf5ff] p-4"><b className="text-3xl text-[#174f83]">{result.total}</b><p>Soru</p></div><div className="rounded-2xl bg-[#e9faef] p-4"><b className="text-3xl text-[#08733e]">{result.correct}</b><p>Doğru</p></div><div className="rounded-2xl bg-[#fff5dc] p-4"><b className="text-3xl text-[#a45c09]">{result.wrong}</b><p>Birlikte bakalım</p></div></div>{runConfig.mode.startsWith('soroban')&&attempts.some(attempt=>!attempt.correct&&attempt.attemptType!=='RETRY_AFTER_FEEDBACK')&&<div className="rounded-2xl border-2 border-[#efb55f] bg-[#fff8e7] p-5"><h2 className="font-black text-[#78470c]">Farkları görsel olarak incele</h2><div className="mt-4 flex flex-wrap justify-center gap-2">{attempts.map((attempt,index)=>!attempt.correct&&attempt.attemptType!=='RETRY_AFTER_FEEDBACK'?<Button key={index} variant="outline" className="border-[#dc941f] bg-white" onClick={()=>setReviewAttempt(attempt)}>Soru {index+1}</Button>:null)}</div></div>}<div className="mt-7 flex flex-wrap justify-center gap-3"><Button onClick={reset}><RotateCcw/> Yeni çalışma</Button><a href="/" className="inline-flex min-h-11 items-center rounded-xl border px-5 font-bold">Çalışma merkezim</a></div><p className="mt-5 text-sm font-semibold text-[#39715c]">Bütün yanıtların eğitimci kaydına işlendi.</p></section>{reviewAttempt&&<dialog open aria-label="Soroban soru incelemesi" className="fixed inset-0 z-50 m-0 grid h-full max-h-none w-full max-w-none place-items-center overflow-y-auto border-0 bg-[#102034]/65 p-4"><div className="w-full max-w-6xl rounded-3xl bg-white p-5 shadow-2xl md:p-8"><SorobanAnswerComparison studentValue={Math.max(0,reviewAttempt.given)} correctValue={reviewAttempt.expected} digits={runConfig.rods??5} onNext={()=>setReviewAttempt(null)}/></div></dialog>}</main>;

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="animate-spin"/> Öğrenci oturumu açılıyor…</div></div>;
  if (!student) return <div className="min-h-screen bg-background px-5 py-12"><form onSubmit={login} className="mx-auto mt-[8vh] max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm"><p className="eyebrow text-primary">ÇELİK ZİHİN AKADEMİSİ</p><h1 className="mt-3 text-3xl font-semibold">Öğrenci girişi</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Flash Anzan dahil bütün çalışmaların kendi öğrenci kaydına işlensin.</p><label className="mt-7 block text-xs font-semibold" htmlFor="username">Kullanıcı adı</label><Input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className="mt-2 h-12"/><label className="mt-4 block text-xs font-semibold" htmlFor="pin">PIN</label><Input id="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} className="mt-2 h-12"/>{loginError&&<p role="alert" className="mt-4 text-sm text-red-700">{loginError}</p>}<Button type="submit" className="mt-6 h-12 w-full">Giriş yap</Button></form></div>;

  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-white px-5 md:px-9"><div className="mx-auto flex min-h-20 max-w-[1400px] items-center justify-between gap-4 py-3"><a href="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl border-2 border-[#b9d7c9] bg-[#edf7f1] px-4 font-bold text-[#205e50] shadow-sm transition hover:bg-[#dff0e7]"><ArrowLeft size={19}/><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#182739] text-[10px] font-black text-[#d8eeac]">CZA</span><span>Çalışma merkezim</span></a><div className="flex items-center gap-4"><span className={`hidden items-center gap-1 text-[11px] sm:flex ${sync==='error'?'text-red-700':'text-muted-foreground'}`}>{sync==='saving'?<Loader2 size={13} className="animate-spin"/>:sync==='error'?<WifiOff size={13}/>:<Wifi size={13}/>} {sync==='saving'?'Kaydediliyor':sync==='error'?'Kayıt bekliyor':'Merkezi kayıt etkin'}</span><span className="text-xs font-semibold">{studentName(student)}{student.grade?` · ${student.grade}`:''}</span><Button variant="ghost" size="sm" onClick={logout}><LogOut/> Çıkış</Button></div></div></header>
    <main data-focus-mode={phase === 'countdown' || phase === 'prepare'} className="mx-auto max-w-[1480px] px-5 py-7 md:px-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2 text-primary">Odaklan · uygula · gelişimini gör</p><h1 className="text-3xl font-semibold tracking-tight">Kendi ritminde, doğru teknikle.</h1></div><Button variant="outline" className="h-10 lg:hidden" onClick={() => setSettingsOpen(v=>!v)}><Settings2 /> Çalışma ayarları</Button></div>
      {info && <div role="status" className="mb-5 rounded-lg border border-[#dfd5bd] bg-[#fbf6e9] px-4 py-3 text-xs leading-5 text-[#786337]">{info}</div>}
      <div className="grid items-start gap-6 lg:grid-cols-[310px_1fr]">
        <aside className={`rounded-xl border border-border bg-white p-6 ${settingsOpen ? '' : 'hidden lg:block'}`}><div className="mb-6 flex items-center gap-2"><Settings2 size={17} className="text-primary" /><h2 className="font-semibold">Çalışma reçetesi</h2></div><ExerciseSettings config={config} onChange={setConfig} disabled={active} /><div className="mt-5 rounded-lg bg-secondary/60 p-3 text-[11px] leading-5 text-[#437369]">Her cevap merkezi öğrenci kaydına işlenir. Doğru cevap, girilen cevap, işlem dizisi, süre ve çalışma ayarları eğitimci raporunda birlikte tutulur.</div></aside>
        <div className="space-y-5">
          <div ref={stageRef} style={active && (runConfig.mode === 'flash' || runConfig.mode === 'audio') ? { backgroundColor: runConfig.backgroundColor ?? '#ffffff', color: runConfig.textColor ?? '#111827' } : undefined} className={`overflow-hidden rounded-2xl border ${darkStage ? 'border-[#273c51] bg-[#182739] text-white' : 'border-border bg-white'}`}>
            <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${darkStage ? 'border-white/10' : 'border-border'}`}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#91baa5]" /><span className="text-xs font-semibold">{modeLabels[active || phase === 'finished' ? runConfig.mode : config.mode]}</span></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={darkStage ? 'Açık çalışma alanı' : 'Koyu çalışma alanı'} onClick={()=>setDarkStage(v=>!v)}>{darkStage ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon" aria-label="Tam ekran" onClick={() => { if (stageRef.current?.requestFullscreen) void stageRef.current.requestFullscreen().catch(()=>setError('Tam ekran bu ortamda desteklenmiyor.')); else setError('Tam ekran bu ortamda desteklenmiyor.'); }}><Maximize2 /></Button></div></div>
            <div className="flex min-h-[430px] flex-col items-center justify-center px-5 py-9 md:min-h-[475px]">
              {phase === 'ready' && <div className="max-w-lg text-center"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f3ee] text-primary"><Target size={32} strokeWidth={1.5} /></div><h2 className="text-2xl font-semibold tracking-tight">Zihnine çalışma alanı aç.</h2><p className={`mx-auto mt-3 max-w-md text-sm leading-7 ${darkStage ? 'text-[#b6c6d7]' : 'text-muted-foreground'}`}>{config.mode === 'finger-read' ? 'Ekrandaki gerçekçi parmak desenine dikkatlice bak.' : config.mode === 'soroban-read' ? 'Abaküsteki boncukları oku ve sayıyı yaz. Üst boncuk 5, çubuğa yakın her alt boncuk 1 değerindedir.' : config.mode === 'soroban-write' ? 'Verilen sayıyı sorobanda oluştur. Boncukları çubuğa yaklaştırmak ve uzaklaştırmak için dokun.' : config.mode === 'audio' ? 'Sayıları dinle, işlemleri zihninde yap. Cihazının sesini aç; ilk sayıdan sonra artı veya eksi komutunu izle.' : 'Sayılar sırayla ekrana gelecek. İşlemleri zihninde takip et ve son sayının ardından sonucu yaz.'}</p><div className="mb-7 mt-6 flex flex-wrap justify-center gap-3 text-xs opacity-70"><span className="rounded-full bg-[#e6f5ee] px-3 py-1 font-bold text-[#176e5e]">{practiceModeLabels[config.practiceMode??'free_practice']}</span><span>{config.rounds} soru</span><span>{config.digits} basamak</span><span>{['finger-read','soroban-read'].includes(config.mode) && isMeasuredMode(config.practiceMode??'free_practice') ? durationLabel(config.presentationDurationMs ?? 1000) : 'Süre baskısı yok'}</span></div><Button className="h-12 px-7" onClick={start}><Play size={16} fill="currentColor" /> Çalışmaya başla</Button>{config.mode === 'audio' && <p className="mt-4 text-[11px] opacity-60">Ses, cihazın konuşma desteğine bağlıdır; profesyonel ses kayıtları henüz eklenmedi.</p>}</div>}
              {phase === 'countdown' && <ExerciseLaunchSequence exerciseType={runConfig.mode} title={modeLabels[runConfig.mode]} icon={runConfig.mode === 'audio' ? <AudioLines size={18}/> : <Target size={18}/>} accentToken={runConfig.mode.startsWith('finger') ? '#bd6c3c' : runConfig.mode.startsWith('soroban') ? '#16836e' : runConfig.mode === 'flash' ? '#7865b7' : '#315f86'} instruction={runConfig.mode === 'finger-read' ? 'Parmakları hızlıca tanımaya hazırlan.' : runConfig.mode === 'soroban-read' ? 'Görüntüye dikkatlice bak.' : runConfig.mode === 'soroban-write' ? 'Gösterilen sayıyı sorobanda kur.' : runConfig.mode === 'flash' ? 'Sayıları sırayla zihninde tut.' : 'Dinlemeye ve zihninde hesaplamaya hazırlan.'} countdownEnabled onComplete={openQuestion} />}
              {phase === 'prepare' && <div className="launch-sequence text-center"><span className="mx-auto block h-3 w-3 animate-pulse rounded-full bg-[#4f9b85]"/><p className="mt-4 text-base font-semibold opacity-65">Yeni soru hazırlanıyor…</p></div>}
              {phase === 'stimulus' && current && <div className="w-full text-center" aria-label="Zamanlı görsel uyaran"><p className="mb-5 text-sm font-semibold opacity-65">Dikkatlice bak</p>{runConfig.mode === 'finger-read' ? <div className={`mx-auto grid max-w-[760px] items-end gap-4 ${runConfig.digits === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{runConfig.digits === 2 && <FingerHand side="left" pattern={numberPattern(current.answer).left}/>}<FingerHand side="right" pattern={numberPattern(current.answer).right}/></div> : <Soroban value={current.answer} digits={runConfig.rods ?? 5}/>}<p className="mt-5 text-xs opacity-55">{durationLabel(runConfig.presentationDurationMs ?? 1000)} sonra görüntü kapanır.</p></div>}
              {phase === 'sequence' && current && <div className="text-center"><p className="mb-6 text-xs opacity-60">{paused ? 'Duraklatıldı · sürdürünce aynı sayı tekrar gösterilir' : `${term+1}. sayı / ${current.sequence.length}`}</p>{runConfig.mode === 'audio' || runConfig.showNumbers === false ? <div className="flex h-[150px] items-center justify-center">{runConfig.mode === 'audio' ? <AudioLines size={100} strokeWidth={1.2} className="text-[#89b8a1]" /> : <span className="text-sm opacity-55">Sayı gizli · zihninden takip et</span>}</div> : <ExerciseNumberDisplay value={paused ? 'Ⅱ' : Math.abs(current.sequence[term])} operator={!paused && term > 0 ? (current.sequence[term] > 0 ? '+' : '−') : ''} size="hero" className="mx-auto min-h-[150px] w-fit" />}<p className="mt-5 text-xs opacity-60">{runConfig.mode === 'audio' ? 'Dinle ve zihninde hesapla.' : runConfig.showNumbers === false ? 'Sayıyı zihninde canlandır.' : 'İşlem işaretini takip et.'}</p>{runConfig.interval === 0 && !paused && <Button className="mt-7 h-10 px-5" onClick={advance}>{term+1 < current.sequence.length ? 'Sonraki sayı' : 'Cevaba geç'} <ChevronRight /></Button>}</div>}
              {phase === 'answer' && current && <form className="w-full max-w-md text-center" onSubmit={e => {e.preventDefault();submit();}}>
                <p className="mb-3 text-sm font-semibold opacity-70">{['soroban-read','finger-read'].includes(runConfig.mode) ? 'Gördüğün sayı kaçtı?' : runConfig.mode === 'soroban-write' ? 'Bu sayıyı sorobanda oluştur' : 'İşlemin sonucu kaç?'}</p>
                {timedReading && measured && <p className="mb-5 text-xs opacity-55">Görsel kapandı. Cevabını hatırladığın sayı üzerinden ver.{(runConfig.answerDurationMs ?? 0) > 0 ? ` ${Math.ceil(answerRemainingMs/1000)} saniyen var.` : ''}</p>}
                {timedReading && !measured && <div className="mb-5">{runConfig.mode==='soroban-read'?<Soroban value={current.answer} digits={runConfig.rods??5}/>:<div className={`mx-auto grid max-w-[760px] items-end gap-3 ${runConfig.digits===1?'grid-cols-1':'grid-cols-2'}`}>{runConfig.digits===2&&<FingerHand side="left" pattern={numberPattern(current.answer).left}/>}<FingerHand side="right" pattern={numberPattern(current.answer).right}/></div>}</div>}
                {runConfig.mode === 'soroban-write' && <><ExerciseNumberDisplay value={current.answer} size="large" animate className="mx-auto mb-5 w-fit"/><Soroban value={abacusValue} digits={runConfig.rods ?? 5} onChange={setAbacusValue} /></>}
                {runConfig.mode !== 'soroban-write' && <><div className="mx-auto mt-7 max-w-[220px]"><label htmlFor="answer" className="sr-only">Cevabın</label><Input autoFocus id="answer" autoComplete="off" inputMode="numeric" value={answer} onChange={e=>setAnswer(e.target.value.replace(/[^0-9-]/g, '').slice(0, 8))} placeholder="Cevabını yaz" className="focus-number h-16 text-center text-3xl font-bold md:text-3xl placeholder:text-base placeholder:font-normal" /></div><div className="mx-auto mt-4 grid max-w-[260px] grid-cols-3 gap-2" aria-label="Sayısal cevap klavyesi">{[1,2,3,4,5,6,7,8,9].map(digit => <button type="button" key={digit} className="h-10 rounded-lg border border-border bg-white text-lg font-semibold shadow-sm active:translate-y-px" onClick={() => addAnswerDigit(digit)}>{digit}</button>)}<button type="button" className="h-10 rounded-lg border border-border bg-white text-xs" onClick={() => setAnswer(value => value.slice(0, -1))}>Sil</button><button type="button" className="h-10 rounded-lg border border-border bg-white text-lg font-semibold" onClick={() => addAnswerDigit(0)}>0</button><button type="button" className="h-10 rounded-lg border border-border bg-white text-xs" onClick={() => setAnswer('')}>Temizle</button></div></>}
                <Button type="submit" disabled={savingAttempt} className="mt-6 h-11 px-6">{savingAttempt?<><Loader2 className="animate-spin"/> Kaydediliyor</>:<>Yanıtı kaydet <ArrowRight /></>}</Button>
                <p className="mt-4 text-[11px] opacity-50">Yanıt gönderilince doğru cevap ve verdiğin cevap karşılaştırılır.</p>
              </form>}
              {phase === 'feedback' && feedbackAttempt && runConfig.mode.startsWith('soroban') && !feedbackAttempt.correct && <SorobanAnswerComparison studentValue={Math.max(0,feedbackAttempt.given)} correctValue={feedbackAttempt.expected} digits={runConfig.rods??5} onRetry={retryQuestion} onNext={round+1<runConfig.rounds?nextQuestion:()=>void finishSession()}/>} {/* Soroban comparison */}
              {phase === 'feedback' && feedbackAttempt && (!runConfig.mode.startsWith('soroban') || feedbackAttempt.correct) && <div className="w-full max-w-xl text-center"><CheckCircle2 size={48} className={`mx-auto mb-5 ${feedbackAttempt.correct ? 'text-[#0a9b56]' : 'text-[#d97716]'}`} /><h2 className={`text-2xl font-black ${feedbackAttempt.correct ? 'text-[#08733e]' : 'text-[#a65c31]'}`}>{feedbackAttempt.correct ? 'DOĞRU' : feedbackAttempt.timeout ? 'SÜRE DOLDU' : 'BİRLİKTE KONTROL EDELİM'}</h2><div className="mt-5 grid grid-cols-2 gap-3 text-left"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Doğru cevap</p><p className="focus-number mt-2 text-3xl font-black">{feedbackAttempt.expected}</p></div><div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-rose-800">Senin cevabın</p><p className="focus-number mt-2 text-3xl font-black">{feedbackAttempt.timeout ? 'Cevap verilmedi' : feedbackAttempt.given}</p></div></div><p className="mt-4 text-xs opacity-60">{round + 1 < runConfig.rounds ? 'Bir sonraki soru otomatik açılacak.' : 'Seans özeti hazırlanıyor.'}</p></div>}
              {phase === 'finished' && <div className="w-full max-w-3xl text-center"><p className="eyebrow text-[#6a9e82]">{modeLabels[runConfig.mode]} tamamlandı</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Çalışma performansın hazır.</h2><div className="my-7 grid grid-cols-2 gap-3 md:grid-cols-3"><div className="rounded-xl bg-[#edf5f0] p-4"><p className="text-3xl font-semibold">{result.total}</p><p className="mt-2 text-xs opacity-60">Soru</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-3xl font-semibold text-emerald-800">{result.correct}</p><p className="mt-2 text-xs opacity-60">Doğru</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-3xl font-semibold text-amber-800">{result.wrong}</p><p className="mt-2 text-xs opacity-60">Yanlış</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-3xl font-semibold">{result.timeout}</p><p className="mt-2 text-xs opacity-60">Süre aşımı</p></div><div className="rounded-xl bg-[#edf5f0] p-4"><p className="text-3xl font-semibold">%{result.accuracy}</p><p className="mt-2 text-xs opacity-60">Başarı</p></div><div className="rounded-xl bg-blue-50 p-4"><p className="text-3xl font-semibold">{(result.averageResponseMs/1000).toFixed(1)} sn</p><p className="mt-2 text-xs opacity-60">Ort. cevap</p></div></div>{timedReading && <div className="grid gap-3 rounded-xl border border-[#cbdad4] bg-[#f8fbf9] p-4 text-left sm:grid-cols-2"><div><p className="text-xs opacity-60">Kullanılan gösterim</p><p className="mt-1 font-bold">{durationLabel(runConfig.presentationDurationMs ?? 1000)}</p></div><div><p className="text-xs opacity-60">En hızlı doğru cevap</p><p className="mt-1 font-bold">{result.fastestCorrectMs === null ? 'Henüz yok' : `${(result.fastestCorrectMs/1000).toFixed(1)} sn`}</p></div></div>}<p className="mt-5 rounded-xl bg-[#fbf6e9] p-4 text-sm leading-6 text-[#6d5b36]">{timedReading ? progressionSuggestion(result.accuracy,result.total,runConfig.presentationDurationMs ?? 1000) : result.accuracy >= 80 ? 'Bu ayarlarda iyi bir temel oluşturdun. Hızı artırmadan önce birkaç tutarlı seans daha tamamla.' : 'Bu seviyeyi sağlamlaştırmak için aynı ayarda bir tur daha çalışabilirsin.'}</p><div className="mt-6 flex justify-center gap-3"><Button className="h-11 px-5" onClick={reset}><RotateCcw/> Yeni seans</Button><a href="/educator" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold">Eğitimci görünümü <ArrowRight size={14}/></a></div><p className="mt-5 text-[11px] text-[#39715c]">Tüm yanıtlar merkezi sisteme kaydedildi ve seans kapatıldı.{saved?' Bu cihazda ayrıca kısa süreli bir yedek tutuldu.':''}</p></div>}
            </div>
            {active && <div className={`border-t px-6 py-4 ${darkStage ? 'border-white/10' : 'border-border'}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs opacity-60">{attempts.length} / {runConfig.rounds} yanıt</span><div className="flex gap-2">{['countdown','stimulus','sequence'].includes(phase) && <Button variant="ghost" size="sm" onClick={()=>setPaused(v=>!v)}>{paused ? <Play /> : <Pause />}{paused ? 'Sürdür' : 'Duraklat'}</Button>}<Button variant="outline" size="sm" disabled={savingAttempt||sync==='saving'} onClick={finishSession}>Bitir ve kaydet</Button></div></div><Progress value={attempts.length/runConfig.rounds*100} aria-label="Seans ilerlemesi" /><p className="mt-3 text-[10px] opacity-55">Bitirdiğinde o ana kadar verdiğin bütün cevaplar eğitimci kaydında kalır.</p></div>}
          </div>
          {phase === 'finished' && runConfig.mode.startsWith('soroban') && attempts.some(attempt=>!attempt.correct&&attempt.attemptType!=='RETRY_AFTER_FEEDBACK') && <section className="rounded-2xl border-2 border-[#efb55f] bg-[#fff8e7] p-5"><h2 className="font-black text-[#78470c]">Yanlış soruları görsel incele</h2><p className="mt-1 text-sm text-[#8a672f]">Bir soruya dokun; verdiğin cevapla doğru boncuk dizilimini yan yana gör.</p><div className="mt-4 flex flex-wrap gap-2">{attempts.map((attempt,index)=>!attempt.correct&&attempt.attemptType!=='RETRY_AFTER_FEEDBACK'?<Button key={index} variant="outline" className="border-[#dc941f] bg-white" onClick={()=>setReviewAttempt(attempt)}>Soru {index+1}</Button>:null)}</div></section>}
          {reviewAttempt && <dialog open aria-label="Soroban soru incelemesi" className="fixed inset-0 z-50 m-0 grid h-full max-h-none w-full max-w-none place-items-center overflow-y-auto border-0 bg-[#102034]/65 p-4"><div className="w-full max-w-6xl rounded-3xl bg-white p-5 shadow-2xl md:p-8"><SorobanAnswerComparison studentValue={Math.max(0,reviewAttempt.given)} correctValue={reviewAttempt.expected} digits={runConfig.rods??5} onNext={()=>setReviewAttempt(null)}/><div className="mt-4 grid gap-2 rounded-xl bg-[#edf5ff] p-4 text-sm sm:grid-cols-2"><p><b>Cevap süresi:</b> {(reviewAttempt.elapsedMs/1000).toFixed(2)} sn</p><p><b>Gösterim süresi:</b> {durationLabel(reviewAttempt.stimulusDurationMs??0)}</p></div></div></dialog>}
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {phase === 'finished' && <section className="rounded-xl border border-border bg-white p-6"><h2 className="mb-4 font-semibold">Soru soru incele</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-3">Soru</th><th className="p-3">Gösterilen sayı / işlem</th><th className="p-3">Yanıtın</th><th className="p-3">Doğru cevap</th><th className="p-3">Sonuç</th></tr></thead><tbody>{attempts.map((a,i)=><tr key={i} className="border-b border-border last:border-0"><td className="p-3">{i+1}</td><td className="p-3 font-mono">{a.sequence.map((n,j)=>`${j && n>0 ? '+' : ''}${n}`).join(' ')}</td><td className="p-3">{a.timeout?'Süre aşımı':a.given}</td><td className="p-3">{a.expected}</td><td className={`p-3 font-semibold ${a.correct ? 'text-primary' : 'text-[#b2733d]'}`}>{a.correct ? 'Doğru' : a.timeout ? 'Süre aşımı' : 'Tekrar çalış'}</td></tr>)}</tbody></table></div></section>}
          <section className="grid gap-4 text-xs sm:grid-cols-3"><div className="rounded-xl border border-border p-4"><CircleHelp size={18} className="mb-3 text-primary"/><h3 className="font-semibold">Önce doğruluk</h3><p className="mt-2 leading-5 text-muted-foreground">Hız, tekniğin yerleştikten sonra artırılır. Adımlı modla başlayabilirsin.</p></div><div className="rounded-xl border border-border p-4"><Pause size={18} className="mb-3 text-primary"/><h3 className="font-semibold">Kontrol sende</h3><p className="mt-2 leading-5 text-muted-foreground">Sayı akışını duraklat. Sekmeden ayrılırsan akış otomatik durur.</p></div><div className="rounded-xl border border-border p-4"><Volume2 size={18} className="mb-3 text-primary"/><h3 className="font-semibold">Ayrı çalışma motorları</h3><p className="mt-2 leading-5 text-muted-foreground">Okuma, yazma, görsel ve işitsel hesaplama ayrı değerlendirilir.</p></div></section>
        </div>
      </div>
    </main>
  </div>;
}
