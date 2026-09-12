(function(root){
  'use strict';
  const bank=root.E3_BANK;if(!bank)throw new Error('E3_BANK must load first');
  const additions={
    VC:[
      {id:'VC13',minAge:36,tier:1,role:'anchor',modality:'visual-choice',title:'Renge Göre Eşle',childPrompt:'Aynı renkte olanı bulur musun?',protocol:'Aynı biçimde üç farklı renk kullan; dilsel renk adı vermeden yalnız örneğe eşlemesini iste.',facets:['eşleme','ayırt-etme'],stimulus:'color-match',scoring:'accuracy'},
      {id:'VC14',minAge:36,tier:1,role:'discriminator',modality:'visual-choice',title:'Şekle Göre Eşle',childPrompt:'Bununla aynı şekli bul.',protocol:'Renkleri değiştir, yalnız şekil ortak kalsın; yüzey renginin çeldirici etkisini gözle.',facets:['eşleme','çoklu-özellik'],stimulus:'shape-match',scoring:'accuracy'}
    ],
    RL:[
      {id:'RL13',minAge:36,tier:1,role:'anchor',modality:'action',title:'Beden Bölgesi Yönergesi',childPrompt:'Burnunu göster.',protocol:'Tanıdık beden bölümlerinden iki doğal deneme yap; sözcüğü tekrar ederek ipucu verme.',facets:['tek-adım'],scoring:'process'},
      {id:'RL14',minAge:36,tier:1,role:'discriminator',modality:'object-choice',title:'İki Nesne Arasından Seç',childPrompt:'Kaşık olanı bana verir misin?',protocol:'Aynı büyüklükte iki tanıdık nesne kullan; işaret etmeden yalnız sözel yönerge ver.',facets:['tek-adım','işlev'],scoring:'accuracy'}
    ],
    EL:[
      {id:'EL13',minAge:36,tier:1,role:'anchor',modality:'verbal',title:'Nesneyi Adlandır',childPrompt:'Bu nedir?',protocol:'Üç tanıdık nesneyi tek tek göster; telaffuz farklılığını anlam bozulmadıkça hata sayma.',facets:['betimleme'],scoring:'process'},
      {id:'EL14',minAge:36,tier:1,role:'discriminator',modality:'scene-description',title:'Eylemi Söyle',childPrompt:'Çocuk ne yapıyor?',protocol:'Tek eylemli sade sahne kullan; isim yerine eylem üretimini gözle.',facets:['betimleme','olay-anlatımı'],scoring:'process'}
    ],
    MA:[
      {id:'MA13',minAge:36,tier:1,role:'anchor',modality:'matching',title:'Bire Bir Eşle',childPrompt:'Her tabağa bir kaşık koy.',protocol:'Üç tabak ve üç kaşık kullan; sayma talep etmeden bire bir eşlemeyi gözle.',facets:['eşleme','nicelik'],scoring:'process'},
      {id:'MA14',minAge:36,tier:1,role:'discriminator',modality:'sorting',title:'Aynıları Bir Araya Getir',childPrompt:'Aynı olanları birlikte koy.',protocol:'İki tür nesneden toplam altı parça kullan; sınıf adını söylemeden gruplat.',facets:['sınıflama','eşleme'],scoring:'process'}
    ],
    MM:[
      {id:'MM13',minAge:36,tier:1,role:'anchor',modality:'delayed-memory',title:'Tek Nesne Kısa Gecikme',childPrompt:'Az önce neyi sakladık?',protocol:'Tek tanıdık nesneyi gösterip 8–10 saniye kapat; arada yeni bilgi verme.',facets:['gecikme','görsel-kısa'],scoring:'process'},
      {id:'MM14',minAge:36,tier:1,role:'discriminator',modality:'auditory-memory',title:'İki Sesli Eylem',childPrompt:'Alkışla, sonra masaya dokun.',protocol:'İki eylemi yalnız sözel söyle; modelleme yapma. Gerekirse destek düzeyini artır.',facets:['işitsel-kısa','sıra'],scoring:'process'}
    ],
    EF:[
      {id:'EF13',minAge:36,tier:1,role:'anchor',modality:'visual-search',title:'Tek Hedefi Tara',childPrompt:'Bütün yıldızları bul.',protocol:'Az sayıda çeldirici arasında üç hedef kullan; göreve dönüşleri ve tarama düzenini gözle.',facets:['hedef-seçimi','sürdürme'],scoring:'process'},
      {id:'EF14',minAge:36,tier:1,role:'discriminator',modality:'go-wait',title:'Sinyali Bekle',childPrompt:'Işık yanınca bloğu koy.',protocol:'İki kısa deneme ile sinyal öncesi bekleme ve sinyal sonrası başlatmayı gözle.',facets:['bekleme','ketleme'],scoring:'process'}
    ],
    SE:[
      {id:'SE13',minAge:36,tier:1,role:'anchor',modality:'scenario',title:'Bağlamdan Duygu',childPrompt:'Oyuncağı kırılan çocuk nasıl hissedebilir?',protocol:'Yüz ifadesine ek olarak kısa bağlam ver; tek kelime veya işaret yanıtını kabul et.',facets:['duygu'],scoring:'process'},
      {id:'SE14',minAge:36,tier:1,role:'discriminator',modality:'turn-taking',title:'Sıranı İste',childPrompt:'Şimdi sen de oynamak istiyorsun. Ne yaparsın?',protocol:'Eğitimci oyuncağı kısa süre elinde tutar; çocuğun sıra isteme biçimini doğal olarak gözler.',facets:['sıra','oyuna-katılma'],scoring:'process'}
    ],
    MO:[
      {id:'MO13',minAge:36,tier:1,role:'anchor',modality:'material',title:'Küçük Parçayı Taşı',childPrompt:'Bu parçaları kutuya koy.',protocol:'Boğulma riski olmayan güvenli büyükçe parçalar kullan; başparmak-parmak koordinasyonunu gözle.',facets:['ince-motor'],scoring:'process'},
      {id:'MO14',minAge:36,tier:1,role:'discriminator',modality:'material',title:'İki Elle Sabitle ve Aç',childPrompt:'Kutuyu tutup kapağını açmayı dener misin?',protocol:'Bir el sabitleme, diğer el işlem yapma gerektiren güvenli materyal kullan.',facets:['iki-el','ince-motor'],scoring:'process'}
    ],
    DL:[
      {id:'DL13',minAge:36,tier:1,role:'anchor',modality:'choice',title:'Günlük Araç Seçimi',childPrompt:'Çorbayı hangisiyle içeriz?',protocol:'Kaşık, tarak ve kalem gibi tanıdık seçenekler kullan; işlevsel günlük yaşam seçimini gözle.',facets:['servis','rutin-sıra'],scoring:'process'},
      {id:'DL14',minAge:36,tier:1,role:'discriminator',modality:'routine',title:'İki Eşyayı Yerleştir',childPrompt:'Ayakkabıyı yerine, oyuncağı kutuya koy.',protocol:'İki farklı günlük eşyanın uygun yerine yerleştirilmesini tek doğal yönergeyle iste.',facets:['düzen','rutin-sıra'],scoring:'process'}
    ],
    LT:[
      {id:'LT13',minAge:36,tier:1,role:'anchor',modality:'imitation',title:'İki Parçalı Modeli Kopyala',childPrompt:'Benim yaptığım gibi yap.',protocol:'İki blokla basit yeni düzen kur; tek model gösteriminden sonra çocuğun kopyasını gözle.',facets:['modelden-öğrenme','benzerlik'],scoring:'process'},
      {id:'LT14',minAge:36,tier:1,role:'discriminator',modality:'tool-choice',title:'Basit Araç Seçimi',childPrompt:'Uzağındaki oyuncağı almak için hangisi işine yarar?',protocol:'İşlevi açık iki araç sun; deneme ve araç değişimini kaydet.',facets:['strateji','benzerlik'],scoring:'process'}
    ]
  };
  for(const d of bank.domains){const extra=additions[d.id]||[];d.tasks.push(...extra)}
  bank.allTasks=bank.domains.flatMap(d=>d.tasks);
  bank.meta.version='E3-v3.1';
  bank.meta.foundationExpansion='Her alanda 36–38 ay için en az altı farklı kanıt fırsatı';
})(typeof globalThis!=='undefined'?globalThis:this);
