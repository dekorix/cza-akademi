# CZA BAŞ MİMAR → CODEX B
## AKTİF TEK GÖREV: B08-UX-REV2 | MAT-01 GÖRSEL VE ŞIKLI DEĞERLENDİRME REVİZYONU

**Proje:** `dekorix/cza-akademi`

**İlgili kayıtlar:**
- Issue #106: https://github.com/dekorix/cza-akademi/issues/106
- PR #109: https://github.com/dekorix/cza-akademi/pull/109
- CZA-MATEMATİK-AI: https://github.com/dekorix/cza-akademi/issues/108

**GÖREVİ UYGULA. Yalnız yeni bir analiz raporu hazırlayıp durma.**

### 1. GÖREV AMACI

Mevcut MAT-01 görsel önizlemesini, öğrencinin gerçek matematiksel bilgisini koruyarak ölçebilen, erişilebilir, görsel açıdan kaliteli ve kullanıcının bizzat inceleyebileceği bir değerlendirme deneyimine dönüştür.

Öncelik yeni etkinlik sayısını artırmak değil, dört mevcut etkinliği doğru çalıştırmaktır.

Çıktı, büyük CZA platformu için kullanıcı kabulüne sunulacak **çalışan ve tıklanabilir, yalnız sentetik önizleme** olmalıdır. Gerçek uygulamaya bağlandığını iddia etme.

### 2. TEMEL PEDAGOJİK KARAR

Bütün soruları zorunlu olarak çoktan seçmeli yapma.

Öğrencinin takvim yaşı, gerçek öğrenme düzeyi, erişim gereksinimleri ve ölçülmek istenen beceriye göre şu yanıt yöntemlerini kullan:

- Büyük ve okunaklı basılı şıklar.
- Gerçekçi görsellerle seçenek belirleme.
- Somut onluk ve birlik nesnelerini gruplama.
- Gerektiğinde bağımsız açık uçlu yanıt.
- Öğretmen tarafından gözlenen sözlü veya alternatif iletişim yanıtı.

**Kritik ayrım:** Şıklardan doğruyu tanıma ile herhangi bir şık verilmeden doğru cevabı üretme aynı beceri kanıtı değildir. Sonuçlarda bu iki yöntem ayrı etiketlenecek. Şıklı yanıt tek başına kavramsal ustalık veya transfer başarısı sayılmayacak.

### 3. MAT-01 GÖREVLERİNİN YENİ YAPISI

**MAT-01A | İlk bağımsız değerlendirme**

47 sayısındaki onluk ve birlik ilişkisini değerlendir.

Öğretmen başlangıçtan önce uygun yanıt yöntemini belirleyebilsin:

- A1: Dört büyük görsel/yazılı seçenekli tanıma.
- A2: Seçeneksiz, somut veya açık uçlu bağımsız gösterme.

Bunlar aynı ölçme türü olarak puanlanmayacak.

İlk yanıt verilmeden doğru çözüm, örnek cevap, destek materyali veya sonraki aşamaların cevabı gösterilmeyecek.

**MAT-01S | Destekli çalışma**

Onluk çubukları ve birlik küpleri kullanılabilir.

Büyük, tıklanabilir ve gerektiğinde basılabilir görsel şıklar hazırla.

Öğrenciye verilen ipucunu, materyali ve destek düzeyini ayrı göster.

Destek sonrası doğru yanıt, MAT-01A'nın bağımsız başarısına dönüşmeyecek.

**MAT-01B | Matematiksel gerekçe**

47 ve 74 sayılarının farkını sorgula.

İlk aşamada görsel seçenek kullanılabilir. Ancak gerçek matematiksel gerekçeyi ölçmek için öğrencinin kendi açıklaması, nesneleri göstermesi veya öğretmen tarafından kaydedilen yanıtı ayrıca değerlendirilecek.

Ölçme sırasında doğru matematiksel açıklamayı sorunun üzerinde gösterme.

**MAT-01T | Yeni örneğe transfer**

Başlık: **Aynı Sayı, Farklı Gösterimler**

