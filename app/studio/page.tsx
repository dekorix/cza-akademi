'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, CheckCircle2, ChevronRight, CircleHelp, Maximize2, Moon, Pause, Play, RotateCcw, Settings2, Sun, Target, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ExerciseSettings } from '@/components/exercise-settings';
import { Soroban } from '@/components/soroban';
import { createQuestion, defaultConfig, modeLabels, score, validateConfig, type Attempt, type ExerciseConfig, type ExerciseQuestion } from '@/lib/exercise-engine';
import { readDemoProgram, saveDemoResult } from '@/lib/demo-session';
import { registerAcademyTools } from '@/lib/webmcp';

type Phase = 'ready' | 'countdown' | 'sequence' | 'answer' | 'feedback' | 'finished';

export default function Studio() {
  const [config, setConfig] = useState<ExerciseConfig>({...defaultConfig});
  const [runConfig, setRunConfig] = useState<ExerciseConfig>({...defaultConfig});
  const [phase, setPhase] = useState<Phase>('ready');
  const [questions, setQuestions] = useState<ExerciseQuestion[]>([]);
  const [round, setRound] = useState(0);
  const [term, setTerm] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [paused, setPaused] = useState(false);
  const [answer, setAnswer] = useState('');
  const [abacusValue, setAbacusValue] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saved, setSaved] = useState(false);
  const [darkStage, setDarkStage] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const responseStart = useRef(0);
  const sessionStart = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const active = !['ready','finished'].includes(phase);
  const current = questions[round];
  const mental = runConfig.mode === 'flash' || runConfig.mode === 'audio';
  const snapshot = useRef({ config, phase });
  snapshot.current = { config, phase };

  useEffect(() => {
    setAudioAvailable('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'flash' || mode === 'audio') setConfig(c => ({...c, mode, digits: 1}));
    if (mode === 'fingers') setInfo('Parmak tekniği atölyesi geliştirme planında. Bu ilk pilotta Soroban ve Anzan motorlarını deneyebilirsin.');
    if (new URLSearchParams(window.location.search).get('program') === 'demo') {
      const program = readDemoProgram();
      if (program) { setConfig(program); setInfo('Eğitimci ekranında hazırladığın deneme programı yüklendi. Bu, gerçek bir öğrenci ataması değildir.'); }
    }
    return registerAcademyTools([
      { name: 'read_exercise_setup', title: 'Egzersiz ayarlarını oku', description: 'Seçili egzersiz ayarlarını ve akış durumunu okur; aktif sorunun doğru cevabını vermez.', inputSchema: {type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false}, execute: () => snapshot.current },
      { name: 'configure_exercise', title: 'Deneme egzersizini ayarla', description: 'Hazır durumdaki deneme ayarlarını değiştirir; seans başlatmaz veya öğrenciye atama yapmaz.', inputSchema:{type:'object',properties:{mode:{enum:['soroban-read','soroban-write','flash','audio']},digits:{type:'integer',minimum:1,maximum:3},terms:{type:'integer',minimum:2,maximum:10},rounds:{type:'integer',minimum:1,maximum:20},interval:{type:'number',minimum:0,maximum:5},operation:{enum:['add','subtract','mixed']},pool:{type:'array',items:{type:'integer',minimum:1,maximum:9},minItems:1}},additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:false}, execute: async input => {
        if (!['ready','finished'].includes(snapshot.current.phase)) throw new Error('Önce mevcut seansı bitirin.');
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ayar nesnesi bekleniyor.');
        const allowed = ['mode','digits','terms','rounds','interval','operation','pool'];
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
    else { setPhase('answer'); responseStart.current = Date.now(); }
  }, [current, term]);

  useEffect(() => {
    if (phase !== 'countdown' || paused) return;
    const timeout = window.setTimeout(() => {
      if (countdown > 1) setCountdown(v => v-1);
      else { setPhase(mental ? 'sequence' : 'answer'); responseStart.current = Date.now(); }
    }, 750);
    return () => clearTimeout(timeout);
  }, [phase, countdown, paused, mental]);

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

  function start() {
    try {
      validateConfig(config);
      if (config.mode === 'audio' && !audioAvailable) throw new Error('Bu tarayıcıda sesli çalışma desteklenmiyor. Flash Anzan kullanabilirsin.');
      const generated = Array.from({length:config.rounds}, () => createQuestion(config));
      setQuestions(generated); setRunConfig({...config, pool:[...config.pool]}); setRound(0); setTerm(0); setCountdown(3); setAttempts([]); setAnswer(''); setAbacusValue(0); setPaused(false); setError(''); setSaved(false); setPhase('countdown'); setSettingsOpen(false); sessionStart.current = Date.now();
    } catch (e) { setError(e instanceof Error ? e.message : 'Çalışma hazırlanamadı.'); }
  }
  function submit() {
    if (!current || phase !== 'answer') return;
    if (runConfig.mode !== 'soroban-write' && !/^\d+$/.test(answer.trim())) { setError('Lütfen sıfır veya pozitif bir tam sayı yaz.'); return; }
    const given = runConfig.mode === 'soroban-write' ? abacusValue : Number(answer);
    if (!Number.isSafeInteger(given)) { setError('Geçerli bir sayı yaz.'); return; }
    const attempt = { sequence: current.sequence, expected: current.answer, given, correct: given === current.answer, elapsedMs: Date.now()-responseStart.current };
    const all = [...attempts, attempt]; setAttempts(all); setError('');
    if (all.length === runConfig.rounds) {
      setSaved(saveDemoResult({ id: crypto.randomUUID(), at: new Date().toISOString(), config: runConfig, attempts: all, durationMs: Date.now()-sessionStart.current })); setPhase('finished');
    } else setPhase('feedback');
  }
  function nextQuestion() { setRound(v=>v+1); setTerm(0); setCountdown(3); setAnswer(''); setAbacusValue(0); setPhase('countdown'); }
  function reset() { setPhase('ready'); setPaused(false); setError(''); setAttempts([]); setSettingsOpen(true); }
  const result = score(attempts);

  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-white px-5 md:px-9"><div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between gap-4"><a href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#182739] text-xs font-black text-[#d8eeac]">CZA</span><span className="text-sm font-semibold">Egzersiz stüdyosu</span></a><div className="flex items-center gap-5"><span className="hidden text-[11px] text-muted-foreground sm:block">Örnek çalışma · gerçek öğrenci kaydı yok</span><a href="/" className="flex items-center gap-2 text-xs font-semibold text-primary"><ArrowLeft size={15} /> Merkezim</a></div></div></header>
    <main className="mx-auto max-w-[1480px] px-5 py-7 md:px-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2 text-primary">Odaklan · uygula · gelişimini gör</p><h1 className="text-3xl font-semibold tracking-tight">Kendi ritminde, doğru teknikle.</h1></div><Button variant="outline" className="h-10 lg:hidden" onClick={() => setSettingsOpen(v=>!v)}><Settings2 /> Çalışma ayarları</Button></div>
      {info && <div role="status" className="mb-5 rounded-lg border border-[#dfd5bd] bg-[#fbf6e9] px-4 py-3 text-xs leading-5 text-[#786337]">{info}</div>}
      <div className="grid items-start gap-6 lg:grid-cols-[310px_1fr]">
        <aside className={`rounded-xl border border-border bg-white p-6 ${settingsOpen ? '' : 'hidden lg:block'}`}><div className="mb-6 flex items-center gap-2"><Settings2 size={17} className="text-primary" /><h2 className="font-semibold">Çalışma reçetesi</h2></div><ExerciseSettings config={config} onChange={setConfig} disabled={active} /><div className="mt-5 rounded-lg bg-secondary/60 p-3 text-[11px] leading-5 text-[#437369]">Cevaplar seans sonuna kadar gizli kalır. Bu pilot, pedagojik tanı veya 14 beceri değerlendirmesi yerine geçmez.</div></aside>
        <div className="space-y-5">
          <div ref={stageRef} className={`overflow-hidden rounded-2xl border ${darkStage ? 'border-[#273c51] bg-[#182739] text-white' : 'border-border bg-white'}`}>
            <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${darkStage ? 'border-white/10' : 'border-border'}`}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#91baa5]" /><span className="text-xs font-semibold">{modeLabels[active || phase === 'finished' ? runConfig.mode : config.mode]}</span></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={darkStage ? 'Açık çalışma alanı' : 'Koyu çalışma alanı'} onClick={()=>setDarkStage(v=>!v)}>{darkStage ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon" aria-label="Tam ekran" onClick={() => { if (stageRef.current?.requestFullscreen) void stageRef.current.requestFullscreen().catch(()=>setError('Tam ekran bu ortamda desteklenmiyor.')); else setError('Tam ekran bu ortamda desteklenmiyor.'); }}><Maximize2 /></Button></div></div>
            <div className="flex min-h-[430px] flex-col items-center justify-center px-5 py-9 md:min-h-[475px]">
              {phase === 'ready' && <div className="max-w-lg text-center"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f3ee] text-primary"><Target size={32} strokeWidth={1.5} /></div><h2 className="text-2xl font-semibold tracking-tight">Zihnine çalışma alanı aç.</h2><p className={`mx-auto mt-3 max-w-md text-sm leading-7 ${darkStage ? 'text-[#b6c6d7]' : 'text-muted-foreground'}`}>{config.mode === 'soroban-read' ? 'Abaküsteki boncukları oku ve sayıyı yaz. Üst boncuk 5, çubuğa yakın her alt boncuk 1 değerindedir.' : config.mode === 'soroban-write' ? 'Verilen sayıyı sorobanda oluştur. Boncukları çubuğa yaklaştırmak ve uzaklaştırmak için dokun.' : config.mode === 'audio' ? 'Sayıları dinle, işlemleri zihninde yap. Cihazının sesini aç; ilk sayıdan sonra artı veya eksi komutunu izle.' : 'Sayılar sırayla ekrana gelecek. İşlemleri zihninde takip et ve son sayının ardından sonucu yaz.'}</p><div className="mb-7 mt-6 flex justify-center gap-5 text-xs opacity-65"><span>{config.rounds} soru</span><span>{config.digits} basamak</span><span>Seans sonunda geri bildirim</span></div><Button className="h-12 px-7" onClick={start}><Play size={16} fill="currentColor" /> Seansı başlat</Button>{config.mode === 'audio' && <p className="mt-4 text-[11px] opacity-60">Ses, cihazın konuşma desteğine bağlıdır; profesyonel ses kayıtları henüz eklenmedi.</p>}</div>}
              {phase === 'countdown' && <div className="text-center"><p className="mb-5 text-sm opacity-60">{paused ? 'Çalışma duraklatıldı' : 'Hazır ol'}</p><p className="focus-number text-[100px] font-semibold">{paused ? 'Ⅱ' : countdown}</p><p className="mt-4 text-xs opacity-60">Soru {round+1} / {runConfig.rounds}</p></div>}
              {phase === 'sequence' && current && <div className="text-center"><p className="mb-6 text-xs opacity-60">{paused ? 'Duraklatıldı · sürdürünce aynı sayı tekrar gösterilir' : `${term+1}. sayı / ${current.sequence.length}`}</p>{runConfig.mode === 'audio' ? <div className="flex h-[150px] items-center justify-center"><AudioLines size={100} strokeWidth={1.2} className="text-[#89b8a1]" /></div> : <div aria-live="off" className="focus-number min-h-[150px] text-[clamp(65px,10vw,130px)] font-semibold leading-none">{paused ? 'Ⅱ' : `${term > 0 && current.sequence[term] > 0 ? '+' : ''}${current.sequence[term]}`}</div>}<p className="mt-5 text-xs opacity-60">{runConfig.mode === 'audio' ? 'Dinle ve zihninde hesapla.' : 'İşlem işaretini takip et.'}</p>{runConfig.interval === 0 && !paused && <Button className="mt-7 h-10 px-5" onClick={advance}>{term+1 < current.sequence.length ? 'Sonraki sayı' : 'Cevaba geç'} <ChevronRight /></Button>}</div>}
              {phase === 'answer' && current && <form className="w-full max-w-md text-center" onSubmit={e => {e.preventDefault();submit();}}>
                <p className="mb-6 text-sm opacity-70">{runConfig.mode === 'soroban-read' ? 'Sorobanda hangi sayı var?' : runConfig.mode === 'soroban-write' ? 'Bu sayıyı sorobanda oluştur' : 'İşlemin sonucu kaç?'}</p>
                {runConfig.mode === 'soroban-read' && <Soroban value={current.answer} digits={runConfig.digits} />}
                {runConfig.mode === 'soroban-write' && <><p className="focus-number mb-5 text-5xl font-semibold">{current.answer}</p><Soroban value={abacusValue} digits={runConfig.digits} onChange={setAbacusValue} /></>}
                {runConfig.mode !== 'soroban-write' && <div className="mx-auto mt-7 max-w-[220px]"><label htmlFor="answer" className="sr-only">Cevabın</label><Input autoFocus id="answer" autoComplete="off" inputMode="numeric" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Cevabını yaz" className="h-14 text-center text-2xl md:text-2xl" /></div>}
                <Button type="submit" className="mt-6 h-11 px-6">Yanıtı kaydet <ArrowRight /></Button>
                <p className="mt-4 text-[11px] opacity-50">Doğru cevaplar seansın sonunda açılacak.</p>
              </form>}
              {phase === 'feedback' && <div className="text-center"><CheckCircle2 size={48} className="mx-auto mb-5 text-[#80aa94]" /><h2 className="text-2xl font-semibold">Yanıtın alındı.</h2><p className="mt-3 text-sm opacity-60">Sonuçları birlikte seans sonunda inceleyeceğiz.</p><Button className="mt-7 h-11 px-6" onClick={nextQuestion}>Sonraki soru <ArrowRight /></Button></div>}
              {phase === 'finished' && <div className="w-full max-w-xl text-center"><p className="eyebrow text-[#6a9e82]">Seans tamamlandı</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Her çalışma yeni bir ipucu.</h2><div className="my-7 grid grid-cols-3 divide-x divide-border/30"><div><p className="text-3xl font-semibold">{result.correct}/{result.total}</p><p className="mt-2 text-xs opacity-60">Doğru yanıt</p></div><div><p className="text-3xl font-semibold">%{result.accuracy}</p><p className="mt-2 text-xs opacity-60">Bu seans doğruluğu</p></div><div><p className="text-3xl font-semibold">{Math.round(attempts.reduce((s,a)=>s+a.elapsedMs,0)/Math.max(1,attempts.length)/1000)} sn</p><p className="mt-2 text-xs opacity-60">Ort. yanıt süresi</p></div></div><p className="text-sm leading-6 opacity-65">{result.accuracy >= 80 ? 'Bu ayarlarda iyi bir temel oluşturdun. Hızı artırmadan önce birkaç tutarlı seans daha tamamla.' : 'Hızını azaltıp aynı basamakta tekrar çalışabilirsin. Yanlışların, bir sonraki çalışmanın yönünü gösterir.'}</p><div className="mt-6 flex justify-center gap-3"><Button className="h-10 px-4" onClick={reset}><RotateCcw /> Yeni seans</Button><a href="/educator" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 text-xs">Eğitimci görünümü <ArrowRight size={14}/></a></div><p className="mt-5 text-[11px] opacity-55">{saved ? 'Deneme sonucu yalnızca bu sekmenin oturumuna kaydedildi.' : 'Tarayıcı kaydına izin vermedi. Sonuç bu ekranda görünür; merkezi sisteme gönderilmedi.'}</p></div>}
            </div>
            {active && <div className={`border-t px-6 py-4 ${darkStage ? 'border-white/10' : 'border-border'}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs opacity-60">{attempts.length} / {runConfig.rounds} yanıt</span><div className="flex gap-2">{['countdown','sequence'].includes(phase) && <Button variant="ghost" size="sm" onClick={()=>setPaused(v=>!v)}>{paused ? <Play /> : <Pause />}{paused ? 'Sürdür' : 'Duraklat'}</Button>}<Button variant="ghost" size="sm" className="text-xs opacity-60" onClick={reset}>Seansı bırak</Button></div></div><Progress value={attempts.length/runConfig.rounds*100} aria-label="Seans ilerlemesi" /><p className="mt-3 text-[10px] opacity-45">Seansı bırakırsan tamamlanmamış yanıtlar kaydedilmez.</p></div>}
          </div>
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {phase === 'finished' && <section className="rounded-xl border border-border bg-white p-6"><h2 className="mb-4 font-semibold">Soru soru incele</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-3">Soru</th><th className="p-3">Gösterilen sayı / işlem</th><th className="p-3">Yanıtın</th><th className="p-3">Doğru cevap</th><th className="p-3">Sonuç</th></tr></thead><tbody>{attempts.map((a,i)=><tr key={i} className="border-b border-border last:border-0"><td className="p-3">{i+1}</td><td className="p-3 font-mono">{a.sequence.map((n,j)=>`${j && n>0 ? '+' : ''}${n}`).join(' ')}</td><td className="p-3">{a.given}</td><td className="p-3">{a.expected}</td><td className={`p-3 font-semibold ${a.correct ? 'text-primary' : 'text-[#b2733d]'}`}>{a.correct ? 'Doğru' : 'Tekrar çalış'}</td></tr>)}</tbody></table></div></section>}
          <section className="grid gap-4 text-xs sm:grid-cols-3"><div className="rounded-xl border border-border p-4"><CircleHelp size={18} className="mb-3 text-primary"/><h3 className="font-semibold">Önce doğruluk</h3><p className="mt-2 leading-5 text-muted-foreground">Hız, tekniğin yerleştikten sonra artırılır. Adımlı modla başlayabilirsin.</p></div><div className="rounded-xl border border-border p-4"><Pause size={18} className="mb-3 text-primary"/><h3 className="font-semibold">Kontrol sende</h3><p className="mt-2 leading-5 text-muted-foreground">Sayı akışını duraklat. Sekmeden ayrılırsan akış otomatik durur.</p></div><div className="rounded-xl border border-border p-4"><Volume2 size={18} className="mb-3 text-primary"/><h3 className="font-semibold">Ayrı çalışma motorları</h3><p className="mt-2 leading-5 text-muted-foreground">Okuma, yazma, görsel ve işitsel hesaplama ayrı değerlendirilir.</p></div></section>
        </div>
      </div>
    </main>
  </div>;
}
