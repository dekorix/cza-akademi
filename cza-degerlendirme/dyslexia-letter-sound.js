(function () {
  const letterSoundTasks = [
    {id:'DYS-LS01',phase:'ISINMA / TABAN',mode:'RAPID',title:'Temiz Başlangıç Dizisi',child:'Bu harfleri soldan sağa tek tek gör. Harfin adını değil, çıkardığı sesi söyle.',letters:['m','s','k','l','n'],educator:'Önce karıştırılması düşük bir diziyle otomatik erişim tabanı al. Her harfte uzun bekleme, harf adı söyleme veya geri dönüş varsa not et.',focus:'Temel harf–ses erişimi · tepki akışı · otomatiklik',probe:'İlk turda ipucu verme. Bir harfte takılırsa 5 saniye bekle; sonra yalnız “harfin sesini söyle” yönergesini tekrarla.'},
    {id:'DYS-LS02',phase:'AYIRT EDİCİ',mode:'SPEAK',title:'b Sesine Erişim',child:'Bu harfe bak. Adını değil, çıkardığı sesi söyle.',stimulus:'b',educator:'Tek harfi izole sun. Çocuk “be” derse doğru kabul etmeden harf adı kullandığını ayrı işaretle. İlk ses üretimine kadar geçen süreyi kaydet.',focus:'b grafeminden foneme erişim · ad/ses ayrımı',probe:'Yanıt yoksa “kelimenin içindeyken nasıl ses çıkarıyor?” diye tek nötr soru sor.'},
    {id:'DYS-LS03',phase:'AYIRT EDİCİ',mode:'SPEAK',title:'d Sesine Erişim',child:'Şimdi bu harfin çıkardığı sesi söyle.',stimulus:'d',educator:'b görevinden hemen sonra uygula. Önceki harfin sesini sürdürme, yön benzerliği nedeniyle karıştırma ve öz-düzeltmeyi ayrı kaydet.',focus:'d grafeminden foneme erişim · b/d karışma örüntüsü',probe:'Harfi parmakla çevirme, yönünü tarif etme veya cevabı çağrıştıracak jest kullanma.'},
    {id:'DYS-LS04',phase:'AYIRT EDİCİ',mode:'SPEAK',title:'p Sesine Erişim',child:'Bu harfin çıkardığı sesi söyle.',stimulus:'p',educator:'b ve d sonrasında üçüncü benzer biçimli grafemi sun. Sesin sertleşmesi, b ile karışma veya görsel yön hatasını gözle.',focus:'p grafeminden foneme erişim · b/p ayrımı',probe:'Yalnız yönergeyi tekrarla; doğru harfin adını söyleme.'},
    {id:'DYS-LS05',phase:'TERS YÖN',mode:'SELECT',title:'Sesi Duy, Harfi Bul',child:'Ben /d/ sesini söyleyeceğim. Bu sesi gösteren harfi seç.',promptSound:'/d/',choices:['b','d','p'],expected:'d',educator:'Bu kez yönü tersine çevir: sesten grafeme git. İlk dokunuşu değiştirmeden kaydet. Doğru seçimden sonra nedenini sormak zorunlu değildir.',focus:'Fonemden grafeme erişim · b/d/p seçiciliği',probe:'Tekrar gerekirse /d/ sesini doğal biçimde bir kez daha söyle; “ortadaki” gibi konum ipucu verme.'},
    {id:'DYS-LS06',phase:'İNCE AYRIM',mode:'SELECT',title:'İşaret Sesi Değiştiriyor',child:'Ben /ü/ sesini söyleyeceğim. Doğru harfi seç.',promptSound:'/ü/',choices:['u','ü','n'],expected:'ü',educator:'Üst işareti yalnız görsel ayrıntı olarak değil, ses değerini değiştiren bir özellik olarak kullanıp kullanmadığını gözle.',focus:'u/ü ses–grafem ayrımı · diakritik farkındalık',probe:'Yanlışta “noktalarına bak” deme; bu, görsel ipucunu cevaba dönüştürür.'},
    {id:'DYS-LS07',phase:'OTOMATİKLİK',mode:'RAPID',title:'Ses Şeridi',child:'Bu sırayı soldan sağa seslendir. Harf adlarını değil, seslerini kullan.',letters:['o','ö','u','ü','s','ş','c','ç'],educator:'Ritim, duraklama, tekrar, geri dönüş ve işaretli harflerdeki gecikmeyi ayrı gözle. Hız yarışı yaptırma; doğal ve kesintisiz erişimi izle.',focus:'Karışık harf–ses otomatikliği · yakın harf çiftleri · ritim',probe:'Satır kaybolursa yalnız kaldığı yeri göster; harfin sesini verme.'},
    {id:'DYS-LS08',phase:'BİÇİM DEĞİŞİMİ',mode:'SELECT',title:'Büyük–Küçük Harf Köprüsü',child:'Soldaki “b” harfinin büyük hâlini seç.',reference:'b',choices:['B','D','P'],expected:'B',educator:'Ses değeri aynı kalırken harf biçimi değiştiğinde eşlemeyi koruyup korumadığını izle. Seçimden sonra seçtiği harfin sesini de söylemesini iste.',focus:'Büyük–küçük harf genellemesi · biçimden bağımsız ses temsili',probe:'Seçim doğru fakat ses yanlışsa bunu kısmi kanıt olarak kaydet.'},
    {id:'DYS-LS09',phase:'KISA GECİKME',mode:'DELAY',title:'Gör – Tut – Yeniden Bul',child:'“ş” harfine kısa süre bak. Harf kapandıktan sonra aynı sesi gösteren harfi yeniden bul.',stimulus:'ş',choices:['s','ş','c','ç'],expected:'ş',educator:'Bu görev otomatikliği kısa süreli görsel sembol tutmayla çaprazlar. Tek başına harf–ses yetersizliği diye yorumlama; çalışma belleği alanıyla birlikte değerlendir.',focus:'Kısa gecikmede grafem–fonem izini koruma · benzer çeldiriciden seçme',probe:'Harf kapandıktan sonra şekli tarif etme. Çocuk isterse sesi kendi kendine tekrar edebilir; bunu strateji olarak not et.'},
    {id:'DYS-LS10',phase:'TRANSFER / KARARLILIK',mode:'RAPID',title:'Yeni Sırada Aynı Bilgi',child:'Şimdi harfler farklı sırada. Yine soldan sağa seslerini söyle.',letters:['ç','ö','b','ü','d','ş','p','c'],educator:'Önceki görevlerde görülen harfleri yeni sırada sun. Ezberlenmiş dizi yerine tek tek sembole erişim olup olmadığını ve karışmaların tekrar edip etmediğini izle.',focus:'Yeni sıraya transfer · erişim kararlılığı · tekrar eden hata örüntüsü',probe:'İlk tur tamamlanmadan düzeltme yapma. Tur sonunda çocuk isterse kendi hatasını gözden geçirsin.'}
  ];

  const letterSoundFlags = [
    'Harf adını söyledi','b–d karıştı','b–p karıştı','d–p karıştı',
    'u–ü karıştı','o–ö karıştı','s–ş karıştı','c–ç karıştı',
    'Uzun arama / gecikme','Geri dönüp tekrar okudu','Satır / sıra kaybetti',
    'Kendini düzeltti','Yönergeyi tekrar istedi'
  ];

  function ensureLsState() {
    if (!state.dysLsEvidence) state.dysLsEvidence = {};
    if (!Number.isInteger(state.dysLsTaskIndex)) state.dysLsTaskIndex = 0;
    if (typeof state.dysLsDelayRevealed !== 'boolean') state.dysLsDelayRevealed = false;
  }

  function getEvidence(task) {
    ensureLsState();
    return Object.assign({
      taskId:task.id,response:'',choice:'',verdict:'',support:'',
      firstMatch:null,latencyMs:null,note:'',flags:[]
    }, state.dysLsEvidence[task.id] || {});
  }

  function letterStrip(letters) {
    return '<div class="letter-strip">' + letters.map(function (letter, index) {
      return '<span><small>' + (index + 1) + '</small>' + esc(letter) + '</span>';
    }).join('') + '</div>';
  }

  function choiceGrid(task) {
    return '<div class="letter-choice-grid">' + task.choices.map(function (letter) {
      return '<button class="letter-choice" data-letter="' + esc(letter) + '">' + esc(letter) + '</button>';
    }).join('') + '</div>';
  }

  function stimulusHtml(task) {
    if (task.mode === 'RAPID') return letterStrip(task.letters);
    if (task.mode === 'SELECT') {
      var reference = task.reference
        ? '<div class="letter-reference"><span>Referans</span><b>' + esc(task.reference) + '</b></div>'
        : '';
      var prompt = task.promptSound
        ? '<div class="sound-prompt"><span>Duyulan ses</span><b>' + esc(task.promptSound) + '</b></div>'
        : '';
      return reference + prompt + choiceGrid(task);
    }
    if (task.mode === 'DELAY') {
      if (!state.dysLsDelayRevealed) {
        return '<div class="delay-stage"><span>Kısa süre incele</span><b>' + esc(task.stimulus) + '</b><small>Harf kendiliğinden kapanacak.</small></div>';
      }
      return '<div class="delay-stage hidden-stimulus"><span>Şimdi hatırla</span><b>?</b></div>' + choiceGrid(task);
    }
    return '<div class="single-letter-card"><span>HARF</span><b>' + esc(task.stimulus || '') + '</b></div>';
  }

  function patternLabel(code) {
    var row = dyslexiaVerdicts.find(function (item) { return item[0] === code; });
    return row ? row[1] : '—';
  }

  function supportLabel(code) {
    var row = supportOptions.find(function (item) { return item[0] === code; });
    return row ? row[1] : '—';
  }

  function taskType(task) {
    if (task.mode === 'RAPID') return 'SES ŞERİDİ';
    if (task.mode === 'SELECT') return 'SEÇİM GÖREVİ';
    if (task.mode === 'DELAY') return 'KISA GECİKME';
    return 'TEK HARF';
  }

  window.startDyslexiaLetterSound = function () {
    ensureLsState();
    state.dysLsTaskIndex = Math.min(state.dysLsTaskIndex, letterSoundTasks.length - 1);
    state.dysLsDelayRevealed = false;
    state.taskStartedAt = Date.now();
    state.screen = 'dyslexia-ls-task';
    render();
  };

  function nextTask() {
    saveState();
    if (state.dysLsTaskIndex + 1 >= letterSoundTasks.length) {
      state.screen = 'dyslexia-ls-summary';
      state.dysLsDelayRevealed = false;
      render();
      return;
    }
    state.dysLsTaskIndex += 1;
    state.dysLsDelayRevealed = false;
    state.taskStartedAt = Date.now();
    render();
  }

  window.dyslexiaLetterSoundTask = function () {
    ensureLsState();
    var task = letterSoundTasks[state.dysLsTaskIndex];
    if (!task) {
      state.screen = 'dyslexia-ls-summary';
      render();
      return;
    }
    if (!state.taskStartedAt) state.taskStartedAt = Date.now();

    var evidence = getEvidence(task);
    var progress = Math.round((state.dysLsTaskIndex / Math.max(1, letterSoundTasks.length)) * 100);
    var needsText = task.mode === 'SPEAK' || task.mode === 'RAPID';

    var verdictButtons = dyslexiaVerdicts.map(function (item) {
      return '<button class="verdict-btn ' + (evidence.verdict === item[0] ? 'selected' : '') +
        '" data-verdict="' + item[0] + '">' + esc(item[1]) + '</button>';
    }).join('');

    var supportButtons = supportOptions.map(function (item) {
      return '<button class="support-btn ' + (evidence.support === item[0] ? 'selected' : '') +
        '" data-support="' + item[0] + '">' + esc(item[1]) + '</button>';
    }).join('');

    var flagButtons = letterSoundFlags.map(function (flag) {
      return '<button class="flag-btn ' + ((evidence.flags || []).includes(flag) ? 'selected' : '') +
        '" data-flag="' + esc(flag) + '">' + esc(flag) + '</button>';
    }).join('');

    var responseArea = needsText
      ? '<label class="panel-label" for="lsResponse">Çocuğun ilk yanıtı / ses dizisi</label>' +
        '<input id="lsResponse" class="response-input" placeholder="Yanıtı olduğu gibi yaz" value="' + esc(evidence.response || '') + '">'
      : '<div class="choice-evidence"><span>İlk seçim</span><b>' + (evidence.choice ? esc(evidence.choice) : 'Henüz yok') + '</b></div>';

    app.innerHTML =
      '<main class="station-page">' +
        '<header class="station-header dys-station-header">' +
          '<div><div class="eyebrow">OKUMA GÜÇLÜĞÜ · ALAN 02</div><h1>Harf–Ses Otomatikliği</h1></div>' +
          '<div class="station-progress"><span>Görev ' + (state.dysLsTaskIndex + 1) + '/' + letterSoundTasks.length + '</span>' +
            '<div class="progress-track"><i style="width:' + progress + '%"></i></div></div>' +
          '<button class="focus-toggle" id="backDysOverviewLs">Alan haritası</button>' +
        '</header>' +
        '<section class="station-layout">' +
          '<div class="child-stage dys-child-stage">' +
            '<div class="child-top"><span class="child-label">ÇOCUKLA UYGULAMA</span><span class="phase-chip">' + esc(task.phase) + '</span></div>' +
            '<div class="task-count">' + String(state.dysLsTaskIndex + 1).padStart(2,'0') + '</div>' +
            '<div class="letter-task-card"><span class="letter-task-type">' + taskType(task) + '</span>' +
              '<h2>' + esc(task.child) + '</h2>' + stimulusHtml(task) + '</div>' +
            '<div class="child-footer">Doğru/yanlış geri bildirimi verme. İlk tepkiyi ve düzeltmeleri ayrı kaydet.</div>' +
          '</div>' +
          '<aside class="educator-panel">' +
            '<div class="panel-kicker">EĞİTİMCİ KANIT PANELİ</div><h2>' + esc(task.title) + '</h2>' +
            '<p class="educator-instruction">' + esc(task.educator) + '</p>' +
            '<div class="evidence-focus"><span>Ölçülen kanıt</span><b>' + esc(task.focus) + '</b></div>' +
            '<div class="probe-note"><b>Nötr probe:</b> ' + esc(task.probe) + '</div>' +
            responseArea +
            '<div class="micro-stats">' +
              '<div><span>Tepki süresi</span><b>' + (evidence.latencyMs != null ? (evidence.latencyMs/1000).toFixed(1) + ' sn' : '—') + '</b></div>' +
              '<div><span>İlk seçim</span><b>' + (evidence.firstMatch === true ? 'Eşleşti' : evidence.firstMatch === false ? 'Farklı' : '—') + '</b></div>' +
              '<div><span>Görev</span><b>' + esc(task.id) + '</b></div>' +
            '</div>' +
            '<label class="panel-label">Yanıt örüntüsü</label><div class="verdict-grid">' + verdictButtons + '</div>' +
            '<label class="panel-label">Destek düzeyi</label><div class="support-grid">' + supportButtons + '</div>' +
            '<label class="panel-label">Hata / öğrenme işaretleri</label><div class="flag-grid">' + flagButtons + '</div>' +
            '<label class="panel-label" for="lsNote">Kısa gözlem notu</label>' +
            '<textarea id="lsNote" placeholder="Örn. b harfine 4 sn sonra /d/ dedi; ardından kendini düzeltti.">' + esc(evidence.note || '') + '</textarea>' +
            '<div class="adaptive-note"><b>Yorum kuralı:</b> Tek harf hatası tanısal değildir. Tekrarlayan çift karışmaları, gecikme, harf adı/ses ayrımı ve ters yön erişimi birlikte yorumlanır.</div>' +
            '<div class="panel-actions"><button class="secondary-btn" id="lsSkip">Değerlendirilemedi</button><button class="primary-btn" id="lsNext">Kaydet ve sonraki →</button></div>' +
          '</aside>' +
        '</section>' +
      '</main>';

    document.getElementById('backDysOverviewLs').onclick = function () {
      state.screen = 'dyslexia-overview';
      render();
    };

    if (task.mode === 'DELAY' && !state.dysLsDelayRevealed) {
      window.setTimeout(function () {
        if (state.screen === 'dyslexia-ls-task' &&
            letterSoundTasks[state.dysLsTaskIndex] &&
            letterSoundTasks[state.dysLsTaskIndex].id === task.id &&
            !state.dysLsDelayRevealed) {
          state.dysLsDelayRevealed = true;
          state.taskStartedAt = Date.now();
          render();
        }
      }, 3000);
    }

    document.querySelectorAll('.letter-choice').forEach(function (button) {
      button.onclick = function () {
        var row = getEvidence(task);
        if (!row.choice) {
          row.latencyMs = Math.max(0, Date.now() - state.taskStartedAt);
          row.firstMatch = task.expected ? button.dataset.letter === task.expected : null;
        }
        row.choice = button.dataset.letter;
        state.dysLsEvidence[task.id] = row;
        render();
      };
    });

    var response = document.getElementById('lsResponse');
    if (response) {
      response.oninput = function (event) {
        var row = getEvidence(task);
        if (!row.response && event.target.value.trim()) {
          row.latencyMs = Math.max(0, Date.now() - state.taskStartedAt);
        }
        row.response = event.target.value;
        state.dysLsEvidence[task.id] = row;
        saveState();
      };
    }

    document.querySelectorAll('.verdict-btn').forEach(function (button) {
      button.onclick = function () {
        var row = getEvidence(task);
        row.verdict = button.dataset.verdict;
        state.dysLsEvidence[task.id] = row;
        render();
      };
    });

    document.querySelectorAll('.support-btn').forEach(function (button) {
      button.onclick = function () {
        var row = getEvidence(task);
        row.support = button.dataset.support;
        state.dysLsEvidence[task.id] = row;
        render();
      };
    });

    document.querySelectorAll('.flag-btn').forEach(function (button) {
      button.onclick = function () {
        var row = getEvidence(task);
        var flag = button.dataset.flag;
        row.flags = row.flags || [];
        row.flags = row.flags.includes(flag)
          ? row.flags.filter(function (item) { return item !== flag; })
          : row.flags.concat([flag]);
        state.dysLsEvidence[task.id] = row;
        render();
      };
    });

    document.getElementById('lsNote').oninput = function (event) {
      var row = getEvidence(task);
      row.note = event.target.value;
      state.dysLsEvidence[task.id] = row;
      saveState();
    };

    document.getElementById('lsSkip').onclick = function () {
      var row = getEvidence(task);
      row.verdict = 'NO_RESPONSE';
      row.support = 'NOT_ASSESSED';
      row.note = document.getElementById('lsNote').value;
      state.dysLsEvidence[task.id] = row;
      nextTask();
    };

    document.getElementById('lsNext').onclick = function () {
      var row = getEvidence(task);
      if (response) row.response = response.value.trim();
      row.note = document.getElementById('lsNote').value;
      if ((task.mode === 'SELECT' || task.mode === 'DELAY') && !row.choice) {
        alert('Önce çocuğun ilk seçimini kaydet.');
        return;
      }
      if (!row.verdict) {
        alert('Yanıt örüntüsünü seç.');
        return;
      }
      if (!row.support) {
        alert('Destek düzeyini seç.');
        return;
      }
      state.dysLsEvidence[task.id] = row;
      nextTask();
    };
  };

  window.dyslexiaLetterSoundSummary = function () {
    ensureLsState();
    var rows = letterSoundTasks.map(function (task) {
      return state.dysLsEvidence[task.id];
    }).filter(Boolean).filter(function (row) {
      return row.support !== 'NOT_ASSESSED';
    });

    var match = rows.filter(function (row) { return row.verdict === 'MATCH'; }).length;
    var partial = rows.filter(function (row) { return row.verdict === 'PARTIAL'; }).length;
    var independent = rows.filter(function (row) { return row.support === 'INDEPENDENT'; }).length;
    var supported = rows.filter(function (row) {
      return ['VERBAL_PROMPT','VISUAL_PROMPT','MODELED','PHYSICAL_ASSIST'].includes(row.support);
    }).length;
    var selectionRows = rows.filter(function (row) { return row.firstMatch != null; });
    var firstMatches = selectionRows.filter(function (row) { return row.firstMatch === true; }).length;

    var flagCounts = {};
    rows.forEach(function (row) {
      (row.flags || []).forEach(function (flag) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      });
    });
    var dominant = Object.entries(flagCounts).sort(function (a,b) { return b[1] - a[1]; }).slice(0,4);

    var status = 'Kanıt yetersiz';
    var cls = 'insufficient';
    if (rows.length >= 7) {
      var matchRate = match / rows.length;
      var supportRate = supported / rows.length;
      if (matchRate >= .75 && supportRate <= .25) {
        status = 'Göreli güçlü harf–ses erişimi';
        cls = 'strength';
      } else if (matchRate < .45 || supportRate > .5) {
        status = 'Yakın destek gerektiren harf–ses örüntüsü';
        cls = 'watch';
      } else {
        status = 'Karışık / gelişen otomatiklik';
        cls = 'developing';
      }
    }

    var phonologyRows = dyslexiaTasks.map(function (task) {
      return state.dysEvidence[task.id];
    }).filter(Boolean).filter(function (row) {
      return row.support !== 'NOT_ASSESSED';
    });
    var phonologyMatch = phonologyRows.filter(function (row) { return row.verdict === 'MATCH'; }).length;
    var phonologySupport = phonologyRows.filter(function (row) {
      return ['VERBAL_PROMPT','VISUAL_PROMPT','MODELED','PHYSICAL_ASSIST'].includes(row.support);
    }).length;
    var crossText = 'Fonolojik alan henüz yeterli kanıt içermiyor; iki alan birlikte tamamlandığında çapraz yorum güçlenecek.';
    if (phonologyRows.length >= 6 && rows.length >= 7) {
      var phWeak = phonologyMatch / phonologyRows.length < .5 || phonologySupport / phonologyRows.length > .5;
      var lsWeak = match / rows.length < .5 || supported / rows.length > .5;
      if (phWeak && lsWeak) crossText = 'Ses işleme ile harf–ses erişimi birlikte destek istiyor. Sonraki çözümleme ve dikte alanlarında aynı örüntünün sürüp sürmediği kontrol edilmeli.';
      else if (!phWeak && lsWeak) crossText = 'Fonolojik işlem görece korunurken harf–ses erişiminde zorlanma görülüyor. Sembol tanıma ve otomatik erişim ekseni özellikle izlenmeli.';
      else if (phWeak && !lsWeak) crossText = 'Harf–ses erişimi görece korunurken fonolojik manipülasyon daha fazla destek istiyor. İşitsel ses işleme ekseni özellikle izlenmeli.';
      else crossText = 'İlk iki alanda görece güçlü kanıt var. Okuma güçlüğü şüphesi varsa çözümleme, akıcılık, dikte ve çalışma belleği alanlarıyla tarama sürdürülmeli.';
    }

    var rowsHtml = letterSoundTasks.map(function (task) {
      var evidence = state.dysLsEvidence[task.id];
      return '<div class="table-row"><b>' + esc(task.title) + ' · ' + esc(task.phase) + '</b>' +
        '<span>' + (evidence ? esc(patternLabel(evidence.verdict)) : '—') + '</span>' +
        '<span>' + (evidence ? esc(supportLabel(evidence.support)) : '—') + '</span>' +
        '<span>' + (evidence && evidence.latencyMs != null ? (evidence.latencyMs/1000).toFixed(1) + ' sn' : '—') + '</span></div>';
    }).join('');

    app.innerHTML =
      '<main class="page"><section class="hero dyslexia-accent">' +
        '<div class="top-actions"><button class="text-btn" id="backDysOverviewLsSum">← 12 alan haritası</button><span class="step-chip">Alan 02 tamamlandı</span></div>' +
        '<div class="summary-hero"><div><div class="eyebrow">' + esc(state.name).toUpperCase() + ' · HARF–SES OTOMATİKLİĞİ</div>' +
          '<h1>İkinci alanın kanıt özeti</h1><p>Grafem → fonem, fonem → grafem, benzer harf çiftleri, ritim ve yeni sıraya transfer birlikte özetlenir.</p></div>' +
          '<div class="status-orb ' + cls + '"><span>Alan görünümü</span><b>' + esc(status) + '</b></div></div>' +
        '<div class="summary-grid">' +
          '<article><span>Değerlendirilen görev</span><b>' + rows.length + '</b><small>Planlanan: ' + letterSoundTasks.length + '</small></article>' +
          '<article><span>Hedef örüntü</span><b>' + match + '</b><small>Kısmi: ' + partial + '</small></article>' +
          '<article><span>Bağımsız</span><b>' + independent + '</b><small>Destekli: ' + supported + '</small></article>' +
          '<article><span>Seçimde ilk eşleşme</span><b>' + (selectionRows.length ? Math.round(firstMatches/selectionRows.length*100) + '%' : '—') + '</b><small>Sesten harfe / gecikmeli seçim</small></article>' +
        '</div>' +
        '<div class="evidence-table"><div class="table-head"><span>Görev</span><span>Yanıt örüntüsü</span><span>Destek</span><span>Tepki</span></div>' + rowsHtml + '</div>' +
        '<div class="pattern-box"><div><span>Tekrar eden karışma / davranışlar</span><b>' +
          (dominant.length ? dominant.map(function (item) { return esc(item[0]) + ' (' + item[1] + ')'; }).join(' · ') : 'Belirgin tekrar eden işaret kaydedilmedi') +
          '</b></div><div><span>İki alanın çapraz yorumu</span><b>' + esc(crossText) + '</b></div></div>' +
        '<div class="clinical-boundary"><b>Rapor dili:</b> “Harfleri bilmiyor” gibi kaba bir etiket yerine hangi harf çiftlerinde, hangi yönde, hangi hızda ve hangi destek düzeyinde karışma görüldüğünü raporla.</div>' +
        '<div class="launch-panel dys-launch"><div><b>Sıradaki geliştirme: Görsel / Ortografik Ayırt Etme</b><p>İlk iki alan artık ses sistemi ile harf koduna erişimi ayrı ayrı gösterebiliyor.</p></div>' +
          '<div class="summary-actions"><button class="secondary-btn" id="reviewDysLs">02 alanını yeniden incele</button><button class="primary-btn" id="returnDysMap">Alan haritasına dön</button></div></div>' +
      '</section></main>';

    document.getElementById('backDysOverviewLsSum').onclick =
      document.getElementById('returnDysMap').onclick = function () {
        state.screen = 'dyslexia-overview';
        render();
      };
    document.getElementById('reviewDysLs').onclick = function () {
      state.dysLsTaskIndex = 0;
      state.dysLsDelayRevealed = false;
      state.taskStartedAt = Date.now();
      state.screen = 'dyslexia-ls-task';
      render();
    };
  };

  function enhanceOverview() {
    var cards = document.querySelectorAll('.domain-card');
    if (cards[1]) {
      cards[1].classList.add('ready');
      var stateEl = cards[1].querySelector('.domain-state');
      if (stateEl) stateEl.textContent = 'CANLI';
    }
    var score = document.querySelector('.route-score.dys-score');
    if (score) score.innerHTML = '<b>2/12</b><span>alan canlı</span>';

    var launch = document.querySelector('.launch-panel.dys-launch');
    if (launch && !document.getElementById('launchDysLs')) {
      var copy = launch.querySelector('div');
      if (copy) copy.innerHTML = '<b>İki derin tarama alanı aktif</b><p>01 Fonolojik İşleme: 8 görev · 02 Harf–Ses Otomatikliği: 10 görev. Kanıtları ayrı tutulur, sonuçta çaprazlanır.</p>';
      var button = document.createElement('button');
      button.className = 'secondary-btn';
      button.id = 'launchDysLs';
      button.textContent = '02 Harf–Ses →';
      button.onclick = window.startDyslexiaLetterSound;
      var firstButton = document.getElementById('launchDys');
      if (firstButton) launch.insertBefore(button, firstButton);
    }
  }

  function enhancePhonologySummary() {
    var launch = document.querySelector('.launch-panel.dys-launch');
    if (!launch || document.getElementById('startDysLs')) return;
    launch.innerHTML =
      '<div><b>Sıradaki çalışan alan: Harf–Ses Otomatikliği</b><p>Fonolojik kanıtı şimdi sembol → ses ve ses → sembol erişimiyle çaprazlayabiliriz.</p></div>' +
      '<div class="summary-actions"><button class="secondary-btn" id="reviewDys">Fonolojiyi yeniden incele</button><button class="primary-btn" id="startDysLs">02 Harf–Ses alanına geç →</button></div>';
    document.getElementById('reviewDys').onclick = function () {
      state.dysTaskIndex = 0;
      state.taskStartedAt = Date.now();
      state.screen = 'dyslexia-task';
      render();
    };
    document.getElementById('startDysLs').onclick = window.startDyslexiaLetterSound;
  }

  dyslexiaDomains[1][2] = 1;
  const baseRender = render;
  render = function () {
    ensureLsState();
    if (state.screen === 'dyslexia-ls-task') {
      saveState();
      return window.dyslexiaLetterSoundTask();
    }
    if (state.screen === 'dyslexia-ls-summary') {
      saveState();
      return window.dyslexiaLetterSoundSummary();
    }
    var result = baseRender();
    if (state.screen === 'dyslexia-overview') enhanceOverview();
    if (state.screen === 'dyslexia-summary') enhancePhonologySummary();
    return result;
  };

  render();
})();