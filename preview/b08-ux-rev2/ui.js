// Balanced session-specific positions, chosen with browser cryptographic randomness.
const shuffled = () => { const p=[0,1,2,3]; for(let i=3;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[p[i],p[j]]=[p[j],p[i]];}return p; };
const positions=shuffled(), offsets=shuffled();
if(positions[offsets[0]]===0)[positions[offsets[0]],positions[(offsets[0]+1)%4]]=[positions[(offsets[0]+1)%4],positions[offsets[0]]];
const sessionLayout=Object.fromEntries(TASKS.map((t,i)=>[t,[0,1,2,3].map(r=>positions[(r+offsets[i])%4])]));
let session=newSession(), view='setup', stage='A', active=null;
const root=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={A:'İlk yanıtın',S:'Birlikte inceleyelim',B:'İki sayıyı karşılaştır',T:'Aynı Sayı, Farklı Gösterimler'};
function blocks(t,u){return `<div class="blocks" role="img" aria-label="${t} onluk çubuğu ve ${u} birlik küpü"><div class="rods">${Array.from({length:t},()=>'<span class="rod">'+('<i></i>'.repeat(10))+'</span>').join('')}</div><div class="units">${'<span class="cube"></span>'.repeat(u)}</div></div>`;}
function attempt(){return session.attempts.find(a=>a.id===active);}
function field(id,label,type='text'){return `<label>${label}<input id="${id}" type="${type}" maxlength="500"></label>`;}
function select(id,label,items){return `<label>${label}<select id="${id}">${items.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`;}
function render(){
 const a=attempt();
 document.body.dataset.access=a?.config.age??'young';
 document.querySelector('#teacher').setAttribute('aria-pressed',view==='teacher');
 document.querySelector('#student').disabled=!a;
 let content='';
 if(view==='setup')content=`<div class="eyebrow">EĞİTMEN HAZIRLIĞI · SENTETİK</div><h1>Her yanıtın bir hikâyesi var.</h1><p class="lead">Onluk ve birlik ilişkisini nasıl gösterdiğine bakalım. Önce yanıt yolunu seçin; ilk yanıttan sonra bu seçim kilitlenir.</p><div class="setup-grid"><section class="panel"><h2>Yanıt yolu</h2>${select('method','MAT-01A başlangıç yöntemi',[['recognition','A1 · Dört seçenekten tanıma'],['production','A2 · Seçeneksiz bağımsız üretim'],['objects','A2 · Nesnelerle gruplama'],['communication','A2 · Sözlü / alternatif iletişim']])}${select('presentation','A1 şık sunumu',[['visual','Nesne grupları'],['written','Büyük basılı yazılı şıklar']])}${select('age','Görsel sunum (düzey belirlemez)',[['young','5–8 yaş · büyük sunum'],['older','9–12 yaş · sade sunum'],['access','Erişim desteği · yüksek okunaklılık']])}${select('access','Yanıt kanalının erişilebilirliği',[['VALID','Uygun kanal hazır'],['UNAVAILABLE','Henüz uygun kanal yok']])}<button id="begin" class="primary">Sentetik denemeyi başlat</button></section><aside class="panel pale"><h2>Bu önizlemede</h2><ol><li>İlk yanıt korunur.</li><li>Destek ayrı kaydedilir.</li><li>Gerekçe gözlem bekler.</li><li>Yeni örnek ayrıca incelenir.</li></ol><p>Takvim yaşı öğrenme düzeyi değildir. Özel eğitimde iletişim ve motor uyarlamaları kavramsal yardımdan ayrılır.</p><p>Yalnız hayalî yanıt girin. İsim, ses kaydı veya gerçek öğrenci verisi kullanmayın.</p></aside></div>`;
 if(view==='student'){
  const saved=a.responses.find(r=>r.task===stage); const first=a.responses.some(r=>r.task==='A');
  content=`<div class="eyebrow">ÖĞRENCİ · ${esc(a.id)}</div><nav class="steps" aria-label="Değerlendirme aşamaları">${TASKS.map((t,i)=>`<button data-stage="${t}" ${(!first&&t!=='A')||(i>0&&!a.responses.some(r=>r.task===TASKS[i-1]))?'disabled':''} aria-current="${stage===t?'step':'false'}">${i+1}. ${titles[t]}</button>`).join('')}</nav><section class="question"><div class="eyebrow">MAT-01${stage} · ${stage==='A'?esc(a.config.method==='recognition'?'Şıklardan tanıma':'Bağımsız üretim'):stage==='S'?'Destekli performans':'Ayrı kanıt'}</div><h1>${titles[stage]}</h1>`;
  if(saved)content+=`<div class="saved" role="status"><h2>Yanıtın kaydedildi.</h2><p>${esc(saved.raw)}</p><p>Bu ilk kayıt değiştirilemez. Sonraki çalışmada yeni bir kayıt oluşur.</p></div>${stage!=='T'?'<button id="next" class="primary">Sonraki çalışmaya geç</button>':'<p>Çalışma tamamlandı. Eğitmenin yanıtlarını ayrıca inceleyecek.</p>'}`;
  else {
   content+=`<p class="prompt">${{A:'47 sayısında kaç onluk ve kaç birlik var? Kendi yanıtını ver.',S:'Bu onluk çubukları ve birlik küpleri hangi sayıyı gösteriyor?',B:'47 ve 74 aynı rakamları kullanıyor. Sence aynı sayı mı? Neden? Anlat ya da göster.',T:'52 sayısını iki farklı şekilde göster. En az birinde onluk ve birlik gruplarını belirt. İkisinin de aynı sayıyı gösterdiğini anlat ya da göster.'}[stage]}</p>`;
   if(stage==='B')content+='<div class="number-pair"><span>47</span><span>74</span></div>';
   if(stage==='S')content+=blocks(4,7)+`<div class="support">Materyal: onluk çubuğu ve birlik küpü. ${select('hint','Verilen kavramsal destek',[['MATERIAL','Yalnız görünen materyal'],['PROMPT','Sözel ipucu verildi'],['MODEL','Çözüm modellendi'],['ANSWER_PROVIDED','Cevap söylendi']])}</div>`;
   const recognition=stage==='A'?a.config.method==='recognition':false;
   if(stage!=='A')content+=select('responseMode','Yanıt yolu',[['production','Kendi yanıtım / gösterimim'],['recognition','Görsel / basılı seçenekten tanıma'],['objects','Nesne gruplama'],['communication','Sözlü / alternatif iletişim']]);
   content+=`<div id="responseArea">${responseArea(recognition?'recognition':stage==='A'?a.config.method:'production')}</div><label class="check"><input id="unavailable" type="checkbox">Bu yanıt kanalı kullanılamadı / yanıt gözlenemedi</label><button id="save" class="primary">Yanıtı kaydet ve kilitle</button><p class="small">Henüz bir doğru/yanlış geri bildirimi verilmez.</p>`;
  }
  content+='</section>';
 }
 if(view==='teacher'){
  content=`<div class="eyebrow">EĞİTMEN · YALNIZ SENTETİK BEYAN</div><h1>Yanıttan kanıta.</h1><p class="lead">Aynı sentetik öğrenci referansı; farklı denemeler. Bu görünüm bir öğretmen oturumunu doğrulamaz ve SLP’ye veri yazmaz.</p><div class="toolbar"><button id="new">Yeni deneme hazırlığı</button><button id="export">Sentetik kayıtları indir</button><button id="print">Görünen seçenekleri A4 yazdır</button></div><div class="status-grid"><span>Ustalık: INSUFFICIENT</span><span>Otomatik atama: BLOCKED</span><span>Kalıcılık: NOT_ASSESSED</span></div>`;
  content+=session.attempts.length?session.attempts.map(at=>`<section class="panel"><h2>${esc(at.id)} ${at.id!==active?'· Arşiv / salt okunur':''}</h2><p>${esc(at.config.method)} · ${esc(at.config.age)} · erişim ${esc(at.config.access)} · Student ref: SYNTHETIC_SINGLE_SLP</p><div class="evidence-grid">${TASKS.map(t=>{
   const r=at.responses.find(x=>x.task===t),o=at.observations.find(x=>x.task===t), result=assess(r,o,classifyMat01A);
   return `<article class="evidence"><h3>MAT-01${t} · ${titles[t]}</h3><span class="badge">${esc(result.status)}</span><p>${esc(result.reason)}</p><dl><dt>Öğrenci doğrudan yanıtı</dt><dd>${r?esc(r.raw):'Henüz yok'}</dd><dt>Kanıt türü / yardım</dt><dd>${r?esc(r.kind+' / '+r.help):'NOT_ASSESSED'}</dd><dt>Kaynak / faz</dt><dd>${r?esc(r.ref+' / '+r.phase):'—'}</dd><dt>Eğitmen gözlemi (ayrı)</dt><dd>${o?esc(o.note+' / '+o.judgment+' / '+JSON.stringify(o.criteria)):'Öğretmen kararı bekleniyor'}</dd></dl>${r&&!o&&at===session.attempts.at(-1)?`<button data-observe="${t}">Sentetik gözlem ekle</button>`:''}</article>`;
  }).join('')}</div></section>`).join(''):'<p>Henüz deneme yok. Eğitmen hazırlığından başlayın.</p>';
  content+='<section class="panel"><h2>Yorumlama sınırı</h2><p>MAT.2.1.2 aday ilişkisi · MAT.1.1.2 ön koşul. Akademik gelişim haritası ve CZA-S01 için tek görev grubu; diğer 13 beceri NOT_ASSESSED. 26 profil / P2 23 bölüm / özel eğitim / LGS–YKS mimarisi korunur. Yeni profil oluşturulmaz. finger_read bu önizlemede ölçülmez; başarısı basamak değeri kanıtına çevrilmez.</p></section>';
 }
 root.innerHTML=content;
 bind();
}
function responseArea(mode){
 if(mode==='recognition')return `<fieldset><legend>Bir seçenek belirle</legend><div class="choices">${options(stage,attempt().number,attempt().config.layout).map((o,i)=>`<label class="choice"><input type="radio" name="choice" value="${o.id}"><span class="letter">${'ABCD'[i]}</span><span>${o.t!==undefined&&(stage!=='A'||attempt().config.presentation!=='written')?blocks(o.t,o.u):''}<strong>${esc(stage==='A'&&attempt().config.presentation!=='written'?'Bu grubu seç':o.label)}</strong></span></label>`).join('')}</div></fieldset><button id="printStudent" type="button">A4 şıklı sayfayı yazdır</button>`;
 if(mode==='objects')return `<p>Onluk çubuğu 10 birleşik birimden oluşur. İstediğin grupları oluştur.</p><div class="counters">${select('tens','Onluk sayısı',Array.from({length:11},(_,i)=>[i,i]))}${select('units','Birlik sayısı',Array.from({length:21},(_,i)=>[i,i]))}</div><div id="constructed">${blocks(0,0)}</div>${stage==='T'?'<label>İkinci gösterimin<textarea id="raw" rows="3" maxlength="1000"></textarea></label>':''}`;
 return `<label>${mode==='communication'?'Gözlenen sözlü / alternatif iletişim yanıtının aynısını yazın (sentetik)':'Kendi yanıtın / gösterimin'}<textarea id="raw" rows="4" maxlength="1000"></textarea></label><p class="small">Yazı veya motor erişimi uygun değilse eğitmen alternatif kanalı hazırlayabilir. Burada ses kaydı ve çizim tanıma yoktur.</p>`;
}
function bind(){
 const on=(id,fn,event='click')=>{const el=document.getElementById(id);if(el)el.addEventListener(event,fn);};
 on('begin',()=>{session=start(session,{method:val('method'),age:val('age'),access:val('access'),presentation:val('presentation'),layout:sessionLayout});active=session.attempts.at(-1).id;stage='A';view='student';render();});
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{stage=b.dataset.stage;render();});
 on('next',()=>{stage=TASKS[TASKS.indexOf(stage)+1];render();});
 on('responseMode',()=>{document.querySelector('#responseArea').innerHTML=responseArea(val('responseMode'));bindCounters();document.querySelector('#printStudent')?.addEventListener('click',()=>window.print());},'change'); bindCounters();
 on('printStudent',()=>window.print());
 on('save',()=>{
  const a=attempt(),mode=stage==='A'?a.config.method:val('responseMode'), selected=document.querySelector('[name=choice]:checked');
  const unavailable=document.querySelector('#unavailable').checked||a.config.access!=='VALID';
  const raw=mode==='recognition'?(selected?options(stage,a.number,a.config.layout).find(o=>o.id===selected.value).label:''):mode==='objects'?`${val('tens')} onluk ${val('units')} birlik${stage==='T'?' / '+val('raw'):''}`:val('raw');
  try{session=record(session,active,stage,{observedAt:new Date().toISOString(),raw:unavailable?'Yanıt gözlenemedi':raw,kind:mode==='recognition'?'recognition':'production',channel:mode,recordedBy:mode==='communication'?'educator_verbatim':'student_direct',option:selected?.value,unavailable,help:stage==='S'?val('hint'):'NONE'});render();}catch(e){message(e.message==='EMPTY_RESPONSE'?'Önce bir yanıt gir veya kanalın kullanılamadığını belirt.':e.message);}
 });
 on('new',()=>{view='setup';render();});
 on('print',()=>window.print());
 on('export',()=>{const blob=new Blob([JSON.stringify(session,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='CZA_SENTETIK_KANIT.json';a.click();URL.revokeObjectURL(url);});
 document.querySelectorAll('[data-observe]').forEach(b=>b.onclick=()=>observationForm(b.dataset.observe));
}
function val(id){return document.getElementById(id)?.value??'';}
function bindCounters(){for(const id of ['tens','units'])document.getElementById(id)?.addEventListener('change',()=>{document.querySelector('#constructed').innerHTML=blocks(+val('tens'),+val('units'));});}
function message(text){document.querySelector('#notice').textContent=text;}
function observationForm(task){
 const rubric=task==='B'?'B1: rakamların yerini gösterme; B2: 4 için 40/4; B3: 7 için 7/70; B4: değişen değerden sayılar farklı sonucunu gerekçelendirme; B5: dil/nesneyle ilişkiyi açıklama. Yalnız “yerleri değişti” kısmi kanıttır.':task==='T'?'T1: iki eşdeğer gösterim; T2: en az bir onluk-birlik temsili; T3: ikisinin de 52 olduğunu gerekçelendirme; T4: bağımsızlık; T5: gerçekten yeni uyaran.': 'Tanıma bağımsız üretim değildir. Destekli cevap ilk yanıtı değiştirmez.';
 const criteria=task==='B'?['B1','B2','B3','B4','B5']:task==='T'?['T1','T2','T3','T4','T5']:[];
 const criterionFields=criteria.map(c=>select('criterion'+c,c+' gözlem durumu',[['NOT_ASSESSED','Gözlenemedi'],['OBSERVED','Gözlendi'],['PARTIAL','Kısmi'],['INCORRECT','Hatalı']])).join('');
 const dialog=document.querySelector('#observation');
 dialog.innerHTML=`<form method="dialog"><h2>MAT-01${task} · ayrı eğitmen gözlemi</h2><p>${rubric}</p><p>Yalnız sentetik beyan; kimlik doğrulaması yok.</p><label>Gözlenen davranış ve ölçüt gerekçesi<textarea id="obsNote" maxlength="1000" required></textarea></label>${select('judgment','Gözlenen kanıt (kalıcı seviye değil)',[['NOT_ASSESSED','Gözlenemedi'],['PARTIAL_EVIDENCE','Kısmi'],['RELATION_OBSERVED','İlişki gözlendi'],['INCORRECT_RELATION','Hatalı ilişki'],['AMBIGUOUS_REVIEW','Belirsiz / inceleme']])}${task==='T'?select('novelty','Uyaran geçmişi',[['UNKNOWN','Bilinmiyor'],['SEEN','Daha önce görüldü'],['UNSEEN','Eğitmen geçmiş kaynağıyla yeni olduğunu beyan ediyor']])+field('history','Önceki uyaran incelemesi / sentetik kaynak referansı')+select('transferHelp','Transfer yardımı',[['UNKNOWN','Bilinmiyor'],['NONE','Kavramsal yardım yok'],['PROMPT','İpucu verildi']]):''}${criterionFields}<button id="saveObservation" value="save" class="primary">Gözlemi ayrı kaydet</button><button value="cancel">Vazgeç</button></form>`;
 dialog.querySelector('form').onsubmit=e=>{if(e.submitter.value!=='save')return;e.preventDefault();try{session=observe(session,active,task,{observedAt:new Date().toISOString(),note:val('obsNote'),judgment:val('judgment'),novelty:val('novelty'),history:val('history'),help:val('transferHelp'),criteria:Object.fromEntries(criteria.map(c=>[c,val('criterion'+c)]))});dialog.close();render();}catch(err){message(err.message);}};
 dialog.showModal();
}
document.querySelector('#teacher').onclick=()=>{view='teacher';render();};
document.querySelector('#student').onclick=()=>{view='student';render();};
document.querySelector('#setup').onclick=()=>{view='setup';render();};
window.addEventListener('beforeunload',e=>{if(session.attempts.length){e.preventDefault();}});
render();
