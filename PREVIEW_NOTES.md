# CZA Egzersiz Akademisi — ayrı pilot

Bu çalışma mevcut Apps Script Kampüs yayınına dokunmadan ayrı bir uygulama olarak hazırlanmıştır.

## Çalışan ilk kapsam

- Öğrenci çalışma merkezi ve örnek günlük rota.
- Soroban okuma ve etkileşimli Soroban yazma.
- Flash Anzan ve cihazın Türkçe konuşma desteğiyle Sesli Anzan.
- Basamak, soru, terim, işlem türü, gösterim süresi, adımlı mod ve tek basamaklı rakam havuzu.
- Seans sonunda soru bazında geri bildirim; seans sırasında doğru cevap gösterilmez.
- Eğitimci deneme programı, filtrelenebilir sekme-yerel sonuçlar ve CSV indirme.
- Atölye yol haritasında çalışan pilot ile henüz geliştirilmemiş alanların ayrılması.

## Sınırlar

- Gerçek hesap girişi, rol yetkileri, öğrenci eşleştirmesi ve merkezi kalıcı kayıt yoktur.
- Örnek öğrenci, gelişim, seri ve rota verileri açıkça senaryodur. Deneme seansları bu örnek öğrencilere atanmaz.
- Deneme programı ve sonuçlar yalnızca sessionStorage içinde, bu tarayıcı sekmesinin oturumunda tutulur; sekme kapanınca kaybolabilir. Gerçek öğrenci verisi girilmemelidir.
- Cevap anahtarı istemcide oluşur; bu pilot güvenli sınav sistemi değildir. Merkezi değerlendirmede üretim/puanlama sunucuya taşınmalıdır.
- Teknik-odaklı beşe/ona tamamlama müfredatı henüz uygulanmadı. Rastgele sorular bu tekniklerde ustalık kanıtı sayılmaz.
- Sesli Anzan cihaz konuşmasını kullanır; dil/ses kalitesi platforma bağlıdır. Eğitimci onaylı profesyonel ses kayıtları sonraki fazdadır.
- 14 CZA becerisi ile atölye eşleştirmeleri henüz eğitimci tarafından onaylanmadı.

## Bir sonraki uygulama fazı

1. Parmak / Soroban teknik basamaklarını ve örnek içerikleri eğitimciyle kesinleştir.
2. Kampüs ile tekil öğrenci kimliği ve güvenli rol sözleşmesini tasarla.
3. Merkezi seans, reçete, atama, erişim süresi ve denetim kaydını kur.
4. Öğretmen kontrollü seviye geçişini ve tekrar politikasını doğrula.
5. Veli özeti ve paket erişimini ayrı yetkilendirilmiş akış olarak ekle.

## Doğrulama notu

İşlem üretimi ve puanlama otomatik birim kontrolleriyle sınanır. Kullanıcı bu turda tarayıcı testi istemediğinden görsel/etkileşimli tarayıcı QA yapılmadı. WebMCP ayar okuma ve hazırlama araçları eklendi; destekleyen bir doğrulama bağlamı bulunmadığından canlı kayıt/sözleşme kontrolü doğrulanmış sayılmaz.
