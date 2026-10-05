'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Loader2, LockKeyhole, PackageCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CatalogItem={
  code:'ANZAN'|'ZIHIN_GELISIM'|'BUTUNLESIK';
  label:string;
  priceTry:number;
  description:string;
  access:{code:string;label:string;ready:boolean}[];
  readiness:{ready:number;total:number;fullyReady:boolean;pendingLabels:string[]};
};
type Decision={
  id:string;
  package_code:string;
  package_label:string;
  price_snapshot_try:number;
  decision:'APPROVED'|'DECLINED';
  decided_at:string;
  note?:string|null;
};
type Enrollment={
  id:string;
  decision_id:string;
  package_code:string;
  package_label:string;
  price_snapshot_try:number;
  activation_basis:string;
  status:string;
  starts_at:string;
  cancelled_at?:string|null;
};
type Data={
  ok:true;
  student:{id:string;name:string};
  catalog:CatalogItem[];
  decisions:Decision[];
  enrollments:Enrollment[];
  entitlements:{id:string;enrollment_id:string;access_code:string;status:string}[];
};

function money(value:number){
  return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(value);
}
function errorText(code:string){
  if(code==='student_not_linked_to_educator') return 'Bu öğrenci eğitimci hesabınıza bağlı değil.';
  if(code==='active_package_exists') return 'Öğrencinin zaten aktif bir paketi var.';
  if(code==='approved_parent_decision_required') return 'Paket aktivasyonu için önce onaylanmış veli kararı gerekir.';
  if(code==='package_not_ready_for_activation') return 'Bu paket henüz teknik olarak tam yayına hazır değil.';
  if(code==='package_activation_confirmation_required') return 'Erişimi açmak için son aktivasyon onayı gerekir.';
  if(code==='package_schema_unavailable') return 'Paket veri katmanı bu ortamda henüz etkin değil.';
  return 'İşlem şu anda tamamlanamadı.';
}

