(function () {
  const advancedDomains = [
    {
      id:'ORTH', index:2, title:'Görsel / Ortografik Ayırt Etme',
      purpose:'Benzer harf, hece ve kelime biçimlerini kalabalıkta ayırt etme; sıra ve kelime biçimi belleğini inceleme.',
      flags:['Harf sırası değişti','Benzer biçime yöneldi','Kelimeyi tahmin etti','Ayrıntıyı atladı','Satır kaybetti','Kendini düzeltti'],
      tasks:[
        {id:'DYS-OR01',phase:'TABAN',title:'Tam Eşini Bul',child:'Üstteki “kalem” kelimesinin tamamen aynısını seç.',stimulus:'kalem',choices:['kalem','kelam','kalen','kaelm'],expected:'kalem',educator:'Yalnız birebir biçim eşlemesini ölç. Çocuğun kelimeyi sesli okumasını şart koşma.',focus:'Kelime biçimi · harf sırası · görsel seçicilik',probe:'Yanlışta “harfleri tek tek kontrol edebilirsin” dışında ipucu verme.'},
        {id:'DYS-OR02',phase:'İNCE AYRIM',title:'Bir Harf Değişti',child:'“balık” ile tamamen aynı olanı bul.',stimulus:'balık',choices:['balik','balık','bakıl','balıkı'],expected:'balık',educator:'Nokta/işaret farkı ile sıra farkını aynı satırda karıştırma. İlk seçimi kaydet.',focus:'Diakritik ayrım · kelime bütünlüğü',probe:'Doğru harfi söyleme; yalnız “tamamen aynı olmalı” de.'},
        {id:'DYS-OR03',phase:'SIRA',title:'Sıra Korundu mu?',child:'“masa” kelimesinin harf sırası bozulmadan yazılmış olanını seç.',stimulus:'masa',choices:['masa','sama','maas','mssa'],expected:'masa',educator:'Aynı harflerin farklı sıraya girdiği çeldiriciler kullan. Tahmin ve hızlı işaretlemeyi gözle.',focus:'Grafem sırası · dizi takibi',probe:'Parmakla harf harf izleme stratejisini çocuk kendiliğinden kullanırsa not et.'},
        {id:'DYS-OR04',phase:'KISA GECİKME',title:'Kelime İzini Tut',child:'“limon” kelimesine kısa süre bak. Sonra kapatacağız ve aynı biçimi bulacaksın.',stimulus:'limon → (kapat) → limon / milon / limon / limno',educator:'Yaklaşık 3 saniye göster, sonra görünümü kapat. Seçimi not alanına yaz ve gecikmeyi kaydet.',focus:'Ortografik kısa süreli bellek · sıra korunumu',probe:'Kelime kapandıktan sonra yeniden gösterme; gerekirse görev değerlendirilemedi olarak işaretlenebilir.'},
        {id:'DYS-OR05',phase:'DERİNLEŞTİR',title:'Uydurma Biçimi Koru',child:'Bu gerçek bir kelime değil: “noru”. Aynısını seçeneklerden bul.',stimulus:'noru',choices:['noru','nuro','moru','norü'],expected:'noru',educator:'Anlam bilgisinin desteğini kaldır. Görsel biçim ve sıra korunuyor mu izle.',focus:'Anlamdan bağımsız ortografik kod · yeni dizilim',probe:'“Uzaylı kelimesi” diyerek anlamı olmadığını normalleştir.'},
        {id:'DYS-OR06',phase:'TRANSFER',title:'Yeni Biçime Transfer',child:'Şimdi “tesa” için aynı kontrolü yap. Hangisi tamamen aynı?',stimulus:'tesa',choices:['tase','tesa','teso','seta'],expected:'tesa',educator:'Önceki stratejiyi yeni ve anlamsız biçime taşıyıp taşımadığını gözle.',focus:'Yeni kelime biçimine transfer',probe:'Stratejiyi yeniden öğretmen gerekirse desteğe kaydet.'}
      ]
    },
    {
      id:'BLEND', index:3, title:'Hece Birleştirme ve Köprüleme',
      purpose:'Sesleri ve heceleri kaybetmeden sözcük bütününe ulaşma; ilk parçayı bellekte koruma.',
      flags:['İlk heceyi unuttu','Başa döndü','Araya ses ekledi','Heceyi kopuk bıraktı','Kelimeyi tahmin etti','Kendini düzeltti'],
      tasks:[
        {id:'DYS-BL01',phase:'TABAN',title:'İki Heceyi Birleştir',child:'“ka” ve “lem” hecelerini oku; sonra hiç durmadan tek kelime yap.',stimulus:'ka + lem',expectedText:'kalem',educator:'İki heceyi ayrı gösterebilirsin. Birleştirme anında ilk heceyi tekrar edip etmediğini izle.',focus:'İki hece köprüsü · ilk heceyi tutma',probe:'“Birbirine yaklaştır” nötr ipucundan fazlasını verme.'},
        {id:'DYS-BL02',phase:'KAPALI HECE',title:'Kapalı Heceden Kelimeye',child:'“el” ve “ma” parçalarını birleştir.',stimulus:'el + ma',expectedText:'elma',educator:'Kapalı hecenin son sesini kaybetme veya sonraki heceye taşıma örüntüsünü izle.',focus:'Kapalı hece korunumu · birleştirme',probe:'İlk heceyi sen uzatma.'},
        {id:'DYS-BL03',phase:'ÜÇ PARÇA',title:'Üçlü Köprü',child:'“ma” + “ka” + “ra” parçalarını tek kelime yap.',stimulus:'ma + ka + ra',expectedText:'makara',educator:'Üç parçalı dizide orta hece atlama, sıra değişimi veya başa dönüşü kaydet.',focus:'Çoklu hece belleği · sıra · bütünleme',probe:'Parçaları tekrar okumak isterse buna izin ver, ancak desteği not et.'},
        {id:'DYS-BL04',phase:'ANLAMSIZ',title:'Ezbersiz Birleştirme',child:'Bu gerçek kelime değil: “nu” + “ra”. Birleştirip söyle.',stimulus:'nu + ra',expectedText:'nura',educator:'Kelime bilgisinin tahmin desteğini kaldır. Salt birleştirme mekanizmasını izle.',focus:'Anlamdan bağımsız birleştirme',probe:'“Anlamı olmak zorunda değil” de; cevabı doğrulama.'},
        {id:'DYS-BL05',phase:'ÖĞRENME TEPKİSİ',title:'Modelden Sonra',child:'Örnek: “ba + lık → balık”. Şimdi “sa + rı”yı sen birleştir.',stimulus:'sa + rı',expectedText:'sarı',educator:'Kısa bir model sonrası yeni örnekte strateji kullanımını kaydet.',focus:'Modelden öğrenme · birleştirme stratejisi',probe:'Ek model verme.'},
        {id:'DYS-BL06',phase:'TRANSFER',title:'Yeni Dizilim',child:'Aynı yolu bu kez “li + mon” için kullan.',stimulus:'li + mon',expectedText:'limon',educator:'Modeli tekrarlamadan yakın transferi gözle.',focus:'Yakın transfer · strateji kararlılığı',probe:'İlk transfer yanıtını değiştirmeden kaydet.'}
      ]
    },
    {
      id:'DECODE', index:4, title:'Gerçek + Uydurma Kelime Çözümleme',
      purpose:'Ezber ve bağlam tahmininden bağımsız olarak harf-ses kurallarını yeni kelimelere uygulama.',
      flags:['İlk sese bakıp tahmin etti','Harf atladı','Ses ekledi','Ses yer değiştirdi','Heceyi yeniden başlattı','Uydurma kelimede belirgin düştü','Kendini düzeltti'],
      tasks:[
        {id:'DYS-DE01',phase:'GERÇEK',title:'Tanıdık Kelime',child:'Bu kelimeyi harfleri izleyerek oku.',stimulus:'sandal',expectedText:'sandal',educator:'Tahmin mi gerçek çözümleme mi olduğunu izle. Çocuğun kelimeyi önceden biliyor olması tek başına yeterli kanıt değildir.',focus:'Gerçek kelime çözümleme',probe:'Kelimeyi resimle destekleme.'},
        {id:'DYS-DE02',phase:'YENİ GERÇEK',title:'Daha Az Tanıdık',child:'Bu kelimeyi oku.',stimulus:'kestane',expectedText:'kestane',educator:'Uzunluk arttığında hece atlama veya ilk bölümden tahmin etme oluşuyor mu izle.',focus:'Uzun gerçek kelime · sıra korunumu',probe:'Hecelere çizgi çekme; ilk deneme bağımsız olsun.'},
        {id:'DYS-DE03',phase:'UYDURMA',title:'Uzaylı Kelime 1',child:'Bu gerçek bir kelime değil. Gördüğün sesleri birleştir: “mota”.',stimulus:'mota',expectedText:'mota',educator:'Anlam ve kelime hafızası desteğini kaldır. Ses-harf çözümleme becerisini gözle.',focus:'Uydurma kelime çözümleme',probe:'“Anlamı yok” bilgisini ver; doğru okumayı modelleme.'},
        {id:'DYS-DE04',phase:'UYDURMA',title:'Uzaylı Kelime 2',child:'Bunu da aynı şekilde oku: “senu”.',stimulus:'senu',expectedText:'senu',educator:'İlk uydurma kelimeyle karşılaştır; hata türü tekrarlanıyor mu?',focus:'Yeni dizilimde çözümleme kararlılığı',probe:'İlk sese göre gerçek kelime uydurursa tahmin bayrağını kullan.'},
        {id:'DYS-DE05',phase:'DERİNLEŞTİR',title:'Benzer Dizilim',child:'“lapi” kelimesini oku. Sonra “pila” kelimesini oku.',stimulus:'lapi → pila',expectedText:'lapi pila',educator:'Aynı harflerin farklı sırada olduğu iki dizide sıra takibini ve otomatik tahmini ayır.',focus:'Sıra hassasiyeti · seri çözümleme',probe:'İki kelimeyi tek tek yeniden göstermek destek sayılır.'},
        {id:'DYS-DE06',phase:'TRANSFER',title:'Yeni Uzaylı Kelime',child:'Son olarak “noru”yu oku.',stimulus:'noru',expectedText:'noru',educator:'Önceki uydurma kelime stratejisini yeni kelimeye taşıyıp taşımadığını izle.',focus:'Çözümleme transferi',probe:'İlk transfer yanıtı ana kanıttır.'}
      ]
    },
    {
      id:'RAN', index:5, title:'Hızlı Otomatik İsimlendirme',
      purpose:'Çok iyi bilinen sembol, sayı ve harf adlarına seri ve kararlı erişimi; ritim ve duraklamayı gözlemleme.',
      flags:['Uzun duraklama','Tekrar etti','Sıra atladı','Geri döndü','Yanlış adlandırdı','İkinci yarıda yavaşladı','Kendini düzeltti'],
      tasks:[
        {id:'DYS-RA01',phase:'TABAN',title:'Sayı Şeridi',child:'Sayıları soldan sağa sırayla söyle.',stimulus:'2  5  3  7  4  2  7  5  3  4',educator:'Toplam süreyi ve belirgin duraklamaları kaydet. Hız baskısı kurma.',focus:'Tanıdık sayı adına hızlı erişim',probe:'Satır kaybolursa kaldığı yeri göster; sayıyı söyleme.'},
        {id:'DYS-RA02',phase:'HARF',title:'Harf Şeridi',child:'Harfleri soldan sağa adlandır.',stimulus:'m  s  k  l  n  m  k  s  n  l',educator:'Burada harf adı istenir; Alan 02’deki ses göreviyle karıştırma. Adlandırma erişim hızını gözle.',focus:'Harf adı erişimi · ritim',probe:'Takıldığı harfi atlayıp devam etmesine izin ver; bunu not et.'},
        {id:'DYS-RA03',phase:'KARIŞIK',title:'Sayı ve Harf Karışık',child:'Gördüğünü sırayla söyle.',stimulus:'3  m  7  s  2  k  5  n  4  l',educator:'Kategori geçişlerinde yavaşlama veya yanlış adlandırma olup olmadığını izle.',focus:'Hızlı erişim · set değiştirme',probe:'Kuralı bir kez hatırlatmak destek sayılır.'},
        {id:'DYS-RA04',phase:'TEKRAR',title:'Yeni Sıra',child:'Aynı öğeler şimdi başka sırada. Baştan sona söyle.',stimulus:'n  2  s  5  m  4  k  7  l  3',educator:'İlk diziden ezber değil, her uyaran için otomatik erişim olup olmadığını gözle.',focus:'Yeni sırada adlandırma kararlılığı',probe:'İlk görevle süre farkını not alanına yaz.'},
        {id:'DYS-RA05',phase:'DERİNLEŞTİR',title:'Benzer Harfler',child:'Bu harfleri sırayla adlandır.',stimulus:'b  d  p  b  p  d  d  b  p',educator:'Görsel benzerliğin adlandırma ritmini bozup bozmadığını Alan 02 kanıtıyla çaprazla.',focus:'Benzer grafemlerde hızlı adlandırma',probe:'Harf yönünü tarif etme.'},
        {id:'DYS-RA06',phase:'TRANSFER',title:'Karma Yeni Şerit',child:'Son şeridi de aynı şekilde tamamla.',stimulus:'ö  6  ç  3  ü  8  ş  4  b  7',educator:'Harf-sayı ve işaretli harfleri yeni karışımda sun. Ritmin korunmasını izle.',focus:'Uzak transfer · hızlı erişim esnekliği',probe:'Hızdan önce doğru ve düzenli taramayı önemse.'}
      ]
    },
    {
      id:'WM', index:6, title:'İşitsel Çalışma Belleği',
      purpose:'Ses ve sözel dizileri kısa süre tutma, sırayı koruma ve zihinde dönüştürme.',
      flags:['İlk öğeyi unuttu','Son öğeyi unuttu','Sıra değişti','Öğe ekledi','Öğe eksiltti','Yönergeyi parçalattı','Kendini düzeltti'],
      tasks:[
        {id:'DYS-WM01',phase:'TABAN',title:'Üçlü Ses Dizisi',child:'Dinle ve aynı sırayla tekrar et: /m/ – /a/ – /s/.',stimulus:'Eğitmen söyler: /m/ – /a/ – /s/',educator:'Yazı gösterme. Sıra ve öğe sayısını ayrı kaydet.',focus:'İşitsel kısa süreli tutma · sıra',probe:'Bir kez doğal hızda tekrar edebilirsin; ikinci tekrar destek sayılır.'},
        {id:'DYS-WM02',phase:'DÖRTLÜ',title:'Dört Parçayı Tut',child:'Aynı sırayla tekrar et: /k/ – /a/ – /l/ – /e/.',stimulus:'Eğitmen söyler: /k/ – /a/ – /l/ – /e/',educator:'Dizi uzadığında ilk veya orta öğenin kaybolup kaybolmadığını izle.',focus:'İşitsel kapasite · sıra korunumu',probe:'Ritimle ipucu verme.'},
        {id:'DYS-WM03',phase:'TERS',title:'Tersten Söyle',child:'“2 – 5 – 8” sayılarını dinle. Şimdi tersten söyle.',stimulus:'2 – 5 – 8',expectedText:'8 5 2',educator:'Salt hatırlamadan farklı olarak zihinsel işlem yükü eklenir.',focus:'Çalışma belleği · zihinsel dönüştürme',probe:'Önce kuralı anladığından emin ol; sayıları tekrar öğretme.'},
        {id:'DYS-WM04',phase:'YÖNERGE',title:'Üç Adımlı Yönerge',child:'Önce masaya dokun, sonra kalemi kaldır, en son elini başına koy.',stimulus:'3 aşamalı sözel yönerge',educator:'Yönergeyi bir kez söyle. Sıra hatası, adım atlama ve yeniden sorma davranışını kaydet.',focus:'Sözel yönergeyi tutma · eylem sırası',probe:'Yönergeyi parçalarsan destek düzeyine işle.'},
        {id:'DYS-WM05',phase:'DERİNLEŞTİR',title:'Tut ve Değiştir',child:'“kal” kelimesini aklında tut. Başındaki /k/ yerine /s/ koy ve yeni kelimeyi söyle.',stimulus:'kal → k yerine s',expectedText:'sal',educator:'Fonolojik işlem ile çalışma belleğini birlikte yükler. Alan 01 ile çapraz yorumla.',focus:'Bilgiyi tutma + manipülasyon',probe:'Kelimeyi yeniden söylemek destek sayılır.'},
        {id:'DYS-WM06',phase:'TRANSFER',title:'Yeni Dizide Aynı İşlem',child:'“bal” kelimesini tut. Başındaki /b/ yerine /d/ koy.',stimulus:'bal → b yerine d',expectedText:'dal',educator:'Aynı zihinsel işlem kuralını yeni kelimede uygulat.',focus:'Çalışma belleği transferi',probe:'İlk yanıtı değiştirmeden kaydet.'}
      ]
    },
    {
      id:'FLU', index:7, title:'Okuma Akıcılığı',
      purpose:'Doğrulukla birlikte duraklama, tekrar, heceleme, ritim, geri dönüş ve anlamlı gruplamayı gözlemleme.',
      flags:['Sık durakladı','Heceleyerek kaldı','Kelimeyi tekrar etti','Satır atladı','Tahmin etti','Noktalama yok sayıldı','İkinci okumada gelişti'],
      tasks:[
        {id:'DYS-FL01',phase:'KELİME',title:'Kelime Dizisi',child:'Kelimeleri sırayla oku.',stimulus:'masa   bulut   sepet   okul   sandal',educator:'Doğruluk yanında kelimeler arası gereksiz duraklama ve ritmi gözle.',focus:'Kelime düzeyi akıcılık',probe:'Hız baskısı yapma; doğal okumasını iste.'},
        {id:'DYS-FL02',phase:'CÜMLE',title:'Kısa Cümle',child:'Cümleyi doğal biçimde oku.',stimulus:'Mina küçük çantasını aldı.',educator:'Kelime kelime kopuk okuma mı, anlamlı grup mu? Noktada duruşu da kaydet.',focus:'Cümle ritmi · prosodi',probe:'Cümleyi sen modelleme.'},
        {id:'DYS-FL03',phase:'UZUN CÜMLE',title:'Anlamlı Gruplama',child:'Bu cümleyi oku.',stimulus:'Yağmur başlayınca çocuklar oyun alanından sınıfa döndüler.',educator:'Uzunluk arttığında nefes, geri dönüş ve anlamlı öbekleme davranışını izle.',focus:'Uzun cümlede akıcılık',probe:'Satır kaybında yalnız konumu göster.'},
        {id:'DYS-FL04',phase:'KISA METİN',title:'Mini Metin',child:'Metni bir kez oku.',stimulus:'Ece sabah pencereden dışarı baktı. Hava serindi. Çantasına suyunu koyup okula yürüdü.',educator:'Toplam süre, hata, tekrar ve satır takibini not et. Sözcük/dakika tek başına yorumlanmaz.',focus:'Metin düzeyi akıcılık · süreklilik',probe:'Okuma sırasında düzeltme yapma.'},
        {id:'DYS-FL05',phase:'ÖĞRENME TEPKİSİ',title:'İkinci Okuma',child:'Aynı metni bir kez daha oku. Bu kez anlamlı gruplara dikkat et.',stimulus:'Ece sabah pencereden dışarı baktı. Hava serindi. Çantasına suyunu koyup okula yürüdü.',educator:'İlk ve ikinci okuma arasındaki hata, süre ve ritim değişimini gözle.',focus:'Tekrarlı okumaya tepki',probe:'Cümleyi sen seslendirme; yalnız hedefi hatırlat.'},
        {id:'DYS-FL06',phase:'TRANSFER',title:'Yeni Metin',child:'Şimdi yeni metni oku.',stimulus:'Mert topunu aldı. Parka giderken arkadaşını gördü. Birlikte oyun kurdular.',educator:'İkinci okumada kazanılan ritim yeni metne taşınıyor mu izle.',focus:'Akıcılık transferi',probe:'Yeni metni önceden okutma.'}
      ]
    },
    {
      id:'COMP', index:8, title:'Okuma–Dinleme Anlama Ayrımı',
      purpose:'Anlama kapasitesi ile yazılı çözümleme yükünü ayırmak; okuma ve dinleme koşullarını karşılaştırmak.',
      flags:['Metne geri döndü','Cevabı tahmin etti','Açık bilgiyi kaçırdı','Neden-sonuç kuramadı','Dinlemede belirgin yükseldi','Okumada belirgin yükseldi'],
      tasks:[
        {id:'DYS-CO01',phase:'OKUMA',title:'Okuyarak Açık Bilgi',child:'Metni oku ve cevapla: “Mert kırmızı şemsiyesini aldı. Yağmur başlayınca okula yürüdü.” Mert ne aldı?',stimulus:'Mert kırmızı şemsiyesini aldı. Yağmur başlayınca okula yürüdü.',expectedText:'şemsiye',educator:'Soruyu çocuk metni okuduktan sonra sor. Çözümleme yükü ile cevabı ayır.',focus:'Okuyarak açık bilgiye erişim',probe:'Metne geri dönmesine izin ver ve bunu strateji olarak kaydet.'},
        {id:'DYS-CO02',phase:'OKUMA',title:'Okuyarak Neden',child:'Aynı metne göre Mert neden şemsiyesini aldı?',stimulus:'Mert kırmızı şemsiyesini aldı. Yağmur başlayınca okula yürüdü.',expectedText:'yağmur',educator:'Neden-sonuç çıkarımını gözle.',focus:'Okuyarak neden-sonuç',probe:'Cevabı seçenekle daraltma.'},
        {id:'DYS-CO03',phase:'DİNLEME',title:'Dinleyerek Açık Bilgi',child:'Şimdi sen okumayacaksın. Ben okuyacağım: “Ece çantasına su ve elma koydu. Sonra parka gitti.” Ece çantasına ne koydu?',stimulus:'Eğitmen sesli okur; çocuk metni görmez.',expectedText:'su elma',educator:'Metni çocuk görmeden doğal sesle bir kez oku. Okuma çözümleme yükünü kaldır.',focus:'Dinleme yoluyla açık bilgi',probe:'Bir tekrar gerekiyorsa desteğe kaydet.'},
        {id:'DYS-CO04',phase:'DİNLEME',title:'Dinleyerek Sıra',child:'Dinlediğin metinde Ece çantasını hazırladıktan sonra nereye gitti?',stimulus:'Aynı dinleme metni',expectedText:'park',educator:'Dinleme koşulunda olay sırasını ölç.',focus:'Dinleme yoluyla sıra ve anlama',probe:'Metni parçalara bölme.'},
        {id:'DYS-CO05',phase:'ÇAPRAZ',title:'Kendi Farkını Açıkla',child:'Okurken mi, dinlerken mi anlamak daha kolay geldi? Neden?',stimulus:'Kısa öz-değerlendirme',educator:'Çocuğun öz-farkındalığını kanıt olarak tut; puanlayıcı tanı dili kullanma.',focus:'Üstbiliş · kanal farkındalığı',probe:'“Hangisi daha iyi?” diye yönlendirme.'},
        {id:'DYS-CO06',phase:'TRANSFER',title:'Yeni Kısa Metin',child:'Bu yeni metni oku ve ana fikri bir cümleyle anlat: “Kedi kapının önünde bekledi. Sahibi gelince kuyruğunu sallayıp içeri girdi.”',stimulus:'Kedi kapının önünde bekledi. Sahibi gelince kuyruğunu sallayıp içeri girdi.',educator:'Açık bilgi yerine bütün anlamı kısa anlatıyla kurmasını iste.',focus:'Yeni metinde bütüncül anlama',probe:'Tek bir kelimelik cevapta “bir cümleyle anlatabilir misin?” de.'}
      ]
    },
    {
      id:'DICT', index:9, title:'Dikte ve Yazılı Kodlama',
      purpose:'Duyulan sesi, heceyi, kelimeyi ve kısa cümleyi sırayı koruyarak yazıya aktarma; öz-kontrolü inceleme.',
      flags:['Ses eksiltti','Ses ekledi','Harf sırası değişti','Benzer harf yazdı','Kelime sınırı bozuldu','Yazdığını okuyamadı','Kendini düzeltti'],
      tasks:[
        {id:'DYS-DI01',phase:'SES',title:'Tek Ses Dikte',child:'Ben /m/ sesini söyleyeceğim. Uygun harfi yaz.',stimulus:'Eğitmen: /m/',expectedText:'m',educator:'Harf adını söyleme. Duyulan sesten grafeme geçişi gözle.',focus:'Fonem → grafem kodlama',probe:'Bir kez daha seslendirmek destek sayılır.'},
        {id:'DYS-DI02',phase:'HECE',title:'Hece Dikte',child:'“kal” hecesini duy ve yaz.',stimulus:'Eğitmen: kal',expectedText:'kal',educator:'Ses sırası, eksiltme ve eklemeyi ayrı kaydet.',focus:'Hece düzeyi yazılı kodlama',probe:'Hecenin harflerini sayma.'},
        {id:'DYS-DI03',phase:'KELİME',title:'Kelime Dikte',child:'“masa” kelimesini duy ve yaz.',stimulus:'Eğitmen: masa',expectedText:'masa',educator:'Kelimeyi bir kez doğal söyle. Gerekirse yalnız bir kez tekrar et.',focus:'Kelime kodlama · sıra',probe:'Harf adı verme.'},
        {id:'DYS-DI04',phase:'UYDURMA',title:'Uydurma Kelime Dikte',child:'Bu gerçek kelime değil: “noru”. Duyduğun gibi yaz.',stimulus:'Eğitmen: noru',expectedText:'noru',educator:'Ezberlenmiş yazım bilgisini azaltıp ses-harf kodlamasını ölç.',focus:'Anlamdan bağımsız yazılı kodlama',probe:'Anlam aramasını normalleştir; cevabı söyleme.'},
        {id:'DYS-DI05',phase:'CÜMLE',title:'Kısa Cümle Dikte',child:'“Mina topu aldı.” cümlesini dinle ve yaz.',stimulus:'Eğitmen: Mina topu aldı.',educator:'Kelime sınırı, büyük harf/nokta ve ses sırasını ayrı gözlemle.',focus:'Cümle düzeyi yazılı kodlama',probe:'Cümleyi parça parça tekrar etmek destek sayılır.'},
        {id:'DYS-DI06',phase:'ÖZ-KONTROL / TRANSFER',title:'Yazdığını Oku',child:'Şimdi az önce yazdığını sesli oku. Değiştirmek istediğin bir yer var mı?',stimulus:'Öğrencinin kendi yazısı',educator:'Kendi üretimini okurken hata fark etme ve düzeltme davranışını kaydet.',focus:'Yazı-okuma çapraz kontrolü · öz-düzeltme',probe:'Hatanın yerini gösterme; yalnız kontrol etmesini iste.'}
      ]
    },
    {
      id:'ERROR', index:10, title:'Hata Farkındalığı ve Öz-Düzeltme',
      purpose:'Okuma/yazma hatasını fark etme, nedenini açıklama ve bağımsız düzeltme stratejisini gözlemleme.',
      flags:['Hata fark etmedi','Fark etti düzeltemedi','İpucuyla düzeltti','Kendiliğinden düzeltti','Gerekçe verdi','Anlama kontrolü yaptı'],
      tasks:[
        {id:'DYS-ER01',phase:'DIŞ HATA',title:'Hangisi Doğru?',child:'“kalem” kelimesi için hangisi doğru: kalem mi, kalen mi? Neden?',stimulus:'kalem   /   kalen',choices:['kalem','kalen'],expected:'kalem',educator:'Seçimden sonra nedenini sor. “Son harfe bak” gibi yönlendirme yapma.',focus:'Dış hatayı fark etme · gerekçe',probe:'Gerekçe yoksa yalnız “nasıl anladın?” de.'},
        {id:'DYS-ER02',phase:'SIRA HATASI',title:'Sıra Bozulmuş mu?',child:'“masa” yerine “sama” yazılmış. Sence bir sorun var mı?',stimulus:'hedef: masa · yazılan: sama',expectedText:'sıra',educator:'Hatanın varlığını ve türünü ayrı kaydet.',focus:'Sıra hatası farkındalığı',probe:'“İlk harfe bak” deme.'},
        {id:'DYS-ER03',phase:'OKUMA HATASI',title:'Anlam Kontrolü',child:'Bir çocuk “Kedi süt içti.” cümlesini “Kedi üst içti.” diye okudu. Sence durup kontrol etmeli mi? Neden?',stimulus:'Kedi süt içti. → Kedi üst içti.',educator:'Anlamın hata kontrolünde kullanılıp kullanılmadığını gözle.',focus:'Semantik hata kontrolü',probe:'Tek doğru açıklama bekleme; gerekçeyi kaydet.'},
        {id:'DYS-ER04',phase:'DÜZELTME',title:'Hatanın Yerini Bul',child:'“balık” kelimesi “balik” yazılmış. Değişmesi gereken yeri göster ve düzelt.',stimulus:'balik → ?',expectedText:'balık',educator:'Diakritik ayrıntıyı fark edip bağımsız düzeltiyor mu izle.',focus:'Ortografik öz-düzeltme',probe:'Harf adını söyleme.'},
        {id:'DYS-ER05',phase:'KENDİ ÜRÜNÜ',title:'Kendi Cevabını Kontrol Et',child:'Önceki görevlerinden bir cevabını seç ve kontrol et. Değiştirmek istediğin bir şey var mı?',stimulus:'Önceki görev kanıtı',educator:'Çocuğun kendi hatasına yaklaşımını gözle. Başarılı cevap seçmesi de kabul edilir.',focus:'Üstbiliş · kendi performansını izleme',probe:'“Burada hata var” deme.'},
        {id:'DYS-ER06',phase:'TRANSFER',title:'Yeni Hata Dedektifi',child:'“limon” kelimesi “milon” yazılmış. Sorunu bulup düzelt.',stimulus:'milon → ?',expectedText:'limon',educator:'Yeni kelimede aynı hata kontrol stratejisini kullanıyor mu izle.',focus:'Hata kontrolü transferi',probe:'İlk yanıtı ana kanıt olarak tut.'}
      ]
    },
    {
      id:'TRANSFER', index:11, title:'Öğrenme Tepkisi ve Transfer',
      purpose:'Kısa öğretim/model sonrası performans değişimini, yakın ve uzak transferi ve kalıcılığı inceleme.',
      flags:['Modelden yararlandı','Tekrar model istedi','Yakın transfer yaptı','Uzak transfer yaptı','Stratejiyi kendisi söyledi','Stratejiyi bıraktı'],
      tasks:[
        {id:'DYS-TR01',phase:'BAĞIMSIZ TABAN',title:'İlk Deneme',child:'“senu” kelimesini kendi bildiğin yolla oku.',stimulus:'senu',expectedText:'senu',educator:'Öğretimden önce taban performansı al. Hata varsa hemen düzeltme.',focus:'Öğretim öncesi bağımsız performans',probe:'5 saniye sonra yalnız “harfleri sırayla izleyebilirsin” de.'},
        {id:'DYS-TR02',phase:'KISA ÖĞRETİM',title:'Stratejiyi Gör',child:'Şimdi bir yöntem göstereceğim: “mo | ta”. Önce parçaları oku, sonra birleştir: “mota”.',stimulus:'mo | ta → mota',educator:'Kısa, standart bir model ver. Bu görev performans puanı değil, öğretim girdisidir.',focus:'Standart model alma · öğretime katılım',probe:'Modeli bir kez ver; uzun öğretime dönüştürme.'},
        {id:'DYS-TR03',phase:'YAKIN TRANSFER',title:'Benzer Yeni Kelime',child:'Aynı yöntemi “pi | lo” için kullan.',stimulus:'pi | lo',expectedText:'pilo',educator:'Modeldeki iki heceli yapıya yakın transferi ölç.',focus:'Yakın transfer',probe:'İkinci kez model gerekirse desteğe kaydet.'},
        {id:'DYS-TR04',phase:'YÜZEY DEĞİŞİMİ',title:'Çizgisiz Dene',child:'Şimdi çizgi yok: “noru”yu aynı düşünme yoluyla oku.',stimulus:'noru',expectedText:'noru',educator:'Görsel hece ayracı kaldırıldığında strateji içselleşti mi izle.',focus:'İpucunun kaldırılması · strateji içselleştirme',probe:'Hece çizgisi eklemek görsel destek sayılır.'},
        {id:'DYS-TR05',phase:'UZAK TRANSFER',title:'Gerçek Kelimeye Taşı',child:'Aynı yöntemi “kestane” kelimesinde kullan.',stimulus:'kestane',expectedText:'kestane',educator:'Uydurma kelimeden gerçek ve daha uzun kelimeye strateji taşınmasını gözle.',focus:'Uzak transfer · uzunluk değişimi',probe:'Kelimeyi sen heceleme.'},
        {id:'DYS-TR06',phase:'ÜSTBİLİŞ',title:'Yöntemi Bana Öğret',child:'Az önce kullandığın yöntemi bana kendi cümlenle anlat.',stimulus:'“Nasıl yaptın?”',educator:'Stratejiyi sözel olarak açıklayabilme, öğrenmenin bilinçli hâle gelip gelmediğine dair ek kanıttır.',focus:'Strateji farkındalığı · açıklama · kalıcılık',probe:'Tek bir doğru ifade arama; kendi diliyle açıklamasını kabul et.'}
      ]
    }
  ];

  function ensureState() {
    if (!state.dysAdvancedEvidence) state.dysAdvancedEvidence = {};
    if (!state.dysAdvancedTaskIndex && state.dysAdvancedTaskIndex !== 0) state.dysAdvancedTaskIndex = 0;
    if (!state.dysAdvancedDomainId) state.dysAdvancedDomainId = '';
  }

  function domainById(id) {
    return advancedDomains.find(function (d) { return d.id === id; });
  }

  function supportLabel(code) {
    var row = supportOptions.find(function (x) { return x[0] === code; });
    return row ? row[1] : '—';
  }

  function verdictLabel(code) {
    var row = dyslexiaVerdicts.find(function (x) { return x[0] === code; });
    return row ? row[1] : '—';
  }

  function evidenceFor(task) {
    ensureState();
    return Object.assign({
      taskId:task.id,response:'',choice:'',verdict:'',support:'',
      firstMatch:null,latencyMs:null,note:'',flags:[]
    }, state.dysAdvancedEvidence[task.id] || {});
  }

  function needsDeepening(domain) {
    var first = domain.tasks.slice(0,3).map(function (t) { return state.dysAdvancedEvidence[t.id]; }).filter(Boolean);
    if (first.length < 3) return false;
    var concern = first.filter(function (e) {
      return e.verdict !== 'MATCH' || e.support !== 'INDEPENDENT';
    }).length;
    return concern >= 2;
  }

  function routeFor(domain) {
    var base = domain.tasks.slice(0,4);
    if (needsDeepening(domain)) base.push(domain.tasks[4]);
    base.push(domain.tasks[5]);
    return base;
  }

  // Central resume must inspect all adaptive domain routes, not only the
  // first task or the overall evidence-status badge.
  window.czaFirstIncompleteDyslexiaAdvancedTask = function () {
    ensureState();
    for (var i = 0; i < advancedDomains.length; i++) {
      var domain = advancedDomains[i];
      var tasks = routeFor(domain);
      var taskIndex = tasks.findIndex(function (task) {
        var row = state.dysAdvancedEvidence[task.id];
        return !row || !row.verdict || !row.support;
      });
      if (taskIndex >= 0) return { domainId: domain.id, taskIndex: taskIndex };
    }
    return null;
  };

  function currentDomain() {
    return domainById(state.dysAdvancedDomainId);
  }

  function currentTask() {
    var d = currentDomain();
    return d ? routeFor(d)[state.dysAdvancedTaskIndex] : null;
  }

  function responseHtml(task, evidence) {
    var choiceHtml = '';
    if (task.choices) {
      choiceHtml = '<div class="orth-choice-grid">' + task.choices.map(function (choice) {
        return '<button class="orth-choice ' + (evidence.choice === choice ? 'selected' : '') + '" data-adv-choice="' + esc(choice) + '">' + esc(choice) + '</button>';
      }).join('') + '</div>';
    }
    var inputHtml = task.choices ? '' :
      '<label class="panel-label" for="advResponse">Çocuğun ilk yanıtı / uygulama sonucu</label>' +
      '<input id="advResponse" class="response-input" placeholder="Yanıtı olduğu gibi kaydet" value="' + esc(evidence.response || '') + '">';
    return choiceHtml + inputHtml;
  }

  function severityForDomain(domain) {
    var rows = routeFor(domain).map(function (t) { return state.dysAdvancedEvidence[t.id]; }).filter(Boolean).filter(function (e) { return e.support !== 'NOT_ASSESSED'; });
    if (rows.length < 3) return {status:'INSUFFICIENT', score:null, rows:rows.length};
    var points = rows.reduce(function (sum,e) {
      var v = e.verdict === 'MATCH' ? 0 : e.verdict === 'PARTIAL' ? 1 : 2;
      var s = e.support === 'INDEPENDENT' ? 0 : ['VERBAL_PROMPT','VISUAL_PROMPT'].includes(e.support) ? .5 : ['MODELED','PHYSICAL_ASSIST'].includes(e.support) ? 1 : 0;
      return sum + v + s;
    },0);
    var score = points / rows.length;
    return {status:score < .7 ? 'RELATIVE_STRENGTH' : score < 1.4 ? 'WATCH' : 'PRIORITY', score:score, rows:rows.length};
  }

  function statusText(status) {
    return status === 'RELATIVE_STRENGTH' ? 'Göreli güçlü' : status === 'WATCH' ? 'İzlem / destek' : status === 'PRIORITY' ? 'Gelişim önceliği' : 'Kanıt yetersiz';
  }

  function startDomain(id) {
    ensureState();
    state.dysAdvancedDomainId = id;
    state.dysAdvancedTaskIndex = 0;
    state.taskStartedAt = Date.now();
    state.screen = 'dyslexia-advanced-task';
    render();
  }
  window.startDyslexiaAdvancedDomain = startDomain;

  function nextAdvanced() {
    var d = currentDomain();
    var route = routeFor(d);
    saveState();
    if (state.dysAdvancedTaskIndex + 1 >= route.length) {
      state.screen = 'dyslexia-advanced-summary';
      render();
      return;
    }
    state.dysAdvancedTaskIndex += 1;
    state.taskStartedAt = Date.now();
    render();
  }

  function taskScreen() {
    var domain = currentDomain();
    var task = currentTask();
    if (!domain || !task) {
      state.screen = 'dyslexia-overview';
      return render();
    }
    if (!state.taskStartedAt) state.taskStartedAt = Date.now();
    var evidence = evidenceFor(task);
    var route = routeFor(domain);
    var progress = Math.round((state.dysAdvancedTaskIndex / Math.max(1,route.length)) * 100);

    var verdicts = dyslexiaVerdicts.map(function (x) {
      return '<button class="verdict-btn ' + (evidence.verdict === x[0] ? 'selected' : '') + '" data-adv-verdict="' + x[0] + '">' + esc(x[1]) + '</button>';
    }).join('');
    var supports = supportOptions.map(function (x) {
      return '<button class="support-btn ' + (evidence.support === x[0] ? 'selected' : '') + '" data-adv-support="' + x[0] + '">' + esc(x[1]) + '</button>';
    }).join('');
    var flags = domain.flags.map(function (f) {
      return '<button class="flag-btn ' + ((evidence.flags || []).includes(f) ? 'selected' : '') + '" data-adv-flag="' + esc(f) + '">' + esc(f) + '</button>';
    }).join('');

    app.innerHTML =
      '<main class="station-page"><header class="station-header dys-station-header">' +
      '<div><div class="eyebrow">OKUMA GÜÇLÜĞÜ · ALAN ' + String(domain.index + 1).padStart(2,'0') + '</div><h1>' + esc(domain.title) + '</h1></div>' +
      '<div class="station-progress"><span>Görev ' + (state.dysAdvancedTaskIndex + 1) + '/' + route.length + '</span><div class="progress-track"><i style="width:' + progress + '%"></i></div></div>' +
      '<button class="focus-toggle" id="advBackMap">Alan haritası</button></header>' +
      '<section class="station-layout"><div class="child-stage dys-child-stage"><div class="child-top"><span class="child-label">ÇOCUKLA UYGULAMA</span><span class="phase-chip">' + esc(task.phase) + '</span></div>' +
      '<div class="task-count">' + String(state.dysAdvancedTaskIndex + 1).padStart(2,'0') + '</div>' +
      '<div class="advanced-task-card"><span class="letter-task-type">' + esc(task.title) + '</span><h2>' + esc(task.child) + '</h2>' +
      (task.stimulus ? '<div class="advanced-stimulus">' + esc(task.stimulus) + '</div>' : '') +
      (task.choices ? '<div class="child-choice-note">Seçenekler eğitimci panelinde ilk seçim olarak da kaydedilir.</div>' : '') +
      '</div><div class="child-footer">İlk performansı düzeltmeden kaydet; destek sonrası değişimi ayrıca işaretle.</div></div>' +
      '<aside class="educator-panel"><div class="panel-kicker">EĞİTİMCİ KANIT PANELİ</div><h2>' + esc(task.title) + '</h2>' +
      '<p class="educator-instruction">' + esc(task.educator) + '</p><div class="evidence-focus"><span>Ölçülen kanıt</span><b>' + esc(task.focus) + '</b></div>' +
      '<div class="probe-note"><b>Nötr probe:</b> ' + esc(task.probe) + '</div>' + responseHtml(task,evidence) +
      '<div class="micro-stats"><div><span>Tepki</span><b>' + (evidence.latencyMs != null ? (evidence.latencyMs/1000).toFixed(1)+' sn' : '—') + '</b></div>' +
      '<div><span>İlk seçim</span><b>' + (evidence.firstMatch === true ? 'Eşleşti' : evidence.firstMatch === false ? 'Farklı' : '—') + '</b></div><div><span>Görev</span><b>' + esc(task.id) + '</b></div></div>' +
      '<label class="panel-label">Yanıt örüntüsü</label><div class="verdict-grid">' + verdicts + '</div>' +
      '<label class="panel-label">Destek düzeyi</label><div class="support-grid">' + supports + '</div>' +
      '<label class="panel-label">Hata / öğrenme işaretleri</label><div class="flag-grid">' + flags + '</div>' +
      '<label class="panel-label" for="advNote">Kısa gözlem notu</label><textarea id="advNote" placeholder="Somut hata ve strateji örneğini yaz.">' + esc(evidence.note || '') + '</textarea>' +
      '<div class="adaptive-note"><b>Adaptif kural:</b> İlk 3 görevden en az 2’sinde belirgin destek/farklı örüntü görülürse derinleştirme görevi açılır. Transfer görevi her durumda korunur.</div>' +
      '<div class="panel-actions"><button class="secondary-btn" id="advSkip">Değerlendirilemedi</button><button class="primary-btn" id="advNext">Kaydet ve sonraki →</button></div></aside></section></main>';

    document.getElementById('advBackMap').onclick = function () { state.screen='dyslexia-overview'; render(); };

    document.querySelectorAll('[data-adv-choice]').forEach(function (button) {
      button.onclick = function () {
        var row = evidenceFor(task);
        if (!row.choice) {
          row.latencyMs = Math.max(0,Date.now()-state.taskStartedAt);
          row.firstMatch = task.expected ? button.dataset.advChoice === task.expected : null;
        }
        row.choice = button.dataset.advChoice;
        row.response = button.dataset.advChoice;
        state.dysAdvancedEvidence[task.id] = row;
        render();
      };
    });

    var input = document.getElementById('advResponse');
    if (input) input.oninput = function (event) {
      var row = evidenceFor(task);
      if (!row.response && event.target.value.trim()) row.latencyMs = Math.max(0,Date.now()-state.taskStartedAt);
      row.response = event.target.value;
      state.dysAdvancedEvidence[task.id] = row;
      saveState();
    };

    document.querySelectorAll('[data-adv-verdict]').forEach(function (button) {
      button.onclick = function () { var row=evidenceFor(task); row.verdict=button.dataset.advVerdict; state.dysAdvancedEvidence[task.id]=row; render(); };
    });
    document.querySelectorAll('[data-adv-support]').forEach(function (button) {
      button.onclick = function () { var row=evidenceFor(task); row.support=button.dataset.advSupport; state.dysAdvancedEvidence[task.id]=row; render(); };
    });
    document.querySelectorAll('[data-adv-flag]').forEach(function (button) {
      button.onclick = function () {
        var row=evidenceFor(task), flag=button.dataset.advFlag; row.flags=row.flags||[];
        row.flags=row.flags.includes(flag) ? row.flags=row.flags.filter(function(x){return x!==flag;}) : row.flags.push(flag);
        state.dysAdvancedEvidence[task.id]=row; render();
      };
    });
    document.getElementById('advNote').oninput=function(event){var row=evidenceFor(task);row.note=event.target.value;state.dysAdvancedEvidence[task.id]=row;saveState();};
    document.getElementById('advSkip').onclick=function(){var row=evidenceFor(task);row.verdict='NO_RESPONSE';row.support='NOT_ASSESSED';row.note=document.getElementById('advNote').value;state.dysAdvancedEvidence[task.id]=row;nextAdvanced();};
    document.getElementById('advNext').onclick=function(){
      var row=evidenceFor(task); if(input)row.response=input.value.trim(); row.note=document.getElementById('advNote').value;
      if(task.choices&&!row.choice){alert('Önce çocuğun ilk seçimini kaydet.');return;}
      if(!row.verdict){alert('Yanıt örüntüsünü seç.');return;}
      if(!row.support){alert('Destek düzeyini seç.');return;}
      state.dysAdvancedEvidence[task.id]=row; nextAdvanced();
    };
  }

  function domainSummary() {
    var domain=currentDomain();
    if(!domain){state.screen='dyslexia-overview';return render();}
    var route=routeFor(domain);
    var rows=route.map(function(t){return state.dysAdvancedEvidence[t.id];}).filter(Boolean).filter(function(e){return e.support!=='NOT_ASSESSED';});
    var sev=severityForDomain(domain);
    var match=rows.filter(function(e){return e.verdict==='MATCH';}).length;
    var supported=rows.filter(function(e){return e.support!=='INDEPENDENT';}).length;
    var flagCounts={}; rows.forEach(function(e){(e.flags||[]).forEach(function(f){flagCounts[f]=(flagCounts[f]||0)+1;});});
    var dominant=Object.entries(flagCounts).sort(function(a,b){return b[1]-a[1];}).slice(0,4);
    var table=route.map(function(t){var e=state.dysAdvancedEvidence[t.id];return '<div class="table-row"><b>'+esc(t.title)+' · '+esc(t.phase)+'</b><span>'+(e?esc(verdictLabel(e.verdict)):'—')+'</span><span>'+(e?esc(supportLabel(e.support)):'—')+'</span><span>'+(e&&e.latencyMs!=null?(e.latencyMs/1000).toFixed(1)+' sn':'—')+'</span></div>';}).join('');
    app.innerHTML='<main class="page"><section class="hero dyslexia-accent"><div class="top-actions"><button class="text-btn" id="advSummaryBack">← 12 alan haritası</button><span class="step-chip">Alan '+String(domain.index+1).padStart(2,'0')+' tamamlandı</span></div>' +
      '<div class="summary-hero"><div><div class="eyebrow">'+esc(state.name).toUpperCase()+' · '+esc(domain.title).toUpperCase()+'</div><h1>Alan kanıt özeti</h1><p>'+esc(domain.purpose)+'</p></div><div class="status-orb '+(sev.status==='RELATIVE_STRENGTH'?'strength':sev.status==='WATCH'?'developing':sev.status==='PRIORITY'?'watch':'insufficient')+'"><span>Alan görünümü</span><b>'+esc(statusText(sev.status))+'</b></div></div>' +
      '<div class="summary-grid"><article><span>Geçerli görev</span><b>'+rows.length+'</b><small>Rota: '+route.length+'</small></article><article><span>Hedef örüntü</span><b>'+match+'</b><small>Bağımsız ve destekli birlikte</small></article><article><span>Destek kullanılan</span><b>'+supported+'</b><small>İlk deneme korunur</small></article><article><span>Adaptif derinleşme</span><b>'+(needsDeepening(domain)?'Açıldı':'Gerekmedi')+'</b><small>İlk üç kanıta göre</small></article></div>' +
      '<div class="evidence-table"><div class="table-head"><span>Görev</span><span>Yanıt örüntüsü</span><span>Destek</span><span>Tepki</span></div>'+table+'</div>' +
      '<div class="pattern-box"><div><span>Tekrar eden işaretler</span><b>'+(dominant.length?dominant.map(function(x){return esc(x[0])+' ('+x[1]+')';}).join(' · '):'Belirgin tekrar eden işaret yok')+'</b></div><div><span>Yorum sınırı</span><b>Bu alan tek başına tanı üretmez. Diğer okuma, bellek ve öğrenme tepkisi alanlarıyla birlikte yorumlanır.</b></div></div>' +
      '<div class="launch-panel dys-launch"><div><b>Sonraki adım</b><p>Alan haritasına dönerek kalan alanları tamamla veya yeterli kanıt oluştuğunda bütüncül profili aç.</p></div><div class="summary-actions"><button class="secondary-btn" id="advRedo">Bu alanı yeniden incele</button><button class="primary-btn" id="advMap">Haritaya dön</button></div></div></section></main>';
    document.getElementById('advSummaryBack').onclick=document.getElementById('advMap').onclick=function(){state.screen='dyslexia-overview';render();};
    document.getElementById('advRedo').onclick=function(){state.dysAdvancedTaskIndex=0;state.taskStartedAt=Date.now();state.screen='dyslexia-advanced-task';render();};
  }

  function domainResultFromExternal(index) {
    if (index===0) {
      var rows=dyslexiaTasks.map(function(t){return state.dysEvidence&&state.dysEvidence[t.id];}).filter(Boolean).filter(function(e){return e.support!=='NOT_ASSESSED';});
      if(rows.length<4)return {status:'INSUFFICIENT',score:null,rows:rows.length};
      var points=rows.reduce(function(s,e){return s+(e.verdict==='MATCH'?0:e.verdict==='PARTIAL'?1:2)+(e.support==='INDEPENDENT'?0:.5);},0);
      var score=points/rows.length;return {status:score<.7?'RELATIVE_STRENGTH':score<1.4?'WATCH':'PRIORITY',score:score,rows:rows.length};
    }
    if (index===1) {
      var ls=state.dysLsEvidence||{}; var rows=Object.values(ls).filter(function(e){return e.support!=='NOT_ASSESSED';});
      if(rows.length<5)return {status:'INSUFFICIENT',score:null,rows:rows.length};
      var points=rows.reduce(function(s,e){return s+(e.verdict==='MATCH'?0:e.verdict==='PARTIAL'?1:2)+(e.support==='INDEPENDENT'?0:.5);},0);
      var score=points/rows.length;return {status:score<.7?'RELATIVE_STRENGTH':score<1.4?'WATCH':'PRIORITY',score:score,rows:rows.length};
    }
    var d=advancedDomains.find(function(x){return x.index===index;}); return severityForDomain(d);
  }

  const prescriptions = {
    0:['Fonem farkındalığı','Ses silme/değiştirme ve birleştirme','Kısa, sözlü fonolojik oyunlar'],
    1:['Harf–ses otomatikleştirme','Benzer harf çiftlerini çok duyulu ayırma','Kısa ve sık sembol→ses erişim çalışmaları'],
    2:['Görsel/ortografik seçicilik','Harf sırası ve kelime biçimi kontrolü','Benzer kelime karşılaştırmaları'],
    3:['Hece birleştirme','İlk heceyi bellekte tutma','Kademeli iki→üç hece köprüleri'],
    4:['Yeni kelime çözümleme','Uydurma kelime ile tahmini azaltma','Sistematik ses-harf çözümleme'],
    5:['Hızlı isimlendirme','Ritimli kısa adlandırma dizileri','Doğruluk korunarak otomatik erişim'],
    6:['İşitsel çalışma belleği','Kısa ses/sözel dizileri tutma','Sıra + manipülasyon görevleri'],
    7:['Okuma akıcılığı','Tekrarlı kısa okuma','Anlamlı gruplama ve ritim'],
    8:['Okuma-anlama yükünü azaltma','Okuma ve dinleme koşullarını ayrı destekleme','Metne geri dönme ve kanıt bulma stratejisi'],
    9:['Dikte / yazılı kodlama','Ses→harf ve hece→kelime diktesi','Yazdığını okuyarak öz-kontrol'],
    10:['Hata farkındalığı','Kendi okuma/yazısını kontrol etme','Anlam ve biçim kontrol rutinleri'],
    11:['Öğrenme stratejisini transfer','Model→yakın transfer→uzak transfer','Stratejiyi sözel açıklama']
  };

  function finalSummary() {
    var results=[]; for(var i=0;i<12;i++)results.push(domainResultFromExternal(i));
    var sufficient=results.filter(function(r){return r.status!=='INSUFFICIENT';}).length;
    var priorities=results.map(function(r,i){return {i:i,r:r};}).filter(function(x){return x.r.status==='PRIORITY';});
    var watches=results.filter(function(r){return r.status==='WATCH';}).length;
    var strengths=results.filter(function(r){return r.status==='RELATIVE_STRENGTH';}).length;
    var risk='Kanıt yetersiz',riskClass='insufficient';
    if(sufficient>=8){
      if(priorities.length>=4){risk='Belirgin eğitsel risk · uzman değerlendirmesi önerilir';riskClass='watch';}
      else if(priorities.length>=2||watches>=4){risk='İzlem ve hedefli destek gerekli';riskClass='developing';}
      else{risk='Düşük eğitsel risk görünümü';riskClass='strength';}
    }
    var ranked=results.map(function(r,i){return {i:i,score:r.score==null?-1:r.score};}).filter(function(x){return x.score>=0;}).sort(function(a,b){return b.score-a.score;}).slice(0,5);
    var priorityHtml=ranked.length?ranked.map(function(x,n){var p=prescriptions[x.i];return '<div class="priority-row"><b>'+(n+1)+'. '+esc(dyslexiaDomains[x.i][0])+'</b><span>'+esc(p[0])+'</span><small>'+esc(p[1])+' · '+esc(p[2])+'</small></div>';}).join(''):'<div class="priority-row"><b>Yeterli kanıt yok</b><span>Önce alan değerlendirmelerini tamamla.</span></div>';
    var domainCards=results.map(function(r,i){return '<article class="mini-domain-result"><span>'+String(i+1).padStart(2,'0')+'</span><div><b>'+esc(dyslexiaDomains[i][0])+'</b><small>'+esc(statusText(r.status))+' · '+(r.rows||0)+' kanıt</small></div></article>';}).join('');

    app.innerHTML='<main class="page"><section class="hero dyslexia-accent"><div class="top-actions"><button class="text-btn" id="finalBack">← Alan haritası</button><span class="step-chip">Bütüncül profil</span></div>' +
      '<div class="summary-hero"><div><div class="eyebrow">'+esc(state.name).toUpperCase()+' · OKUMA GÜÇLÜĞÜ EĞİTİMSEL PROFİLİ</div><h1>12 alanın birlikte okunduğu profil</h1><p>Bu sonuç klinik tanı değildir. Eğitimsel tarama, risk işaretleri ve öğretim önceliklerini düzenler.</p></div><div class="status-orb '+riskClass+'"><span>Genel görünüm</span><b>'+esc(risk)+'</b></div></div>' +
      '<div class="summary-grid"><article><span>Yeterli kanıtlı alan</span><b>'+sufficient+'/12</b><small>Yorum güveni buna bağlıdır</small></article><article><span>Gelişim önceliği</span><b>'+priorities.length+'</b><small>Yüksek destek / farklı örüntü</small></article><article><span>İzlem alanı</span><b>'+watches+'</b><small>Karışık kanıt</small></article><article><span>Göreli güçlü alan</span><b>'+strengths+'</b><small>Eğitimde kaynak olarak kullan</small></article></div>' +
      '<h2>Alan haritası</h2><div class="mini-domain-grid">'+domainCards+'</div>' +
      '<h2>Çocukla yarın ne çalışacağız?</h2><div class="priority-list">'+priorityHtml+'</div>' +
      '<div class="four-week-plan"><h3>İlk 4 haftalık eğitim iskeleti</h3><div class="week-grid"><div><b>1. Hafta</b><span>En yüksek öncelikli mekanizmayı kısa ve yoğun çalış.</span></div><div><b>2. Hafta</b><span>Aynı beceriyi yeni uyaranlarla genelle.</span></div><div><b>3. Hafta</b><span>İkinci öncelik alanını ilk beceriyle birleştir.</span></div><div><b>4. Hafta</b><span>Kısa yeniden ölçüm + transfer görevi uygula.</span></div></div></div>' +
      '<div class="clinical-boundary"><b>Karar sınırı:</b> “Belirgin eğitsel risk” klinik disleksi tanısı değildir. Kalıcı ve işlevsel güçlüklerde çocuk gelişimi/çocuk psikiyatrisi, dil-konuşma, özel eğitim veya ilgili yetkili uzman değerlendirmesi önerilir. CZA raporu hangi becerilerde ne tür kanıt görüldüğünü taşır.</div>' +
      '<div class="launch-panel dys-launch"><div><b>Değerlendirme → Öğrenme Profili → Çalışma Programı</b><p>Bu profil eğitim hedeflerinin öncelik sırasını sağlar. Yeniden ölçümde aynı alanlar karşılaştırılabilir.</p></div><button class="primary-btn" id="finalBack2">Alan haritasına dön</button></div></section></main>';
    document.getElementById('finalBack').onclick=document.getElementById('finalBack2').onclick=function(){state.screen='dyslexia-overview';render();};
  }

  function enhanceOverview() {
    var cards=document.querySelectorAll('.domain-card');
    advancedDomains.forEach(function(d){
      if(cards[d.index]){
        cards[d.index].classList.add('ready','clickable-domain');
        var st=cards[d.index].querySelector('.domain-state'); if(st)st.textContent='CANLI';
        cards[d.index].onclick=function(){startDomain(d.id);};
        var res=severityForDomain(d); if(res.status!=='INSUFFICIENT'){cards[d.index].setAttribute('data-result',statusText(res.status));}
      }
    });
    if(cards[0])cards[0].onclick=function(){var next=dyslexiaTasks.findIndex(function(t){var e=state.dysEvidence[t.id];return !e||!e.verdict||!e.support;});state.dysTaskIndex=Math.max(0,next);state.taskStartedAt=Date.now();state.screen='dyslexia-task';render();};
    if(cards[1]&&window.startDyslexiaLetterSound)cards[1].onclick=window.startDyslexiaLetterSound;

    var launch=document.querySelector('.launch-panel.dys-launch');
    if(launch){
      launch.innerHTML='<div><b>12 alanın tamamı aktif</b><p>Alan kartına dokunarak istediğin derin taramayı aç. Sistem güçlü alanı kısa tutar, zorlanma gördüğü yerde derinleşir.</p></div><div class="summary-actions"><button class="secondary-btn" id="openNextIncomplete">Eksik ilk alanı aç</button><button class="primary-btn" id="openFullProfile">Bütüncül profili oluştur</button></div>';
      document.getElementById('openFullProfile').onclick=function(){state.screen='dyslexia-final-summary';render();};
      document.getElementById('openNextIncomplete').onclick=function(){
        for(var i=0;i<12;i++){var r=domainResultFromExternal(i);if(r.status==='INSUFFICIENT'){if(i===0){var next=dyslexiaTasks.findIndex(function(t){var e=state.dysEvidence[t.id];return !e||!e.verdict||!e.support;});if(next<0)continue;state.dysTaskIndex=next;state.taskStartedAt=Date.now();state.screen='dyslexia-task';return render();}if(i===1&&window.startDyslexiaLetterSound)return window.startDyslexiaLetterSound();var d=advancedDomains.find(function(x){return x.index===i;});if(d)return startDomain(d.id);}}
        state.screen='dyslexia-final-summary';render();
      };
    }
    var score=document.querySelector('.route-score.dys-score'); if(score)score.innerHTML='<b>12/12</b><span>alan aktif</span>';
  }

  advancedDomains.forEach(function(d){ if(dyslexiaDomains[d.index]) dyslexiaDomains[d.index][2]=1; });

  const baseRender=render;
  render=function(){
    ensureState();
    if(state.screen==='dyslexia-advanced-task'){saveState();return taskScreen();}
    if(state.screen==='dyslexia-advanced-summary'){saveState();return domainSummary();}
    if(state.screen==='dyslexia-final-summary'){saveState();return finalSummary();}
    var result=baseRender();
    if(state.screen==='dyslexia-overview')enhanceOverview();
    return result;
  };

  render();
})();
