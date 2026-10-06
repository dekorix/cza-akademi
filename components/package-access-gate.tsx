'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Loader2, LockKeyhole } from 'lucide-react';

export function PackageAccessGate({
  accessCode,
  label,
  children,
}: {
  accessCode:string;
  label:string;
  children:ReactNode;
}) {
  const [state,setState]=useState<'loading'|'allowed'|'denied'|'session'>('loading');

  useEffect(()=>{
    let active=true;
    async function check(){
      const params=new URLSearchParams(window.location.search);
      const assignedRecipe=params.get('assignedRecipe')?.trim()||'';
      if(assignedRecipe){
        const assigned=await fetch('/api/core/assignments?recipeId='+encodeURIComponent(assignedRecipe),{cache:'no-store'});
        if(assigned.status===401) return {session:true,allowed:false};
        if(assigned.ok){
          const body=await assigned.json() as {ok?:boolean;assignment?:{module_code?:string}};
          if(body.ok===true&&body.assignment?.module_code===accessCode) return {session:false,allowed:true};
        }
      }

      const response=await fetch('/api/core/access',{cache:'no-store'});
      if(response.status===401) return {session:true,allowed:false};
      const body=await response.json() as {ok?:boolean;accessCodes?:string[]};
      return {
        session:false,
        allowed:body.ok===true&&Array.isArray(body.accessCodes)&&body.accessCodes.includes(accessCode),
      };
    }

    void check()
      .then(result=>{
        if(!active) return;
        if(result.session) setState('session');
        else setState(result.allowed?'allowed':'denied');
      })
      .catch(()=>{if(active)setState('denied');});
    return()=>{active=false;};
  },[accessCode]);

  if(state==='loading'){
    return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary"/><p className="mt-3 text-sm font-semibold">Erişim yetkin doğrulanıyor…</p></div></main>;
  }
  if(state==='allowed') return <>{children}</>;

  return <main className="grid min-h-screen place-items-center bg-[#f5f7fb] p-6">
    <section className="w-full max-w-lg rounded-3xl border border-[#d7e0e8] bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eef4fb] text-[#385a78]"><LockKeyhole/></span>
      <h1 className="mt-5 text-2xl font-semibold">{state==='session'?'Öğrenci oturumu gerekli':label + ' henüz hesabında açık değil'}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {state==='session'
          ? 'Bu çalışma alanına erişmek için öğrenci hesabınla yeniden giriş yap.'
          : 'Bu alan paket erişimine bağlıdır. Eğitimcin paket aktivasyonu yaptığında otomatik olarak açılır.'}
      </p>
      <a href="/work" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#385a78] px-5 text-sm font-semibold text-white">
        <ArrowLeft size={16}/> Çalışma merkezine dön
      </a>
    </section>
  </main>;
}
