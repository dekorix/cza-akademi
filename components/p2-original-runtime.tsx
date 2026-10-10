'use client';
import {useEffect,useState} from 'react';
export function P2OriginalRuntime(){
 const [src,setSrc]=useState('');
 useEffect(()=>{const q=new URLSearchParams(location.search),studentId=q.get('studentId')||'',session=q.get('session')||'';const params=new URLSearchParams();if(studentId)params.set('studentId',studentId);setSrc('/p2-runtime/index.html'+(params.size?'?'+params:'')+(session?'#/assessment?session='+encodeURIComponent(session):'#/educator'));},[]);
 return <section className="rounded-2xl border bg-white p-4"><h2 className="text-xl font-bold">Korunmuş P2 değerlendirmesi · entegrasyon testi</h2><p className="my-3 text-sm">Mevcut CZA öğrenci/eğitimci oturumu kullanılır. Bu aday yalnız sentetik test ortamında kayıt açar. Tam entegrasyon kabulü henüz tamamlanmadı.</p>{src?<iframe title="23 bölümlük özgün P2 başlangıç değerlendirmesi" src={src} className="w-full border-0" style={{height:'85vh',minHeight:640}}/>:<p>Değerlendirme yükleniyor…</p>}</section>;
}
