# CZA Egzersiz Akademisi — ayrı pilot

Bu çalışma mevcut Apps Script Kampüs yayınına dokunmadan ayrı bir uygulama olarak hazırlanmıştır.

## Çalışan ilk kapsam

- Öğrenci çalışma merkezi ve örnek günlük rota.
- Soroban okuma ve etkileşimli Soroban yazma.
- `/learn`: 8 derslik Soroban Temel Öğretim V1. Boncuklar/sıfırlama, basamaklar, doğrudan toplama/çıkarma, basit 5 ve 10 tamamlamaları.
- 17 rehberli örnek + 40 bağımsız deneme; özgün ders açıklamaları ve yasal boncuk hareketleriyle tanımlı çözüm yolları.
- Rehberli derste basamak/boncuk/yön geri bildirimi; bağımsız denemede ilk yanıt, ipucu kullanımı ve gerçek dijital hareket kaydı.
- Doğru sonuç ile örnek yöntem eşleşmesi ayrı değerlendirilir. Alternatif doğru yollar yanlış sayılmaz. Ders tamamlanması ustalık/seviye onayı değildir.
- Eğitimci “Ders incelemesi”: sekme-yerel ders filtresi, soru ve ham hareket incelemesi, CSV.
- Flash Anzan ve cihazın Türkçe konuşma desteğiyle Sesli Anzan.
- Basamak, soru, terim, işlem türü, gösterim süresi, adımlı mod ve tek basamaklı rakam havuzu.
- Egzersiz stüdyosunda seans sonunda soru bazında geri bildirim; seans sırasında doğru cevap gösterilmez. Yeni öğretim yolu farklıdır: rehberli örneklerde anlık, bağımsız sorularda yanıt gönderildikten sonra geri bildirim verilir.
- Eğitimci deneme programı, filtrelenebilir sekme-yerel sonuçlar ve CSV indirme.
- Atölye yol haritasında çalışan pilot ile henüz geliştirilmemiş alanların ayrılması.

## Sınırlar

- Gerçek hesap girişi, rol yetkileri, öğrenci eşleştirmesi ve merkezi kalıcı kayıt yoktur.
- Örnek öğrenci, gelişim, seri ve rota verileri açıkça senaryodur. Deneme seansları bu örnek öğrencilere atanmaz.
- Deneme programı ve sonuçlar yalnızca sessionStorage içinde, bu tarayıcı sekmesinin oturumunda tutulur; sekme kapanınca kaybolabilir. Gerçek öğrenci verisi girilmemelidir.
- Cevap anahtarı istemcide oluşur; bu pilot güvenli sınav sistemi değildir. Merkezi değerlendirmede üretim/puanlama sunucuya taşınmalıdır.
- Temel öğretim pilotu yalnızca tek basamaklı doğrudan/5 tamamlamaları ve basit tek onluk geçişi içerir. İç içe 5–10 tamamlamaları, çoklu elde/bozma, geniş yaş/seviye varyasyonları henüz yoktur. Rastgele stüdyo soruları teknik-odaklı ustalık kanıtı değildir.
- Ders kayıtları ayrı sessionStorage anahtarında en son 40 tamamlanmış çalışmayla sınırlıdır. Yarım kalan dersler kaydedilmez; ders değiştirmede ve sekme kapanışında uyarı vardır. Kalıcı öğrenci portfolyosu değildir.
- Ekrandaki boncuk adımları fiziksel parmak/duruş/eşzamanlı hareketi ölçmez. Fiziksel 6–9 oluşturmanın eşzamanlı hareketi ekranda ayrı tıklamalara ayrılır. Eğitimci gözlemi ve içerik kabulü gereklidir.
- Sesli Anzan cihaz konuşmasını kullanır; dil/ses kalitesi platforma bağlıdır. Eğitimci onaylı profesyonel ses kayıtları sonraki fazdadır.
- 14 CZA becerisi ile atölye eşleştirmeleri henüz eğitimci tarafından onaylanmadı.

## Bir sonraki uygulama fazı

1. Sekiz pilot dersin yöntem ve yaş/seviye kapsamını eğitimciyle kabul testine al; fiziksel parmak gösterimleri için özgün video ekle. Pilotun basit tek onluk örneklerinden sonra iç içe tamamlamalar ve çoklu aktarma tasarlanacak.
2. Kampüs ile tekil öğrenci kimliği ve güvenli rol sözleşmesini tasarla.
3. Merkezi seans, reçete, atama, erişim süresi ve denetim kaydını kur.
4. Öğretmen kontrollü seviye geçişini ve tekrar politikasını doğrula.
5. Veli özeti ve paket erişimini ayrı yetkilendirilmiş akış olarak ekle.

## Doğrulama notu

İşlem üretimi ve puanlamanın 6 kontrolüne 7 öğretim kontrolü eklendi. 57 görevde tüm adımların hedefe ulaşması, 0–999 için 15.000 boncuk hareketinde diğer basamakların korunması, tamamlayıcı tekniklerin kapsamı, alternatif doğru yollar ve kayıt doğrulaması sınanır. Kullanıcı bu turda tarayıcı testi istemediğinden görsel/etkileşimli tarayıcı QA yapılmadı. WebMCP ayar okuma ve hazırlama araçları korunur; destekleyen bir doğrulama bağlamı bulunmadığından canlı kayıt/sözleşme kontrolü doğrulanmış sayılmaz.

## Yöntem kaynakları

- Fiziksel soroban temelleri: https://www.shuzan.jp/english/preliminary/
- Tamamlayıcı işlem açıklamaları: https://www.sorobanexam.org/basics/add.html ve https://www.sorobanexam.org/basics/subtract.html
- Kaynak kontrolü: 3 Eylül 2026. Ders metinleri, örnek havuzları ve ekranlar CZA için özgün hazırlanmıştır; kaynak platformun markası veya lisanslı içeriği kopyalanmamıştır.
