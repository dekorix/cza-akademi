# CZA karma satış ve kayıt modeli — ONAYLI

Karar sahibi: Habip Çelik. Onay: 7 Ekim 2026, kullanıcı talimatı: “tm karma modeli sabitle”.

## Ana akış

Özgün Başlangıç Değerlendirmesi → eğitmen onaylı rapor ve program önerisi → veliye kişisel teklif → ödeme doğrulama → kesin eğitim kaydı → paket kapsamındaki öğrenci/veli erişimleri ve eğitmen ataması.

Değerlendirme girişinde aday öğrenci için mevcut merkezi kimlik mekanizması kullanılır. Satıştan sonra aynı kimlik kesin eğitim kaydına dönüşür; ikinci öğrenci veya geçmiş oluşturulmaz. Değerlendirme öncesi sınırlı giriş, satın alma sonrası tam eğitim erişimiyle karıştırılmaz.

## Satış yolları

| Yol | Kullanım | Geçiş koşulu |
| --- | --- | --- |
| Doğrudan satın alma | Eğitmen tarafından uygunluğu onaylanan standart programlar ve uygun yenilemeler | Onaylı teklif, veli kabulü ve doğrulanmış ödeme |
| Görüşme sonrası teklif | Bireysel destek, özel eğitim ve Karma Profil | Eğitmen incelemesi, görüşmeyle kapsamın belirlenmesi, veli kabulü ve doğrulanmış ödeme |

Otomatik değerlendirme sonucu tek başına paket veya eğitimsel yerleştirme kararı vermez. Rapor eğitimsel kanıtı açıklar; teklif hizmet kapsamı ve fiyatı ayrı sunar. Raporu açmak teklif kabulü değildir.

## Paket ve teklif kuralları

Paket aileleri: Anzan/Soroban, Zihin Gelişim, Bütünleşik Program, Bireysel Destek Programı, LGS/YKS Koçluğu. Mevcut paket kataloğu yeniden kurulmaz; bu aileler mevcut kayıtlarla eşleştirilir.

Teklifte süre, ders/görüşme sayısı, çalışma sıklığı, dijital modüller, eğitmen desteği, raporlama, yeniden değerlendirme zamanı, başlangıç tarihi, toplam ücret ve ödeme planı açıkça gösterilir. Yeni fiyat, indirim veya ödeme sağlayıcısı bu kararla belirlenmiş değildir.

Veli satış öncesi yalnız kendi çocuğuna ait onaylı rapor ve teklif alanına erişir. Öğrencinin satın aldığı modüller ve eğitim alanları kesin kayıttan sonra açılır. Veli, öğrenci ve eğitmen ayrı yetkilerle aynı öğrenci kayıtlarını kullanır.

## Kayıt ve erişim

- Paket seçimi sipariş oluşturur; tek başına eğitim erişimi açmaz.
- Ödeme sunucu tarafında doğrulanır. Havale yetkili kişi tarafından doğrulanır.
- Doğrulanmış ödeme kesin kayıt ve erişimleri bir kez oluşturur; tekrarlanan bildirim çift kayıt üretmez.
- Ödeme ile eğitim başlangıç tarihi ayrı tutulur; erişim süresi onaylı başlangıç kuralına göre hesaplanır.
- Paket sona ermesi, değişmesi veya iptali geçmişi ve raporları silmez. İade, taksit gecikmesi ve iptal erişim politikaları ayrıca tanımlanır; bu karar otomatik tahsilat veya geri ödeme yetkisi değildir.
- Tanıtım/materyal web projesi ayrı kalır. Production, mevcut DB ve yayın hedefleri bu karar kaydıyla değiştirilmez.

## Yönetim aşamaları

Değerlendirme tamamlandı → rapor onayı bekliyor → rapor paylaşıldı → teklif hazırlandı/gönderildi → veli kararı → ödeme bekliyor → kayıt tamamlandı → eğitim başladı. Eğitim geçmişi ve satış geçmişi aynı öğrenciyle ilişkili ayrı kayıtlar olarak izlenir.

## İlk uygulama kabulü

Sentetik öğrenci özgün değerlendirmeyi tamamlar; eğitmen raporu onaylar; yetkili veli teklifi görür ve kabul eder; test ödemesi doğrulanır; aynı öğrenci kaydında doğru modüller ve paneller açılır. Yenileme, tekrar ödeme bildirimi ve bağlantısız veli/eğitmen erişimi kontrol edilir. Kaynak commit'i, çalıştırılmış test ve açılabilir doğru test bağlantısı birlikte teslim edilir.

## Durum

Ürün kararı onaylandı. Uygulama, gerçek ödeme entegrasyonu, runtime testi ve canlı yayın tamamlanmış sayılmaz.

Sıradaki tek uygulama adımı: mevcut öğrenci kimliği, değerlendirme, paket kataloğu ve kayıt/erişim kodlarını bu onaylı akışla eşleştirip eksik ilk bağlantıyı seçmek.
