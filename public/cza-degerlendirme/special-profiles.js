(function () {
  const genericProfiles = {
    'SP-SLD': {
      title:'Özgül Öğrenme Güçlüğü Eğitsel Tarama Profili',
      short:'Özgül Öğrenme Güçlüğü',
      disclaimer:'Okuma, yazma ve matematikteki öğrenme örüntülerini birlikte inceler; klinik tanı üretmez.',
      flags:['Yönergeyi tekrar istedi','Belirgin yavaşlık','Strateji kullanmadı','Tahmin etti','Sıra kaybetti','Modelden yararlandı','Kendini düzeltti'],
      tasks:[
        {id:'SLD01',area:'Ortak Temel',title:'İki Aşamalı Yönerge',child:'Önce 4 yaz, sonra 4’ün altına küçük bir daire çiz.',stimulus:'Sözel yönerge · yazma/işaretleme',focus:'Alıcı dil · çalışma belleği · yönerge sırası',educator:'Yönergeyi bir kez doğal biçimde ver. Tekrar, parçalara bölme ve sıra hatasını ayrı kaydet.',probe:'Yalnız “yönergeyi baştan düşün” gibi nötr ipucu kullan.'},
        {id:'SLD02',area:'Okuma',title:'Yeni Kelimeyi Çöz',child:'“mota” gerçek bir kelime değil. Gördüğün sesleri birleştirerek oku.',stimulus:'mota',focus:'Ezberden bağımsız çözümleme',educator:'Tahmin, harf atlama, ses ekleme ve uzun beklemeyi not et.',probe:'Anlam aramasını normalleştir; kelimeyi modelleme.',related:'SP-DYS'},
        {id:'SLD03',area:'Yazma',title:'Duy ve Yaz',child:'“kalem” kelimesini dinle ve yaz.',stimulus:'Eğitmen söyler: kalem',focus:'Ses-harf kodlama · sıra · yazılı üretim',educator:'Harf adı söylemeden doğal dikte uygula.',probe:'Bir kez tekrar etmek destek sayılır.',related:'SP-DYSG'},
        {id:'SLD04',area:'Matematik',title:'Nicelik mi Sembol mü?',child:'Hangisi daha fazla: 8 nokta mı, 6 nokta mı? Sonra “8” rakamını göster.',stimulus:'••••••••   /   ••••••   → 8',focus:'Nicelik karşılaştırma · sembol eşleme',educator:'Önce nicelik kararını, sonra sembol seçimini ayrı değerlendir.',probe:'Saymasına izin ver; stratejiyi not et.',related:'SP-DYSC'},
        {id:'SLD05',area:'Dikkat / Bellek',title:'Kuralı Tut',child:'2-5-8 dizisini dinle. Önce aynı sırayla, sonra tersten söyle.',stimulus:'2 – 5 – 8',focus:'İşitsel çalışma belleği · manipülasyon',educator:'Aynı sıra ve ters sıra performansını ayır.',probe:'Diziyi tekrar etmek destek sayılır.',related:'SP-ATTN'},
        {id:'SLD06',area:'Öğrenme Tepkisi',title:'Modelden Sonra Dene',child:'Örnek: “ba + lık → balık”. Şimdi “sa + rı” için aynı yöntemi kullan.',stimulus:'sa + rı',focus:'Kısa öğretimden yararlanma',educator:'Bir model ver, sonra yeni örnekte performansı kaydet.',probe:'Ek model gerekiyorsa desteğe işle.'},
        {id:'SLD07',area:'Transfer',title:'Yeni Duruma Taşı',child:'Aynı birleştirme yolunu “li + mon” için kullan.',stimulus:'li + mon',focus:'Yakın transfer · strateji kararlılığı',educator:'Modeli tekrar etmeden uygulat.',probe:'İlk transfer cevabını koru.'},
        {id:'SLD08',area:'Üstbiliş',title:'Nasıl Öğrendin?',child:'Zor gelen bir görevde sana en çok ne yardım etti? Bana kendi cümlenle anlat.',stimulus:'Kısa öz-değerlendirme',focus:'Strateji farkındalığı · yardım kullanımı',educator:'Tek doğru cevap arama. Çocuğun kendi öğrenme dilini kaydet.',probe:'Seçenek sunmadan önce serbest yanıt al.'},
        {id:'SLD09',area:'Görsel / Ortografik İşleme',title:'Benzer Biçimi Ayır',child:'“kalem” ile tamamen aynı olanı seç.',stimulus:'kalem → kalem / kalen / kaelm / kelam',focus:'Kelime biçimi · harf sırası · görsel seçicilik',educator:'Okuma doğruluğundan bağımsız olarak biçim ve sıra kontrolünü gözle.',probe:'“Harfleri tek tek kontrol edebilirsin” dışında ipucu verme.',related:'SP-DYS'},
        {id:'SLD10',area:'İşitsel İşleme / Transfer',title:'Duyduğunu Dönüştür',child:'“bal” kelimesini dinle. Başındaki /b/ yerine /d/ koy ve yeni kelimeyi söyle.',stimulus:'bal → b yerine d',focus:'İşitsel işlem · çalışma belleği · yeni kurala transfer',educator:'Kelimeyi zihinde tutma ile ses değiştirmeyi birlikte gözle.',probe:'Kelimeyi tekrar etmek destek sayılır.',related:'SP-DYS'}

      ]
    },
    'SP-DYSC': {
      title:'Diskalkuli / Matematik Öğrenme Güçlüğü Eğitsel Tarama Profili',
      short:'Diskalkuli / Matematik',
      disclaimer:'Sayı hissi ve matematik öğrenme süreçlerini inceler; diskalkuli tanısı koymaz.',
      flags:['Nesneleri tek tek saydı','Sayıyı ters okudu','Basamak karıştı','İşlem işaretini karıştırdı','Parmakla yoğun destek aldı','Stratejiyi açıklayamadı','Modelden yararlandı'],
      tasks:[
        {id:'DYC01',area:'Sayı Hissi',title:'Hangisi Daha Çok?',child:'Saymadan önce tahmin et: 7 noktalı grup mu, 4 noktalı grup mu daha fazla?',stimulus:'•••••••     ••••',focus:'Yaklaşık nicelik · sayı hissi',educator:'İlk tahmini ve sonra sayarak kontrol edip etmediğini ayrı kaydet.',probe:'Saymasına izin ver ama ilk tahmini silme.'},
        {id:'DYC02',area:'Sembol–Nicelik',title:'Sembolü Bağla',child:'Bu 6 nesneyi gösteren rakam hangisi?',stimulus:'● ● ● ● ● ●',choices:['5','6','9'],expected:'6',focus:'Nicelikten sayısal sembole eşleme',educator:'6/9 görsel karışmasıyla miktar bilgisini ayır.',probe:'Nesneleri tekrar saymak destek sayılmaz; rakamı söylemek sayılır.'},
        {id:'DYC03',area:'Sayı Dizisi',title:'Eksik Sayıyı Bul',child:'12, 13, __, 15. Boşluğa hangi sayı gelir?',stimulus:'12  13  __  15',focus:'Ardışıklık · sayı sırası',educator:'Çocuğun ezber sayma mı, komşuluk ilişkisi mi kullandığını sor.',probe:'“13’ten sonra ne gelir?” doğrudan cevaba yaklaşan ipucudur; kullanırsan destek kaydet.'},
        {id:'DYC04',area:'Basamak Değeri',title:'27 ile 72',child:'27 ve 72 aynı rakamlardan oluşuyor. Sence neden aynı sayı değiller?',stimulus:'27   ↔   72',focus:'Onluk-birlik · basamak konumu',educator:'Sadece büyük olanı seçmesi yetmez; konumun anlamını nasıl açıkladığını kaydet.',probe:'Onluk/birlik adını önceden verme.'},
        {id:'DYC05',area:'İşlem Stratejisi',title:'8 + 7’yi Nasıl Bulursun?',child:'Cevabı bul ve nasıl düşündüğünü anlat.',stimulus:'8 + 7 = ?',focus:'Toplama stratejisi · sayısal esneklik',educator:'Parmak, sayarak devam, 10’a tamamlama gibi stratejileri yargılamadan kaydet.',probe:'Tek bir “iyi yöntem” dayatma.'},
        {id:'DYC06',area:'Problem',title:'Değişimi İzle',child:'Ece’nin 9 kalemi vardı. 3’ünü arkadaşına verdi. Kaç kalemi kaldı?',stimulus:'9 kalem → 3 verildi → ?',focus:'Problem dili · işlem seçimi · nicelik değişimi',educator:'Yanlışsa bunun dil mi, işlem mi, sayı bilgisi mi olduğunu ayırmaya çalış.',probe:'Somut nesne kullanırsa desteği materyal olarak not et.'},
        {id:'DYC07',area:'Öğrenme Tepkisi',title:'10’a Tamamlama Modeli',child:'Örnek: 8 + 5 için 8’e 2 ekleyip 10 yapabiliriz, 3 kalır; 13 olur. Şimdi 7 + 6 için dene.',stimulus:'7 + 6',focus:'Modelden strateji öğrenme',educator:'Model sonrası stratejiyi kullanıp kullanmadığını gözle.',probe:'İkinci model gerekirse desteğe işle.'},
        {id:'DYC08',area:'Transfer',title:'Yeni İşleme Taşı',child:'Aynı 10’a tamamlama fikrini 9 + 5 için kullan.',stimulus:'9 + 5',focus:'Matematik stratejisi transferi',educator:'Önceki modeli tekrar etmeden uygulat.',probe:'İlk transfer performansı ana kanıttır.'},
        {id:'DYC09',area:'Matematiksel Çalışma Belleği',title:'İki Adımı Zihinde Tut',child:'5 ile 3’ü topla. Çıkan sonuca 2 daha ekle. Sonuç kaç?',stimulus:'5 + 3, sonra +2',focus:'Ara sonucu tutma · sıralı zihinsel işlem',educator:'İlk ara sonucu unutma, başa dönme veya işlemleri karıştırmayı kaydet.',probe:'İlk ara sonucu sen söylersen bunu destek olarak işaretle.'},
        {id:'DYC10',area:'Sayı Doğrusu / Konum',title:'Sayı Nerede Durur?',child:'0 ile 20 arasındaki çizgide 14 sayısının yaklaşık yerini göster.',stimulus:'0 ───────────── 20',focus:'Sayı büyüklüğü · uzamsal sayı temsili',educator:'Kesin santimetre değil, göreli konumu ve stratejiyi gözle.',probe:'10’un yerini referans olarak göstermek görsel destek sayılır.'}

      ]
    },
    'SP-DYSG': {
      title:'Disgrafi / Yazma Güçlüğü Eğitsel Tarama Profili',
      short:'Disgrafi / Yazma',
      disclaimer:'Grafomotor ve yazılı kodlama bileşenlerini ayrıştırır; disgrafi tanısı koymaz.',
      flags:['Kalem basıncı çok değişken','Harf biçimi kararsız','Satır dışına çıktı','Boşluk sorunu','Harf/ses eksiltti','Yazma çok yavaş','Kopya ile dikte arasında fark yüksek','Kendini düzeltti'],
      tasks:[
        {id:'DYG01',area:'Grafomotor',title:'Çizgi Rotası',child:'Kalemi kaldırmadan dalgalı çizginin üzerinden git.',stimulus:'Kağıt üzerinde dalgalı yol',focus:'İnce motor kontrol · çizgi takibi',educator:'Gerçek kağıt/kalem kullan. Basınç, hız, taşma ve el pozisyonunu gözle.',probe:'Fiziksel yönlendirme desteğe yazılır.'},
        {id:'DYG02',area:'Harf Biçimi',title:'Kopyala',child:'“m n u b d” harflerini aynı sırayla kopyala.',stimulus:'m   n   u   b   d',focus:'Harf biçimi · yön · kopyalama',educator:'Kopyada biçim kararlılığı ve benzer harf yönlerini kaydet.',probe:'Harf oluşumunu modellemek destek sayılır.'},
        {id:'DYG03',area:'Dikte',title:'Duy ve Yaz',child:'“sarı” kelimesini dinle ve yaz.',stimulus:'Eğitmen: sarı',focus:'Ses-harf kodlama · harf sırası',educator:'Kopya desteğini kaldır. Hangi harfin nasıl üretildiğini gözle.',probe:'Kelimeyi bir kez tekrar edebilirsin.'},
        {id:'DYG04',area:'Kelime Sınırı',title:'Cümleyi Yaz',child:'“Mina okula gitti.” cümlesini yaz.',stimulus:'Eğitmen cümleyi söyler',focus:'Kelime boşluğu · satır düzeni · noktalama',educator:'İçerik doğruluğuyla görsel düzeni ayrı değerlendir.',probe:'Kelime kelime dikte desteğe yazılır.'},
        {id:'DYG05',area:'Yazma Hızı',title:'Bir Dakikalık Üretim',child:'“Bugün okulda...” diye başlayan kısa bir cümle yaz.',stimulus:'Bugün okulda ...',focus:'Yazılı üretim akışı · hız · içerik',educator:'Süreyi kaydet ama hız tek başına olumsuz yorumlanmaz. Duraklama ve fikir üretimini ayır.',probe:'Sözel fikir ipucu destek sayılır.'},
        {id:'DYG06',area:'Kopya–Dikte Ayrımı',title:'Aynı Kelime İki Yolla',child:'Önce “kalem”i kopyala. Sonra yazıyı kapatıp kelimeyi duyunca yeniden yaz.',stimulus:'kalem',focus:'Görsel kopya ile işitsel kodlama farkı',educator:'İki üretimi yan yana karşılaştır.',probe:'Kapatıldıktan sonra kelimeyi yeniden gösterme.'},
        {id:'DYG07',area:'Öz-Kontrol',title:'Yazdığını Oku',child:'Yazdığın cümleyi sesli oku ve değiştirmek istediğin bir yer var mı bak.',stimulus:'Kendi yazısı',focus:'Yazı-okuma çapraz kontrolü',educator:'Kendi hatasını fark edip etmediğini kaydet.',probe:'Hatanın yerini söyleme.'},
        {id:'DYG08',area:'Transfer',title:'Yeni Cümle',child:'Şimdi benzer uzunlukta yeni bir cümle yaz: “Kedi pencereye çıktı.”',stimulus:'Kedi pencereye çıktı.',focus:'Yeni yazma durumuna transfer',educator:'Önceki düzenleme stratejilerinin sürüp sürmediğini izle.',probe:'İlk üretimi ana kanıt olarak tut.'},
        {id:'DYG09',area:'Yazım / Ortografik Bellek',title:'Gördün, Kapandı, Yaz',child:'“limon” kelimesine kısa süre bak. Kelime kapandıktan sonra hatırladığın gibi yaz.',stimulus:'limon → 3 sn → kapat',focus:'Ortografik bellek · harf sırası · yazılı geri çağırma',educator:'Kopyalama ile gecikmeli yazma farkını kaydet.',probe:'Kelimeyi ikinci kez göstermek görsel destek sayılır.'},
        {id:'DYG10',area:'Yazılı İfade / Planlama',title:'Üç Bilgiyi Cümlede Birleştir',child:'“çocuk – park – top” kelimelerini kullanarak anlamlı bir cümle yaz.',stimulus:'çocuk · park · top',focus:'Yazılı ifade · cümle planlama · kelime sınırları',educator:'Fikir üretme ile el yazısı mekaniklerini ayrı değerlendir.',probe:'Sözel cümle kurdurmak destek olarak kaydedilir.'}

      ]
    },
    'SP-ASD': {
      title:'Otizm Spektrumu Eğitsel Profil',
      short:'Otizm Eğitsel Profili',
      disclaimer:'İletişim, ortak dikkat, oyun, esneklik ve öğrenme tepkisini eğitim amacıyla gözlemler; otizm tanısı koymaz.',
      flags:['Ortak dikkati kendiliğinden kurdu','İşaret/jest kullandı','Sözel yanıt kullandı','Taklit etti','Geçişte zorlandı','Tekrarlı tepki gösterdi','Duyusal kaçınma/arama','Modelden yararlandı'],
      tasks:[
        {id:'ASD01',area:'Ortak Dikkat',title:'Bak ve Paylaş',child:'Eğitmen ilginç bir nesneyi işaret eder: “Bak, orada ne var?”',stimulus:'Tanıdık ve ilgi çekici nesne',focus:'Bakış/işaret takibi · ortak dikkat',educator:'Bakış yönü, işaret takibi ve deneyimi paylaşma davranışını doğal ortamda gözle.',probe:'Çocuğun yüzünü fiziksel olarak yönlendirme.'},
        {id:'ASD02',area:'İşlevsel İletişim',title:'Yardım İste',child:'Kapağı zor açılan sevdiği bir materyal sunulur. Yardım gerektiğinde ne yapıyor?',stimulus:'Kapalı kutu + sevilen materyal',focus:'İstek/y yardım iletişimi · işlevsel iletişim',educator:'Sözel, jest, bakış, nesneyi uzatma gibi tüm işlevsel iletişimi kabul et ve biçimini kaydet.',probe:'“Yardım de” şeklinde kelime dayatma.'},
        {id:'ASD03',area:'Taklit',title:'Benim Gibi Yap',child:'Eğitmen iki basit hareket yapar: masaya iki kez vur, sonra ellerini aç.',stimulus:'2 aşamalı motor model',focus:'Motor taklit · sıra',educator:'İlk bağımsız taklit ile tekrar/model ihtiyacını ayır.',probe:'Fiziksel yardım en yüksek destek olarak kaydedilir.'},
        {id:'ASD04',area:'Sosyal Karşılıklılık',title:'Sıra Bende – Sıra Sende',child:'Kısa top yuvarlama oyununda iki tur sıra değiştirin.',stimulus:'Top ile karşılıklı oyun',focus:'Sıra alma · sosyal karşılıklılık · ortak etkinlik',educator:'Başlatma, bekleme, karşı tarafa yönelme ve oyunu sürdürmeyi gözle.',probe:'Yoğun sözel yönlendirme desteğe yazılır.'},
        {id:'ASD05',area:'Oyun / Sembol',title:'Nesneyle Yeni Oyun',child:'Oyuncak bardak ve kaşıkla istediğin kısa oyunu kur.',stimulus:'Oyuncak bardak + kaşık + bebek',focus:'İşlevsel/sembolik oyun · esneklik',educator:'Tek doğru oyun bekleme. Nesneyi işlevsel, sembolik veya tekrarlı kullanım biçimini not et.',probe:'Bir sembolik örnek modellemek destek sayılır.'},
        {id:'ASD06',area:'Esneklik',title:'Kural Değişti',child:'Önce kırmızı blokları kutuya koy. Sonra kural değişiyor: şimdi büyük blokları koy.',stimulus:'Renk ve boyutu değişen bloklar',focus:'Bilişsel esneklik · geçiş toleransı',educator:'Eski kuralı sürdürme, yeni kurala geçiş ve duygusal düzenlemeyi ayrı kaydet.',probe:'Görsel kural kartı kullanırsan desteğe yaz.'},
        {id:'ASD07',area:'Duyusal / Düzenleme',title:'Tercih ve Rahatsızlık',child:'İki farklı dokulu materyal sunulur; hangisini tercih ettiğini veya istemediğini gösterebilir.',stimulus:'Yumuşak kumaş + pütürlü top',focus:'Duyusal tepki · tercih bildirme · düzenleme',educator:'Kaçınma veya arama davranışını “iyi/kötü” diye puanlama; katılımı ve iletişimi kaydet.',probe:'Zorlayarak temas ettirme.'},
        {id:'ASD08',area:'Öğrenme / Transfer',title:'Model Sonrası Yeni Örnek',child:'Eğitmen bir blok dizilimi gösterir; sonra farklı renklerle aynı kuralı kurmasını ister.',stimulus:'kırmızı-mavi-kırmızı → sarı-yeşil-?',focus:'Modelden öğrenme · örüntü transferi',educator:'Yeni yüzeyde kuralı genelleyip genellemediğini gözle.',probe:'İlk modelden sonra ikinci modeli destek olarak kaydet.'},
        {id:'ASD09',area:'Duygu / Sosyal İpucu',title:'Yüzden ve Durumdan Anla',child:'Bir çocuk oyuncağı kırılınca yüzü üzgün görünüyor. Sence ne hissediyor ve neden?',stimulus:'Kısa sosyal durum + duygu yüzü',focus:'Duygu ipucu · durumla duygu eşleme · sosyal çıkarım',educator:'Sözel açıklama zorunlu değil; işaret, seçim veya kısa yanıt kabul edilir.',probe:'“Üzgün mü?” gibi cevabı içeren soru sorma.'},
        {id:'ASD10',area:'Geçiş / Genelleme',title:'Etkinlik Değişiyor',child:'Sevdiği kısa etkinlik bittikten sonra görsel “bitti → yeni etkinlik” kartıyla başka göreve geçilir.',stimulus:'Bitti kartı + yeni etkinlik',focus:'Geçiş toleransı · görsel destek kullanımı · düzenleme',educator:'Geçiş süresi, protesto, yardım türü ve yeni etkinliğe katılımı ayrı kaydet.',probe:'Görsel program standart destek olabilir; ek fiziksel/sözel yardım ayrıca kaydedilir.'}

      ]
    },
    'SP-LANG': {
      title:'Dil ve Konuşma Gelişimi Eğitsel Tarama Profili',
      short:'Dil ve Konuşma',
      disclaimer:'Alıcı/ifade edici dil, sözcük erişimi ve anlatıyı eğitimsel olarak tarar; dil/konuşma bozukluğu tanısı koymaz.',
      flags:['Yönergeyi kaçırdı','Sözcük bulmakta zorlandı','Kısa yanıt verdi','Dilbilgisel yapı eksik','Olay sırası karıştı','Jestle destekledi','Modelden yararlandı'],
      tasks:[
        {id:'LAN01',area:'Alıcı Dil',title:'İki Özellikli Yönerge',child:'Kırmızı kalemin yanındaki küçük kutuyu göster.',stimulus:'Masa üzerinde renk/boyut/konum seçenekleri',focus:'Nitelik + konum içeren yönerge',educator:'Tek sözcük bilgisinden çok birleşik yönergeyi izle.',probe:'Yönergeyi parçalara bölmek destek sayılır.'},
        {id:'LAN02',area:'Sözcük Dağarcığı',title:'İşlevden Sözcüğe',child:'“Yağmurda ıslanmamak için kullandığımız şey nedir?”',stimulus:'Sözlü işlev tanımı',focus:'Sözcük erişimi · kavram bilgisi',educator:'İlk erişim süresi ve dolaylı anlatımı kaydet.',probe:'İlk sesi verme.'},
        {id:'LAN03',area:'İfade Edici Dil',title:'Bir Cümleyle Anlat',child:'Bir çocuk topunu düşürdü ve arkadaşı topu aldı. Ne oldu?',stimulus:'İki olaylı kısa sahne sözlü betimi',focus:'Cümle kurma · özne-eylem ilişkisi',educator:'Uzunluk yerine anlam bütünlüğü ve kelime sırasını gözle.',probe:'Cümleyi sen başlatma.'},
        {id:'LAN04',area:'Olay Sırası',title:'Önce – Sonra',child:'“Ayakkabımı giydim, kapıyı açtım, dışarı çıktım.” Olayları doğru sırayla anlat.',stimulus:'3 olay',focus:'Zamansal dil · anlatı sırası',educator:'Önce/sonra bağlaçlarını kullanıp kullanmadığını kaydet.',probe:'Kartlarla görsel destek verirsen desteğe yaz.'},
        {id:'LAN05',area:'Neden–Sonuç',title:'Neden?',child:'Ece montunu giydi çünkü dışarısı çok soğuktu. Ece neden montunu giydi?',stimulus:'Kısa cümle',focus:'Neden-sonuç dili · anlama',educator:'Soruyu tekrar ihtiyacı ve cevabın ilişkisini gözle.',probe:'Seçenek verme.'},
        {id:'LAN06',area:'Sözcük Erişim Hızı',title:'Bir Dakikada Kategori',child:'Bana bildiğin hayvan isimlerini söyle.',stimulus:'Kategori: hayvanlar',focus:'Sözcük erişimi · kategori içinde üretim',educator:'Tekrar, uzun boşluk ve kümelenme stratejilerini not et. Norm puanı üretme.',probe:'Örnek hayvan adı verme.'},
        {id:'LAN07',area:'Öğrenme Tepkisi',title:'Yeni Sözcüğü Öğren',child:'“Luma” bu oyunda mavi küçük topun adı olsun. Şimdi “luma”yı bana ver.',stimulus:'Yeni uydurma etiket + nesne',focus:'Yeni sözcük eşleme · kısa öğrenme',educator:'Bir kez eşleştir, sonra seçme görevinde öğrenme tepkisini izle.',probe:'İkinci öğretim desteğe yazılır.'},
        {id:'LAN08',area:'Transfer',title:'Yeni Bağlamda Kullan',child:'“Luma masanın altında” cümlesinde luma nedir ve nerede?',stimulus:'Yeni öğrenilen sözcük yeni cümlede',focus:'Yeni sözcüğü bağlama taşıma',educator:'Öğrenilen etiketi yeni dil bağlamında kullanıp kullanmadığını izle.',probe:'Nesneyi tekrar göstermeden önce serbest yanıt al.'},
        {id:'LAN09',area:'Sesletim / Konuşma Anlaşılırlığı',title:'Yakın Sesli Sözcükler',child:'“sal – şal”, “cam – çam” çiftlerini sırayla söyle.',stimulus:'sal / şal · cam / çam',focus:'Konuşma sesi üretimi · yakın ses ayrımı · anlaşılırlık',educator:'Sesletim gözlemini tanı olarak yorumlama; hangi ses/konumda anlaşılabilirlik değiştiğini kaydet.',probe:'Ayna veya ağız modeli kullanırsan destek olarak kaydet.'},
        {id:'LAN10',area:'Pragmatik Dil / Karşılıklılık',title:'Kısa Konuşmayı Sürdür',child:'Eğitmen “Bugün seni mutlu eden bir şey oldu mu?” diye sorar; yanıta göre bir takip sorusu yöneltir.',stimulus:'2 turluk doğal konuşma',focus:'Konuyu sürdürme · karşılıklı iletişim · uygun yanıt',educator:'Göz teması zorunlu kriter değildir. Konuşma sırası ve anlamlı karşılıklılığı gözle.',probe:'Yanıt seçenekleri sunmak destek sayılır.'}

      ]
    },
    'SP-ATTN': {
      title:'Dikkat – Odaklanma – Yürütücü İşlevler Eğitsel Tarama Profili',
      short:'Dikkat / Yürütücü İşlevler',
      disclaimer:'Dikkat ve yürütücü süreçleri eğitimsel görevlerde gözlemler; DEHB veya başka klinik tanı koymaz.',
      flags:['Hedef atladı','Yanlış hedef işaretledi','İkinci yarıda performans düştü','Kuralı unuttu','Dürtüsel başladı','Eski kuralı sürdürdü','Hatasını fark etti','Plan kullandı'],
      tasks:[
        {id:'ATT01',area:'Seçici Dikkat',title:'Hedef Avı',child:'Bu dizide yalnız “27” sayılarını bul.',stimulus:'27 72 37 27 22 72 27 17 27 72',focus:'Benzer uyaranlar arasında hedef seçme',educator:'Atlama, yanlış hedef ve tarama yönünü kaydet.',probe:'Satırı parmakla takip etme kendiliğinden strateji ise not et.'},
        {id:'ATT02',area:'Sürdürülen Dikkat',title:'İkinci Tur',child:'Aynı kuralla daha uzun diziyi tamamla.',stimulus:'27 17 72 27 37 27 22 72 27 17 27 37 72 27 27',focus:'Dikkati sürdürme · performans düşüşü',educator:'İlk ve ikinci yarıyı karşılaştır.',probe:'Mola ihtiyacını ayrıca gözlemle.'},
        {id:'ATT03',area:'Ketleme',title:'Ters Kural',child:'Ben “gündüz” dersem “gece”, “gece” dersem “gündüz” de.',stimulus:'gündüz · gece · gece · gündüz · gündüz',focus:'Otomatik cevabı durdurma · ketleme',educator:'İlk dürtüsel yanıt ile düzeltmeyi ayrı kaydet.',probe:'Kuralı tekrar etmek destek sayılır.'},
        {id:'ATT04',area:'Çalışma Belleği',title:'Tut ve Uygula',child:'Önce 3 yaz, sonra 3’ün soluna daire çiz, en son dairenin içine nokta koy.',stimulus:'3 aşamalı yönerge',focus:'Sözel bilgiyi tutma · sıralı uygulama',educator:'Adım atlama ve sıra değişimini kaydet.',probe:'Yönergeyi parçalamak destek sayılır.'},
        {id:'ATT05',area:'Bilişsel Esneklik',title:'Kural Değiştir',child:'İlk turda kırmızıları seç. İkinci turda renk değil, yuvarlak olanları seç.',stimulus:'Renk + şekil kartları',focus:'Set değiştirme · eski kuralı bırakma',educator:'Geçişte perseverasyon ve gecikmeyi izle.',probe:'Yeni kuralı görsel kartla göstermek destek sayılır.'},
        {id:'ATT06',area:'Planlama',title:'En Kısa Yol',child:'Üç işi yapacaksın: kitabı çantaya koy, kalemi kutuya koy, sandalyeyi düzelt. Sence hangi sırayla başlamak iyi olur?',stimulus:'3 günlük görev',focus:'Plan kurma · göreve başlama',educator:'Tek doğru sıra yok. Plan açıklaması ve uygulama tutarlılığını gözle.',probe:'Sırayı sen verme.'},
        {id:'ATT07',area:'Hata Kontrolü',title:'Kendi Taramana Bak',child:'Az önceki hedef avını yeniden kontrol et. Kaçırdığın bir şey var mı?',stimulus:'Önceki hedef avı',focus:'Öz-izleme · hata farkındalığı',educator:'Kendiliğinden kontrol stratejisini kaydet.',probe:'Hatanın yerini işaretleme.'},
        {id:'ATT08',area:'Transfer',title:'Yeni Hedef, Aynı Strateji',child:'Şimdi yalnız “63” sayılarını bul.',stimulus:'36 63 83 63 33 36 63 68 63 36',focus:'Seçici dikkat stratejisini yeni hedefe taşıma',educator:'İlk görevdeki tarama stratejisini genelleyip genellemediğini izle.',probe:'Yeni görevi ayrıca modelleme.'},
        {id:'ATT09',area:'Göreve Başlama / Başlatma',title:'Planla ve Başla',child:'Önünde üç materyal var. “Bu şekli aynen yap” yönergesinden sonra ne zaman ve nasıl başladığını gözlemle.',stimulus:'Basit model + 3 materyal',focus:'Göreve başlatma · plan kurma · gereksiz gecikme',educator:'Başlama süresini, materyal seçimini ve yardım bekleme davranışını kaydet.',probe:'“Şuradan başla” demek yönlendirici destek sayılır.'},
        {id:'ATT10',area:'Çift Görev / Esnek Dikkat',title:'İki Kuralı Birlikte Tut',child:'Kırmızı şekillerde yalnız daireyi, mavi şekillerde yalnız kareyi işaretle.',stimulus:'Kırmızı/mavi daire-kare karışık dizi',focus:'Kural sürdürme · seçici dikkat · çalışma belleği',educator:'Renk kuralı ile şekil kuralının karışıp karışmadığını ve hata sonrası toparlanmayı izle.',probe:'Kuralları görsel kartta açık tutmak görsel destek olarak kaydedilir.'}

      ]
    },
    'SP-DELAY': {
      title:'Gelişimsel Gecikme Eğitsel Profil',
      short:'Gelişimsel Gecikme',
      disclaimer:'Birden fazla gelişim alanındaki eğitimsel katılımı gözlemler; gelişimsel tanı veya gelişim yaşı üretmez.',
      flags:['Bakışla katıldı','Jest kullandı','Modeli taklit etti','Yoğun destek gerekti','Görevden kaçındı','Yorgunluk belirtisi','Yeni örneğe taşıdı'],
      tasks:[
        {id:'DEL01',area:'İletişim',title:'İstek Bildirme',child:'Sevdiği iki nesneden birini seçmesi için fırsat ver.',stimulus:'İki tanıdık nesne',focus:'Seçim · istek iletişimi',educator:'Sözel, jest, bakış veya uzanma biçimini kaydet.',probe:'Tek bir iletişim biçimini zorunlu tutma.'},
        {id:'DEL02',area:'Alıcı Dil',title:'Tek Aşamalı Yönerge',child:'Topu kutuya koy.',stimulus:'Top + kutu',focus:'Basit yönergeyi anlama ve uygulama',educator:'Yönerge tekrarını ve jest desteğini ayrı kaydet.',probe:'Fiziksel yardım en yüksek destek sayılır.'},
        {id:'DEL03',area:'Biliş / Problem',title:'Parça Nereye Ait?',child:'Tekerleği uygun oyuncağa yerleştir.',stimulus:'Tekerlek + araba + ilgisiz nesne',focus:'Parça-bütün · problem çözme',educator:'Deneme, bakış ve yardım kullanımını gözle.',probe:'Doğru yeri işaret etmek görsel destek sayılır.'},
        {id:'DEL04',area:'Motor',title:'Taklit Et',child:'Bir çizgi ve bir daire çizimini taklit et.',stimulus:'|   ○',focus:'Grafomotor taklit · el-göz koordinasyonu',educator:'Çizgi doğruluğundan çok katılım, tutuş ve modelden yararlanmayı izle.',probe:'El üstünden yardım fiziksel destek sayılır.'},
        {id:'DEL05',area:'Sosyal / Oyun',title:'Sıralı Oyun',child:'Topu iki tur karşılıklı yuvarlayın.',stimulus:'Top',focus:'Sıra alma · ortak etkinlik',educator:'Başlatma, bekleme ve karşı tarafa yönelme davranışını kaydet.',probe:'Sözel “sıra sende” desteğini not et.'},
        {id:'DEL06',area:'Özbakım',title:'Günlük Adım',child:'Montun fermuarını açma/kapama veya çantayı düzenleme gibi yaşa uygun kısa bir işi dene.',stimulus:'Günlük yaşam materyali',focus:'Günlük yaşam katılımı · bağımsızlık',educator:'Görev çocuğun yaşına ve motor durumuna uygun seçilmeli.',probe:'Fiziksel yardım düzeyini açıkça kaydet.'},
        {id:'DEL07',area:'Öğrenme Tepkisi',title:'Modeli İzle',child:'Eğitmen iki bloktan kısa bir model kurar; çocuk aynısını dener.',stimulus:'2 bloklu model',focus:'Taklit yoluyla öğrenme',educator:'İlk model sonrası performansı kaydet.',probe:'İkinci model desteğe yazılır.'},
        {id:'DEL08',area:'Transfer',title:'Yeni Renklerle Kur',child:'Aynı yapıyı farklı renkli bloklarla kur.',stimulus:'Farklı renk, aynı yapı',focus:'Model bilgisini yeni malzemeye taşıma',educator:'Yüzey değiştiğinde yapının kuralını koruyor mu izle.',probe:'Eski modeli yanında bırakmak görsel destek sayılır.'},
        {id:'DEL09',area:'Kaba Motor / Beden Planlama',title:'İki Hareketi Sırayla Yap',child:'Önce iki adım ileri git, sonra ellerini başının üstünde birleştir.',stimulus:'2 aşamalı kaba motor yönerge',focus:'Kaba motor planlama · beden farkındalığı · sıra',educator:'Motor kapasite, yönerge anlama ve taklidi birbirinden ayırmaya çalış.',probe:'Hareketi modellemek görsel/motor destek sayılır.'},
        {id:'DEL10',area:'Güvenlik / Günlük Yaşam',title:'Güvenli Seçimi Göster',child:'Sıcak bir bardağa dokunmak mı, bir yetişkinden yardım istemek mi daha güvenli?',stimulus:'İki günlük yaşam seçeneği',focus:'Temel güvenlik bilgisi · yardım isteme',educator:'Yaşa ve gelişim düzeyine uygun senaryo seç. Korkutucu içerik kullanma.',probe:'Seçenekleri sadeleştirmek dil desteği olarak kaydedilir.'}

      ]
    },
    'SP-COG': {
      title:'Bilişsel / Öğrenme Hızı Eğitsel Profil',
      short:'Bilişsel / Öğrenme Hızı',
      disclaimer:'Öğrenme temposu, strateji ve transferi inceler; IQ, zekâ yaşı veya klinik bilişsel tanı üretmez.',
      flags:['Hızlı kavradı','Uzun işlem süresi','Deneme-yanılma kullandı','Kuralı keşfetti','Strateji değiştirdi','Modelden hızlı yararlandı','Kalıcılık gösterdi','Transfer etti'],
      tasks:[
        {id:'COG01',area:'Kodlama',title:'Kısa Görsel Kod',child:'★ ○ △ dizisine 5 saniye bak. Sonra aynı sırayı söyle veya çiz.',stimulus:'★  ○  △',focus:'Kısa süreli kodlama · sıra',educator:'Süreyi sabit tut. Geri çağırma biçimini kaydet.',probe:'İkinci gösterim destek sayılır.'},
        {id:'COG02',area:'Kural Keşfi',title:'Örüntüyü Bul',child:'2, 4, 6, 8, __. Sence kural ne ve sırada ne gelir?',stimulus:'2  4  6  8  __',focus:'Kural çıkarma · açıklama',educator:'Yalnız cevabı değil kuralı açıklamasını iste.',probe:'“İkişer artıyor” ipucunu ilk denemede verme.'},
        {id:'COG03',area:'Yeni Kural',title:'Sembol Dili',child:'Bu oyunda ▲ = 2 ve ● = 1 olsun. ▲ + ● kaç eder?',stimulus:'▲ = 2   ● = 1   → ▲ + ●',focus:'Yeni kuralı öğrenme · sembolik işlem',educator:'Kuralı bir kez açıkla, sonra bağımsız uygulat.',probe:'Kuralı tekrar etmek destek sayılır.'},
        {id:'COG04',area:'Esneklik',title:'Kural Değişti',child:'Şimdi ▲ = 1, ● = 2. Aynı soruyu yeni kuralla çöz.',stimulus:'▲ = 1   ● = 2   → ▲ + ●',focus:'Eski kuralı bırakma · bilişsel esneklik',educator:'Eski değeri sürdürme ve düzeltmeyi kaydet.',probe:'Yeni kuralı görsel tutmak destek sayılmaz; sözlü hatırlatma sayılır.'},
        {id:'COG05',area:'Öğrenme Eğrisi',title:'İkinci Benzer Görev',child:'■ = 3 ve ○ = 2. ■ + ○ kaç eder?',stimulus:'■ = 3   ○ = 2',focus:'Benzer görevde öğrenme hızlanması',educator:'İlk sembol görevine göre daha az destek/süre gerekip gerekmediğini not et.',probe:'İlk stratejiyi sen hatırlatma.'},
        {id:'COG06',area:'Gecikmeli Kalıcılık',title:'Biraz Sonra Hatırla',child:'Az önce ▲ ve ● için kullandığımız ilk kuralı hatırlıyor musun?',stimulus:'Gecikmeli geri çağırma',focus:'Kısa gecikmeli kalıcılık',educator:'Araya başka görev koyduktan sonra sor.',probe:'İlk kuralı yeniden öğretme.'},
        {id:'COG07',area:'Strateji',title:'Nasıl Çözdün?',child:'Biraz önceki sembol sorusunda hangi yolu kullandın?',stimulus:'Kısa öz-açıklama',focus:'Strateji farkındalığı',educator:'Çocuğun kendi diliyle yöntemi anlatmasına izin ver.',probe:'Seçenek sunmadan önce serbest anlatım al.'},
        {id:'COG08',area:'Uzak Transfer',title:'Yeni Yüzey, Aynı Mantık',child:'Bu kez renkler sayı olsun: mavi = 4, sarı = 1. Mavi ile sarıyı toplarsak?',stimulus:'Mavi=4 · Sarı=1',focus:'Yeni temsile transfer',educator:'Sembolden renge yüzey değişiminde kural öğrenme mantığını taşıyor mu izle.',probe:'Önceki örneği tekrar anlatma.'},
        {id:'COG09',area:'Problem Çözme / Yeni Yol',title:'İlk Yol Çalışmazsa',child:'Üç parçayla hedef şekli kurmayı dene. İlk denemen olmazsa başka bir yol bul.',stimulus:'3 parçalı basit yapboz / blok problemi',focus:'Problem çözme · strateji değiştirme · sebat',educator:'Deneme sayısı, strateji değişikliği ve yardım arama biçimini kaydet.',probe:'Parçanın yerini göstermek görsel destek sayılır.'},
        {id:'COG10',area:'Destek Azaltma / Kalıcılık',title:'İpucunu Çek ve Yeniden Dene',child:'Önce kısa bir ipucuyla öğrendiğin kuralı şimdi ipucu olmadan yeni örnekte kullan.',stimulus:'Önceki kurala benzer yeni örnek',focus:'Destek azaltma · bağımsızlaşma · kalıcılık',educator:'İpucu varken ve ipucu kalkınca performansı ayrı kaydet.',probe:'İpucunu yeniden vermek destek düzeyini yükseltir.'}

      ]
    },
    'SP-MIX': {
      title:'Karma Öğrenme Profili · Adaptif Ortak Tarama',
      short:'Karma Profil',
      disclaimer:'Birden fazla alanda belirti olduğunda hangi derin profile geçileceğini belirleyen eğitimsel yönlendirme taramasıdır.',
      flags:['Okuma alanı işaret verdi','Yazma alanı işaret verdi','Matematik alanı işaret verdi','Dil alanı işaret verdi','Dikkat alanı işaret verdi','Gelişim/sosyal alan işaret verdi','Bellek/öğrenme alanı işaret verdi'],
      tasks:[
        {id:'MIX01',area:'Okuma',title:'Yeni Kelime',child:'“mota” kelimesini oku.',stimulus:'mota',focus:'Yeni kelime çözümleme',educator:'Tahmin, ses birleştirme ve gecikmeyi kaydet.',probe:'Anlamı olmadığını söyleyebilirsin.',related:'SP-DYS'},
        {id:'MIX02',area:'Yazma',title:'Kısa Dikte',child:'“masa” kelimesini duy ve yaz.',stimulus:'Eğitmen: masa',focus:'Ses-harf kodlama',educator:'Ses eksiltme, sıra ve harf biçimini gözle.',probe:'Bir tekrar destek sayılır.',related:'SP-DYSG'},
        {id:'MIX03',area:'Matematik',title:'Nicelik ve Sembol',child:'7 nesneyi gösteren rakamı seç.',stimulus:'● ● ● ● ● ● ●',choices:['6','7','9'],expected:'7',focus:'Nicelik–sembol eşleme',educator:'Sayma stratejisini not et.',probe:'Nesneleri saymasına izin ver.',related:'SP-DYSC'},
        {id:'MIX04',area:'Dil',title:'İki Aşamalı Dil',child:'Kırmızı kalemi al ve küçük kutunun yanına koy.',stimulus:'Masa üstü materyal',focus:'Alıcı dil · yönerge takibi',educator:'Renk/nesne/konum bilgisini birlikte tutmayı izle.',probe:'Yönergeyi parçalamak destek sayılır.',related:'SP-LANG'},
        {id:'MIX05',area:'Dikkat',title:'Benzer Hedef',child:'Yalnız 27 sayılarını bul.',stimulus:'27 72 27 37 72 27 17 27',focus:'Seçici dikkat · görsel tarama',educator:'Atlama ve yanlış hedefi kaydet.',probe:'Satırı takip etme stratejisini not et.',related:'SP-ATTN'},
        {id:'MIX06',area:'Bellek',title:'Üç Öğeyi Tut',child:'2 – 5 – 8 dizisini aynı sırayla tekrar et.',stimulus:'2 – 5 – 8',focus:'İşitsel kısa süreli bellek',educator:'Öğe ve sıra hatasını ayır.',probe:'Bir tekrar destek sayılır.',related:'SP-COG'},
        {id:'MIX07',area:'Sosyal / Gelişim',title:'Sıra Al',child:'Topla iki tur karşılıklı oyun oynayın.',stimulus:'Top',focus:'Ortak etkinlik · sıra alma',educator:'Karşılıklılık, dikkat paylaşımı ve yardım ihtiyacını gözle.',probe:'Sözel yönlendirmeyi destek olarak kaydet.',related:'SP-ASD'},
        {id:'MIX08',area:'Öğrenme Tepkisi',title:'Modelden Öğren',child:'Eğitmen kırmızı-mavi-kırmızı dizisini kurar. Şimdi sarı-yeşil-? dizisini tamamla.',stimulus:'R-M-R → S-Y-?',focus:'Modelden kural çıkarma',educator:'Yeni renklere kuralı taşıyıp taşımadığını gözle.',probe:'İkinci model destek sayılır.',related:'SP-COG'},
        {id:'MIX09',area:'Yönlendirme',title:'Hangi Tür Yardım İşe Yarıyor?',child:'Zor görevlerde sana en çok ne yardım ediyor: görmek, duymak, yapmak, tekrar etmek, yoksa başka bir şey?',stimulus:'Öğrenme tercihi üzerine kısa konuşma',focus:'Yardım biçimi · üstbiliş',educator:'Tercihi kalıcı “öğrenme stili” etiketi olarak kullanma; yalnız o oturumdaki destek tepkisini kaydet.',probe:'Çocuk cevap veremezse örnekleri seçenek olarak sun.'},
        {id:'MIX10',area:'Adaptif Yönlendirme / Transfer',title:'Yeni Kuralı Genelle',child:'Kısa bir örnekte öğrendiğin kuralı farklı materyalle yeniden uygula.',stimulus:'Model → farklı materyal → aynı kural',focus:'Genel öğrenme tepkisi · transfer · hangi derin profile ihtiyaç olduğu',educator:'Başarıdan çok hangi destek türüyle öğrenip genellediğini kaydet.',probe:'İkinci model gerekiyorsa ilgili destek alanını işaretle.',related:'SP-COG'}

      ]
    }
  };

  const profileDomains = {
    'SP-SLD':['Ortak Temel Tarama','Okuma / Fonolojik İşleme','Yazma / Kodlama','Matematiksel Öğrenme','Görsel / Ortografik İşleme','İşitsel İşleme','Çalışma Belleği','Dikkat / Yürütücü İşlevler','Öğrenme Tepkisi','Transfer / Üstbiliş'],
    'SP-DYSC':['Sayı Hissi','Sembol–Nicelik Eşleme','Sayı Dizisi','Basamak Değeri','İşlem Stratejileri','Problem Dili','Matematiksel Çalışma Belleği','Sayı Doğrusu / Uzamsal Temsil','Öğrenme Tepkisi','Transfer / Hata Kontrolü'],
    'SP-DYSG':['Grafomotor Kontrol','Harf Biçimi ve Yön','Kopyalama','Dikte / Ses-Harf Kodlama','Kelime Sınırı ve Sayfa Düzeni','Yazma Hızı / Akış','Ortografik Bellek','Yazılı İfade','Öz-Kontrol','Transfer'],
    'SP-ASD':['Ortak Dikkat','İşlevsel İletişim','Alıcı Dil / Yönerge','Taklit','Sosyal Karşılıklılık','Oyun / Sembolik Oyun','Bilişsel Esneklik','Duyusal Düzenleme','Duygu / Sosyal İpuçları','Geçiş / Genelleme'],
    'SP-LANG':['Alıcı Dil','İfade Edici Dil','Sözcük Dağarcığı','Sözcük Erişimi','Dilbilgisel Yapı','Olay Sırası / Anlatı','Neden–Sonuç','Sesletim / Anlaşılırlık','Pragmatik Dil','Yeni Sözcük Öğrenme / Transfer'],
    'SP-ATTN':['Seçici Dikkat','Sürdürülen Dikkat','Ketleme','Çalışma Belleği','Bilişsel Esneklik','Planlama','Göreve Başlama','Hata Kontrolü','Çift Görev / Kural Sürdürme','Transfer'],
    'SP-DELAY':['İletişim','Alıcı Dil','İfade / Seçim Bildirme','Biliş / Problem Çözme','İnce Motor / Grafomotor','Kaba Motor','Sosyal Etkileşim / Oyun','Özbakım','Güvenlik','Öğrenme Tepkisi / Transfer'],
    'SP-COG':['Kodlama','Örüntü / Kural Keşfi','Yeni Kural Öğrenme','Bilişsel Esneklik','Problem Çözme','Öğrenme Eğrisi','Gecikmeli Kalıcılık','Strateji Farkındalığı','Destek Azaltma','Uzak Transfer'],
    'SP-MIX':['Okuma','Yazma','Matematik','Dil','Dikkat','Bellek','Sosyal / Gelişim','Motor / Günlük Yaşam','Öğrenme Tepkisi','Adaptif Yönlendirme / Transfer']
  };


  function activateProfiles() {
    var canonicalNames = {
      'SP-DYS':'Disleksi / Okuma Güçlüğü Tarama Profili',
      'SP-SLD':'Özgül Öğrenme Güçlüğü Eğitsel Profili',
      'SP-DYSC':'Diskalkuli / Matematik Öğrenme Güçlüğü',
      'SP-DYSG':'Disgrafi / Yazılı Anlatım-Yazma Güçlüğü',
      'SP-ASD':'Otizm Spektrumu Eğitsel Profili',
      'SP-LANG':'Dil ve Konuşma Gelişimi',
      'SP-ATTN':'Dikkat – Odaklanma – Yürütücü İşlevler',
      'SP-DELAY':'Gelişimsel Gecikme',
      'SP-COG':'Bilişsel / Öğrenme Hızı Profili',
      'SP-MIX':'Karma Profil'
    };
    var existing = {};
    specialProfiles.forEach(function (p) {
      existing[p[0]]=p;
      p[3]=1;
      if (canonicalNames[p[0]]) p[1]=canonicalNames[p[0]];
    });
    if(!existing['SP-DELAY']) specialProfiles.splice(specialProfiles.length-1,0,['SP-DELAY',canonicalNames['SP-DELAY'],'İletişim, biliş, motor, özbakım, oyun ve öğrenme tepkisini birlikte tarar.',1,'GELİŞİM']);
    if(!existing['SP-COG']) specialProfiles.splice(specialProfiles.length-1,0,['SP-COG',canonicalNames['SP-COG'],'Öğrenme temposu, strateji, kalıcılık ve transferi tanısal etiket üretmeden inceler.',1,'ÖĞRENME']);
  }

  function ensureState(){
    if(!state.specialGenericEvidence)state.specialGenericEvidence={};
    if(!state.specialGenericCode)state.specialGenericCode='';
    if(!Number.isInteger(state.specialGenericTaskIndex))state.specialGenericTaskIndex=0;
  }

  function profile(){return genericProfiles[state.specialGenericCode];}
  function keyFor(task){return state.specialGenericCode+':'+task.id;}
  function evidence(task){return Object.assign({taskId:task.id,response:'',choice:'',verdict:'',support:'',latencyMs:null,note:'',flags:[]},state.specialGenericEvidence[keyFor(task)]||{});}

  function routeFor(p){
    var first=p.tasks.slice(0,5);
    var firstRows=first.map(function(t){return state.specialGenericEvidence[state.specialGenericCode+':'+t.id];}).filter(Boolean);
    var concern=firstRows.filter(function(e){return e.verdict!=='MATCH'||e.support!=='INDEPENDENT';}).length;
    if(firstRows.length>=5&&concern<2)return first.concat([p.tasks[p.tasks.length-1]]);
    return p.tasks;
  }

  function profileStatus(p){
    var rows=routeFor(p).map(function(t){return state.specialGenericEvidence[state.specialGenericCode+':'+t.id];}).filter(Boolean).filter(function(e){return e.support!=='NOT_ASSESSED';});
    if(rows.length<4)return {status:'INSUFFICIENT',score:null,rows:rows};
    var score=rows.reduce(function(sum,e){return sum+(e.verdict==='MATCH'?0:e.verdict==='PARTIAL'?1:2)+(e.support==='INDEPENDENT'?0:['VERBAL_PROMPT','VISUAL_PROMPT'].includes(e.support)?.5:1);},0)/rows.length;
    return {status:score<.65?'LOW':score<1.15?'WATCH':score<1.7?'CLEAR':'REFER',score:score,rows:rows};
  }
  function statusText(s){return s==='LOW'?'Düşük eğitsel risk görünümü':s==='WATCH'?'İzlem gerekli':s==='CLEAR'?'Belirgin destek gereksinimi':s==='REFER'?'Uzman değerlendirmesi önerilir':'Kanıt yetersiz';}

  function intake(){
    var p=profile();
    var manifest=profileDomains[state.specialGenericCode]||[];
    app.innerHTML='<main class="page"><section class="hero special-generic-accent"><div class="top-actions"><button class="text-btn" id="sgHome">← Değerlendirme merkezine dön</button><span class="step-chip">Özel Eğitim · Eğitsel Profil</span></div>' +
      '<div class="intake-head"><div><div class="eyebrow">'+esc(p.short).toUpperCase()+'</div><h1>'+esc(p.title)+'</h1><p>'+esc(p.disclaimer)+'</p></div><div class="age-orbit"><b>'+p.tasks.length+'</b><span>görev ailesi</span></div></div>' +
      '<div class="clinical-boundary"><b>Tanısal sınır:</b> Bu bölüm klinik tanı, IQ, gelişim yaşı veya tıbbi karar üretmez. Eğitimsel kanıt, destek ihtiyacı ve yönlendirme önerisi üretir.</div>' +
      '<div class="profile-coverage"><div class="coverage-head"><b>Bu profilde taranan başlıklar</b><span>'+manifest.length+'/10 alan dolu</span></div><div class="coverage-grid">'+manifest.map(function(item,i){return '<div><span>'+String(i+1).padStart(2,'0')+'</span><b>'+esc(item)+'</b></div>';}).join('')+'</div><div class="three-layer-flow"><span><b>1</b> Ortak Temel Tarama</span><span><b>2</b> Alan Derinleştirme</span><span><b>3</b> Adaptif İnceleme + Transfer</span></div></div>' +
      '<div class="form-panel"><div class="form-grid"><label>Öğrencinin adı<input id="sgName" value="'+esc(state.name||'')+'" placeholder="Örn. Deniz"></label><label>Doğum tarihi<input id="sgBirth" type="date" value="'+esc(state.birth||'')+'"></label><label>Sınıf / gelişim düzeyi<input id="sgGrade" value="'+esc(state.grade||'')+'" placeholder="Örn. 2. sınıf / 48 ay"></label><label>Eğitimci<input id="sgAssessor" value="'+esc(state.assessor||'')+'" placeholder="İsteğe bağlı"></label><label class="wide-label">İlk gözlem / başvuru nedeni<textarea id="sgConcern" placeholder="Somut örnek yazın...">'+esc(state.concerns||'')+'</textarea></label></div>' +
      '<div class="form-footer"><div id="sgErr" class="error"></div><button class="primary-btn" id="sgStart">Adaptif taramayı başlat →</button></div></div></section></main>';
    document.getElementById('sgHome').onclick=function(){state.screen='home';render();};
    document.getElementById('sgStart').onclick=function(){
      state.name=document.getElementById('sgName').value.trim(); state.birth=document.getElementById('sgBirth').value;
      state.grade=document.getElementById('sgGrade').value.trim(); state.assessor=document.getElementById('sgAssessor').value.trim();
      state.concerns=document.getElementById('sgConcern').value.trim();
      if(!state.name){document.getElementById('sgErr').textContent='Öğrencinin adını yaz.';return;}
      state.specialGenericTaskIndex=0;state.taskStartedAt=Date.now();state.screen='special-generic-task';render();
    };
  }

  function task(){
    var p=profile(),route=routeFor(p),t=route[state.specialGenericTaskIndex];
    if(!t){state.screen='special-generic-summary';return render();}
    if(!state.taskStartedAt)state.taskStartedAt=Date.now();
    var e=evidence(t),progress=Math.round(state.specialGenericTaskIndex/Math.max(1,route.length)*100);
    var choices=t.choices?'<div class="orth-choice-grid">'+t.choices.map(function(c){return '<button class="orth-choice '+(e.choice===c?'selected':'')+'" data-sg-choice="'+esc(c)+'">'+esc(c)+'</button>';}).join('')+'</div>':'';
    var response=t.choices?'':'<label class="panel-label" for="sgResponse">İlk yanıt / uygulama sonucu</label><input id="sgResponse" class="response-input" value="'+esc(e.response||'')+'" placeholder="Yanıtı olduğu gibi kaydet">';
    var verdict=dyslexiaVerdicts.map(function(x){return '<button class="verdict-btn '+(e.verdict===x[0]?'selected':'')+'" data-sg-verdict="'+x[0]+'">'+esc(x[1])+'</button>';}).join('');
    var supports=supportOptions.map(function(x){return '<button class="support-btn '+(e.support===x[0]?'selected':'')+'" data-sg-support="'+x[0]+'">'+esc(x[1])+'</button>';}).join('');
    var flags=p.flags.map(function(f){return '<button class="flag-btn '+((e.flags||[]).includes(f)?'selected':'')+'" data-sg-flag="'+esc(f)+'">'+esc(f)+'</button>';}).join('');

    app.innerHTML='<main class="station-page"><header class="station-header special-station-header"><div><div class="eyebrow">'+esc(p.short).toUpperCase()+'</div><h1>'+esc(t.area)+' · '+esc(t.title)+'</h1></div><div class="station-progress"><span>Görev '+(state.specialGenericTaskIndex+1)+'/'+route.length+'</span><div class="progress-track"><i style="width:'+progress+'%"></i></div></div><button class="focus-toggle" id="sgBack">Merkeze dön</button></header>' +
      '<section class="station-layout"><div class="child-stage special-child-stage"><div class="child-top"><span class="child-label">ÇOCUKLA UYGULAMA</span><span class="phase-chip">'+esc(t.area)+'</span></div><div class="task-count">'+String(state.specialGenericTaskIndex+1).padStart(2,'0')+'</div><div class="advanced-task-card"><span class="letter-task-type">'+esc(t.title)+'</span><h2>'+esc(t.child)+'</h2><div class="advanced-stimulus">'+esc(t.stimulus)+'</div></div></div>' +
      '<aside class="educator-panel"><div class="panel-kicker">EĞİTİMCİ KANIT PANELİ</div><h2>'+esc(t.title)+'</h2><p class="educator-instruction">'+esc(t.educator)+'</p><div class="evidence-focus"><span>Ölçülen kanıt</span><b>'+esc(t.focus)+'</b></div><div class="probe-note"><b>Nötr probe:</b> '+esc(t.probe)+'</div>'+choices+response+
      '<div class="micro-stats"><div><span>Tepki</span><b>'+(e.latencyMs!=null?(e.latencyMs/1000).toFixed(1)+' sn':'—')+'</b></div><div><span>Alan</span><b>'+esc(t.area)+'</b></div><div><span>Görev</span><b>'+esc(t.id)+'</b></div></div>' +
      '<label class="panel-label">Yanıt örüntüsü</label><div class="verdict-grid">'+verdict+'</div><label class="panel-label">Destek düzeyi</label><div class="support-grid">'+supports+'</div><label class="panel-label">Gözlem işaretleri</label><div class="flag-grid">'+flags+'</div>' +
      '<label class="panel-label" for="sgNote">Somut gözlem notu</label><textarea id="sgNote">'+esc(e.note||'')+'</textarea><div class="adaptive-note"><b>Üç katman:</b> ortak temel kanıt → alan derinleştirme → ilk beş görevdeki örüntüye göre adaptif kısaltma/derinleşme.</div><div class="panel-actions"><button class="secondary-btn" id="sgSkip">Değerlendirilemedi</button><button class="primary-btn" id="sgNext">Kaydet ve sonraki →</button></div></aside></section></main>';
    document.getElementById('sgBack').onclick=function(){state.screen='home';render();};
    document.querySelectorAll('[data-sg-choice]').forEach(function(b){b.onclick=function(){var row=evidence(t);if(!row.choice)row.latencyMs=Math.max(0,Date.now()-state.taskStartedAt);row.choice=b.dataset.sgChoice;row.response=b.dataset.sgChoice;state.specialGenericEvidence[keyFor(t)]=row;render();};});
    var input=document.getElementById('sgResponse');if(input)input.oninput=function(ev){var row=evidence(t);if(!row.response&&ev.target.value.trim())row.latencyMs=Math.max(0,Date.now()-state.taskStartedAt);row.response=ev.target.value;state.specialGenericEvidence[keyFor(t)]=row;saveState();};
    document.querySelectorAll('[data-sg-verdict]').forEach(function(b){b.onclick=function(){var row=evidence(t);row.verdict=b.dataset.sgVerdict;state.specialGenericEvidence[keyFor(t)]=row;render();};});
    document.querySelectorAll('[data-sg-support]').forEach(function(b){b.onclick=function(){var row=evidence(t);row.support=b.dataset.sgSupport;state.specialGenericEvidence[keyFor(t)]=row;render();};});
    document.querySelectorAll('[data-sg-flag]').forEach(function(b){b.onclick=function(){var row=evidence(t),f=b.dataset.sgFlag;row.flags=row.flags||[];row.flags=row.flags.includes(f)?row.flags.filter(function(x){return x!==f;}):row.flags.concat([f]);state.specialGenericEvidence[keyFor(t)]=row;render();};});
    document.getElementById('sgNote').oninput=function(ev){var row=evidence(t);row.note=ev.target.value;state.specialGenericEvidence[keyFor(t)]=row;saveState();};
    document.getElementById('sgSkip').onclick=function(){var row=evidence(t);row.verdict='NO_RESPONSE';row.support='NOT_ASSESSED';row.note=document.getElementById('sgNote').value;state.specialGenericEvidence[keyFor(t)]=row;next();};
    document.getElementById('sgNext').onclick=function(){var row=evidence(t);if(input)row.response=input.value.trim();row.note=document.getElementById('sgNote').value;if(t.choices&&!row.choice){alert('Önce ilk seçimi kaydet.');return;}if(!row.verdict){alert('Yanıt örüntüsünü seç.');return;}if(!row.support){alert('Destek düzeyini seç.');return;}state.specialGenericEvidence[keyFor(t)]=row;next();};
  }

  function next(){var p=profile(),r=routeFor(p);saveState();if(state.specialGenericTaskIndex+1>=r.length){state.screen='special-generic-summary';render();return;}state.specialGenericTaskIndex+=1;state.taskStartedAt=Date.now();render();}

  function summary(){
    var p=profile(),route=routeFor(p),res=profileStatus(p),rows=res.rows||[];
    var priorities=route.map(function(t){var e=state.specialGenericEvidence[keyFor(t)];var score=!e?-1:(e.verdict==='MATCH'?0:e.verdict==='PARTIAL'?1:2)+(e.support==='INDEPENDENT'?0:.5);return {task:t,e:e,score:score};}).filter(function(x){return x.score>=1;}).sort(function(a,b){return b.score-a.score;});
    var related={}; priorities.forEach(function(x){if(x.task.related)related[x.task.related]=(related[x.task.related]||0)+1;});
    var relatedHtml=Object.entries(related).sort(function(a,b){return b[1]-a[1];}).map(function(x){var card=specialProfiles.find(function(p){return p[0]===x[0];});return card?'<span class="route-chip" data-route-profile="'+x[0]+'">'+esc(card[1])+'</span>':'';}).join('');
    var priorityHtml=priorities.slice(0,5).map(function(x,i){return '<div class="priority-row"><b>'+(i+1)+'. '+esc(x.task.area)+' · '+esc(x.task.title)+'</b><span>'+esc(x.task.focus)+'</span><small>'+(x.e?esc(x.e.note||'Somut not eklenmedi'):'')+'</small></div>';}).join('')||'<div class="priority-row"><b>Belirgin öncelik oluşmadı</b><span>Yine de işlevsel güçlük varsa öğretmen/veli gözlemiyle izlemeyi sürdür.</span></div>';
    var cls=res.status==='LOW'?'strength':res.status==='WATCH'?'developing':'watch';
    if(res.status==='INSUFFICIENT')cls='insufficient';

    app.innerHTML='<main class="page"><section class="hero special-generic-accent"><div class="top-actions"><button class="text-btn" id="sgSumHome">← Değerlendirme merkezi</button><span class="step-chip">Eğitsel profil özeti</span></div><div class="summary-hero"><div><div class="eyebrow">'+esc(state.name).toUpperCase()+' · '+esc(p.short).toUpperCase()+'</div><h1>'+esc(p.title)+'</h1><p>'+esc(p.disclaimer)+'</p></div><div class="status-orb '+cls+'"><span>Genel görünüm</span><b>'+esc(statusText(res.status))+'</b></div></div>' +
      '<div class="summary-grid"><article><span>Geçerli kanıt</span><b>'+rows.length+'</b><small>Adaptif rota: '+route.length+'</small></article><article><span>Bağımsız</span><b>'+rows.filter(function(e){return e.support==='INDEPENDENT';}).length+'</b><small>Desteksiz performans</small></article><article><span>Destek kullanılan</span><b>'+rows.filter(function(e){return e.support!=='INDEPENDENT';}).length+'</b><small>Destek türü ayrıca kayıtlı</small></article><article><span>Öncelik adayı</span><b>'+priorities.length+'</b><small>Tek görev tanı değildir</small></article></div>' +
      '<h2>Çocukla yarın ne çalışacağız?</h2><div class="priority-list">'+priorityHtml+'</div>' +
      (relatedHtml?'<h2>Gerekirse derinleştirilecek profil</h2><div class="route-chips">'+relatedHtml+'</div>':'') +
      '<div class="four-week-plan"><h3>İlk 4 haftalık eğitim iskeleti</h3><div class="week-grid"><div><b>1. Hafta</b><span>En belirgin destek alanında kısa ve başarıyla biten görevler.</span></div><div><b>2. Hafta</b><span>Aynı beceriyi farklı materyalle genelle.</span></div><div><b>3. Hafta</b><span>İkinci öncelik alanını birinci beceriyle birleştir.</span></div><div><b>4. Hafta</b><span>Kısa yeniden ölçüm ve transfer kontrolü.</span></div></div></div>' +
      '<div class="clinical-boundary"><b>Raporlama:</b> Sonuçlar eğitimsel kanıt dilinde yazılır. “Tanı var/yok”, “zeka düzeyi”, “normal/anormal” gibi ifadeler kullanılmaz. Kalıcı veya belirgin işlevsel güçlükte uygun yetkili uzman değerlendirmesi önerilir.</div>' +
      '<div class="launch-panel"><div><b>Başlangıç Değerlendirmesi zinciri</b><p>Profil → eğitim önceliği → bireysel çalışma → yeniden ölçüm.</p></div><div class="summary-actions"><button class="secondary-btn" id="sgRedo">Profili yeniden incele</button><button class="primary-btn" id="sgSumHome2">Merkeze dön</button></div></div></section></main>';
    document.getElementById('sgSumHome').onclick=document.getElementById('sgSumHome2').onclick=function(){state.screen='home';render();};
    document.getElementById('sgRedo').onclick=function(){state.specialGenericTaskIndex=0;state.taskStartedAt=Date.now();state.screen='special-generic-task';render();};
    document.querySelectorAll('[data-route-profile]').forEach(function(b){b.onclick=function(){state.specialGenericCode=b.dataset.routeProfile;state.specialGenericTaskIndex=0;state.screen='special-generic-intake';render();};});
  }

  function enhanceHome(){
    document.querySelectorAll('.special-card.active').forEach(function(card){
      var code=card.dataset.code;
      if(code==='SP-DYS')return;
      if(genericProfiles[code])card.onclick=function(){state.specialGenericCode=code;state.specialGenericTaskIndex=0;state.screen='special-generic-intake';render();};
    });
  }

  activateProfiles();
  const baseRender=render;
  render=function(){
    ensureState();
    if(state.screen==='special-generic-intake'){saveState();return intake();}
    if(state.screen==='special-generic-task'){saveState();return task();}
    if(state.screen==='special-generic-summary'){saveState();return summary();}
    var result=baseRender();
    if(state.screen==='home')enhanceHome();
    return result;
  };
  render();
})();