52 sayısı kullanılacak.

Öğrencinin gerçekten yeni bir örnekte ilişkiyi gösterip göstermediğini araştır.

Görsel seçenekli tanıma ile bağımsız farklı temsil üretme ayrı kanıt türleri olacak.

Sorunun üstünde veya cevap alanında `52=50+2`, `5 onluk 2 birlik` gibi çözümü veren örnekler bulunmayacak.

Yeni örneğin daha önce görülmediği veya yardım verilmediği doğrulanamıyorsa sonuç `NOT_ASSESSED` olarak kalacak.

### 4. ZORUNLU GÜVENLİK VE ÖLÇME DÜZELTMELERİ

Önceki HTML önizlemesindeki şu hataları kesin olarak gider:

1. İlk bağımsız yanıt kaydedilmeden destek, gerekçe ve transfer ekranlarına geçilemesin.
2. İlk yanıt sonradan silinemesin veya değiştirilmesin.
3. Yeni deneme başlatılması eski denemenin kanıtlarını silmesin; ayrı deneme kimliğiyle gösterilsin.
4. Öğrenci ekranında örnek cevap düğmeleri veya doğruyu ele veren placeholder metinleri bulunmasın.
5. Destekli çalışmada verilen cevap ilk değerlendirmeyi değiştirmesin.
6. Öğretmen gözlemleri ile öğrencinin doğrudan yanıtları ayrı kaydedilsin.
7. Transferin yeniliği öğrenci tarafından yalnız kutu işaretlenerek kanıtlanmış sayılmasın.
8. Matematiksel olarak eşdeğer alternatif doğru yanıtlar hatalı sayılmasın. Örneğin `3 onluk 17 birlik` ifadesinin 47'ye eşdeğerliği tanınsın; bunun kanonik onluk-birlik çözümlemesiyle aynı ölçme anlamına gelmediği de korunsun.
9. `4,7` gibi belirsiz yanıtlar otomatik doğru kabul edilmesin.
10. Tek bir doğru yanıttan kalıcı öğrenme, genel beceri puanı veya otomatik ödev çıkarılmasın.

### 5. ŞIK TASARIMI VE GÖRSEL KALİTE

- Şıklar büyük, açık ve çocuk tarafından rahat seçilebilir olacak.
- Doğru cevap varsayılan olarak ilk şıkta bulunmayacak.
- Doğru cevap konumu etkinlikler boyunca dengeli ve öngörülemez dağıtılacak.
- Yanlış seçenekler gerçek kavram hatalarını yansıtacak; anlamsız çeldiriciler kullanılmayacak.
- Metin ve görseller birbirinin aynısını tekrar ederek cevabı ele vermeyecek.
- Gerçekçi ve anlaşılır onluk çubukları, birlik küpleri ve nesne grupları kullanılacak.
- Gerektiğinde A4 baskıya uygun şıklı sayfa düzeni gösterilecek.
- Dikkat dağıtan animasyonlar, aşırı renk, gereksiz ödül ve sahte başarı puanları bulunmayacak.
- 5–8 yaş, 9–12 yaş ve özel eğitim erişim gereksinimleri dikkate alınacak. Yaş, tek başına öğrenme düzeyi olarak kabul edilmeyecek.

### 6. İKİ AYRI GÖRÜNÜM

**Öğrenci görünümü**

Gerçek bir öğrenci deneyimine benzeyen, sade, görsel, anlaşılır ve etkileşimli ekran.

**Eğitmen görünümü**

Ayrı olarak şunları gösterecek:

- İlk bağımsız yanıt.
- Destekli yanıt.
- Matematiksel gerekçe gözlemi.
- Yeni örneğe transfer.
- Kullanılan yanıt yöntemi ve yardım düzeyi.
- Belirsiz veya yetersiz kanıtlar.
- Öğretmen kararı bekleyen alanlar.

Bütün bilgiler tek Student Learning Profile mimarisiyle uyumlu tasarlanacak. Ancak bu prototip gerçek SLP'ye veri yazmayacak.

