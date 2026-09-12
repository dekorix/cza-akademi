(function(root){
  'use strict';
  const task=(id,min,tier,role,modality,title,child,protocol,facets,extra={})=>({id,minAge:min,tier,role,modality,title,childPrompt:child,protocol,facets,...extra});
  const domain=(id,title,short,facets,tasks)=>({id,title,short,facets,tasks});

  const domains=[
    domain('VC','Görsel Kavramlar ve Kategorizasyon','Görsel Kavramlar',['eşleme','kategori','ayırt-etme','mekânsal','çoklu-özellik','çıkarım'],[
      task('VC01',36,1,'anchor','visual-choice','Aynısını Bul','Bunun aynısını bulur musun?','Tek referans ve üç seçenek sun. İlk dokunuşu düzeltmeden kaydet.',['eşleme','ayırt-etme'],{stimulus:'match-object',scoring:'accuracy'}),
      task('VC02',36,1,'anchor','visual-choice','Birlikte Olanlar','Hangileri birlikte gider?','Kategori adını söylemeden üç eşleşme sun. Gerekçe kendiliğinden gelirse ayrıca kaydet.',['kategori','çıkarım'],{stimulus:'category-pairs',scoring:'accuracy'}),
      task('VC03',36,1,'anchor','visual-choice','Farklı Olan','Hangisi diğerlerinden farklı?','Aynı sınıftan iki, farklı sınıftan bir görsel sun. İlk seçim sonrası “Neden?” sorusu yalnız açıklama kanıtı içindir.',['kategori','ayırt-etme'],{stimulus:'odd-one-out',scoring:'accuracy'}),
      task('VC04',36,1,'anchor','visual-choice','Büyük–Küçük Karşılaştırma','Büyük olanı göster.','Aynı nesnenin yalnız boyutunu değiştir; renk ve biçim aynı kalsın.',['ayırt-etme'],{stimulus:'size-contrast',scoring:'accuracy'}),
      task('VC05',36,2,'discriminator','visual-choice','Parça–Bütün','Bu parça hangisine ait olabilir?','Parçayı tek başına göster; üç bütün seçenek sun. Ek ipucu verme.',['çıkarım','eşleme'],{stimulus:'part-whole',scoring:'accuracy'}),
      task('VC06',39,2,'anchor','visual-choice','Konum Kavramı','Kutunun altında olanı bul.','İçinde–üstünde–altında seçeneklerinde nesne ve kutu aynı kalmalı.',['mekânsal','ayırt-etme'],{stimulus:'spatial-position',scoring:'accuracy'}),
      task('VC07',42,3,'anchor','visual-choice','İki Özelliği Birlikte Tut','Kırmızı ve yuvarlak olanı bul.','Renk ve şekli aynı anda tutmasını gerektiren üç seçenek sun.',['çoklu-özellik','ayırt-etme'],{stimulus:'dual-feature',scoring:'accuracy'}),
      task('VC08',42,3,'discriminator','sorting','İşleve Göre Grupla','Birlikte kullanılanları yan yana koy.','Dört gerçek nesne/kart kullan. Kategori ismini baştan söyleme.',['kategori','çıkarım'],{scoring:'process'}),
      task('VC09',42,3,'transfer','visual-choice','İlişkiyi Eşle','Fırça saça gider; kaşık nereye gider?','Önce örnek ilişkiyi göster, sonra yeni ilişkiyi tamamlat.',['çıkarım','eşleme'],{stimulus:'analogy',scoring:'accuracy'}),
      task('VC10',45,4,'transfer','sorting','Kural Değiştirerek Sınıfla','Önce renge göre, şimdi şekle göre ayır.','Aynı kartlarla iki ardışık sınıflama kuralı uygula; geçişte ek hatırlatma verme.',['çoklu-özellik','kategori'],{scoring:'process'}),
      task('VC11',45,4,'transfer','visual-choice','Eksik Parçayı Çıkar','Resmi tamamlamak için ne eksik?','Tanıdık nesnenin kritik bir parçasını kaldırılmış olarak sun.',['çıkarım','ayırt-etme'],{stimulus:'missing-part',scoring:'accuracy'}),
      task('VC12',45,4,'ceiling','reasoning','Yeni Kategori Kuralı','Bu gruba hangisi uyar? İstersen nedenini anlat.','Yeni ve açıkça adlandırılmamış bir ortak özellik kullan. Yapılamaması alanı aşağı çekmez.',['kategori','çıkarım','çoklu-özellik'],{neutral:true,scoring:'process'})
    ]),

    domain('RL','Alıcı Dil ve Yönerge Takibi','Alıcı Dil',['tek-adım','işlev','konum','nitelik','iki-adım','zaman-sırası','olumsuzluk','koşul'],[
      task('RL01',36,1,'anchor','action','Tek Adımlı Yönerge','Topu bana ver.','Masada üç tanıdık nesne bulunsun; yalnız bir kez söyle.',['tek-adım'],{scoring:'process'}),
      task('RL02',36,1,'anchor','object-choice','İşlevi Bul','Hangisiyle su içeriz?','Nesnenin adını değil işlevini söyle.',['işlev'],{scoring:'accuracy'}),
      task('RL03',36,1,'anchor','action','Konum Sözcüğü','Arabayı kutunun içine koy.','İçinde/üstünde/altında kavramlarını farklı denemelerde dengele.',['konum','tek-adım'],{scoring:'process'}),
      task('RL04',36,1,'discriminator','object-choice','Niteliğe Göre Seç','Yumuşak olanı göster.','İki nesnenin işlevi benzer, niteliği farklı olsun.',['nitelik'],{scoring:'accuracy'}),
      task('RL05',39,2,'anchor','scene-choice','Kim Ne Yapıyor?','Köpeği besleyen çocuğu göster.','Özne ve eylem bilgisini birlikte taşıyan sahneler kullan.',['tek-adım','işlev'],{scoring:'accuracy'}),
      task('RL06',39,2,'anchor','action','İki Aşamalı Yönerge','Kalemi al ve masaya koy.','İki ilişkili adımı tek seferde söyle; arada tekrar etme.',['iki-adım'],{scoring:'process'}),
      task('RL07',39,2,'discriminator','action','Önce–Sonra','Önce bloğu kutuya koy, sonra alkışla.','Sıra sözcüklerini vurgulamadan doğal tonla söyle.',['iki-adım','zaman-sırası'],{scoring:'process'}),
      task('RL08',42,3,'anchor','object-choice','İki Özellikli Yönerge','Küçük kırmızı arabayı ver.','Renk ve boyutun ikisini de ayırt etmeyi gerektiren seçenekler kullan.',['nitelik','iki-adım'],{scoring:'accuracy'}),
      task('RL09',42,3,'discriminator','object-choice','Olumsuz Yönerge','Kırmızı olmayan topu göster.','Olumsuzluk yapısını anlamayı ölç; ek açıklama verme.',['olumsuzluk','nitelik'],{scoring:'accuracy'}),
      task('RL10',45,4,'transfer','action','Koşullu Yönerge','Eğer kart mavi ise kutuya koy; değilse bana ver.','Tek basit koşul kullan, iki denemede renkleri değiştir.',['koşul','iki-adım'],{scoring:'process'}),
      task('RL11',45,4,'transfer','action','Üç Parçalı Rutin','Bardağı al, peçeteyi yanına koy, sonra otur.','Üç adımı tek seferde söyle. Gerektiğinde destek basamağını kaydet.',['iki-adım','zaman-sırası'],{scoring:'process'}),
      task('RL12',45,4,'ceiling','clarification','Belirsizliği Fark Et','Bana onu verir misin?','İki olası nesne varken bilerek belirsiz yönerge ver; açıklama istemesi keşif kanıtıdır.',['koşul','işlev'],{neutral:true,scoring:'process'})
    ]),

    domain('EL','İfade Edici Dil ve Anlatı','İfade Edici Dil',['istek','betimleme','olay-anlatımı','neden','karşılaştırma','öykü-sırası','onarım','çıkarım'],[
      task('EL01',36,1,'anchor','verbal','İstek Bildirme','Bu oyuncağı istiyorsan bana nasıl söylersin?','Doğal istek fırsatı oluştur; doğrudan örnek cümle verme.',['istek'],{scoring:'process'}),
      task('EL02',36,1,'anchor','scene-description','Resimde Ne Oluyor?','Bu resimde ne oluyor?','Tek eylemli açık bir sahne göster; söylediği kelime/cümleyi aynen not et.',['betimleme'],{scoring:'process'}),
      task('EL03',36,1,'discriminator','verbal','İki Özellikle Anlat','Bu nesneyi bana anlat.','Tanıdık nesne göster; renk, boyut, işlev gibi ayrıntıları kendiliğinden üretmesini gözle.',['betimleme'],{scoring:'process'}),
      task('EL04',36,1,'anchor','verbal','Bugünden Bir Şey','Bugün yaptığın bir şeyi anlatır mısın?','Evet/hayır sorularıyla yönlendirme yapma; olayın kişi/eylem/yer ayrıntılarını kaydet.',['olay-anlatımı'],{scoring:'process'}),
      task('EL05',39,2,'anchor','verbal','Neden?','Çocuk neden şemsiye almış olabilir?','Nedensel açıklama için tek sahne kullan. Kabul edilebilir farklı gerekçeleri yanlış sayma.',['neden','çıkarım'],{scoring:'process'}),
      task('EL06',39,2,'discriminator','verbal','Karşılaştır','Bu iki top nasıl farklı?','İki nesnede boyut/renk gibi görünür karşıtlık olsun.',['karşılaştırma','betimleme'],{scoring:'process'}),
      task('EL07',42,3,'anchor','story-sequence','Üç Resimden Hikâye','Bu resimler bir hikâye. Bana anlatır mısın?','Üç ardışık sahne sun; sırayı değiştirmesine izin ver, sonra anlatıyı kaydet.',['öykü-sırası','olay-anlatımı'],{scoring:'process'}),
      task('EL08',42,3,'discriminator','repair','Yanlış Anladım','Ben seni yanlış anladım. Bir daha başka türlü söyler misin?','Çocuğun önceki ifadesini kasıtlı ama nazik biçimde yanlış yorumla; iletişim onarımını gözle.',['onarım','istek'],{scoring:'process'}),
      task('EL09',42,3,'transfer','verbal','Sebep–Sonuç Zinciri','Bundan sonra ne olabilir? Neden?','Tek açık başlangıç sahnesinden olası devam üretmesini iste.',['neden','çıkarım'],{scoring:'process'}),
      task('EL10',45,4,'transfer','perspective','Başka Biri Nasıl Anlatır?','Bu resmi öğretmenine anlatır gibi anlat.','Dinleyiciye göre açıklama ayrıntısını ayarlamasını gözle.',['betimleme','onarım'],{scoring:'process'}),
      task('EL11',45,4,'transfer','retell','Kısa Öyküyü Yeniden Anlat','Dinlediğin hikâyeyi bana anlatır mısın?','2–3 olaylı kısa özgün öyküyü bir kez oku; ana olay ve sıra kanıtını kaydet.',['öykü-sırası','olay-anlatımı'],{scoring:'process'}),
      task('EL12',45,4,'ceiling','story-generation','Yeni Bir Hikâye Kur','Bu üç nesneyle bir hikâye uydurabilir misin?','Nesneler arasında ilişki kurmasını bekle; yapılamaması zayıflık sayılmaz.',['öykü-sırası','çıkarım','betimleme'],{neutral:true,scoring:'process'})
    ]),

    domain('MA','Erken Matematik ve Akıl Yürütme','Erken Matematik',['nicelik','sayma','karşılaştırma','örüntü','değişim','eşleme','sınıflama','paylaştırma'],[
      task('MA01',36,1,'anchor','visual-choice','Az–Çok','Hangisinde daha çok var?','Farkı belirgin iki küçük nesne grubu kullan.',['nicelik','karşılaştırma'],{scoring:'accuracy'}),
      task('MA02',36,1,'anchor','material','Bir Tane Ver','Bana bir tane blok verir misin?','Önünde en az dört aynı blok olsun.',['nicelik'],{scoring:'process'}),
      task('MA03',36,1,'anchor','material','Üçe Kadar Say','Kaç tane var?','1–3 nesneyle değişen denemeler yap; ritmik saymayı değil kardinal yanıtı ayrıca kaydet.',['sayma','nicelik'],{scoring:'process'}),
      task('MA04',36,1,'discriminator','visual-choice','Uzun–Kısa','Hangisi daha uzun?','Renk ve kalınlık aynı, yalnız uzunluk değişsin.',['karşılaştırma'],{scoring:'accuracy'}),
      task('MA05',39,2,'anchor','pattern','Örüntüyü Devam Ettir','Kırmızı, mavi, kırmızı, mavi… sırada ne gelir?','AB örüntüyü fiziksel kartlarla kur.',['örüntü'],{scoring:'process'}),
      task('MA06',39,2,'anchor','material','Bir Tane Daha','Burada iki blok var. Bir tane daha koyarsak kaç olur?','Önce somut nesneyle, sonra yalnız sözel tekrar olmadan gözle.',['değişim','nicelik'],{scoring:'process'}),
      task('MA07',39,2,'discriminator','material','Bir Tane Eksildi','Üç kurabiyeden biri gitti. Şimdi kaç kaldı?','Somut nesneyle çıkarma değişimini göster; sembol kullanma.',['değişim','sayma'],{scoring:'process'}),
      task('MA08',42,3,'anchor','matching','Eşit Grupları Bul','Hangisinde bunun kadar var?','Dizilim farklı ama nicelik aynı gruplar kullan.',['eşleme','nicelik'],{scoring:'accuracy'}),
      task('MA09',42,3,'discriminator','sorting','İki Kuralla Sınıfla','Büyük kırmızıları buraya, küçük mavileri oraya koy.','İki özelliği birlikte kullanmasını gerektir.',['sınıflama','karşılaştırma'],{scoring:'process'}),
      task('MA10',42,3,'transfer','pattern','AAB Örüntüsünü Tamamla','Sıradaki parçayı bul.','AAB ya da ABB örüntüsünü yeni materyalle sun.',['örüntü','eşleme'],{scoring:'process'}),
      task('MA11',45,4,'transfer','material','Eşit Paylaştır','Dört bloğu iki oyuncağa eşit dağıtabilir misin?','Paylaştırmayı somut nesneyle yaptır; “ikişer” deme.',['paylaştırma','nicelik'],{scoring:'process'}),
      task('MA12',45,4,'ceiling','reasoning','Kuralı Kendin Bul','Bu sıranın kuralı ne olabilir?','Basit ama yeni görsel örüntü sun; açıklama keşif kanıtıdır.',['örüntü','çıkarım'],{neutral:true,scoring:'process'})
    ]),

    domain('MM','Görsel–İşitsel Bellek','Bellek',['görsel-kısa','işitsel-kısa','konum','sıra','gecikme','güncelleme','girişim','çift-kod'],[
      task('MM01',36,1,'anchor','memory','İki Nesneyi Hatırla','Birazdan hangi iki şeyi gördüğünü söyle.','İki tanıdık nesneyi 4–5 saniye göster, kapat ve sor.',['görsel-kısa'],{scoring:'process'}),
      task('MM02',36,1,'anchor','memory','Nerede Saklandı?','Oyuncak hangi kutudaydı?','İki konumdan birine sakla; kısa gecikme ver.',['konum','görsel-kısa'],{scoring:'accuracy'}),
      task('MM03',36,1,'anchor','imitation','İki Hareketi Hatırla','Benim yaptıklarımı sırayla yap.','Örn. alkışla → masaya dokun. Bir kez modelle.',['sıra','görsel-kısa'],{scoring:'process'}),
      task('MM04',36,1,'discriminator','memory','Resimde Neler Vardı?','Az önceki resimde neler vardı?','Üç belirgin nesneli sahneyi kısa süre göster.',['görsel-kısa'],{scoring:'process'}),
      task('MM05',39,2,'anchor','auditory-memory','İki Sözcüğü Hatırla','Kedi – top. Birazdan bana söyle.','İki ilgisiz tanıdık sözcüğü normal hızda bir kez söyle.',['işitsel-kısa'],{scoring:'process'}),
      task('MM06',39,2,'anchor','sequence-memory','Üçlü Sıra','Kırmızı, sarı, mavi sırasını aynen yap.','Üç kartı 4 saniye göster, sonra kapat.',['sıra','görsel-kısa'],{scoring:'process'}),
      task('MM07',39,2,'discriminator','delayed-memory','Gecikmeli Konum','Oyuncağı nereye koyduğumuzu hatırlıyor musun?','20–30 saniyelik başka etkinlikten sonra konumu sor.',['gecikme','konum'],{scoring:'process'}),
      task('MM08',42,3,'anchor','updating','Belleği Güncelle','Önce kırmızıydı, şimdi mavi oldu. Son rengi söyle.','İki ardışık bilgi ver; son geçerli bilgiyi tutmasını bekle.',['güncelleme','işitsel-kısa'],{scoring:'process'}),
      task('MM09',42,3,'discriminator','dual-code','Gör ve Dinle','Kırmızı karta dokun, sonra “top” kelimesini hatırla.','Görsel ve işitsel iki farklı bilgiyi kısa süre birlikte tuttur.',['çift-kod','sıra'],{scoring:'process'}),
      task('MM10',42,3,'transfer','rule-memory','Kuralı Hatırla','Zili duyunca mavi karta dokun.','Kuralı öğret, kısa aradan sonra hatırlatmadan uygulat.',['gecikme','güncelleme'],{scoring:'process'}),
      task('MM11',45,4,'transfer','interference','Araya Giren Bilgiden Sonra','Önce gördüğümüz üç şeyden hangilerini hatırlıyorsun?','Hedef liste sonrası kısa dikkat dağıtıcı görev ver.',['girişim','gecikme'],{scoring:'process'}),
      task('MM12',45,4,'ceiling','transfer-memory','Yeni Malzemeyle Aynı Bellek Kuralı','Bu kez farklı kartlarla aynı sırayı koru.','Önceki sıra kuralını yeni materyale taşımasını bekle; nötr keşif kanıtıdır.',['çift-kod','sıra','güncelleme'],{neutral:true,scoring:'process'})
    ]),

    domain('EF','Dikkat ve Yürütücü İşlevler','Dikkat / Yürütücü',['sürdürme','bekleme','ketleme','hedef-seçimi','kural-sürdürme','kural-değişimi','planlama','hata-izleme'],[
      task('EF01',36,1,'anchor','attention','Kısa Odak','Bu resmi dikkatle incele.','20–30 saniyelik sade bir arama görevi ver; bakıştan kaçma ve göreve dönüşü kaydet.',['sürdürme'],{scoring:'process'}),
      task('EF02',36,1,'anchor','go-wait','Bekle ve Başla','Ben “başla” deyince kuleyi yap.','Malzemeyi önceden ver; 3–5 saniyelik bekleme kullan.',['bekleme','ketleme'],{scoring:'process'}),
      task('EF03',36,1,'anchor','rule','Aynı Kuralı Sürdür','Kırmızıları bu kutuya koymaya devam et.','En az dört ardışık doğru uygulama fırsatı oluştur.',['kural-sürdürme','sürdürme'],{scoring:'process'}),
      task('EF04',36,1,'discriminator','stop-go','Dur–Kalk','Yeşilde yap, kırmızıda dur.','Motor yanıtla basit stop-go döngüsü uygula.',['ketleme','bekleme'],{scoring:'process'}),
      task('EF05',39,2,'anchor','visual-search','Hedefi Bul','Sadece yıldızları bul.','Benzer çeldiriciler arasında hedef seçimini ölç.',['hedef-seçimi','sürdürme'],{scoring:'process'}),
      task('EF06',39,2,'anchor','rule-switch','Kural Değişti','Şimdi kırmızıları değil, mavileri seç.','İlk kuralı birkaç kez uygulattıktan sonra değiştir.',['kural-değişimi','ketleme'],{scoring:'process'}),
      task('EF07',39,2,'discriminator','opposite','Tersini Yap','Ben yukarı deyince sen aşağıyı göster.','İki karşıt yanıtla kısa oyun kur; öğretme denemesinden sonra ölç.',['ketleme','kural-sürdürme'],{scoring:'process'}),
      task('EF08',42,3,'anchor','alternating-rule','İki Kural Arasında Geç','Zilde renge, alkışta şekle göre seç.','İki açık sinyali iki kuralla eşleştir.',['kural-değişimi','hedef-seçimi'],{scoring:'process'}),
      task('EF09',42,3,'discriminator','planning','Önce Planla','Bu kuleyi yapmadan önce hangi parçayla başlayacaksın?','Harekete geçmeden kısa plan ifadesi/işaretini kaydet.',['planlama'],{scoring:'process'}),
      task('EF10',42,3,'transfer','error-monitor','Bir Şey Ters Gitti','Kulen devrildi; şimdi ne yapabilirsin?','Hemen çözüm söyleme; hatayı fark etme ve düzeltme girişimini gözle.',['hata-izleme','planlama'],{scoring:'process'}),
      task('EF11',45,4,'transfer','delayed-choice','Kısa Bekleme Sonrası Seç','Kartı şimdi değil, işaret gelince seç.','Gecikmiş yanıt ve hedef korumayı birlikte ölç.',['bekleme','hedef-seçimi'],{scoring:'process'}),
      task('EF12',45,4,'ceiling','strategy-switch','İlk Yol Çalışmazsa','Bu yol olmadı; başka nasıl deneyebiliriz?','Açık uçlu alternatif strateji aramasını gözle; nötr keşif kanıtıdır.',['kural-değişimi','planlama','hata-izleme'],{neutral:true,scoring:'process'})
    ]),

    domain('SE','Sosyal Biliş, Duygu ve Oyun','Sosyal / Duygusal',['duygu','sıra','sembolik-oyun','yardım-etme','oyuna-katılma','farklı-bakış','kural','sosyal-problem'],[
      task('SE01',36,1,'anchor','emotion-choice','Duyguyu Tanı','Hangisi üzgün görünüyor?','Yüz ifadesi sade ve bağlamdan bağımsız iki–üç seçenek kullan.',['duygu'],{scoring:'accuracy'}),
      task('SE02',36,1,'anchor','turn-taking','Sıra Bende–Sende','Bir ben, bir sen oynayalım.','Kısa top/halka oyunu ile en az üç sıra değişimi gözle.',['sıra','kural'],{scoring:'process'}),
      task('SE03',36,1,'anchor','pretend-play','Rol Oyunu','Bu bebeğin acıkmış olduğunu düşün. Ne yapalım?','Günlük yaşam nesneleriyle sembolik oyun başlat; çocuğun genişletmesini gözle.',['sembolik-oyun'],{scoring:'process'}),
      task('SE04',36,1,'discriminator','scenario','Arkadaş Üzgünse','Arkadaşın ağlıyor. Ne yapabilirsin?','Tek doğru cevap dayatma; uygun destek davranışlarını süreç kanıtı olarak kaydet.',['yardım-etme','duygu'],{scoring:'process'}),
      task('SE05',39,2,'anchor','scenario','Oyuna Katılma','İki çocuk oynuyor. Sen de oynamak istiyorsun. Ne yaparsın?','Sosyal girişimi sözlü/işaretle ifade etmesine izin ver.',['oyuna-katılma','sosyal-problem'],{scoring:'process'}),
      task('SE06',39,2,'discriminator','perspective','Ben Başka, Sen Başka','Sen elmayı seviyorsun; ben muzu seviyorum. İkimiz aynı şeyi mi seviyoruz?','Kendi tercihi ile başkasının tercihini ayırmasını gözle.',['farklı-bakış'],{scoring:'process'}),
      task('SE07',39,2,'anchor','rule-change','Oyunun Kuralı Değişirse','Şimdi sıra tersine döndü. Ne yapacağız?','Basit oyun kuralını değiştir; davranışsal uyumu gözle.',['kural','sıra'],{scoring:'process'}),
      task('SE08',42,3,'anchor','perspective','Karakter Ne Hissediyor?','Oyuncağı kırılan çocuk nasıl hissedebilir? Neden?','Duygu ve nedenini birlikte sor; farklı makul yanıtları kabul et.',['duygu','farklı-bakış'],{scoring:'process'}),
      task('SE09',42,3,'discriminator','scenario','İki Çocuk Aynı Oyuncağı İsterse','İkiniz de aynı oyuncağı istiyorsunuz. Ne yapabilirsiniz?','Paylaşma, sıra, alternatif üretme gibi çözümleri açık uçlu kaydet.',['sosyal-problem','sıra'],{scoring:'process'}),
      task('SE10',42,3,'transfer','pretend-play','Oyunu Birlikte Genişlet','Şimdi dükkâna bir müşteri geldi. Sonra ne olur?','Başlatılmış sembolik oyuna yeni rol ekle; esnek genişletmeyi gözle.',['sembolik-oyun','farklı-bakış'],{scoring:'process'}),
      task('SE11',45,4,'transfer','scenario','Davranışı Ortama Göre Değiştir','Kütüphanede ve parkta aynı şekilde mi davranırız?','İki tanıdık ortamı karşılaştır; kuralı ezberden değil örnekle açıklamasını bekle.',['kural','sosyal-problem'],{scoring:'process'}),
      task('SE12',45,4,'ceiling','perspective','Karakterin Bilmediği Şey','Oyuncağın yerini sen gördün ama karakter görmedi. O nerede sanabilir?','Basit bilgi erişimi farkını keşif amacıyla gözle; yapılamaması zayıflık sayılmaz.',['farklı-bakış'],{neutral:true,scoring:'process'})
    ]),

    domain('MO','Motor ve Grafomotor','Motor / Grafomotor',['ince-motor','iki-el','çizgi','şekil','top','düğme','kalem-tutuş','kesme'],[
      task('MO01',36,1,'anchor','material','Boncuk Dizme','Bu boncukları ipe dizelim.','Büyük boncuk ve güvenli kalın ip kullan; kavrama, yönlendirme ve iki el koordinasyonunu kaydet.',['ince-motor','iki-el'],{scoring:'process'}),
      task('MO02',36,1,'anchor','material','Kapağı Aç–Kapat','Bu kabın kapağını açıp kapatır mısın?','Çocuğun gücüne uygun vidalı kap kullan.',['ince-motor','iki-el'],{scoring:'process'}),
      task('MO03',36,1,'anchor','drawing','Dikey ve Yatay Çizgi','Benim çizgim gibi bir çizgi çizer misin?','Önce dikey, sonra yatay çizgiyi ayrı dene.',['çizgi','kalem-tutuş'],{scoring:'process'}),
      task('MO04',36,1,'discriminator','drawing','Daire Taklidi','Benimki gibi yuvarlak çizer misin?','Tek model göster; elini yönlendirme.',['şekil','kalem-tutuş'],{scoring:'process'}),
      task('MO05',39,2,'anchor','construction','Kule ve Köprü','Önce kule yap, sonra iki blok üstüne bir blokla köprü dene.','Yapı modelini kısa göster; ince motor ve görsel-motor planlamayı birlikte kaydet.',['ince-motor','iki-el'],{scoring:'process'}),
      task('MO06',39,2,'anchor','ball','Büyük Topu Yakala','Topu sana atacağım, yakalamaya çalış.','Yakın mesafeden büyük yumuşak top ile üç doğal deneme yap.',['top'],{scoring:'process'}),
      task('MO07',39,2,'discriminator','selfcare-motor','Düğme Açma','Bu büyük düğmeyi açabilir misin?','Geniş düğmeli uygulama materyali kullan; kıyafet üzerinde zorunlu kılma.',['düğme','iki-el'],{scoring:'process'}),
      task('MO08',42,3,'anchor','observation','Kalem Tutuşu','Bir şey çizmek ister misin?','Doğal çizim sırasında tutuşu gözle; “doğru tut” deme.',['kalem-tutuş'],{scoring:'process'}),
      task('MO09',42,3,'discriminator','drawing','Artı İşaretini Taklit','Benimki gibi iki çizgiyi kesiştir.','Modeli görünür tut; çizgi yönü ve kesişimi kaydet.',['çizgi','şekil'],{scoring:'process'}),
      task('MO10',42,3,'transfer','cutting','Kalın Yol Boyunca Kes','Makasla bu kalın çizgiyi takip edelim.','Çocuk makası ve kalın kısa yol kullan; güvenlik için yetişkin yanında olsun.',['kesme','iki-el'],{scoring:'process'}),
      task('MO11',45,4,'transfer','drawing','Basit İnsan Çizimi','Bir insan çizer misin?','Yönlendirme yapmadan serbest çizim iste; parça sayısını yalnız betimsel kanıt olarak kaydet.',['şekil','kalem-tutuş'],{scoring:'process'}),
      task('MO12',45,4,'ceiling','fine-motor-transfer','Yeni İnce Motor Dizisi','Kıskaçla üç parçayı sırayla taşı.','Yeni araçla planlı ince motor dizisini keşif amacıyla gözle.',['ince-motor','iki-el'],{neutral:true,scoring:'process'})
    ]),

    domain('DL','Günlük Yaşam, Özbakım ve Güvenlik','Özbakım / Güvenlik',['giyinme','düzen','hijyen','yardım','tehlike','yetişkin-güvenliği','servis','rutin-sıra'],[
      task('DL01',36,1,'anchor','selfcare','Montunu Giyme','Montunu giymeyi dener misin?','Çocuğun kendi montu veya benzer geniş giysi kullan; yalnız gerektiğinde destek basamağına geç.',['giyinme'],{scoring:'process'}),
      task('DL02',36,1,'anchor','routine','Eşyayı Yerine Koy','Oyun bitince bunları nereye koyarız?','Tanıdık düzen ipuçları olan ortam kullan.',['düzen','rutin-sıra'],{scoring:'process'}),
      task('DL03',36,1,'anchor','scenario','Eller Ne Zaman Yıkanır?','Tuvaletten sonra ne yaparız?','Günlük rutini açık uçlu sor; ezberlenmiş slogan isteme.',['hijyen'],{scoring:'process'}),
      task('DL04',36,1,'discriminator','scenario','Yardım İsteme','Bir şeyi açamıyorsan ne yapabilirsin?','Yetişkinden uygun yardım isteme yollarını gözle.',['yardım'],{scoring:'process'}),
      task('DL05',39,2,'anchor','safety-choice','Sıcak Şey','Bu çok sıcak olabilir. Ne yapmalıyız?','Görsel/oyuncak senaryo kullan; gerçek tehlikeli nesne kullanma.',['tehlike'],{scoring:'process'}),
      task('DL06',39,2,'anchor','safety-scenario','Tanımadığın Biri Çağırırsa','Tanımadığın biri “Benimle gel” derse ne yaparsın?','Korkutucu dil kullanmadan güvenilir yetişkine yönelme davranışını konuş.',['yetişkin-güvenliği'],{scoring:'process'}),
      task('DL07',39,2,'discriminator','selfcare','Su Dökme','Bardağa biraz su doldurabilir misin?','Az miktarda su ve güvenli sürahi kullan; dökülmeyi hata olarak değil süreç kanıtı olarak kaydet.',['servis','iki-el'],{scoring:'process'}),
      task('DL08',42,3,'anchor','routine','İki Aşamalı Özbakım','Önce ellerini ıslat, sonra sabunu kullan.','Gerçek veya temsili lavabo rutininde iki adımı sırayla uygulat.',['hijyen','rutin-sıra'],{scoring:'process'}),
      task('DL09',42,3,'discriminator','choice','Havaya Uygun Seçim','Yağmur yağıyor. Hangisini seçersin?','Şemsiye/şapka/terlik gibi görsellerden bağlama uygun seçimi sor.',['giyinme','tehlike'],{scoring:'process'}),
      task('DL10',42,3,'transfer','scenario','Kaybolursan Ne Yaparsın?','Bir yerde aileni göremezsen ne yapabilirsin?','Güvenilir görevli/yetişkin bulma ve yerinde kalma gibi seçenekleri açık uçlu değerlendir.',['yardım','yetişkin-güvenliği'],{scoring:'process'}),
      task('DL11',45,4,'transfer','sequence','Sabah Rutini Sırala','Giyinme, diş fırçalama ve kahvaltıyı nasıl sıraya koyarsın?','Tek bir kültürel “doğru sıra” dayatma; tutarlı plan ve açıklamayı kaydet.',['rutin-sıra','düzen'],{scoring:'process'}),
      task('DL12',45,4,'ceiling','reasoning','Güvenli Seçimi Açıkla','İki seçenekten hangisi daha güvenli? Neden?','Yeni bir günlük yaşam senaryosu sun; gerekçe keşif kanıtıdır.',['tehlike','yardım'],{neutral:true,scoring:'process'})
    ]),

    domain('LT','Öğrenmeye Tepki, Transfer ve Problem Çözme','Öğrenme / Transfer',['modelden-öğrenme','ipucu-kullanma','strateji','benzerlik','plan','genelleme','öz-düzeltme','öğretme'],[
      task('LT01',36,1,'anchor','imitation','Modelden Öğren','Beni izle, sonra sen dene.','Yeni ama kısa iki adımlı bir yapım modeli göster; tek gösterim sonrası denet.',['modelden-öğrenme'],{scoring:'process'}),
      task('LT02',36,1,'anchor','scaffold','İpucundan Sonra','Bir ipucu vereceğim; sonra sen devam et.','Önce bağımsız deneme, sonra yalnız gerektiği kadar ipucu ver; ipucu sonrası öğrenme kazancını kaydet.',['ipucu-kullanma'],{scoring:'process'}),
      task('LT03',36,1,'anchor','problem-solving','İlk Yol Olmazsa','Bu parça buraya olmadı. Başka ne deneyebiliriz?','Çözümü söylemeden alternatif girişim sayısını ve esnekliği gözle.',['strateji','öz-düzeltme'],{scoring:'process'}),
      task('LT04',36,1,'discriminator','matching','Benzerini Bul','Bunun gibi çalışan başka bir şeyi bul.','Yüzey özelliği farklı, işlev ilişkisi benzer seçenekler kullan.',['benzerlik','genelleme'],{scoring:'process'}),
      task('LT05',39,2,'anchor','planning','Planını Göster','Bunu yapmadan önce neyle başlayacaksın?','Sözel cevap zorunlu değil; işaret etme veya ilk planlı hareketi de kanıt kabul et.',['plan'],{scoring:'process'}),
      task('LT06',39,2,'anchor','transfer','Yeni Malzemeyle Aynı Kural','Aynı kuralı bu farklı parçalarla da yapabilir misin?','Öğrenilen kuralı yüzey özellikleri farklı materyale taşıt.',['genelleme','modelden-öğrenme'],{scoring:'process'}),
      task('LT07',39,2,'discriminator','self-correction','Kendi Hatanı Fark Et','Bir şey tam uymadı. Sence neyi değiştirebiliriz?','Hemen düzeltme verme; hatayı fark etme ve yeniden deneme sürecini kaydet.',['öz-düzeltme','strateji'],{scoring:'process'}),
      task('LT08',42,3,'anchor','delayed-transfer','Biraz Sonra Aynısını Yap','Az önce öğrendiğimiz yolu bu kez bekledikten sonra uygula.','Kısa gecikme sonrası kuralı yeniden uygulamasını gözle.',['genelleme','modelden-öğrenme'],{scoring:'process'}),
      task('LT09',42,3,'discriminator','tool-choice','Uygun Aracı Seç','Bu parçayı almak için hangi araç işine yarar?','İki–üç araç arasından işlevsel seçim ve gerekçe fırsatı ver.',['strateji','benzerlik'],{scoring:'process'}),
      task('LT10',42,3,'transfer','generalization','Başka Ortamda Aynı Çözüm','Bu kuralı masada yaptık; yerde de nasıl yaparız?','Bağlam değiştirerek aynı ilkeyi uygulamasını iste.',['genelleme','plan'],{scoring:'process'}),
      task('LT11',45,4,'transfer','teach-back','Bana Öğret','Bunu nasıl yaptığını bana öğretir misin?','Çocuğun süreç bilgisini davranışla veya sözle dışa vurmasını gözle.',['öğretme','plan'],{scoring:'process'}),
      task('LT12',45,4,'ceiling','far-transfer','Uzak Transfer Keşfi','Bu öğrendiğimiz fikir başka nerede işe yarar?','Doğrudan benzemeyen yeni bağlamda ilke transferini keşif amacıyla yokla.',['genelleme','strateji','öğretme'],{neutral:true,scoring:'process'})
    ])
  ];

  const caregiver=[];
  const cq=(domainId,id,prompt,facet)=>caregiver.push({id,domainId,prompt,facet,responseScale:['Sık görülür','Bazen görülür','Henüz gözlenmedi','Emin değilim']});
  cq('VC','CG-VC1','Benzer nesneleri kendi kendine gruplar mı?','kategori');
  cq('VC','CG-VC2','Günlük yaşamda “üstünde, altında, içinde” gibi konumları anlayıp kullanır mı?','mekânsal');
  cq('VC','CG-VC3','Eksik veya farklı olanı fark edip size gösterir mi?','ayırt-etme');
  cq('RL','CG-RL1','Evde iki aşamalı yönergeleri çoğunlukla takip eder mi?','iki-adım');
  cq('RL','CG-RL2','Nesneleri isimlerinden çok işlevleriyle tarif ettiğinizde bulabilir mi?','işlev');
  cq('RL','CG-RL3','“Önce/sonra” gibi sıra sözcüklerini günlük rutinde anlayabiliyor mu?','zaman-sırası');
  cq('EL','CG-EL1','Gün içinde yaşadığı bir olayı size kendiliğinden anlatır mı?','olay-anlatımı');
  cq('EL','CG-EL2','Bir şeyi açıklarken renk, yer, kişi veya eylem gibi ayrıntılar ekler mi?','betimleme');
  cq('EL','CG-EL3','Yanlış anlaşıldığında anlatımını başka türlü ifade etmeyi dener mi?','onarım');
  cq('MA','CG-MA1','Günlük yaşamda küçük miktarları saymaya veya karşılaştırmaya ilgi gösterir mi?','sayma');
  cq('MA','CG-MA2','Basit tekrar eden örüntüleri fark eder veya sürdürür mü?','örüntü');
  cq('MA','CG-MA3','Paylaştırma sırasında “aynı/çok/az” gibi nicelik ilişkilerine dikkat eder mi?','nicelik');
  cq('MM','CG-MM1','Yakın zamanda gördüğü iki–üç şeyi kısa süre sonra hatırlar mı?','görsel-kısa');
  cq('MM','CG-MM2','Kısa bir yönerge dizisini hatırlayıp uygular mı?','sıra');
  cq('MM','CG-MM3','Kısa bir aradan sonra nesnenin yerini hatırlayabilir mi?','gecikme');
  cq('EF','CG-EF1','Kısa masa/oyun etkinliğinde dikkatini sürdürebiliyor mu?','sürdürme');
  cq('EF','CG-EF2','Bir oyunun kuralı değiştiğinde yeni kurala uyum sağlayabiliyor mu?','kural-değişimi');
  cq('EF','CG-EF3','Hata yaptığında fark edip yeniden denemeye çalışır mı?','hata-izleme');
  cq('SE','CG-SE1','Başka bir çocuk üzgün olduğunda bunu fark edip tepki verir mi?','duygu');
  cq('SE','CG-SE2','Sembolik/rol oyunlarında karakter veya günlük yaşam rolleri kurar mı?','sembolik-oyun');
  cq('SE','CG-SE3','Akran oyununa katılmak için sözlü veya davranışsal girişimde bulunur mu?','oyuna-katılma');
  cq('MO','CG-MO1','Kalem, kaşık, boncuk gibi küçük araçları günlük yaşamda rahatça kullanıyor mu?','ince-motor');
  cq('MO','CG-MO2','Top yakalama/atma gibi kaba motor oyunlarına katılıyor mu?','top');
  cq('MO','CG-MO3','Giyinme sırasında fermuar/düğme gibi işlemleri denemeye istekli mi?','düğme');
  cq('DL','CG-DL1','Giyinme, el yıkama veya eşya toplama rutinlerine bağımsız katılıyor mu?','rutin-sıra');
  cq('DL','CG-DL2','Tehlikeli olabilecek durumlarda yetişkinden yardım isteme eğilimi gösteriyor mu?','yardım');
  cq('DL','CG-DL3','Sıcak yüzey, trafik veya yabancı yetişkin gibi temel güvenlik durumlarında temkinli davranıyor mu?','tehlike');
  cq('LT','CG-LT1','Bir kez gösterilen yeni bir işi ikinci denemede daha bağımsız yapabiliyor mu?','modelden-öğrenme');
  cq('LT','CG-LT2','Bir çözüm işe yaramadığında başka yol deniyor mu?','strateji');
  cq('LT','CG-LT3','Bir yerde öğrendiği kuralı farklı oyuncak veya ortamda kullanıyor mu?','genelleme');

  const meta={
    version:'E3-v3.0',
    ageRange:[36,47],
    disclaimer:'Bu görev bankası tanı veya norm üretmez. CZA içi yapılandırılmış gelişimsel gözlem ve başlangıç profili oluşturmak için kullanılır.',
    evidencePrinciples:['çoklu görev','çoklu yöntem','eğitimci gözlemi','bakımveren kanıtı','yardım düzeyi','öz-düzeltme','transfer','yaşa göre adaptasyon'],
    researchBasis:['CDC 3–4 yaş gelişim kilometre taşları','ASHA 3–4 yaş iletişim kilometre taşları','AAP gelişimsel izlem yaklaşımı','Head Start/ELOF alan mantığı']
  };

  const api={meta,domains,caregiver,allTasks:domains.flatMap(d=>d.tasks)};
  root.E3_BANK=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
