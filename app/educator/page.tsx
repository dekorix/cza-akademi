'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardList, Download, Filter, KeyRound, LayoutGrid, Search, SlidersHorizontal, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExerciseSettings } from '@/components/exercise-settings';
import { createQuestion, defaultConfig, modeLabels, score, type ExerciseConfig, type SessionResult } from '@/lib/exercise-engine';
import { readDemoResults, saveDemoProgram } from '@/lib/demo-session';
import { TeachingReports } from '@/components/teaching-reports';
import { CentralStudentReport } from '@/components/central-student-report';
import { EducatorStudents } from '@/components/educator-students';

type Tab = 'students' | 'program' | 'reports' | 'modules' | 'teaching';
const roadmap = [
  ['Soroban okuma','Boncuk örüntüsünü sayıya dönüştürme','Pilot'],
  ['Soroban yazma','Sayıyı etkileşimli abaküste oluşturma','Pilot'],
  ['Flash Anzan','Görsel sıralı işlem, hız ve rakam havuzu','Pilot'],
  ['Sesli Anzan','Sunucuda hazırlanan premium Türkçe seslerle sıralı işlem','Sağlayıcı bekliyor'],
  ['Parmak okuma ve basma','Sağ el, sol el, iki el; doğru hareket modeli','Yöntem onayı'],
  ['Soroban temel öğretim','8 ders; rehberli hareketler, doğrudan ve basit 5–10 tamamlamaları','Pilot'],
  ['Çarpım tablosu ve çarpma','Basamaklı öğretim, hataya göre tekrar','Planlandı'],
  ['Rakam–şekil ilişkisi','Eşleştirme ve geri çağırma çalışmaları','İçerik tasarımı'],
  ['Hafıza çivisi','Yaşa uygun çağrışım ve sıralı hatırlama','İçerik tasarımı'],
  ['Flash / sesli sayı hafızası','İşlem yapmadan sayı dizisini hatırlama','Planlandı'],
  ['Liste hatırlama','Kelime / görsel dizilerini geri çağırma','Planlandı'],
  ['Hızlı okuma ve anlama','Hız ile birlikte anlama doğruluğu','Ayrı faz'],
];

export default function Educator() {
  return <CentralStudentReport><EducatorDashboard /></CentralStudentReport>;
}

