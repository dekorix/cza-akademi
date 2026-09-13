(function(){
  'use strict';
  const root=document.getElementById('app');if(!root)return;
  function apply(){
    const bank=globalThis.E3_BANK;
    const hero=document.querySelector('.hero-stat');
    if(hero&&bank?.allTasks?.length){const nums=hero.querySelectorAll('b');if(nums[0])nums[0].textContent=String(bank.allTasks.length)}
    document.querySelectorAll('button:not([type])').forEach(b=>b.type='button');
    document.querySelectorAll('.evidence-console').forEach(x=>x.setAttribute('aria-label','Eğitimci kanıt paneli'));
    document.querySelectorAll('.child-canvas').forEach(x=>x.setAttribute('aria-label','Çocuk değerlendirme alanı'));
    document.querySelectorAll('.support-matrix').forEach(x=>x.setAttribute('aria-label','Yardım ve bağımsızlık düzeyi'));
    document.querySelectorAll('.flag-matrix').forEach(x=>x.setAttribute('aria-label','Süreç gözlemleri'));
    document.querySelectorAll('.form-error').forEach(x=>{x.setAttribute('role','alert');x.setAttribute('aria-live','polite')});
    document.querySelectorAll('.progress-bar').forEach(p=>{const fill=p.querySelector('i');const width=parseInt(fill?.style.width||'0',10)||0;p.setAttribute('role','progressbar');p.setAttribute('aria-valuemin','0');p.setAttribute('aria-valuemax','100');p.setAttribute('aria-valuenow',String(width))});
    document.querySelectorAll('.domain-track').forEach(p=>p.setAttribute('aria-hidden','true'));
  }
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})});
  observer.observe(root,{childList:true,subtree:true});
  apply();
})();