export default function EnrollmentPage(){
  const [studentId,setStudentId]=useState('');
  const [data,setData]=useState<Data|null>(null);
  const [selectedPackage,setSelectedPackage]=useState<CatalogItem['code']>('ANZAN');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [success,setSuccess]=useState('');
  const [activationBasis,setActivationBasis]=useState<'PAYMENT_CONFIRMED'|'PILOT_COMPLIMENTARY'>('PAYMENT_CONFIRMED');
  const [activationConfirm,setActivationConfirm]=useState(false);

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    setStudentId(q.get('studentId')||'');
  },[]);

  async function load(){
    if(!studentId) return;
    setBusy(true);
    setMessage('');
    try{
      const response=await fetch('/api/educator-enrollment',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'list',studentId}),
      });
      const body=await response.json() as Data & {error?:string};
      if(!response.ok||body.ok!==true) throw new Error(body.error||'load_failed');
      setData(body);
    }catch(error){
      setMessage(errorText(error instanceof Error?error.message:'load_failed'));
    }finally{
      setBusy(false);
    }
  }

  useEffect(()=>{if(studentId) void load();},[studentId]);

  const activeEnrollment=useMemo(
    ()=>data?.enrollments.find(item=>item.status==='active')||null,
    [data],
  );
  const selectedCatalog=useMemo(
    ()=>data?.catalog.find(item=>item.code===selectedPackage)||null,
    [data,selectedPackage],
  );
  const latestApprovedDecision=useMemo(
    ()=>data?.decisions.find(item=>item.package_code===selectedPackage&&item.decision==='APPROVED')||null,
    [data,selectedPackage],
  );

  async function recordDecision(decision:'APPROVED'|'DECLINED'){
    if(!studentId||busy) return;
    setBusy(true);
    setMessage('');
    setSuccess('');
    try{
      const response=await fetch('/api/educator-enrollment',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'record_decision',studentId,packageCode:selectedPackage,decision,note}),
      });
      const body=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||body.ok!==true) throw new Error(body.error||'decision_failed');
      setSuccess(decision==='APPROVED'?'Veli onayı kaydedildi.':'Veli devam etmeme kararı kaydedildi.');
      setNote('');
      await load();
    }catch(error){
      setMessage(errorText(error instanceof Error?error.message:'decision_failed'));
    }finally{
      setBusy(false);
    }
  }

  async function activate(){
    if(!latestApprovedDecision||!activationConfirm||busy) return;
    setBusy(true);
    setMessage('');
    setSuccess('');
    try{
      const response=await fetch('/api/educator-enrollment',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          action:'activate',
          studentId,
          decisionId:latestApprovedDecision.id,
          activationBasis,
          confirm:true,
        }),
      });
      const body=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||body.ok!==true) throw new Error(body.error||'activation_failed');
      setSuccess('Paket aktive edildi ve hazır modül yetkileri öğrenci hesabına açıldı.');
      setActivationConfirm(false);
      await load();
    }catch(error){
      setMessage(errorText(error instanceof Error?error.message:'activation_failed'));
    }finally{
      setBusy(false);
    }
  }

  async function cancel(){
    if(!activeEnrollment||busy||!window.confirm('Aktif paket erişimini kapatmak istediğinize emin misiniz?')) return;
    setBusy(true);
    setMessage('');
    setSuccess('');
    try{
      const response=await fetch('/api/educator-enrollment',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'cancel',studentId,enrollmentId:activeEnrollment.id,confirm:true}),
      });
      const body=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||body.ok!==true) throw new Error(body.error||'cancel_failed');
      setSuccess('Paket kapatıldı ve paket kaynaklı erişim yetkileri geri çekildi.');
      await load();
    }catch(error){
      setMessage(errorText(error instanceof Error?error.message:'cancel_failed'));
    }finally{
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-9">
    <div className="mx-auto max-w-6xl">
      <a href="/educator" className="inline-flex items-center gap-2 text-sm font-semibold text-[#385a78]">
        <ArrowLeft size={16}/> Eğitimci merkezine dön
      </a>

      <section className="mt-5 rounded-3xl border border-[#d7e0e8] bg-white p-6 shadow-sm md:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef4fb] text-[#385a78]"><PackageCheck/></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#69839d]">Veli Kararı → Paket → Yetki</p>
            <h1 className="mt-2 text-2xl font-semibold">Kayıt ve erişim aktivasyonu</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Veli kararı ayrı kaydedilir. Paket erişimi ancak açık aktivasyon dayanağı ve eğitimci onayıyla açılır. Bu ekran ödeme tahsil etmez veya ödeme belgesi üretmez.
            </p>
          </div>
        </div>

        {busy&&!data&&<p className="mt-7 flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={17}/> Kayıt bilgileri hazırlanıyor…</p>}
        {message&&<p role="alert" className="mt-6 rounded-xl bg-[#fff4e7] p-4 text-sm font-semibold text-[#8a5a25]">{message}</p>}
        {success&&<p role="status" className="mt-6 rounded-xl bg-[#edf8f2] p-4 text-sm font-semibold text-[#276151]">{success}</p>}

        {data&&<>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce4ed] bg-[#f8fafc] p-4">
            <div><span className="text-[10px] font-black text-[#69839d]">ÖĞRENCİ</span><b className="mt-1 block">{data.student.name}</b></div>
            {activeEnrollment
              ? <span className="rounded-full bg-[#edf8f2] px-3 py-1 text-xs font-bold text-[#276151]">Aktif paket: {activeEnrollment.package_label}</span>
              : <span className="rounded-full bg-[#f1f4f7] px-3 py-1 text-xs font-bold text-[#617383]">Aktif paket yok</span>}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold">1. Paket seçimi</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {data.catalog.map(pack=>{
                const selected=selectedPackage===pack.code;
                return <button key={pack.code} type="button" onClick={()=>{setSelectedPackage(pack.code);setActivationConfirm(false);}}
                  className={`rounded-2xl border p-5 text-left transition ${selected?'border-[#557fa5] bg-[#f1f6fb]':'border-[#dce4ed] bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold">{pack.label}</h3><p className="mt-1 text-xl font-bold text-[#294b68]">{money(pack.priceTry)}</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${pack.readiness.fullyReady?'bg-[#edf8f2] text-[#276151]':'bg-[#fff4e7] text-[#8a5a25]'}`}>
                      {pack.readiness.fullyReady?'AKTİVASYONA HAZIR':`${pack.readiness.ready}/${pack.readiness.total} HAZIR`}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{pack.description}</p>
                  <div className="mt-4 space-y-1">
                    {pack.access.slice(0,8).map(item=><p key={item.code} className="text-[11px] text-muted-foreground">
                      {item.ready?'✓':'○'} {item.label}{!item.ready?' · hazırlanıyor':''}
                    </p>)}
                  </div>
                </button>;
              })}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#dce4ed] bg-white p-5">
            <h2 className="text-lg font-semibold">2. Veli kararını kaydet</h2>
            <p className="mt-1 text-xs text-muted-foreground">Karar kaydı erişimi kendi başına açmaz.</p>
            <label className="mt-4 block text-sm font-semibold">
              Kısa not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              <textarea value={note} onChange={event=>setNote(event.target.value.slice(0,1000))}
                className="mt-2 min-h-20 w-full resize-none rounded-xl border border-border p-3 text-sm font-normal"
                placeholder="Örneğin: Veli raporu incelendi, Anzan programıyla devam etmek istiyor."/>
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button onClick={()=>recordDecision('APPROVED')} disabled={busy||Boolean(activeEnrollment)} className="h-11 bg-[#276151] hover:bg-[#204f43]">
                <CheckCircle2/> Veli devam kararını kaydet
              </Button>
              <Button variant="outline" onClick={()=>recordDecision('DECLINED')} disabled={busy||Boolean(activeEnrollment)} className="h-11">
                Şimdilik devam etmiyor
              </Button>
            </div>
          </div>

          {selectedCatalog&&latestApprovedDecision&&!activeEnrollment&&<div className="mt-8 rounded-2xl border border-[#cad9e6] bg-[#f7f9fc] p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#385a78]"><LockKeyhole/></span>
              <div>
                <h2 className="font-semibold">3. Paket erişimini aktive et</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Son onay, veli kararından bağımsızdır. Yalnız teknik olarak hazır paket aktive edilebilir.</p>
              </div>
            </div>

            {!selectedCatalog.readiness.fullyReady
              ? <div className="mt-5 rounded-xl border border-[#ead5af] bg-[#fff8e9] p-4 text-sm text-[#7b6124]">
                  <b>Aktivasyon kilitli.</b> Bekleyen modüller: {selectedCatalog.readiness.pendingLabels.join(', ')}.
                  Veli kararı kayıtta kalır; paket tamamlanmadan erişim açılmaz.
                </div>
              : <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className={`rounded-xl border p-4 text-sm ${activationBasis==='PAYMENT_CONFIRMED'?'border-[#557fa5] bg-white':'border-border'}`}>
                    <input type="radio" name="basis" checked={activationBasis==='PAYMENT_CONFIRMED'} onChange={()=>setActivationBasis('PAYMENT_CONFIRMED')} className="mr-2"/>
                    <b>Ödeme doğrulandı</b>
                    <span className="mt-1 block text-xs text-muted-foreground">Tahsilat başka sistemde doğrulandı; burada yalnız aktivasyon dayanağı kaydedilir.</span>
                  </label>
                  <label className={`rounded-xl border p-4 text-sm ${activationBasis==='PILOT_COMPLIMENTARY'?'border-[#557fa5] bg-white':'border-border'}`}>
                    <input type="radio" name="basis" checked={activationBasis==='PILOT_COMPLIMENTARY'} onChange={()=>setActivationBasis('PILOT_COMPLIMENTARY')} className="mr-2"/>
                    <b>Pilot / ücretsiz erişim</b>
                    <span className="mt-1 block text-xs text-muted-foreground">Tahsilat yapılmadan, kurum tarafından kontrollü erişim verilir.</span>
                  </label>
                </div>
                <label className="mt-5 flex items-start gap-3 text-sm leading-6">
                  <input type="checkbox" checked={activationConfirm} onChange={event=>setActivationConfirm(event.target.checked)} className="mt-1 h-4 w-4"/>
                  <span><b>Aktivasyon onayı:</b> Veli kararını ve aktivasyon dayanağını doğruladım. Hazır modüllerin öğrencinin merkezi hesabına açılmasını onaylıyorum.</span>
                </label>
                <Button onClick={activate} disabled={!activationConfirm||busy} className="mt-5 h-12 w-full bg-[#385a78] text-base hover:bg-[#2d4b66]">
                  {busy?<><Loader2 className="animate-spin"/> Açılıyor…</>:<><ShieldCheck/> Paketi aktive et ve yetkileri aç</>}
                </Button>
              </>}
          </div>}

          {activeEnrollment&&<div className="mt-8 rounded-2xl border border-[#b9daca] bg-[#edf8f2] p-5 text-[#276151]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Aktif erişim</h2>
                <p className="mt-1 text-sm">{activeEnrollment.package_label} · {money(activeEnrollment.price_snapshot_try)}</p>
                <p className="mt-1 text-xs">Dayanak: {activeEnrollment.activation_basis==='PAYMENT_CONFIRMED'?'Ödeme doğrulandı':'Pilot / ücretsiz'} · Başlangıç {new Date(activeEnrollment.starts_at).toLocaleDateString('tr-TR')}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                {data.entitlements.filter(item=>item.status==='active'&&item.enrollment_id===activeEnrollment.id).length} aktif yetki
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.entitlements.filter(item=>item.status==='active'&&item.enrollment_id===activeEnrollment.id).map(item=>
                <span key={item.id} className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold">{item.access_code}</span>
              )}
            </div>
            <Button variant="outline" onClick={cancel} disabled={busy} className="mt-5 border-[#91b7aa] bg-white text-[#7a3f45]">
              Erişimi kapat
            </Button>
          </div>}

          {data.decisions.length>0&&<div className="mt-8">
            <h2 className="text-lg font-semibold">Karar geçmişi</h2>
            <div className="mt-3 space-y-2">
              {data.decisions.slice(0,8).map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
                <div><b className="text-sm">{item.package_label}</b><p className="mt-1 text-xs text-muted-foreground">{money(item.price_snapshot_try)} · {new Date(item.decided_at).toLocaleString('tr-TR')}</p></div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${item.decision==='APPROVED'?'bg-[#edf8f2] text-[#276151]':'bg-[#f1f3f5] text-[#617383]'}`}>
                  {item.decision==='APPROVED'?'VELİ ONAYLADI':'DEVAM ETMİYOR'}
                </span>
              </div>)}
            </div>
          </div>}

          <p className="mt-7 flex items-start gap-2 text-[10px] leading-5 text-muted-foreground">
            <Clock3 size={14} className="mt-0.5 shrink-0"/> Paket fiyatı karar anındaki pilot fiyatın tarihsel anlık görüntüsüdür. Daha sonra katalog fiyatı değişse bile eski kayıt geriye dönük değişmez.
          </p>
        </>}
      </section>
    </div>
  </main>;
}