### 7. GERÇEK ÇALIŞAN ÖNİZLEME VE TEST

Yeni dosyalardan oluşan, izole ve sentetik, tıklanabilir bir önizleme oluştur.

Öğrenciyle eğitmen arasında örnek kanıt aktarımını kullanıcı arayüzünde göster.

Şu kontrolleri gerçekten çalıştır:

- İlk yanıttan önce sonraki aşamaya geçiş reddi.
- Yanıt silme ve eski denemeyi değiştirme reddi.
- Şıkların cevap konumu dağılımı.
- Cevap ve ipucu sızıntısı kontrolü.
- Doğru, yanlış, kısmi, belirsiz ve değerlendirilemeyen yanıtlar.
- İlk bağımsız ve destekli performans ayrımı.
- Yeni örneğe transfer için ön koşul kontrolü.
- Mobil ve masaüstü görüntü.
- Öğrenci/eğitmen ekranları arası gösterim.
- Klavye, dokunmatik ve erişilebilirlik kontrolü.

Gerçek tarayıcı testi mümkünse masaüstü 1440×900 ve mobil 390×844 ölçülerinde gerçekleştir. Mümkün değilse açıkça `NOT_RUN` bildir.

Önizleme gerçek CZA ürünüymüş veya canlı staging kabulü almış gibi gösterilmeyecek.

### 8. KAPSAM VE KOD KORUMASI

PR #109'un kabul edilen saf matematiksel kanıt sözleşmesini koru. Mevcut değerlendirme API'sini, SLP veritabanını ve öğrenci kayıtlarını değiştirme.

Ayrı çalışma dalında yalnız yeni sentetik önizleme ve gerekli test dosyalarını oluştur. Gerekiyorsa ayrı DRAFT PR aç.

PR #91, #101, #107, #109 ve main'i değiştirme.

Codex A'nın #98 güvenlik, Worker ve staging işine müdahale etme.

**Kesin yasaklar:** Gerçek öğrenci verisi, production, canlı SQL, secret, migration, Worker deploy, main merge ve otomatik öğrenci ataması.

### 9. BEKLENEN TEK TESLİM

Issue #106'ya tek kanıtlı teslim raporu bırak.

Raporda:

1. Açılabilir ve tıklanabilir öğrenci önizlemesi.
2. Eğitmen kanıt görünümü.
3. Masaüstü ve mobil ekran görüntüleri.
4. Revize edilmiş MAT-01A/S/B/T akışı.
5. Gerçek test sonuçları.
6. Değiştirilen dosyalar ve varsa DRAFT PR.
7. Açık eksikler ve sonraki entegrasyon sınırı.
8. Kullanıcının görsel kabul vermesi için açık kontrol listesi.

Yalnız test sayısı ve commit bildirerek işi tamamlanmış ilan etme.

**Başarı koşulu:** Kullanıcı ekranı açıp bir öğrencinin değerlendirmeyi nasıl yaptığını, eğitmenin ne gördüğünü ve doğru/yanlış/destekli yanıtların nasıl ayrıldığını somut olarak inceleyebilmeli.

### 10. KANONİK DURUMLAR

`B08_UX_REV2=IN_PROGRESS`

`USER_VISUAL_ACCEPTANCE=PENDING`

`REAL_STUDENT_USE=BLOCKED`

`AUTO_ASSIGNMENT=BLOCKED`

`RUNTIME_NOT_WIRED=YES`

`PRODUCTION_APPROVED=NO`

Rapor sonunda:

- GENEL PROJE İLERLEME %
- MEVCUT FAZ İLERLEME %
- TAMAMLANAN
- KALAN
- KAPSAM SAPMASI
- SIRADAKİ TEK ADIM

alanlarını koru.

**SIRADAKİ TEK ADIM:** Öğrencinin ve eğitmenin deneyebileceği güvenli, sentetik MAT-01 görsel önizlemesini tamamla ve Baş Mimar ile ürün sahibinin görsel kabulüne sun.
