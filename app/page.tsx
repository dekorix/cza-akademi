'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, AudioLines, BookOpenCheck, BrainCircuit, ChartNoAxesCombined, Check, ChevronRight, Clock3, Dumbbell, Flame, Hand, LayoutDashboard, LogOut, Menu, Play, School, ShieldCheck, Sparkles, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { core, coreStudent, friendlyCoreError, studentName, type CoreStudent } from '@/lib/core-client';

const modules = [
  { title: 'Parmak tekniği', detail: 'Oku, parmaklarınla göster ve anında geri bildirim al', icon: Hand, color: '#f8eee3', ink: '#a56730', level: 'Learning Core bağlı', progress: 1, href: '/paritmetik' },
  { title: 'Soroban öğretimi', detail: 'Anla, birlikte yap, kendin dene', icon: BrainCircuit, color: '#e8f3ee', ink: '#23796e', level: '8 derslik temel rota', progress: 0, href: '/learn' },
  { title: 'Toplama / Çıkarma', detail: 'Soroban, parmak veya zihinden işlem çöz', icon: Target, color: '#e8f2fb', ink: '#315a83', level: 'Ayar kontrollü çalışma', progress: 0, href: '/arithmetic' },
  { title: 'Flash Anzan', detail: 'Zihnindeki abaküsü çalıştır', icon: Sparkles, color: '#eeedf9', ink: '#7765aa', level: 'Seviye 1', progress: 32, href: '/studio?mode=flash' },
  { title: 'Sesli Anzan', detail: 'Dinle, canlandır, hesapla', icon: AudioLines, color: '#eef1f4', ink: '#6c7b8d', level: 'Sıradaki adım', progress: 0, href: '/studio?mode=audio' },
];

const CAMPUS_V14_URL = 'https://script.google.com/macros/s/AKfycbwIS-o_6HB8GiA-pLhR-zK4aRZCqo_kz_dpUJFWA94NqMUT2E22tu6tThHPSAT0Ro92/exec?v=14';

