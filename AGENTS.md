# CZA ürün sınırı ve aktif görev

Bu depo büyük CZA eğitim platformudur. Sıfırdan ürün veya alternatif başlangıç değerlendirmesi üretme.

## Kullanıcının onayladığı akış (7 Ekim 2026)

Başlangıç Değerlendirmesi öğrenci girişinin ilk merkezidir. Öğrenci buradan mevcut merkezi CZA kimliğiyle büyük platformun öğrenci paneline ve çalışma merkezine geçer. Değerlendirme sonuçları, geçmiş, eğitmen raporu ve Student Learning Profile aynı öğrenciye aittir. İkinci öğrenci veya geçmiş sistemi kurma.

Özgün değerlendirme kaynağı `apps/assessment-appdeploy/` altında korunur. Ekranları, görselleri, etkinlikleri, soruları ve hesaplamaları yeniden üretilmiş alternatiflerle değiştirme. Kaynak manifesti tarihsel snapshot kimliğidir; güncel çalışan yayın kanıtı değildir.

Tanıtım, materyal sitesi ve kütüphane web projesi ayrı üründür. Benzer ad veya alan adına dayanarak bu depoyu o projenin yerine yayımlama. Kullanıcının bu ayrım kararı eski canonical B notlarından daha yenidir.

## Yayın ve kaynak sınırı

- GitHub main güncel depo kaynağıdır; her iş başında SHA'yı doğrula.
- `.openai/hosting.json` içindeki kimlik yalnız yapılandırmayı kanıtlar; doğru ürünün yayınlandığını kanıtlamaz.
- PR #58 ile B Sites hedefine yapılan değişiklik, 7 Ekim ürün ayrımı karşısında açık eşleme sorunudur. Otomatik geri alma veya başka hedefe retarget yapma. Önce mevcut kaynak/build/deployment eşleşmesini kanıtla.
- Staging Worker adresi de son main'in yayını olduğu doğrulanmadan güncel preview diye sunulamaz.
- Production'a yalnız açık kullanıcı yetkisiyle geç. Öğrenci akışını, DB yetkilerini ve mevcut yayınları bu görev için değiştirme.
- Kod değişiklikleri ayrı dal, hedefli test ve PR üzerinden ilerler; main'e doğrudan yazma.
- Dal ayrımı aynı yayın hedefini veya veritabanını izole etmez. Ayrı web projesinin checkout, repo, proje kimliği ve runtime hedefi ayrıca ayrılmalıdır.

## Aktif teslim

Özgün değerlendirmeden giriş → aynı öğrenci kimliği → CZA panel/çalışma → cevap ve tamamlama kaydı → geçmiş → yetkili eğitmen → rapor/PDF. Yenileme, çift gönderim ve yetki izolasyonu doğrulanır. Kapanmış testleri somut regresyon olmadan yeniden açma. LGS/YKS, veli paneli ve AI öneri motoru kapsamdan çıkarılmaz.

Tamamlanma: kalıcı kaynak commit'i, çalıştırılmış akış kanıtı ve kullanıcının açabileceği doğru test bağlantısı birlikte gerekir. HTTP 200 veya dosya varlığı tek başına PASS değildir.
