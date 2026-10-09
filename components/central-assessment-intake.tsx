'use client';

import { useEffect, useMemo, useState } from 'react';
import { Baby, Brain, CalendarDays, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  INTAKE_PROFILE_CODES,
  resolveAssessmentBridge,
  type AssessmentPurpose,
} from '@/lib/assessment-bridge';

type Student={id:string;name:string;code:string|null;username:string|null};
type P2CreatedPayload={
  session:any;
  student?:{id:string;name?:string;code?:string|null;username?:string|null};
  tasks?:any[];
};

const PROFILE_LABELS:Record<string,string>={
  E0:'0–12 ay · Erken Gelişim',E1:'12–24 ay · Erken Gelişim',E2:'24–36 ay · Erken Gelişim',
  E3:'36–48 ay · Erken Gelişim',E4:'48–60 ay · Erken Gelişim',E5:'60–72 ay · Okula Hazırlık',
  P1:'1. Sınıf',P2:'1. sınıf sonu / 2. sınıf başlangıcı',P3:'3. Sınıf',P4:'4. Sınıf',
  P5:'5. Sınıf',P6:'6. Sınıf',P7:'7. Sınıf · LGS Ön Hazırlık',P8:'8. Sınıf · LGS',
  P9:'9–10. Sınıf · Lise Öğrenme Sistemi',P10:'11–12 / Mezun · YKS-TYT',
};

const PROFILE_ICONS:Record<string,string>={
  E0:'🍼',E1:'🐣',E2:'🐰',E3:'🐥',E4:'🦊',E5:'🦁',
  P1:'✏️',P2:'🌟',P3:'📘',P4:'🧭',P5:'🧠',P6:'🔎',P7:'🎯',P8:'🏆',P9:'🚀',P10:'🎓',
};

const PURPOSES:Array<[AssessmentPurpose,string]>=[
  ['GENERAL','Genel Bütüncül Değerlendirme'],
  ['LANGUAGE','Dil ve İletişim'],
  ['SCHOOL_READINESS','Okula Hazırlık'],
  ['ACADEMIC','Akademik Değerlendirme'],
  ['COGNITIVE','Bilişsel Profil'],
  ['LGS','LGS Hazırlık ve Koçluk'],
  ['YKS','YKS / TYT Performans ve Koçluk'],
  ['REASSESSMENT','Yeniden Ölçüm'],
];

const SPECIAL=[
  ['SP-DYS','Disleksi / Okuma Güçlüğü','Okuma sisteminde ses, harf, hece, akıcılık, bellek ve transfer örüntülerini ayırır.','Aa'],
  ['SP-SLD','Özgül Öğrenme Güçlüğü','Okuma, yazma ve matematikte ortak ve ayrışan öğrenme örüntülerini tarar.','◇'],
  ['SP-DYSC','Diskalkuli / Matematik','Sayı hissi, sembol-nicelik, basamak, işlem ve matematik stratejilerini inceler.','±'],
  ['SP-DYSG','Disgrafi / Yazma','Grafomotor, dikte, harf biçimi, yazılı kodlama ve yazılı ifade süreçlerini ayırır.','✎'],
  ['SP-ASD','Otizm Spektrumu Eğitsel Profili','Ortak dikkat, iletişim, taklit, oyun, esneklik ve öğrenme tepkisini eğitimsel olarak gözlemler.','◎'],
  ['SP-LANG','Dil ve Konuşma Gelişimi','Alıcı ve ifade edici dil, sözcük erişimi, anlatı ve yönerge takibini inceler.','◌'],
  ['SP-ATTN','Dikkat / Yürütücü İşlevler','Seçici dikkat, dürtü kontrolü, çalışma belleği, planlama ve kural sürdürmeyi tarar.','⌁'],
  ['SP-DELAY','Gelişimsel Gecikme Profili','Gelişim alanları arasındaki güçlü ve destek gerektiren örüntüleri eğitimsel olarak haritalar.','↗'],
  ['SP-COG','Bilişsel / Öğrenme Hızı','Yeni öğrenme, strateji değiştirme, bellek, işlem hızı ve transferi birlikte inceler.','◉'],
  ['SP-MIX','Karma Profil','Birden fazla alandaki belirtileri tek etikete zorlamadan adaptif olarak ayrıştırır.','✦'],
] as const;

async function postJson(url:string,body:Record<string,unknown>){
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok||data.ok===false) throw new Error(String(data.error||'assessment_unavailable'));
  return data;
}

