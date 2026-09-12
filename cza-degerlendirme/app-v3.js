(function(){
  'use strict';
  const BANK=globalThis.E3_BANK;
  const ENGINE=globalThis.E3_ENGINE;
  if(!BANK||!ENGINE)throw new Error('E3 v3 bank/engine missing');

  const STORAGE='cza-e3-v3-session';
  const SUPPORTS=['INDEPENDENT','VERBAL_PROMPT','VISUAL_PROMPT','MODELED','PHYSICAL_ASSIST','NOT_OBSERVED','NOT_ASSESSED'];
  const FLAGS=[
    ['SELF_CORRECTED','Öz-düzeltme'],['SPONTANEOUS_EXPLANATION','Kendiliğinden açıklama'],['SUSTAINED_ENGAGEMENT','Sürdürülen katılım'],['STRATEGY_SHIFT','Strateji değiştirdi'],
    ['DISTRACTED','Dikkat dağıldı'],['AVOIDANT','Kaçınma'],['FATIGUED','Yorgunluk'],['NEEDED_REPETITION','Tekrar gerekti']
  ];
  const profiles=[
    ['E0','0–12 ay',false],['E1','12–24 ay',false],['E2','24–36 ay',true],['E3','36–48 ay',true],['E4','48–60 ay',false],['E5','60–72 ay',false],
    ['P1','1. Sınıf',false],['P2','1. Sınıf Sonu / 2. Sınıf Başlangıcı',true],['P3','3. Sınıf',false],['P4','4. Sınıf',false],['P5','5. Sınıf',false],['P6','6. Sınıf',false],['P7','7. Sınıf',false],['P8','8. Sınıf · LGS',false],['P9','9–10. Sınıf',false]
  ];
  const defaultState={
    screen:'home',student:{name:'',birth:'',age:null,language:'Türkçe',purpose:'GENERAL',assessor:''},activeDomain:null,currentTaskId:null,
    evidence:{},caregiver:{},taskRuntime:{startedAt:null,touches:0,choice:null,firstMatch:null},ui:{focus:false},session:{startedAt:null,lastSavedAt:null}
  };
  let state=load();
  const app=document.getElementById('app');

  function load(){try{return deepMerge(structuredClone(defaultState),JSON.parse(localStorage.getItem(STORAGE)||'{}'))}catch{return structuredClone(defaultState)}}
  function deepMerge(a,b){for(const [k,v] of Object.entries(b||{})){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object')deepMerge(a[k],v);else a[k]=v}return a}
  function save(){state.session.lastSavedAt=new Date().toISOString();localStorage.setItem(STORAGE,JSON.stringify(state))}
  function reset(){state=structuredClone(defaultState);save();render()}
  function esc(v=''){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
  function months(d){if(!d)return null;const b=new Date(`${d}T12:00:00`),n=new Date();let m=(n.getFullYear()-b.getFullYear())*12+n.getMonth()-b.getMonth();if(n.getDate()<b.getDate())m--;return m}
  function pct(n,d){return d?Math.round(n/d*100):0}
  function currentDomain(){return BANK.domains.find(d=>d.id===state.activeDomain)||null}
  function currentTask(){return ENGINE.taskById(state.currentTaskId)}
  function domainCompleted(id){return ENGINE.completedEvidence?ENGINE.completedEvidence(id,state.evidence).length:Object.values(state.evidence).filter(e=>e.domainId===id).length}
  function taskEvidence(id){return state.evidence[id]||null}
  function formatTime(ms){if(ms==null)return '—';if(ms<1000)return `${ms} ms`;return `${(ms/1000).toFixed(1)} sn`}

  function render(){
    document.body.classList.toggle('focus-mode',!!state.ui.focus);
    if(state.screen==='home')return renderHome();
    if(state.screen==='intake')return renderIntake();
    if(state.screen==='dashboard')return renderDashboard();
    if(state.screen==='task')return renderTask();
    if(state.screen==='caregiver')return renderCaregiver();
    if(state.screen==='report')return renderReport();
  }

  function shell(content,extra=''){
    return `<div class="v3-shell ${extra}">
      <header class="v3-global"><div><div class="brand-kicker">ÇELİK ZİHİN AKADEMİSİ</div><div class="brand-title">Bütüncül Değerlendirme Merkezi</div></div><div class="v3-badge">E3 · 36–48 AY · v3</div></header>
      ${content}
    </div>`;
  }

  function renderHome(){
    app.innerHTML=shell(`<section class="hero-block"><div class="hero-copy"><div class="eyebrow">BAŞLANGIÇ DEĞERLENDİRMESİ</div><h1>Yaşa uygun, kanıt temelli ve adaptif değerlendirme.</h1><p>Her profil ayrı gelişim mantığıyla çalışır. E3; çocuk görevi, gerçek materyal, eğitimci gözlemi ve bakımveren kanıtını tek oturum dosyasında birleştirir.</p></div><div class="hero-stat"><b>120</b><span>E3 görev havuzu</span><b>30</b><span>bakımveren maddesi</span></div></section>
    <section class="profile-zone"><div class="section-heading"><div><span>PROFİL MATRİSİ</span><h2>Hangi dünyaya yolculuk?</h2></div><div class="legend"><i class="dot live"></i> Aktif <i class="dot prep"></i> Hazırlanıyor</div></div>
    <div class="profile-grid-v3">${profiles.map(([code,label,live])=>`<button class="profile-tile ${live?'is-live':'is-prep'}" data-code="${code}" ${live?'':'disabled'}><div class="profile-code">${code}</div><div><strong>${label}</strong><small>${code.startsWith('E')?'ERKEN GELİŞİM':'OKUL ÇAĞI'}</small></div><span>${live?'AKTİF':'HAZIRLANIYOR'}</span></button>`).join('')}</div></section>`,`home-view`);
    document.querySelectorAll('.profile-tile.is-live').forEach(btn=>btn.onclick=()=>{
      if(btn.dataset.code!=='E3'){alert('Bu geliştirme sürümünde odak E3 36–48 aydır.');return}
      state.screen='intake';save();render();
    });
  }

  function renderIntake(){
    const age=months(state.student.birth);const valid=age>=36&&age<=47;
    app.innerHTML=shell(`<div class="crumb"><button data-back>← Profil matrisi</button><span>E3 / Oturum Kurulumu</span></div>
      <section class="intake-layout"><div class="intake-main"><div class="eyebrow">OTURUM KURULUMU</div><h1>36–48 Ay Başlangıç Değerlendirmesi</h1><p class="lead">Doğum tarihi tamamlanmış ayı belirler. Dil, değerlendirme amacı ve eğitimci bilgisi raporda bağlam olarak saklanır.</p>
      <div class="form-grid-v3"><label>Öğrencinin adı<input id="f-name" value="${esc(state.student.name)}" placeholder="Ad Soyad"></label><label>Doğum tarihi<input id="f-birth" type="date" value="${esc(state.student.birth)}"></label><label>Değerlendirme dili<input id="f-lang" value="${esc(state.student.language)}"></label><label>Değerlendiren eğitimci<input id="f-assessor" value="${esc(state.student.assessor)}" placeholder="Eğitimci adı"></label><label>Değerlendirme amacı<select id="f-purpose"><option value="GENERAL">Genel gelişim</option><option value="LANGUAGE">Dil ağırlıklı</option><option value="COGNITIVE">Bilişsel profil</option><option value="REASSESSMENT">Yeniden değerlendirme</option></select></label></div>
      <div class="intake-actions"><div id="form-error" class="form-error"></div><button class="primary-action" id="create-session">Oturumu oluştur →</button></div></div>
      <aside class="age-panel"><span>TAMAMLANMIŞ AY</span><b class="${valid?'valid':''}">${age==null?'—':age}</b><small>${age==null?'Doğum tarihi bekleniyor':valid?`${ENGINE.ageBand(age).label} bandı`:'E3 aralığı: 36–47 ay'}</small><div class="boundary-note">Bu sistem gelişim yaşı veya klinik tanı üretmez. Bulgular eğitimsel başlangıç profili olarak yorumlanır.</div></aside></section>`,'intake-view');
    document.getElementById('f-purpose').value=state.student.purpose;
    document.querySelector('[data-back]').onclick=()=>{state.screen='home';save();render()};
    document.getElementById('f-birth').onchange=e=>{state.student.birth=e.target.value;save();render()};
    document.getElementById('create-session').onclick=()=>{
      state.student.name=document.getElementById('f-name').value.trim();state.student.birth=document.getElementById('f-birth').value;state.student.language=document.getElementById('f-lang').value.trim()||'Türkçe';state.student.assessor=document.getElementById('f-assessor').value.trim();state.student.purpose=document.getElementById('f-purpose').value;state.student.age=months(state.student.birth);
      const err=document.getElementById('form-error');
      if(!state.student.name)return err.textContent='Öğrenci adı gerekli.';
      if(!ENGINE.ageBand(state.student.age))return err.textContent='E3 için doğum tarihi 36–47 tamamlanmış ay aralığında olmalı.';
      if(!state.student.assessor)return err.textContent='Değerlendiren eğitimci alanını doldurun.';
      state.session.startedAt=state.session.startedAt||new Date().toISOString();state.screen='dashboard';save();render();
    };
  }

  function renderDashboard(){
    const prog=ENGINE.sessionProgress(state.student.age,state.evidence);
    app.innerHTML=shell(`<div class="workspace-head"><div><button class="link-btn" data-home>← Profiller</button><div class="eyebrow">E3 OTURUM DOSYASI</div><h1>${esc(state.student.name)}</h1><div class="meta-row"><span>${state.student.age} ay</span><span>${ENGINE.ageBand(state.student.age).label}</span><span>${esc(state.student.language)}</span><span>${esc(state.student.assessor)}</span></div></div><div class="overall-progress"><div><b>${prog.percent}%</b><span>alan tamamlanma</span></div><div class="progress-bar"><i style="width:${prog.percent}%"></i></div><small>${prog.complete}/10 gelişim alanı</small></div></div>
      <div class="workspace-grid"><aside class="protocol-panel"><h3>Kanıt protokolü</h3><div class="protocol-step"><b>1</b><span>Yaşa uygun çekirdek görev</span></div><div class="protocol-step"><b>2</b><span>Gerektiğinde ayırt edici görev</span></div><div class="protocol-step"><b>3</b><span>Güçlü kanıtta transfer görevi</span></div><div class="protocol-step"><b>4</b><span>45+ ayda nötr tavan keşfi</span></div><p>Tek sonuç yerine farklı görevlerden kanıt biriktirilir. Yorgunluk ve kaçınma ayrı oturum koşulu olarak tutulur.</p><button class="secondary-action" id="caregiver-open">Bakımveren Bölümü <span>${Object.keys(state.caregiver).length}/30</span></button><button class="secondary-action" id="report-open">Ara Raporu Gör</button></aside>
      <main class="domain-board">${BANK.domains.map((d,i)=>domainCard(d,i)).join('')}</main></div>`,'dashboard-view');
    document.querySelector('[data-home]').onclick=()=>{state.screen='home';save();render()};
    document.querySelectorAll('[data-domain]').forEach(b=>b.onclick=()=>startDomain(b.dataset.domain));
    document.getElementById('caregiver-open').onclick=()=>{state.screen='caregiver';save();render()};
    document.getElementById('report-open').onclick=()=>{state.screen='report';save();render()};
  }

  function domainCard(d,i){
    const s=ENGINE.domainSummary(d.id,state.evidence);const next=ENGINE.selectNext(d.id,state.student.age,state.evidence);const sampled=s.completed;const max=ENGINE.ageBand(state.student.age).maxTasks;const pc=pct(sampled,max);
    const tone={RELATIVE_STRENGTH:'strength',DEVELOPING_MIXED:'mixed',WATCH_WITH_SUPPORT:'watch',INSUFFICIENT:'pending'}[s.code]||'pending';
    return `<article class="domain-tile ${tone}"><div class="domain-index">${String(i+1).padStart(2,'0')}</div><div class="domain-body"><div class="domain-title-row"><div><span>${d.short}</span><h2>${d.title}</h2></div><em>${s.status}</em></div><p>${d.facets.join(' · ')}</p><div class="domain-metrics"><span><b>${sampled}</b> görev kaydı</span><span><b>${s.coverage.covered}/${s.coverage.total}</b> boyut</span><span><b>${Math.round(s.coverage.ratio*100)}%</b> kapsam</span></div><div class="domain-track"><i style="width:${pc}%"></i></div></div><button class="domain-action" data-domain="${d.id}">${next?'Devam et':'Alan özeti'} →</button></article>`;
  }

  function startDomain(id){
    state.activeDomain=id;const next=ENGINE.selectNext(id,state.student.age,state.evidence);
    if(!next){state.screen='report';save();render();return}
    state.currentTaskId=next.id;state.taskRuntime={startedAt:Date.now(),touches:0,choice:null,firstMatch:null};state.screen='task';save();render();
  }

  function renderTask(){
    const d=currentDomain(),t=currentTask();if(!d||!t){state.screen='dashboard';save();return render()}
    const s=ENGINE.domainSummary(d.id,state.evidence);const ev=taskEvidence(t.id)||{};const support=ev.support||'';const flags=ev.flags||[];
    app.innerHTML=`<div class="assessment-frame ${state.ui.focus?'focus':''}"><header class="assessment-top"><div><button class="link-btn" id="back-dashboard">← Oturum dosyası</button><span class="domain-label">${esc(d.short)}</span><h1>${esc(d.title)}</h1></div><div class="assessment-status"><span>${s.completed} kayıt</span><span>${s.coverage.covered}/${s.coverage.total} boyut</span><button id="focus-toggle">${state.ui.focus?'Eğitimci panelini aç':'Çocuk odak modu'}</button></div></header>
      <div class="assessment-body"><nav class="domain-rail">${BANK.domains.map((x,i)=>`<button class="rail-item ${x.id===d.id?'active':''}" data-rail="${x.id}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(x.short)}</span></button>`).join('')}</nav>
      <main class="child-canvas"><div class="task-heading"><span class="task-role">${roleLabel(t.role)} · ${t.minAge}+ ay</span><span class="task-id">${t.id}</span></div><h2>${esc(t.childPrompt)}</h2><div id="stimulus-area">${renderStimulus(t)}</div><div class="child-safe-note">Bu ekranda puan, doğru/yanlış geri bildirimi veya süre baskısı gösterilmez.</div></main>
      <aside class="evidence-console"><div class="console-head"><span>EĞİTİMCİ KANIT PANELİ</span><h2>${esc(t.title)}</h2></div><div class="protocol-box"><b>Uygulama protokolü</b><p>${esc(t.protocol)}</p></div><div class="facet-row">${t.facets.map(f=>`<span>${esc(f)}</span>`).join('')}</div><div class="live-metrics"><div><small>İlk tepki</small><b id="latency-value">${ev.latencyMs?formatTime(ev.latencyMs):'ölçülüyor'}</b></div><div><small>Dokunuş</small><b id="touch-value">${ev.touches??state.taskRuntime.touches}</b></div><div><small>İlk seçim</small><b id="match-value">${ev.firstMatch===true?'eşleşti':ev.firstMatch===false?'eşleşmedi':'—'}</b></div></div>
      <label class="console-label">Yardım / bağımsızlık düzeyi</label><div class="support-matrix">${SUPPORTS.map(k=>`<button class="support-chip ${support===k?'selected':''}" data-support="${k}">${ENGINE.SUPPORT_LABELS[k]}</button>`).join('')}</div>
      <label class="console-label">Süreç gözlemleri</label><div class="flag-matrix">${FLAGS.map(([k,l])=>`<button class="flag-chip ${flags.includes(k)?'selected':''}" data-flag="${k}">${l}</button>`).join('')}</div>
      <label class="console-label">Eğitimci notu</label><textarea id="evidence-note" placeholder="Strateji, ifade, yardımın etkisi, dikkat/yorgunluk gibi gözlemleri kısa ve somut yazın.">${esc(ev.note||'')}</textarea>
      <div class="console-actions"><button class="secondary-action" id="neutral-save">Nötr / değerlendirilemedi</button><button class="primary-action" id="save-next">Kanıtı kaydet ve ilerle →</button></div>${t.neutral?'<div class="neutral-warning">Bu bir tavan/keşif görevidir. Yapılamaması alan sonucunu düşürmez.</div>':''}</aside></div></div>`;
    bindTaskEvents(t,ev);
  }

  function roleLabel(r){return {anchor:'Çekirdek',discriminator:'Ayırt edici',transfer:'Transfer',ceiling:'Keşif / tavan'}[r]||r}
  function modalityLabel(m){return {'visual-choice':'Görsel seçim',sorting:'Sınıflama',action:'Yönerge uygulama','object-choice':'Nesne seçimi','scene-choice':'Sahne seçimi',verbal:'Sözel anlatım','scene-description':'Sahne anlatımı','story-sequence':'Öykü sırası',repair:'İletişim onarımı',perspective:'Bakış açısı',retell:'Yeniden anlatım','story-generation':'Öykü üretimi',material:'Gerçek materyal',pattern:'Örüntü',matching:'Eşleme',reasoning:'Akıl yürütme',memory:'Bellek',imitation:'Modelleme','auditory-memory':'İşitsel bellek','sequence-memory':'Sıra belleği','delayed-memory':'Gecikmeli bellek',updating:'Bellek güncelleme','dual-code':'Çift kod','rule-memory':'Kural belleği',interference:'Girişim sonrası hatırlama',attention:'Dikkat','go-wait':'Bekle–başla',rule:'Kural sürdürme','stop-go':'Dur–kalk','visual-search':'Görsel arama','rule-switch':'Kural değişimi',opposite:'Ketleme','alternating-rule':'Çift kural',planning:'Planlama','error-monitor':'Hata izleme','delayed-choice':'Gecikmiş yanıt','strategy-switch':'Strateji esnekliği','emotion-choice':'Duygu seçimi','turn-taking':'Sıra alma','pretend-play':'Sembolik oyun',scenario:'Sosyal senaryo','rule-change':'Kural uyumu',construction:'Yapı kurma',ball:'Top becerisi','selfcare-motor':'Özbakım motoru',drawing:'Grafomotor',observation:'Doğal gözlem',cutting:'Kesme','fine-motor-transfer':'İnce motor transferi',selfcare:'Özbakım',routine:'Günlük rutin','safety-choice':'Güvenlik seçimi','safety-scenario':'Güvenlik senaryosu',choice:'Bağlamsal seçim',sequence:'Sıralama',scaffold:'İpucundan öğrenme','problem-solving':'Problem çözme',transfer:'Transfer','self-correction':'Öz-düzeltme','delayed-transfer':'Gecikmeli transfer','tool-choice':'Araç seçimi',generalization:'Genelleme','teach-back':'Öğretme','far-transfer':'Uzak transfer'}[m]||m}

  function renderStimulus(t){
    const interactive=stimulusFor(t.stimulus);
    if(interactive)return interactive;
    const glyph={VC:'◈',RL:'↳',EL:'◌',MA:'∴',MM:'▦',EF:'⇄',SE:'◎',MO:'✦',DL:'⌂',LT:'↗'}[t.id.slice(0,2)]||'•';
    return `<div class="material-stage"><div class="stage-glyph">${glyph}</div><div><span>${esc(modalityLabel(t.modality))}</span><h3>${esc(t.title)}</h3><p>${materialInstruction(t)}</p></div></div>`;
  }
  function materialInstruction(t){
    if(['material','sorting','action','selfcare','routine','drawing','construction','ball','cutting','turn-taking','pretend-play'].includes(t.modality))return 'Bu görev ekrandan puanlanmaz. Eğitimci yönergeyi uygular; çocuk gerçek materyalle veya doğal davranışla yanıt verir.';
    if(['verbal','scene-description','repair','retell','story-generation','perspective','reasoning','scenario'].includes(t.modality))return 'Eğitimci yönergeyi doğal biçimde seslendirir. Çocuğun sözel, jestsel veya davranışsal yanıtı kanıt olarak kaydedilir.';
    return 'Yönerge eğitimci tarafından okunur; çocuğa doğru/yanlış geri bildirimi verilmez.';
  }

  function stimulusFor(name){
    const sv=(body)=>`<svg class="task-svg" viewBox="0 0 760 340" aria-hidden="true">${body}</svg>`;
    const card=(x,y,w,h,body,idx,correct)=>`<button class="svg-choice" data-choice="${idx}" data-correct="${correct?'1':'0'}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%">${sv(body)}</button>`;
    if(name==='match-object')return `<div class="choice-stage"><div class="reference-mini">${sv('<rect x="260" y="55" width="240" height="230" rx="48" fill="#edf5ff"/><circle cx="380" cy="170" r="58" fill="#5d8ee8"/><circle cx="355" cy="154" r="7" fill="#17324d"/><circle cx="405" cy="154" r="7" fill="#17324d"/><path d="M350 198q30 26 60 0" fill="none" stroke="#17324d" stroke-width="8" stroke-linecap="round"/>')}</div><div class="choice-row">${card(0,0,31,100,'<circle cx="380" cy="170" r="58" fill="#5d8ee8"/><circle cx="355" cy="154" r="7" fill="#17324d"/><circle cx="405" cy="154" r="7" fill="#17324d"/><path d="M350 198q30 26 60 0" fill="none" stroke="#17324d" stroke-width="8" stroke-linecap="round"/>',0,true)}${card(34.5,0,31,100,'<rect x="260" y="105" width="240" height="120" rx="28" fill="#ef7b87"/><circle cx="310" cy="245" r="34" fill="#17324d"/><circle cx="450" cy="245" r="34" fill="#17324d"/>',1,false)}${card(69,0,31,100,'<circle cx="380" cy="180" r="75" fill="#f2c761"/><path d="M380 105q5-45 45-55" stroke="#468a63" stroke-width="14" fill="none" stroke-linecap="round"/>',2,false)}</div></div>`;
    if(name==='size-contrast')return `<div class="choice-stage simple"><div class="choice-row two">${card(0,0,48,100,'<circle cx="380" cy="170" r="95" fill="#5d8ee8"/>',0,true)}${card(52,0,48,100,'<circle cx="380" cy="170" r="48" fill="#5d8ee8"/>',1,false)}</div></div>`;
    if(name==='dual-feature')return `<div class="choice-stage simple"><div class="choice-row">${card(0,0,31,100,'<circle cx="380" cy="170" r="78" fill="#ef5c62"/>',0,true)}${card(34.5,0,31,100,'<rect x="302" y="92" width="156" height="156" rx="18" fill="#ef5c62"/>',1,false)}${card(69,0,31,100,'<circle cx="380" cy="170" r="78" fill="#4d7fe8"/>',2,false)}</div></div>`;
    return null;
  }

  function bindTaskEvents(t,ev){
    document.getElementById('back-dashboard').onclick=()=>{state.screen='dashboard';save();render()};
    document.getElementById('focus-toggle').onclick=()=>{state.ui.focus=!state.ui.focus;save();render()};
    document.querySelectorAll('[data-rail]').forEach(b=>b.onclick=()=>{state.activeDomain=b.dataset.rail;const n=ENGINE.selectNext(state.activeDomain,state.student.age,state.evidence);if(n){state.currentTaskId=n.id;state.taskRuntime={startedAt:Date.now(),touches:0,choice:null,firstMatch:null};save();render()}else{state.screen='report';save();render()}});
    document.querySelectorAll('[data-support]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-support]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
    document.querySelectorAll('[data-flag]').forEach(b=>b.onclick=()=>b.classList.toggle('selected'));
    document.querySelectorAll('.svg-choice').forEach(b=>b.onclick=()=>{
      state.taskRuntime.touches++;if(state.taskRuntime.choice===null){state.taskRuntime.choice=b.dataset.choice;state.taskRuntime.firstMatch=b.dataset.correct==='1';if(!state.taskRuntime.startedAt)state.taskRuntime.startedAt=Date.now()}
      document.querySelectorAll('.svg-choice').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');document.getElementById('touch-value').textContent=state.taskRuntime.touches;document.getElementById('match-value').textContent=state.taskRuntime.firstMatch?'eşleşti':'eşleşmedi';save();
    });
    document.getElementById('save-next').onclick=()=>persistTask(false);
    document.getElementById('neutral-save').onclick=()=>persistTask(true);
  }

  function persistTask(neutral){
    const t=currentTask();if(!t)return;
    let support=neutral?'NOT_ASSESSED':document.querySelector('[data-support].selected')?.dataset.support;
    if(!support){alert('Önce yardım / bağımsızlık düzeyini seçin.');return}
    const flags=[...document.querySelectorAll('[data-flag].selected')].map(x=>x.dataset.flag);
    const latency=state.taskRuntime.startedAt?Date.now()-state.taskRuntime.startedAt:null;
    const ev=ENGINE.createEvidence(t.id,{support,firstMatch:state.taskRuntime.firstMatch,latencyMs:latency,touches:state.taskRuntime.touches,flags,note:document.getElementById('evidence-note').value.trim(),response:state.taskRuntime.choice,neutral});
    state.evidence[t.id]=ev;save();
    const next=ENGINE.selectNext(state.activeDomain,state.student.age,state.evidence);
    if(next){state.currentTaskId=next.id;state.taskRuntime={startedAt:Date.now(),touches:0,choice:null,firstMatch:null};save();render()}
    else{state.screen='dashboard';state.currentTaskId=null;save();render()}
  }

  function renderCaregiver(){
    const done=Object.keys(state.caregiver).length;
    app.innerHTML=shell(`<div class="workspace-head compact"><div><button class="link-btn" id="cg-back">← Oturum dosyası</button><div class="eyebrow">BAKIMVEREN KANITI</div><h1>Günlük yaşam gözlemi</h1><p class="lead">Bakımveren yanıtı çocuk görevini “doğru/yanlış” yapmaz; farklı bağlamdan ek kanıt sağlar.</p></div><div class="overall-progress"><div><b>${done}/30</b><span>yanıtlandı</span></div><div class="progress-bar"><i style="width:${pct(done,30)}%"></i></div></div></div>
      <main class="caregiver-board">${BANK.domains.map(d=>`<section class="cg-domain"><div class="cg-domain-head"><span>${d.id}</span><h2>${esc(d.title)}</h2></div>${BANK.caregiver.filter(q=>q.domainId===d.id).map(q=>`<article class="cg-item"><p>${esc(q.prompt)}</p><div class="cg-scale">${q.responseScale.map(r=>`<button data-cg="${q.id}" data-value="${esc(r)}" class="${state.caregiver[q.id]===r?'selected':''}">${esc(r)}</button>`).join('')}</div></article>`).join('')}</section>`).join('')}</main>`,'caregiver-view');
    document.getElementById('cg-back').onclick=()=>{state.screen='dashboard';save();render()};
    document.querySelectorAll('[data-cg]').forEach(b=>b.onclick=()=>{state.caregiver[b.dataset.cg]=b.dataset.value;save();renderCaregiver()});
  }

  function renderReport(){
    const prog=ENGINE.sessionProgress(state.student.age,state.evidence);
    app.innerHTML=shell(`<div class="workspace-head compact"><div><button class="link-btn" id="report-back">← Oturum dosyası</button><div class="eyebrow">ARA DEĞERLENDİRME RAPORU</div><h1>${esc(state.student.name)}</h1><div class="meta-row"><span>${state.student.age} ay</span><span>${ENGINE.ageBand(state.student.age).label}</span><span>${Object.keys(state.evidence).length} görev kaydı</span><span>${Object.keys(state.caregiver).length}/30 bakımveren</span></div></div><div class="report-seal"><b>${prog.percent}%</b><span>alan tamamlanma</span></div></div>
      <div class="report-warning">Bu rapor norm, tanı veya “gelişim yaşı” üretmez. Etiketler yalnız bu değerlendirmede toplanan kanıtın bağımsızlık ve destek örüntüsünü betimler.</div>
      <main class="report-grid">${prog.domains.map((r,i)=>`<article class="report-domain"><div class="report-no">${String(i+1).padStart(2,'0')}</div><div><span>${esc(r.domain.short)}</span><h2>${esc(r.domain.title)}</h2><p>${esc(r.status)}</p><div class="report-stats"><b>${r.completed}</b> görev · <b>${r.coverage.covered}/${r.coverage.total}</b> boyut · <b>${r.stats.strong}</b> bağımsız güçlü kanıt · <b>${r.stats.supported}</b> yoğun destek kanıtı</div></div></article>`).join('')}</main><div class="report-actions"><button class="secondary-action" id="new-session">Yeni oturum</button><button class="primary-action" id="continue-session">Değerlendirmeye devam et</button></div>`,'report-view');
    document.getElementById('report-back').onclick=()=>{state.screen='dashboard';save();render()};
    document.getElementById('continue-session').onclick=()=>{state.screen='dashboard';save();render()};
    document.getElementById('new-session').onclick=()=>{if(confirm('Mevcut yerel önizleme oturumunu temizleyip yeni oturum açılsın mı?'))reset()};
  }

  render();
})();
