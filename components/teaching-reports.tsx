'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpenCheck, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { lessons, lessonSummary, placeName, type LessonRecord } from '@/lib/soroban-curriculum';
import { readLessonRecords } from '@/lib/lesson-session';

export function TeachingReports() {
  const [records,setRecords] = useState<LessonRecord[]>([]);
  const [filter,setFilter] = useState('all');
  const [selected,setSelected] = useState<LessonRecord|null>(null);
  const [question,setQuestion] = useState(0);
  useEffect(()=>setRecords(readLessonRecords()),[]);
  const visible = records.filter(r=>filter==='all'||r.lessonId===filter);
  const lesson = selected ? lessons.find(l=>l.id===selected.lessonId) : undefined;
  const answer = selected?.answers[question];
  const task = lesson?.practice[question];
  function download() {
    const rows = [['Ortam','Tarih','Ders','Soru','Gorev','Beklenen','Yanit','Dogru','Ipucu','Ornek_yolla_eslesen','Hareket_sayisi','Sayi_yolu'],
      ...visible.flatMap(r=>{const l=lessons.find(item=>item.id===r.lessonId)!;return r.answers.map((a,i)=>['Sekme-yerel deneme',r.at,l.title,i+1,l.practice[i].prompt,l.practice[i].target,a.given,a.correct?'Evet':'Hayir',a.hintUsed?'Evet':'Hayir',a.routeMatch?'Evet':'Hayir',a.moves.length,[l.practice[i].start,...a.moves.map(m=>m.after)].join(' > ')]);})];
    const csv='\uFEFF'+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download='cza-soroban-ogretim-denemeleri.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="space-y-5">
    <div className="rounded-xl border border-border bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-primary">Öğretim ile ölçmeyi ayır</p><h2 className="mt-2 text-xl font-semibold">Soroban ders incelemesi</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">Bu sekmede tamamlanan derslerin gerçek deneme kayıtları. Örnek öğrencilere atanmaz; Kampüs’e gönderilmez. En son 40 çalışma tutulur.</p></div><Link href="/learn" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-semibold text-white"><BookOpenCheck size={16}/> 8 derslik öğretimi aç</Link></div>
      <div className="my-6 flex flex-wrap gap-3"><Select value={filter} onValueChange={v=>{setFilter(v||'all');setSelected(null);}}><SelectTrigger aria-label="Ders filtresi" className="h-10 min-w-[210px]"><SelectValue>{filter==='all'?'Bütün dersler':lessons.find(l=>l.id===filter)?.title}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Bütün dersler</SelectItem>{lessons.map(l=><SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="h-10" onClick={()=>{setRecords(readLessonRecords());setSelected(null);}}><RefreshCw/> Yenile</Button><Button variant="outline" className="h-10 sm:ml-auto" disabled={!visible.length} onClick={download}><Download/> Soru bazında indir</Button></div>
      {visible.length?<Table><TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Ders</TableHead><TableHead>Doğru</TableHead><TableHead>İpucusuz doğru</TableHead><TableHead>Örnek yol eşleşmesi</TableHead><TableHead>İncele</TableHead></TableRow></TableHeader><TableBody>{visible.map(r=>{const s=lessonSummary(r);return <TableRow key={r.id}><TableCell className="text-xs">{new Date(r.at).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</TableCell><TableCell>{lessons.find(l=>l.id===r.lessonId)?.title}</TableCell><TableCell>{s.correct}/{s.total}</TableCell><TableCell>{s.withoutHint}/{s.total}</TableCell><TableCell>{s.matchingRoutes}/{s.total}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={()=>{setSelected(r);setQuestion(0);}} aria-label={`${lessons.find(l=>l.id===r.lessonId)?.title} kaydını incele`}>Hareketler <ArrowRight/></Button></TableCell></TableRow>;})}</TableBody></Table>:<div className="rounded-xl bg-[#f7f5ef] px-6 py-12 text-center"><BookOpenCheck size={32} className="mx-auto text-primary"/><h3 className="mt-4 font-semibold">Henüz tamamlanmış ders kaydı yok.</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">Öğrenme yolunda rehberli örnekleri ve beş denemeyi bitir. Son özet ekranını açınca kayıt buraya gelir.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">Aynı sekmeyi kullan; başka cihaz veya oturumdaki kayıtlar burada görünmez.</p></div>}
    </div>
    {selected&&lesson&&answer&&task&&<div className="rounded-xl border border-border bg-white p-6"><h3 className="text-lg font-semibold">{lesson.title} · Ham hareket kaydı</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Rehberli örneklerde {selected.guidedCorrections} düzeltme yönlendirmesi gösterildi. Aşağıdaki hareketler bağımsız denemelere aittir.</p><div className="my-5 flex flex-wrap gap-2">{selected.answers.map((a,i)=><Button key={a.taskId} className="h-10" variant={question===i?'default':'outline'} onClick={()=>setQuestion(i)} aria-pressed={question===i}>{i+1}. soru</Button>)}</div><div className="mb-5 rounded-xl bg-secondary/50 p-5"><p className="font-semibold">{task.prompt} · Yanıt {answer.given} · Beklenen {task.target}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{answer.correct?'Sonuç doğru':'Sonuç tekrar gerektiriyor'} · {answer.hintUsed?'İpucu kullanıldı':'İpucu kullanılmadı'} · {answer.routeMatch?'Örnek yolla eşleşti':'Örnek yolla eşleşmedi; tek başına teknik hata anlamına gelmez'}</p></div>
      <Table><TableHeader><TableRow><TableHead>Adım</TableHead><TableHead>Basamak</TableHead><TableHead>Boncuk</TableHead><TableHead>Önce</TableHead><TableHead>Sonra</TableHead><TableHead>Değişim</TableHead></TableRow></TableHeader><TableBody>{answer.moves.map((m,i)=><TableRow key={i}><TableCell>{i+1}</TableCell><TableCell>{placeName(m.place)}</TableCell><TableCell>{m.deck==='upper'?'Üst boncuk':`${m.bead+1}. alt boncuk`}</TableCell><TableCell>{m.before}</TableCell><TableCell>{m.after}</TableCell><TableCell>{m.after-m.before>0?'+':''}{m.after-m.before}</TableCell></TableRow>)}</TableBody></Table>{!answer.moves.length&&<p className="py-4 text-sm text-muted-foreground">Boncuk hareketi yapılmadan yanıt gönderildi.</p>}
      <p className="mt-5 text-xs leading-6 text-muted-foreground">Örnek sayı yolu: {[task.start,...task.steps.map(s=>s.after)].join(' → ')}</p>
    </div>}
    <div className="rounded-xl border border-[#e7decc] bg-[#fbf7ee] p-6"><h3 className="font-semibold text-[#715b3d]">Eğitimci kararını gerektirenler</h3><p className="mt-3 text-sm leading-7 text-[#887553]">Fiziksel parmak kullanımı, duruş, yöntemi açıklayabilme ve farklı günlerde tutarlılık bu sayılardan çıkarılamaz. Ders tamamlanması, otomatik seviye veya 14 beceri puanı üretmez. Yaşa göre içerik ve sonraki ders geçişi eğitimci tarafından onaylanmalıdır.</p></div>
  </section>;
}
