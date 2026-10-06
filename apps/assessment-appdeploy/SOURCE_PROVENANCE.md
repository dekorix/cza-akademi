# CZA Başlangıç Değerlendirmesi · AppDeploy Kaynak Snapshotı

Bu klasör, Çelik Zihin Akademisi'nin ekranda **“Doğru değerlendirme, doğru gelişim düzeyinden başlar.”** başlığıyla görünen Başlangıç Değerlendirmesi uygulamasının AppDeploy kaynak snapshotıdır.

- Kaynak uygulama ID: `cza-degerlendirme-hl4a5d`
- Kaynak AppDeploy sürümü: `1790749888495`
- Kaynak canlı adres: https://cza-degerlendirme-hl4a5d.v2.appdeploy.ai/
- GitHub hedef repo: `dekorix/cza-akademi`
- GitHub klasörü: `apps/assessment-appdeploy/`
- Snapshot dosya sayısı: 93
- Aktarım tarihi: 2026-10-06

## Neden ayrı klasörde?

Bu uygulama React/Vite + AppDeploy backend mimarisinde geliştirilmiştir. Ana CZA uygulaması farklı runtime ve merkezi veri mimarisi kullanır. Kaynak önce eksiksiz korunur; ardından öğrenci kimliği, auth, değerlendirme oturumları, raporlar ve özel eğitim motorları kontrollü biçimde ana CZA katmanına taşınır.

Bu klasör bir ölü arşiv değildir; **entegrasyon kaynağıdır**. Ancak ana CZA build'i buradaki eski runtime dosyalarını doğrudan derlemez.

## Yeni kaynak kuralı

Bu snapshot sonrasında Başlangıç Değerlendirmesi için kaynak gerçekliği GitHub olacaktır. AppDeploy üzerinde paralel ve kayıtsız kod değişikliği yapılmamalıdır. AppDeploy canlı uygulaması entegrasyon tamamlanana kadar referans/kabul ortamı olarak korunur.
