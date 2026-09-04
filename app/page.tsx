'use client';

import { useState } from 'react';
import { ArrowRight, AudioLines, BookOpenCheck, BrainCircuit, ChartNoAxesCombined, Check, ChevronRight, Clock3, Flame, Hand, LayoutDashboard, Menu, Play, Sparkles, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const modules = [
  { title: 'Parmak tekniği', detail: 'Oku, parmaklarınla göster ve anında geri bildirim al', icon: Hand, color: '#f8eee3', ink: '#a56730', level: 'Learning Core bağlı', progress: 1, href: '/paritmetik' },
  { title: 'Soroban öğretimi', detail: 'Anla, birlikte yap, kendin dene', icon: BrainCircuit, color: '#e8f3ee', ink: '#23796e', level: '8 derslik temel rota', progress: 0, href: '/learn' },
  { title: 'Flash Anzan', detail: 'Zihnindeki abaküsü çalıştır', icon: Sparkles, color: '#eeedf9', ink: '#7765aa', level: 'Seviye 1', progress: 32, href: '/studio?mode=flash' },
  { title: 'Sesli Anzan', detail: 'Dinle, canlandır, hesapla', icon: AudioLines, color: '#eef1f4', ink: '#6c7b8d', level: 'Sıradaki adım', progress: 0, href: '/studio?mode=audio' },
];

export default function Home() {
  const [menu, setMenu] = useState(false);
  const [digits, setDigits] = useState([0, 2, 4]);
  const [notice, setNotice] = useState('');
  const value = digits.reduce((total, digit) => total * 10 + digit, 0);

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
          <a href="/" className="academy-nav active"><LayoutDashboard size={18} /> Çalışma merkezim</a>
          <a href="/studio" className="academy-nav"><BrainCircuit size={18} /> Egzersiz stüdyosu</a>
          <a href="/paritmetik" className="academy-nav"><Hand size={18} /> Paritmetik</a>
          <a href="/learn" className="academy-nav"><BookOpenCheck size={18} /> Öğrenme yolum</a>
          <a href="#development" className="academy-nav" onClick={() => setMenu(false)}><ChartNoAxesCombined size={18} /> Gelişimim</a>
        </nav>
        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="eyebrow mb-3 px-4 text-[#7e91a5]">Eğitimci alanı</p>
          <a href="/educator" className="academy-nav"><Target size={18} /> Kontrol merkezi <ArrowRight size={14} className="ml-auto" /></a>
        </div>
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
          <a href="/paritmetik" className="flex items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-secondary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1ddc6] font-semibold text-[#875a38]">C</span><div className="hidden sm:block"><p className="text-sm font-semibold">CZA öğrenci girişi</p><p className="text-[11px] text-muted-foreground">Learning Core ile devam et</p></div></a>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 xl:px-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div><p className="eyebrow mb-2 text-primary">Bugün kendine bir adım daha yaklaş</p><h1 className="text-[27px] font-semibold leading-tight tracking-[-.035em] md:text-[34px]">Günaydın Elif, odak seansın hazır.</h1><p className="mt-2 text-sm text-muted-foreground">Bugün soroban becerini güçlendiriyoruz. Acele etmeden, doğru teknikle.</p></div>
          <span className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">Örnek çalışma günü</span>
        </div>

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
              <div className="flex items-center justify-between"><h2 className="font-semibold">Bugünkü rotam</h2><span className="text-xs text-muted-foreground">1 / 3</span></div>
              <Progress value={33} aria-label="Günlük rota yüzde 33 tamamlandı" className="mb-6 mt-4" />
              <div className="space-y-5">
                {[{ title: 'Boncuklarla ısınma', time: 'Örnek adım', done: true }, { title: 'Soroban · sayı okuma', time: '5 soruluk pilot', done: false }, { title: 'Kısa Anzan turu', time: 'Ayarlanabilir pilot', done: false }].map((step, index) => <div key={step.title} className="flex gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.done ? 'bg-secondary text-primary' : index === 1 ? 'bg-[#226f60] text-white' : 'border border-border text-muted-foreground'}`}>{step.done ? <Check size={14} /> : index + 1}</span>
                  <div><p className={`text-xs font-semibold ${step.done ? 'text-muted-foreground' : ''}`}>{step.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{step.done ? 'Tamamlandı' : step.time}</p></div>
                </div>)}
              </div>
              <div className="mt-7 rounded-lg bg-[#fbf7ee] p-3 text-[11px] leading-5 text-[#8a734e]">Bu rota bir arayüz örneğidir. Kişiselleştirilmiş atamalar, Kampüs bağlantısından sonra etkinleşecek.</div>
            </CardContent>
          </Card>
        </div>

        <section id="learning-path" className="mt-9 scroll-mt-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Beceri atölyelerim</h2><p className="mt-1 text-xs text-muted-foreground">Her atölye, kendi gelişim basamaklarınla ilerler.</p></div><a href="/studio" className="flex items-center gap-1 text-xs font-semibold text-primary">Stüdyoyu aç <ChevronRight size={14} /></a></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map(module => <a href={module.href} key={module.title} className="group rounded-xl border border-border bg-white p-5 transition-transform hover:-translate-y-1 hover:shadow-md">
              <div className="mb-5 flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: module.color, color: module.ink }}><module.icon size={23} strokeWidth={1.7} /></span><ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" /></div>
              <h3 className="text-[15px] font-semibold">{module.title}</h3><p className="mt-1.5 text-xs text-muted-foreground">{module.detail}</p>
              <div className="mb-2 mt-5 flex justify-between text-[10px] font-medium"><span style={{ color: module.ink }}>{module.level}</span><span className="text-muted-foreground">{module.progress ? `%${module.progress}` : 'Keşfet'}</span></div>
              <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(module.progress, 4)}%`, background: module.ink }} /></div>
            </a>)}
          </div>
        </section>

        <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_300px]">
          <section id="development" className="scroll-mt-6 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Çaban gelişime dönüşüyor</h2><span className="text-[11px] text-muted-foreground">Örnek haftalık görünüm</span></div>
            <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_1fr_1.3fr]">
              <div><p className="text-xs text-muted-foreground">Doğruluk</p><p className="mt-1 text-3xl font-semibold tracking-tight">%92 <span className="text-xs font-medium text-primary">+8 puan</span></p><p className="mt-2 text-[11px] text-muted-foreground">Önceki örnek haftaya göre</p></div>
              <div><p className="text-xs text-muted-foreground">Odaklı çalışma</p><p className="mt-1 text-3xl font-semibold tracking-tight">68 <span className="text-sm font-normal text-muted-foreground">dakika</span></p><p className="mt-2 text-[11px] text-muted-foreground">5 kısa seans tamamlandı</p></div>
              <div className="flex items-end justify-between gap-3" aria-label="Haftalık örnek çalışma süreleri">{[45, 70, 55, 85, 65, 20, 12].map((height, index) => <div key={index} className="flex w-full flex-col items-center gap-2"><div className="flex h-[64px] w-full items-end"><div className={`w-full rounded-t-sm ${index < 5 ? 'bg-[#a9d1bd]' : 'bg-[#edf0ed]'}`} style={{ height: `${height}%` }} /></div><span className="text-[9px] text-muted-foreground">{['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'][index]}</span></div>)}</div>
            </div>
          </section>
          <section className="rounded-xl border border-[#e7decc] bg-[#faf6ec] p-6"><div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e9dfc8] text-[11px] font-semibold">CZA</span><h2 className="text-sm font-semibold">Eğitimcinden bir not</h2></div><p className="text-xs leading-6 text-[#786b54]">“Boncuk hareketlerin daha kararlı. Bu hafta beşe tamamlama adımlarını sesli düşünerek çalışmanı istiyorum.”</p><p className="mt-4 text-[10px] text-[#998967]">Örnek eğitimci geri bildirimi</p></section>
        </div>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[10px] text-muted-foreground"><span>CZA Egzersiz Akademisi · Bağımsız çalışma alanı</span><button className="underline underline-offset-2" onClick={() => setNotice('Bu önizlemede örnek öğrenci ve sonuçlar gösterilir. Kampüs bağlantısı ve güvenli hesap girişi henüz etkin değildir.')}>Bu önizleme hakkında</button></footer>
      </main>
      {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-border bg-white p-5 text-sm shadow-xl"><p className="leading-6">{notice}</p><Button size="icon-xs" variant="ghost" aria-label="Bildirimi kapat" onClick={() => setNotice('')}><X /></Button></div>}
    </div>
  );
}