function EducatorDashboard() {
  const [tab,setTab] = useState<Tab>('students');
  const [studentCode, setStudentCode] = useState('');
  const [config,setConfig] = useState<ExerciseConfig>({...defaultConfig,mode:'flash',digits:1,interval:0});
  const [programReady,setProgramReady] = useState(false);
  const [message,setMessage] = useState('');
  const [results,setResults] = useState<SessionResult[]>([]);
  const [reportMode,setReportMode] = useState('all');
  const [report,setReport] = useState<SessionResult | null>(null);
  useEffect(()=>{setResults(readDemoResults());if(new URLSearchParams(window.location.search).get('tab')==='teaching')setTab('teaching');},[]);
  const reports = useMemo(()=>results.filter(r=>reportMode === 'all' || r.config.mode === reportMode),[results,reportMode]);
  function prepare() {
    try { createQuestion(config); if (!saveDemoProgram(config)) throw new Error('Tarayıcı yerel kayda izin vermedi.'); setProgramReady(true); setMessage('Deneme programı bu sekme için hazır. Gerçek öğrenciye atama yapılmadı.'); }
    catch(e) { setProgramReady(false);setMessage(e instanceof Error ? e.message : 'Program hazırlanamadı.'); }
  }
  function exportReports() {
    const rows = [['Tarih','Çalışma','Basamak','Terim','Gösterim_sn','Soru','Doğru','Doğruluk_yüzde'],...reports.map(r=>{const s=score(r.attempts);return [r.at,modeLabels[r.config.mode],r.config.digits,r.config.terms,r.config.interval,s.total,s.correct,s.accuracy];})];
    const csv='\uFEFF'+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download='cza-bu-sekme-deneme-sonuclari.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const tabs: {id:Tab;label:string;icon:typeof Users}[] = [{id:'students',label:'Öğrenciler',icon:Users},{id:'teaching',label:'Ders incelemesi',icon:BookOpen},{id:'program',label:'Program stüdyosu',icon:SlidersHorizontal},{id:'reports',label:'Seans raporları',icon:ClipboardList},{id:'modules',label:'Atölye yol haritası',icon:LayoutGrid}];
  return <div className="min-h-screen bg-background">
    <header className="bg-[#182739] px-5 text-white md:px-9"><div className="mx-auto flex h-20 max-w-[1360px] items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d8eeac] text-xs font-black text-[#182739]">CZA</span><div><p className="text-sm font-semibold">Eğitimci kontrol merkezi</p><p className="text-[10px] text-[#9db0c3]">EGZERSİZ AKADEMİSİ</p></div></div><a href="/" className="flex items-center gap-2 text-xs text-[#cfdfec]"><ArrowLeft size={15}/> Öğrenci görünümü</a></div></header>
    <main className="mx-auto max-w-[1432px] px-5 py-8 md:px-9">
      {tab==='reports' && <div className="mb-5"><CentralStudentReport key={studentCode} initialCode={studentCode}/></div>}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2 text-primary">Öğretimin kontrolü sende</p><h1 className="text-3xl font-semibold tracking-tight">Çalışmayı planla. Süreci görünür kıl.</h1><p className="mt-2 text-sm text-muted-foreground">Öğrenci, çalışma reçetesi ve sonuçlar aynı eğitimci akışında.</p></div><span className="rounded-lg border border-[#b9daca] bg-[#edf8f2] px-3 py-2 text-xs font-semibold text-[#276151]">Merkezî öğrenci kaydı</span></div>
      <nav aria-label="Eğitimci bölümleri" className="mb-6 flex gap-2 overflow-x-auto border-b border-border">{tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setMessage('');if(t.id==='reports')setResults(readDemoResults());}} aria-current={tab===t.id?'page':undefined} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 pb-4 pt-2 text-sm font-semibold ${tab===t.id?'border-primary text-primary':'border-transparent text-muted-foreground hover:text-foreground'}`}><t.icon size={17}/>{t.label}</button>)}</nav>

      {tab==='students' && <EducatorStudents onReport={code => { setStudentCode(code); setTab('reports'); }} />}

      {tab==='program' && <div className="grid gap-6 lg:grid-cols-[380px_1fr]"><section className="rounded-xl border border-border bg-white p-6"><h2 className="mb-2 text-lg font-semibold">Deneme çalışma reçetesi</h2><p className="mb-6 text-xs leading-5 text-muted-foreground">Ayarları belirle ve öğrenci deneyimini bu sekmede dene.</p><ExerciseSettings config={config} onChange={c=>{setConfig(c);setProgramReady(false);setMessage('');}}/><Button className="mt-6 h-11 w-full" onClick={prepare}><CheckCircle2/> Deneme programını hazırla</Button></section><section className="space-y-5"><div className="rounded-xl border border-border bg-white p-7"><p className="eyebrow text-primary">Reçete önizlemesi</p><h2 className="mt-3 text-2xl font-semibold">{modeLabels[config.mode]}</h2><div className="my-6 grid grid-cols-2 gap-6 sm:grid-cols-4">{[['Basamak',String(config.digits)],['Soru',String(config.rounds)],['Terim',config.mode.startsWith('soroban')?'Uygulanmaz':String(config.terms)],['Süre',config.interval===0?'Adımlı':`${config.interval.toFixed(1)} sn`]].map(([label,value])=><div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}</div><div className="rounded-lg bg-secondary/50 p-4"><h3 className="text-sm font-semibold text-primary">Geri bildirim politikası</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Doğru cevaplar seans sonunda gösterilir. Soruların ham yanıtları, süreleri ve çalışma ayarları birlikte raporlanır.</p></div>{message&&<p role="status" className="mt-5 text-sm leading-6">{message}</p>}{programReady&&<a href="/studio?program=demo" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white">Öğrenci olarak dene <ArrowRight size={16}/></a>}</div><div className="rounded-xl border border-[#dfd5bd] bg-[#fbf7ee] p-6"><h3 className="font-semibold text-[#806942]">Gerçek atamadan önce tamamlanacaklar</h3><ul className="mt-4 space-y-3 text-xs leading-5 text-[#887553]"><li>• CZA Kampüs ile güvenli öğrenci ve eğitimci kimliği eşleştirmesi</li><li>• Öğrenci / grup seçimi, tarih ve erişim süresi</li><li>• Sunucuda kalıcı kayıt, yetki kontrolü ve işlem günlüğü</li><li>• Eğitimci onaylı içerik, teknik basamaklar ve seviye geçiş kuralları</li></ul></div></section></div>}

      {tab==='reports' && <section className="space-y-5"><div className="rounded-xl border border-border bg-white p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Bu cihazdaki kısa süreli rapor yedeği</h2><p className="mt-1 text-xs text-muted-foreground">Aşağıdaki kayıtlar bu cihazda tamamlanan seansların yedeğidir. Asıl öğrenci kayıtları yukarıdaki güvenli merkezi raporda tutulur.</p></div><Button variant="outline" className="h-10" onClick={exportReports} disabled={!reports.length}><Download/> CSV indir</Button></div><Select value={reportMode} onValueChange={v=>{setReportMode(v||'all');setReport(null);}}><SelectTrigger className="mb-5 h-10 min-w-[200px]" aria-label="Çalışma filtresi"><SelectValue>{reportMode==='all'?'Tüm çalışma türleri':modeLabels[reportMode as keyof typeof modeLabels]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Tüm çalışma türleri</SelectItem>{Object.entries(modeLabels).map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select>{reports.length?<Table><TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Çalışma</TableHead><TableHead>Ayarlar</TableHead><TableHead>Doğru / soru</TableHead><TableHead>Doğruluk</TableHead><TableHead>Detay</TableHead></TableRow></TableHeader><TableBody>{reports.map(r=>{const s=score(r.attempts);return <TableRow key={r.id}><TableCell className="text-xs">{new Date(r.at).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</TableCell><TableCell>{modeLabels[r.config.mode]}</TableCell><TableCell className="text-xs">{r.config.digits} basamak · {r.config.interval===0?'Adımlı':`${r.config.interval} sn`}</TableCell><TableCell>{s.correct} / {s.total}</TableCell><TableCell className="font-semibold text-primary">%{s.accuracy}</TableCell><TableCell><Button size="sm" variant="ghost" onClick={()=>setReport(r)}>İncele <ArrowRight/></Button></TableCell></TableRow>})}</TableBody></Table>:<div className="py-14 text-center"><ClipboardList size={38} className="mx-auto mb-4 text-[#9fb5ab]"/><h3 className="font-semibold">Henüz tamamlanmış deneme yok.</h3><p className="mt-2 text-sm text-muted-foreground">Bir seansı bitirdiğinde soru bazındaki sonuçlar burada görünecek.</p><a href="/studio" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">İlk seansı dene <ArrowRight size={15}/></a></div>}</div>{report&&<div className="rounded-xl border border-border bg-white p-6"><h3 className="mb-4 font-semibold">Soru bazında kayıt · {modeLabels[report.config.mode]}</h3><Table><TableHeader><TableRow><TableHead>Soru</TableHead><TableHead>İşlem / sayı</TableHead><TableHead>Yanıt</TableHead><TableHead>Beklenen</TableHead><TableHead>Yanıt süresi</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader><TableBody>{report.attempts.map((a,i)=><TableRow key={i}><TableCell>{i+1}</TableCell><TableCell className="font-mono">{a.sequence.map((n,j)=>`${j&&n>0?'+':''}${n}`).join(' ')}</TableCell><TableCell>{a.given}</TableCell><TableCell>{a.expected}</TableCell><TableCell>{(a.elapsedMs/1000).toFixed(1)} sn</TableCell><TableCell className={a.correct?'text-primary':'text-[#ac793d]'}>{a.correct?'Doğru':'Tekrar gerekli'}</TableCell></TableRow>)}</TableBody></Table></div>}</section>}

      {tab==='modules' && <section className="grid items-start gap-6 xl:grid-cols-[1fr_320px]"><div className="rounded-xl border border-border bg-white p-6"><h2 className="text-lg font-semibold">Referanslardan ürün planına</h2><p className="mb-6 mt-2 text-xs leading-6 text-muted-foreground">Örneklerdeki işlev grupları ayrı motorlar olarak ele alınıyor. “Pilot” dışındaki alanlar henüz çalışır ürün değildir.</p><div className="divide-y divide-border">{roadmap.map(([title,desc,status])=><div key={title} className="flex items-start justify-between gap-4 py-4"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{desc}</p></div><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${status==='Pilot'?'bg-secondary text-primary':'bg-muted text-muted-foreground'}`}>{status}</span></div>)}</div></div><aside className="space-y-5"><div className="rounded-xl bg-[#e4eee8] p-6"><BookOpen className="mb-4 text-primary" size={26}/><h3 className="text-lg font-semibold text-[#254d41]">Tek çatı, ayrı motorlar.</h3><p className="mt-3 text-sm leading-7 text-[#597869]">Kampüs öğrenciyi, raporu ve eğitimciyi yönetir. Egzersiz Akademisi yoğun çalışma deneyimini sunar. Sonuçlar güvenli bağlantıyla Kampüs’e dönecek.</p></div><div className="rounded-xl border border-border bg-white p-6"><h3 className="font-semibold">14 beceri ile ilişki</h3><p className="mt-3 text-xs leading-6 text-muted-foreground">Bu atölye listesi, CZA’nın 14 değerlendirme becerisiyle aynı liste değildir. Her egzersizin hangi beceriyi, hangi sınırlar içinde desteklediği eğitimci onayıyla ayrıca eşleştirilecek.</p></div></aside></section>}
      {tab==='teaching' && <TeachingReports/>}
      <footer className="mt-9 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[11px] leading-5 text-muted-foreground"><span>Merkezî öğrenci kaydı ve çalışma raporları etkin.</span><span>Program atama, Kampüs geçmiş aktarımı ve veli erişimi geliştirme sırasında.</span></footer>
    </main>
  </div>;
}