function friendlyError(code:string){
  if(code==='educator_session_required') return 'Eğitimci oturumu gerekli. Eğitimci merkezinden yeniden giriş yap.';
  if(code==='student_not_linked_to_educator') return 'Bu öğrenci merkezi eğitimci hesabına bağlı değil.';
  if(code==='birth_date_required') return 'Bu profil için doğum tarihi gerekli.';
  if(code==='e3_age_out_of_range') return '36–48 ay E3 profili yalnız 36–47 tamamlanmış ay için açılır.';
  return code;
}

export function CentralAssessmentIntake({onP2Created}:{onP2Created:(payload:P2CreatedPayload)=>void}){
  const [students,setStudents]=useState<Student[]>([]);
  const [studentId,setStudentId]=useState('');
  const [profileCode,setProfileCode]=useState('');
  const [purpose,setPurpose]=useState<AssessmentPurpose>('GENERAL');
  const [birthDate,setBirthDate]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get('profile');
    if(requested && resolveAssessmentBridge(requested, 'GENERAL')) setProfileCode(requested);
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/educator-students?page=0',{signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok||data.ok!==true||!Array.isArray(data.students)) throw new Error(data.error||'student_list_unavailable');
        if(!controller.signal.aborted) setStudents(data.students);
      })
      .catch(error=>{if(!controller.signal.aborted)setMessage(friendlyError(error instanceof Error?error.message:'Öğrenci listesi alınamadı.'));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[]);

  const target=useMemo(()=>profileCode?resolveAssessmentBridge(profileCode,purpose):null,[profileCode,purpose]);
  const selectedStudent=students.find(student=>student.id===studentId)||null;

  function chooseProfile(code:string){
    setProfileCode(code);
    setMessage('');
    const resolved=resolveAssessmentBridge(code,purpose);
    if(resolved&&!resolved.allowedPurposes.includes(purpose)){
      setPurpose(resolved.allowedPurposes[0]||'GENERAL');
    }
  }

  async function start(){
    if(!studentId||!profileCode||busy) return;
    setBusy(true);setMessage('');
    try{
      const context=await postJson('/api/educator-assessment-context',{
        studentId,profileCode,purpose,
      });
      const resolved=context.target as ReturnType<typeof resolveAssessmentBridge>;
      if(!resolved||context.canStartCentralAssessment!==true||!resolved.centralRoute){
        setMessage(resolved?.reason||'Bu profil merkezi CZA değerlendirme hattına henüz açılmadı.');
        return;
      }

      const finalBirth=(birthDate||context.student?.birthDate||'').trim();
      if(resolved.requiresBirthDate&&!finalBirth){
        setMessage('Bu yaş profili için doğum tarihi gerekli.');
        return;
      }

      if(profileCode==='P2'){
        const data=await postJson('/api/assessment-linked',{studentId});
        onP2Created(data);
        return;
      }

      if(profileCode==='E2'){
        const data=await postJson('/api/assessment-e2-linked',{
          studentId,birthDate:finalBirth,assessmentPurpose:purpose,
        });
        window.location.href='/assessment/e2?session='+encodeURIComponent(String(data.session.id));
        return;
      }

      if(profileCode==='E3'){
        const data=await postJson('/api/assessment-e3-linked',{
          studentId,birthDate:finalBirth,assessmentPurpose:purpose,
        });
        window.location.href='/assessment/e3?session='+encodeURIComponent(String(data.session.id));
        return;
      }

      if(profileCode.startsWith('SP-')){
        const query=new URLSearchParams({studentId,profile:profileCode});
        window.location.href='/cza-degerlendirme/?'+query.toString();
        return;
      }

      setMessage(resolved.reason);
    }catch(error){
      setMessage(friendlyError(error instanceof Error?error.message:'Değerlendirme başlatılamadı.'));
    }finally{setBusy(false);}
  }

  const ready=Boolean(studentId&&profileCode&&target?.status==='CENTRAL_READY');

  return <section className="space-y-6">
    <div className="overflow-hidden rounded-[2rem] border border-[#d7e5df] bg-white shadow-sm">
      <div className="grid gap-6 bg-[radial-gradient(circle_at_top_right,#edf7f2,transparent_38%),linear-gradient(135deg,#f9fcfb,#f2f8f5)] p-7 md:grid-cols-[1fr_auto] md:p-10">
        <div>
          <span className="text-xs font-black uppercase tracking-[.16em] text-[#4f7b6d]">CZA · TEK BAŞLANGIÇ DEĞERLENDİRMESİ MERKEZİ</span>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">Tüm başlangıç değerlendirmeleri tek yerde.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Merkezi öğrenciyi seç; Erken Gelişim, Okul Çağı veya Özel Eğitim ve Öğrenme Profili seçeneklerinden doğru değerlendirme hattına geç.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full bg-white px-3 py-1.5 text-[#276151] shadow-sm">6 Erken Gelişim profili</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[#4f617b] shadow-sm">10 Okul Çağı profili</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[#66599f] shadow-sm">10 Özel Eğitim profili</span>
          </div>
        </div>
        <div className="grid h-28 w-28 place-items-center rounded-[2rem] bg-[#18372f] text-white"><Brain size={45}/></div>
      </div>

      <div className="p-6 md:p-8">
        <div className="flex items-center gap-3"><Sparkles className="text-[#4f7b6d]"/><div><b>1 · Merkezi öğrenci</b><p className="text-xs text-muted-foreground">Serbest isim değil, tek CZA Student ID kullanılır.</p></div></div>
        <select value={studentId} onChange={event=>{setStudentId(event.target.value);setMessage('');}} disabled={loading}
          className="mt-4 min-h-12 w-full rounded-xl border border-[#d4e1dc] bg-white px-4 text-sm outline-none focus:ring-4 focus:ring-[#dcefe6]">
          <option value="">{loading?'Öğrenciler yükleniyor…':'Merkezi öğrenciyi seç'}</option>
          {students.map(student=><option key={student.id} value={student.id}>{student.name}{student.code?' · '+student.code:''}</option>)}
        </select>
        {selectedStudent&&<p className="mt-2 text-[11px] text-muted-foreground">Student ID: {selectedStudent.id}</p>}

        <div className="mt-8 flex items-center gap-3"><GraduationCap className="text-[#4f7b6d]"/><div><b>2 · Değerlendirme alanını seç</b><p className="text-xs text-muted-foreground">Bütün profiller bu tek sayfada görünür. Hazır olmayan profiller yanlış soru açmamak için kilitli kalır.</p></div></div>

        <div className="mt-5 rounded-3xl border border-[#d8e5df] bg-[#f8fcfa] p-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#4f7b6d]">ERKEN GELİŞİM</p><h3 className="mt-1 text-lg font-semibold">0–72 ay gelişim profilleri</h3></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTAKE_PROFILE_CODES.filter(code=>code.startsWith('E')).map(code=>{
            const item=resolveAssessmentBridge(code,purpose);
            const live=item?.status==='CENTRAL_READY';
            return <button key={code} type="button" onClick={()=>chooseProfile(code)} className={'rounded-2xl border p-4 text-left transition '+(profileCode===code?'border-[#4f8f78] bg-[#edf8f2] shadow-sm':live?'border-[#d8e5df] bg-white hover:border-[#94bca9]':'border-[#e5e8e6] bg-[#fafbfa] opacity-65')}>
              <div className="text-2xl">{PROFILE_ICONS[code]}</div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[#73847e]">{code.startsWith('E')?'Erken Gelişim':'Okul Çağı'}</p>
              <b className="mt-1 block text-sm leading-5">{PROFILE_LABELS[code]}</b>
              <span className={'mt-3 inline-flex rounded-full px-2 py-1 text-[9px] font-black '+(live?'bg-[#e5f5ec] text-[#276151]':item?.status==='SOURCE_REFERENCE_ONLY'?'bg-[#fff4dd] text-[#84651f]':'bg-[#f0f2f1] text-[#7c8581]')}>{live?'MERKEZİ HAZIR':item?.status==='SOURCE_REFERENCE_ONLY'?'KAYNAK HAZIR':'HAZIRLANIYOR'}</span>
            </button>;
          })}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[#dce2ec] bg-[#fafcff] p-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#4f617b]">OKUL ÇAĞI</p><h3 className="mt-1 text-lg font-semibold">1. sınıftan YKS/TYT düzeyine</h3></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTAKE_PROFILE_CODES.filter(code=>code.startsWith('P')).map(code=>{
            const item=resolveAssessmentBridge(code,purpose);
            const live=item?.status==='CENTRAL_READY';
            return <button key={code} type="button" onClick={()=>chooseProfile(code)} className={'rounded-2xl border p-4 text-left transition '+(profileCode===code?'border-[#64748b] bg-white shadow-sm':live?'border-[#d8e0ea] bg-white hover:border-[#9badc3]':'border-[#e5e8ec] bg-white/70 opacity-70')}>
              <div className="text-2xl">{PROFILE_ICONS[code]}</div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[#73847e]">Okul Çağı</p>
              <b className="mt-1 block text-sm leading-5">{PROFILE_LABELS[code]}</b>
              <span className={'mt-3 inline-flex rounded-full px-2 py-1 text-[9px] font-black '+(live?'bg-[#e5f5ec] text-[#276151]':item?.status==='SOURCE_REFERENCE_ONLY'?'bg-[#fff4dd] text-[#84651f]':'bg-[#f0f2f1] text-[#7c8581]')}>{live?'MERKEZİ HAZIR':item?.status==='SOURCE_REFERENCE_ONLY'?'TAM KAYNAK HAZIR · BAĞLANTI SÜRÜYOR':'HAZIRLANIYOR'}</span>
            </button>;
          })}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[#d8d8ec] bg-[#faf9ff] p-5 md:p-6">
          <div className="flex items-start gap-3"><Brain className="mt-1 text-[#6c61a6]"/><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#786daf]">ÖZEL EĞİTİM VE ÖĞRENME PROFİLİ</p><h3 className="mt-1 text-xl font-semibold">Belirtiyi etikete değil, öğrenme mekanizmasına ayır</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Bu alan klinik tanı koymaz. Eğitimsel tarama, hata örüntüsü, destek ihtiyacı ve öğrenme tepkisi üretir.</p></div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SPECIAL.map(([code,title,description,icon])=><button key={code} type="button" onClick={()=>{chooseProfile(code);setPurpose('GENERAL');}} className={'rounded-2xl border p-4 text-left transition '+(profileCode===code?'border-[#7569b0] bg-white shadow-sm':'border-[#e3e0f1] bg-white/80 hover:border-[#aaa1d2]')}>
              <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efedf8] font-black text-[#66599f]">{icon}</span><div><b className="text-sm">{title}</b><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p><span className="mt-2 inline-flex rounded-full bg-[#e8f5ee] px-2 py-1 text-[9px] font-black text-[#276151]">TAM PROFİL AKTİF</span></div></div>
            </button>)}
          </div>
        </div>

        {target?.requiresBirthDate&&<div className="mt-7"><label className="text-sm font-semibold"><CalendarDays className="mr-2 inline" size={17}/>Doğum tarihi</label><input type="date" value={birthDate} onChange={event=>setBirthDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#d4e1dc] bg-white px-4 text-sm"/></div>}

        <div className="mt-7"><label className="text-sm font-semibold">3 · Değerlendirme amacı</label><select value={purpose} onChange={event=>setPurpose(event.target.value as AssessmentPurpose)} className="mt-2 min-h-11 w-full rounded-xl border border-[#d4e1dc] bg-white px-4 text-sm">{PURPOSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>

        {target&&<div className={'mt-5 flex gap-3 rounded-xl border p-4 '+(target.status==='CENTRAL_READY'?'border-[#cce2d6] bg-[#f1f8f4]':'border-[#eadfbf] bg-[#fffaf0]')}><ShieldCheck className={target.status==='CENTRAL_READY'?'text-[#276151]':'text-[#856f32]'}/><div><b>{target.status==='CENTRAL_READY'?'Merkezi CZA hattı hazır.':target.status==='SOURCE_REFERENCE_ONLY'?'Tam P2 değerlendirme motoru hazır.':'Bu profil güvenli biçimde kilitli.'}</b><p className="mt-1 text-xs leading-5 text-muted-foreground">{target.reason}</p></div></div>}
        {message&&<p role="status" className="mt-4 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#825b2d]">{message}</p>}
        {profileCode==='P2'&&target?.status==='SOURCE_REFERENCE_ONLY'&&
          <Button type="button" onClick={()=>{window.location.href='/assessment/p2';}} className="mt-6 min-h-12 w-full bg-[#856f32] text-base hover:bg-[#6f5c29]">
            P2 tam değerlendirme durumunu aç →
          </Button>}
        <Button onClick={()=>void start()} disabled={!ready||busy} className="mt-3 min-h-12 w-full bg-[#226f60] text-base hover:bg-[#195749]">{busy?'Merkezi bağlantı kuruluyor…':'Değerlendirme planını aç →'}</Button>
      </div>
    </div>
  </section>;
}