export function StudentPortal({ area }: { area: 'main' | 'work' }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [student, setStudent] = useState<CoreStudent | null>(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [menu, setMenu] = useState(false);
  const [digits, setDigits] = useState([0, 2, 4]);
  const [notice, setNotice] = useState('');
  const value = digits.reduce((total, digit) => total * 10 + digit, 0);
  const displayName = student ? studentName(student) : 'Öğrenci';

  useEffect(() => {
    async function restoreStudent() {
      try {
        const ticket = new URLSearchParams(window.location.search).get('handoff');
        if (ticket) {
          window.location.replace(`/api/legacy-handoff?ticket=${encodeURIComponent(ticket)}`);
          return;
        }
        if (new URLSearchParams(window.location.search).get('handoffError')) throw new Error('handoff_unavailable');
        const data = await core('me');
        setStudent(coreStudent(data));
      } catch (error) {
        setStudent(null);
        if (error instanceof Error && error.message !== 'session_required' && error.message !== 'invalid_session') {
          setLoginError('Güvenli panel geçişi tamamlanamadı. Öğrenci paneline dönüp yeniden dene.');
        }
      } finally {
        setAuthLoading(false);
      }
    }
    void restoreStudent();
  }, []);

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    try {
      const data = await core('login', { username: username.trim(), pin: pin.trim() });
      setStudent(coreStudent(data));
      setPin('');
    } catch (error) {
      setLoginError(friendlyCoreError(error));
    }
  }

  async function logout() {
    try { await core('logout'); } finally { setStudent(null); setPin(''); }
  }

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Öğrenci oturumu açılıyor…</div>;
  if (!student) return <main className="min-h-screen bg-background px-5 py-12"><form onSubmit={login} className="mx-auto mt-[8vh] max-w-md rounded-3xl border border-border bg-white p-8 shadow-lg"><p className="eyebrow text-primary">ÇELİK ZİHİN AKADEMİSİ</p><h1 className="mt-3 text-3xl font-semibold">Öğrenci girişi</h1><p className="mt-2 text-base leading-7 text-muted-foreground">Çalışma merkezine girmek için kullanıcı adı ve PIN bilgilerini yaz.</p><label className="mt-7 block text-sm font-semibold" htmlFor="home-username">Kullanıcı adı</label><Input id="home-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="mt-2 h-12" required /><label className="mt-4 block text-sm font-semibold" htmlFor="home-pin">PIN</label><Input id="home-pin" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} className="mt-2 h-12" required />{loginError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{loginError}</p>}<Button type="submit" className="mt-6 h-12 w-full text-base" disabled={!username.trim() || !pin.trim()}>Giriş yap</Button></form></main>;

  if (area === 'main') return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-white"><div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-black text-white">CZA</span><div><p className="font-semibold">CZA Öğrenci Paneli</p><p className="text-xs text-muted-foreground">Ana gelişim merkezi</p></div></div><Button variant="outline" onClick={logout}><LogOut/> Güvenli çıkış</Button></div></header>
    <main className="mx-auto max-w-6xl px-5 py-9">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-primary">TEK ÖĞRENCİ · TEK GELİŞİM GEÇMİŞİ</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Merhaba {displayName}, ana paneline hoş geldin.</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">Akademik gelişimini ve beceri çalışmalarını iki sade alandan yönetebilirsin.</p></div><span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><ShieldCheck size={18}/> Merkezî kayıt etkin</span></div>
      <section className="grid gap-5 md:grid-cols-2" aria-label="Öğrenci çalışma alanları">
        <a href={CAMPUS_V14_URL} className="group rounded-3xl border-2 border-[#315a83]/30 bg-[linear-gradient(145deg,#fff,#e8f2fb)] p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#315a83] text-white"><School size={28}/></span><p className="mt-6 text-xs font-bold tracking-widest text-[#315a83]">ANA AKADEMİK PANEL</p><h2 className="mt-2 text-2xl font-bold">CZA Kampüs · Sürüm 14</h2><p className="mt-3 min-h-20 text-sm leading-7 text-muted-foreground">Değerlendirme sonuçların, okul derslerin, hedeflerin, eğitimci yönlendirmelerin ve gelişim yolun.</p><span className="mt-5 inline-flex items-center gap-2 font-semibold text-[#315a83]">Akademik panelimi aç <ArrowRight size={18} className="transition group-hover:translate-x-1"/></span></a>
        <a href="/work" className="group rounded-3xl border-2 border-primary/30 bg-[linear-gradient(145deg,#fff,#e5f4ed)] p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white"><Dumbbell size={28}/></span><p className="mt-6 text-xs font-bold tracking-widest text-primary">BECERİ VE EGZERSİZ ALANI</p><h2 className="mt-2 text-2xl font-bold">CZA Çalışma Paneli</h2><p className="mt-3 min-h-20 text-sm leading-7 text-muted-foreground">Parmak, Soroban, Toplama–Çıkarma, Flash Anzan, Sesli Anzan ve gelişecek diğer atölyeler.</p><span className="mt-5 inline-flex items-center gap-2 font-semibold text-primary">Çalışma alanımı aç <ArrowRight size={18} className="transition group-hover:translate-x-1"/></span></a>
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 className="font-semibold">Paneller nasıl birlikte çalışır?</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">Her iki alan aynı öğrenciye aittir. Çalışma Panelindeki yeni sonuçlar merkezî kayda işlenir; eğitimci bu sonuçları kendi güvenli panelinden görür.</p></section>
    </main>
  </div>;

  return (
    <div className="academy-shell lg:pl-[236px]">
      {menu && <button aria-label="Menüyü kapat" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMenu(false)} />}
      <aside className={`academy-sidebar fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col px-5 py-8 transition-transform lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-11 flex items-center gap-3 px-2 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8eeac] text-lg font-black tracking-tighter text-[#213e32]">CZA</div>
          <div><p className="text-[15px] font-semibold">Egzersiz</p><p className="text-[12px] tracking-[.12em] text-[#aebdcd]">AKADEMİSİ</p></div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" aria-label="Menüyü kapat" onClick={() => setMenu(false)}><X /></Button>
        </div>
        <p className="eyebrow mb-3 px-4 text-[#7e91a5]">Çalışma alanım</p>
        <nav className="space-y-1" aria-label="Ana menü">
          <a href="/work" className="academy-nav active"><LayoutDashboard size={18} /> Çalışma merkezim</a>
          <a href="/studio" className="academy-nav"><BrainCircuit size={18} /> Egzersiz stüdyosu</a>
          <a href="/paritmetik" className="academy-nav"><Hand size={18} /> Paritmetik</a>
          <a href="/learn" className="academy-nav"><BookOpenCheck size={18} /> Öğrenme yolum</a>
          <a href="#development" className="academy-nav" onClick={() => setMenu(false)}><ChartNoAxesCombined size={18} /> Gelişimim</a>
        </nav>
        <div className="mt-10 border-t border-white/10 pt-6"><a href="/" className="academy-nav"><ArrowRight className="rotate-180" size={18}/> CZA Öğrenci Paneli</a></div>
        <div className="mt-auto pt-10">
          <div className="rounded-xl border border-[#3b4d60] p-4">
            <div className="mb-3 flex items-center gap-2 text-[#d8eeac]"><Sparkles size={17} /><span className="text-sm font-semibold">Küçük adımlar, güçlü zihin.</span></div>
            <p className="text-xs leading-5 text-[#a8b9ca]">Önemli olan hızlı bitirmek değil, her gün biraz daha iyi anlamak.</p>
          </div>
          <p className="mt-5 px-1 text-[10px] text-[#8c9cae]">CZA KAMPÜS EKOSİSTEMİ <span className="float-right">ÖNİZLEME</span></p>
        </div>
      </aside>

      <header className="flex h-[82px] items-center justify-between border-b border-border bg-white/70 px-5 md:px-9 xl:px-12">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menüyü aç" onClick={() => setMenu(true)}><Menu /></Button><span className="text-sm font-medium text-muted-foreground">Öğrenci çalışma merkezi</span></div>
        <div className="flex items-center gap-5">
          <span className="hidden items-center gap-1.5 text-sm font-semibold text-[#b06d3f] sm:flex"><Flame size={18} /> 4 günlük seri</span>
          <div className="h-7 w-px bg-border" />
          <a href="/paritmetik" className="flex items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-secondary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1ddc6] font-semibold text-[#875a38]">{displayName.slice(0,1).toLocaleUpperCase('tr')}</span><div className="hidden sm:block"><p className="text-sm font-semibold">{displayName}</p><p className="text-[11px] text-muted-foreground">CZA Çalışma Paneli</p></div></a>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 xl:px-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div><p className="eyebrow mb-2 text-primary">Bugün kendine bir adım daha yaklaş</p><h1 className="text-[27px] font-semibold leading-tight tracking-[-.035em] md:text-[34px]">Merhaba {displayName}, çalışma alanın hazır.</h1><p className="mt-2 text-sm text-muted-foreground">Acele etmeden, doğru teknikle ilerle. Her tamamlanan çalışma güvenli öğrenci kaydına işlenir.</p></div>
          <span className="rounded-lg border border-[#b9daca] bg-[#edf8f2] px-3 py-2 text-xs font-semibold text-[#276151]">Merkezî kayıt etkin</span>
        </div>

        <a href="/studio" className="group mb-7 flex min-h-36 flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-[#77ad9c] bg-[linear-gradient(120deg,#174e46,#237d6c_55%,#315f86)] p-6 text-white shadow-[0_14px_34px_rgba(25,78,70,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(25,78,70,.28)] sm:flex-row sm:items-center md:p-8"><div className="flex items-center gap-5"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><BrainCircuit size={34}/></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#cdebdc]">Bütün çalışmalar tek merkezde</p><h2 className="mt-2 text-2xl font-bold md:text-3xl">Egzersiz Stüdyosunu Aç</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#e1f1eb]">Parmak, Soroban, Toplama–Çıkarma, Flash ve Sesli Anzan çalışmalarını seç; süreni ve seviyeni ayarla.</p></div></div><span className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f4d46c] px-6 font-bold text-[#263d39] shadow-sm transition group-hover:bg-[#ffe58a]">Stüdyoya gir <ArrowRight size={18}/></span></a>

        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <section className="relative overflow-hidden rounded-2xl bg-[#e4eee8] p-6 md:p-8" aria-labelledby="today-title">
            <div className="flex flex-wrap items-center gap-2"><span className="eyebrow rounded-md bg-white/70 px-2.5 py-1.5 text-[#387568]">Soroban temel öğretim</span><span className="text-xs text-[#58796b]">Rehberli öğretim pilotu</span></div>
            <div className="mt-7 grid items-center gap-6 md:grid-cols-[1fr_270px]">
              <div>
                <h2 id="today-title" className="max-w-[380px] text-[29px] font-semibold leading-[1.2] tracking-[-.035em] text-[#21493f]">Sayıları boncuklarla tanı.<br />Bir adım daha ileri.</h2>
                <p className="mt-4 max-w-[350px] text-sm leading-6 text-[#55766b]">Boncukları tanı, basamakları yerleştir. Doğrudan işlemlerden 5 ve 10 tamamlamalarına adım adım ilerle.</p>
                <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-[#44675b]"><span className="flex items-center gap-1.5"><Clock3 size={15} /> Kendi ritminde</span><span className="flex items-center gap-1.5"><Target size={15} /> 8 ders</span><span className="flex items-center gap-1.5"><BookOpenCheck size={15} /> Rehberli öğretim</span></div>
                <a href="/learn" className="mt-7 inline-flex h-11 items-center gap-3 rounded-lg bg-[#226f60] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#195749]">Öğrenme yolunu aç <Play size={15} fill="currentColor" /></a>
              </div>
              <div className="mx-auto w-fit text-center">
                <div className="abacus" role="group" aria-label="Etkileşimli soroban önizlemesi">
                  {digits.map((digit, index) => <button key={index} className="abacus-rod" aria-label={`${index + 1}. basamak ${digit}, bir artır`} onClick={() => setDigits(previous => previous.map((v, i) => i === index ? (v + 1) % 10 : v))}>
                    <span className={`abacus-bead upper ${digit >= 5 ? 'engaged' : ''}`} />
                    {[0, 1, 2, 3].map(bead => <span key={bead} className={`abacus-bead lower ${bead < digit % 5 ? 'engaged' : ''}`} />)}
                  </button>)}
                </div>
                <p className="mt-4 text-xs text-[#58796b]">Boncuklara dokun, sayıyı keşfet <span className="ml-2 font-bold text-[#21493f]">{value}</span></p>
              </div>
            </div>
          </section>

          <Card className="rounded-2xl py-6 ring-border">
            <CardContent className="px-6">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Çalışma rotam</h2><span className="text-xs text-muted-foreground">Kendi hızında</span></div>
              <Progress value={0} aria-label="Çalışma rotası henüz başlamadı" className="mb-6 mt-4" />
              <div className="space-y-5">
                {[{ title: 'Parmak veya soroban çalışması', time: 'Çalışma türünü seç' }, { title: 'Kısa Anzan turu', time: 'Süre ve seviyeni ayarla' }, { title: 'Sonucunu incele', time: 'Doğru, yanlış ve sürelerini gör' }].map((step, index) => <div key={step.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <div><p className="text-xs font-semibold">{step.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{step.time}</p></div>
                </div>)}
              </div>
              <div className="mt-7 rounded-lg bg-[#fbf7ee] p-3 text-[11px] leading-5 text-[#8a734e]">Kişiselleştirilmiş rota ve geçmiş gelişim verileri merkezî aktarım tamamlandığında burada gösterilecek.</div>
            </CardContent>
          </Card>
        </div>

        <section id="learning-path" className="mt-9 scroll-mt-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Beceri atölyelerim</h2><p className="mt-1 text-xs text-muted-foreground">Her atölye, kendi gelişim basamaklarınla ilerler.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map(module => <a href={module.href} key={module.title} className="group relative overflow-hidden rounded-2xl border-2 p-5 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg" style={{ borderColor: `${module.ink}45`, background: `linear-gradient(145deg, #ffffff 35%, ${module.color})` }}>
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: module.ink }} />
              <div className="mb-5 flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm ring-1 ring-white" style={{ background: module.color, color: module.ink }}><module.icon size={25} strokeWidth={2} /></span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm transition-transform group-hover:translate-x-1" style={{ color: module.ink }}><ChevronRight size={18} /></span></div>
              <h3 className="text-base font-bold" style={{ color: module.ink }}>{module.title}</h3><p className="mt-2 min-h-10 text-xs font-medium leading-5 text-[#52606d]">{module.detail}</p>
              <div className="mb-2 mt-5 flex justify-between text-[10px] font-medium"><span style={{ color: module.ink }}>{module.level}</span><span className="text-muted-foreground">{module.progress ? `%${module.progress}` : 'Keşfet'}</span></div>
              <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(module.progress, 4)}%`, background: module.ink }} /></div>
            </a>)}
          </div>
        </section>

        <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_300px]">
          <section id="development" className="scroll-mt-6 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Çaban gelişime dönüşüyor</h2><span className="text-[11px] text-muted-foreground">Kayıtların geldikçe güncellenecek</span></div>
            <p className="mt-6 rounded-xl bg-secondary/40 p-5 text-sm leading-6 text-muted-foreground">Bu bölümde çalışma süren, doğru–yanlış sayın, başarı oranın ve haftalık gelişimin kendi kayıtlarından gösterilecek. Geçmiş Kampüs verilerin de aktarım sonrasında “Geçmiş gelişimim” bölümüne eklenecek.</p>
          </section>
          <section className="rounded-xl border border-[#e7decc] bg-[#faf6ec] p-6"><div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e9dfc8] text-[11px] font-semibold">CZA</span><h2 className="text-sm font-semibold">Eğitimcinden bir not</h2></div><p className="text-xs leading-6 text-[#786b54]">Eğitimcin sana kişisel not bıraktığında burada görünecek.</p><p className="mt-4 text-[10px] text-[#998967]">Henüz kişisel not yok</p></section>
        </div>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[10px] text-muted-foreground"><a href="/" className="font-semibold text-primary">CZA Öğrenci Paneline dön</a><button className="underline underline-offset-2" onClick={() => setNotice('Çalışma sonuçların merkezî öğrenci kaydına işlenir. Geçmiş Kampüs değerlendirmelerin kontrollü aktarım sonrasında burada da görünür.')}>Kayıtlarım hakkında</button></footer>
      </main>
      {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-border bg-white p-5 text-sm shadow-xl"><p className="leading-6">{notice}</p><Button size="icon-xs" variant="ghost" aria-label="Bildirimi kapat" onClick={() => setNotice('')}><X /></Button></div>}
    </div>
  );
}

export default function Home() {
  useEffect(() => { window.location.replace(CAMPUS_V14_URL); }, []);
  return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="text-center"><p className="eyebrow text-primary">ÇELİK ZİHİN AKADEMİSİ</p><h1 className="mt-3 text-2xl font-semibold">CZA Öğrenci Girişi açılıyor…</h1><a className="mt-5 inline-flex font-semibold text-primary" href={CAMPUS_V14_URL}>Açılmazsa öğrenci girişine dokun</a></div></main>;
}
