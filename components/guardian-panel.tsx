'use client';

import { useEffect,useMemo,useState } from 'react';
import { BookOpenCheck,CalendarDays,ClipboardList,GraduationCap,Loader2,LogOut,Target,UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

type GuardianStudent={id:string;name:string;campusCode:string};
type Assignment={id:string;title:string;instructions:string|null;taskKind:string;subject:string|null;topic:string|null;status:string;startsAt:string|null;expiresAt:string|null};
type Activity={id:string;title:string;status:string;startedAt:string|null;completedAt:string|null};
type ModuleSummary={moduleCode:string;assignmentCount:number|null;sessionCount:number|null;attemptCount:number|null;clientReportedAccuracy:number|null;provenance:string};
type Dashboard={
  student:{id:string;name:string};
  summary:{activeAssignments:number;completedAssignments:number;completedSessions:number;lastStudyAt:string|null;evidenceStatus:string};
  assignments:Assignment[];
  recentActivity:Activity[];
  report:{summary:{clientPerformance?:{attempts:number;accuracy:number|null;evidenceStatus:string;provenance:string}|null};modules:ModuleSummary[];errors:Array<{errorType:string;count:number;provenance:string}>};
  profile:null|{coverage:{assignments:number;sessions:number;attempts:number;records:number;evidence:number};studyPattern:{sessions:{activeDaysLast30:number;lastStudyAt:string|null}};skills:Array<{skillCode:string;recordCount:number;provenance:string}>;process:{insufficiencyReason:string|null}};
  coaching:{programs:Array<{id:unknown;programType:string|null;examYear:number;status:string|null}>;goals:Array<{id:unknown;target:unknown;provenance:string|null}>;exams:Array<{id:unknown;stage:string|null;examDate:string|null;totalNet:number|null;provenance:string|null}>;meetings:Array<{id:unknown;sharedSummary:string|null;nextWeekFocus:string|null}>};
};

function date(value:string|null){if(!value)return 'Kayıt yok';const parsed=new Date(value);return Number.isNaN(parsed.valueOf())?'Kayıt yok':parsed.toLocaleDateString('tr-TR');}
function labelStatus(value:string){return ({available:'Hazır',in_progress:'Devam ediyor',upcoming:'Yaklaşan',completed:'Tamamlandı',cancelled:'İptal',expired:'Süresi doldu'} as Record<string,string>)[value]||value;}
function targetText(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Hedef bilgisi paylaşılmadı';
  const row=value as Record<string,unknown>;
  for(const key of ['school','department','university','statement'])if(typeof row[key]==='string'&&row[key].trim())return row[key] as string;
  return 'Hedef bilgisi paylaşılmadı';
}

export function GuardianPanel(){
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [guardianName,setGuardianName]=useState('Veli');
  const [students,setStudents]=useState<GuardianStudent[]>([]);
  const [studentId,setStudentId]=useState('');
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const selected=useMemo(()=>students.find(student=>student.id===studentId)||null,[students,studentId]);
  const summaryCards=dashboard?[{Icon:ClipboardList,title:'Aktif görev',value:dashboard.summary.activeAssignments},{Icon:BookOpenCheck,title:'Tamamlanan çalışma',value:dashboard.summary.completedAssignments},{Icon:CalendarDays,title:'Tamamlanan oturum',value:dashboard.summary.completedSessions},{Icon:UserRound,title:'Son çalışma',value:date(dashboard.summary.lastStudyAt)}]:[];

  async function loadStudents(){
    const response=await fetch('/api/guardian/students',{cache:'no-store'});
    const body=await response.json() as {ok?:boolean;students?:GuardianStudent[];error?:string};
    if(!response.ok||body.ok!==true)throw new Error(body.error||'guardian_students_unavailable');
    const list=body.students||[];setStudents(list);setStudentId(current=>current||list[0]?.id||'');return list;
  }
  async function loadDashboard(id:string){
    if(!id){setDashboard(null);return;}
    setLoading(true);setError('');
    try{
      const response=await fetch(`/api/guardian/dashboard?studentId=${encodeURIComponent(id)}`,{cache:'no-store'});
      const body=await response.json() as {ok?:boolean;dashboard?:Dashboard;error?:string};
      if(!response.ok||body.ok!==true||!body.dashboard)throw new Error(body.error||'guardian_dashboard_unavailable');
      setDashboard(body.dashboard);
    }catch{setError('Öğrenci bilgileri şu anda yüklenemedi.');}
    finally{setLoading(false);}
  }

  useEffect(()=>{void (async()=>{
    try{
      const response=await fetch('/api/guardian-auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'me'}),cache:'no-store'});
      const body=await response.json() as {ok?:boolean;user?:{name?:string};error?:string};
      if(!response.ok||body.ok!==true)throw new Error(body.error||'guardian_session_required');
      setGuardianName(body.user?.name||'Veli');const list=await loadStudents();if(list[0])await loadDashboard(list[0].id);
    }catch{setError('Veli oturumu doğrulanamadı. Yetkili hesabınızla yeniden giriş yapın.');}
    finally{setLoading(false);}
  })();},[]);


  async function logout(){
    const response=await fetch('/api/guardian-auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});
    if(response.ok){setStudents([]);setStudentId('');setDashboard(null);setError('Güvenli çıkış yapıldı.');}
    else setError('Güvenli çıkış tamamlanamadı. Yeniden deneyin.');
  }

  if(loading&&!dashboard)return <main className="grid min-h-screen place-items-center bg-[#f5f8f6]"><p className="flex items-center gap-3 text-base font-semibold"><Loader2 className="animate-spin"/> Veli paneli hazırlanıyor…</p></main>;

  return <main className="min-h-screen bg-[#f5f8f6] px-4 py-6 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="font-semibold text-[#276151]">ÇELİK ZİHİN AKADEMİSİ</p><h1 className="mt-2 text-3xl font-black text-[#18342c]">Veli Paneli</h1><p className="mt-2 text-base text-[#5d6d67]">Hoş geldiniz, {guardianName}. Çocuğunuzun öğrenme yolculuğunu tek profilden izleyin.</p></div>
          <Button variant="outline" onClick={logout}><LogOut/> Güvenli çıkış</Button>
        </div>
        {students.length?<div className="mt-6"><label htmlFor="guardian-student" className="font-bold text-[#213d34]">Öğrenci</label><select id="guardian-student" value={studentId} onChange={e=>{const id=e.target.value;setStudentId(id);void loadDashboard(id);}} className="mt-2 h-12 w-full rounded-xl border bg-white px-4 text-base font-semibold sm:max-w-md">{students.map(student=><option key={student.id} value={student.id}>{student.name}{student.campusCode?` · ${student.campusCode}`:''}</option>)}</select></div>:null}
        {error?<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{error}</p>:null}
      </header>

      {dashboard&&selected?<div className="mt-6 space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({Icon,title,value})=><article key={title} className="rounded-2xl bg-white p-5 shadow-sm"><Icon className="text-[#276151]"/><p className="mt-3 font-semibold text-[#5d6d67]">{title}</p><strong className="mt-1 block text-2xl text-[#18342c]">{String(value)}</strong></article>)}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-xl font-black"><ClipboardList className="text-[#276151]"/> Aktif görevler</h2><div className="mt-4 space-y-3">{dashboard.assignments.slice(0,8).map(item=><div key={item.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b>{item.title}</b><span className="rounded-full bg-[#edf5f1] px-3 py-1 text-sm font-bold">{labelStatus(item.status)}</span></div><p className="mt-2 text-sm text-[#5d6d67]">{item.subject||item.taskKind}{item.topic?` · ${item.topic}`:''}</p>{item.instructions?<p className="mt-2 text-base">{item.instructions}</p>:null}</div>)}{!dashboard.assignments.length?<p className="rounded-2xl border border-dashed p-5 text-[#5d6d67]">Aktif görev bulunmuyor.</p>:null}</div></article>
          <article className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-xl font-black"><CalendarDays className="text-[#276151]"/> Son çalışmalar</h2><div className="mt-4 space-y-3">{dashboard.recentActivity.map(item=><div key={item.id} className="rounded-2xl border p-4"><b>{item.title}</b><p className="mt-1 text-sm text-[#5d6d67]">{labelStatus(item.status)} · {date(item.completedAt||item.startedAt)}</p></div>)}{!dashboard.recentActivity.length?<p className="text-[#5d6d67]">Henüz çalışma kaydı yok.</p>:null}</div></article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><GraduationCap className="text-[#276151]"/> Öğrenme profili</h2>{dashboard.profile?<><p className="mt-4 text-base">Son 30 günde <b>{dashboard.profile.studyPattern.sessions.activeDaysLast30}</b> aktif çalışma günü.</p><p className="mt-2 text-sm text-[#5d6d67]">Kayıt: {dashboard.profile.coverage.records} · Oturum: {dashboard.profile.coverage.sessions}</p><div className="mt-4 space-y-2">{dashboard.profile.skills.slice(0,4).map(skill=><p key={skill.skillCode} className="rounded-xl bg-[#f5f8f6] p-3 font-semibold">{skill.skillCode} · {skill.recordCount} kayıt</p>)}</div>{dashboard.profile.process.insufficiencyReason?<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{dashboard.profile.process.insufficiencyReason}</p>:null}</>:<p className="mt-4 text-[#5d6d67]">Öğrenme profili için henüz yeterli veri yok.</p>}</article>
          <article className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><BookOpenCheck className="text-[#276151]"/> Rapor özeti</h2>{dashboard.report.summary.clientPerformance?.evidenceStatus==='AVAILABLE'?<><p className="mt-4 text-base">Bildirilen deneme sayısı: <b>{dashboard.report.summary.clientPerformance.attempts}</b></p><p className="mt-2 text-base">Bildirilen doğruluk: <b>%{dashboard.report.summary.clientPerformance.accuracy??'—'}</b></p><p className="mt-2 text-sm text-[#5d6d67]">Kaynak: İstemci bildirimi. Doğrulanmış başarı puanı değildir.</p></>:<p className="mt-4 text-[#5d6d67]">Performans oranı için yeterli veri yok.</p>}</article>
          <article className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><Target className="text-[#276151]"/> Koçluk / LGS / YKS</h2>{dashboard.coaching.programs.length?<><p className="mt-4 font-semibold">{dashboard.coaching.programs[0].programType||'Koçluk'} · {dashboard.coaching.programs[0].examYear}</p>{dashboard.coaching.goals[0]?<p className="mt-2 text-base">Hedef: {targetText(dashboard.coaching.goals[0].target)}</p>:null}{dashboard.coaching.meetings[0]?.sharedSummary?<p className="mt-3 rounded-xl bg-[#f5f8f6] p-3 text-base">{dashboard.coaching.meetings[0].sharedSummary}</p>:null}{dashboard.coaching.meetings[0]?.nextWeekFocus?<p className="mt-2 text-sm text-[#5d6d67]">Sonraki odak: {dashboard.coaching.meetings[0].nextWeekFocus}</p>:null}</>:<p className="mt-4 text-[#5d6d67]">Aktif LGS/YKS koçluk programı bulunmuyor.</p>}</article>
        </section>

        <p className="pb-6 text-sm text-[#5d6d67]">Bu panel öğrenme verilerini görüntüler. Eğitimsel karar ve değişiklikler öğrenci ile yetkili eğitimci/koç tarafından yürütülür.</p>
      </div>:null}
    </div>
  </main>;
}
