# Özgün P2 → CZA izole entegrasyon adayı

Taban: doğrulanmış main `a3e3a1437adc20d93c3c55f7091a7322feab9773`, E2 giriş devamı `d229c83f5f4a87f2ad31b832507ebe0eef608941`.
Dal: `integration/cza-unified-preview-20261009`. Eski çalışma klasöründeki kullanıcı değişiklikleri korunmuştur.

Tanıtım Sites uygulaması platform yerine kullanılmadı. Korunmuş özgün P2'nin 79 src dosyası byte düzeyinde aynı; 23 bölüm ve mevcut görsel görevleri korunur. Arşiv `apps/assessment-appdeploy` değişmedi. Önceki çift geçiş ve çeviri koruması mevcut korunmuş kaynakla taşındı; 8. bölüm 7. soru yeni entegrasyonda yeniden üretilmedi, yeni çözüm iddiası yok.

## Uygulama
- `/assessment/p2` içinde özgün runtime; aynı origin `/api/p2-original` köprüsü.
- Ana CZA `authenticatedStudent` / `authenticatedEducator`, mevcut öğrenci ve kurum kimliği, teacher_student_links can_view kullanılır. Yeni öğrenci/geçmiş/kimlik deposu kurulmaz.
- Assessment, attempts, training, learning_records ve learning_evidence mevcut tablolara bağlanır. DB schema/migration/grant değiştirilmedi.
- Yazma ve okuma köprüsü yalnız Neon project `patient-firefly-51111834` üzerinde çalışır. Diğer projeye işaret eden bağlantı reddedilir; rate-limit yazması dahi target guard sonrasındadır.
- Runtime build root build'e dahil; üretimde normal Cloudflare plugin kullanılır. Opt-in yerel Node modu yalnız ortam ağ proxy'siyle geliştirme içindir, uzak Worker kanıtı yerine geçmez.

## Çalıştırılan kontroller
- Yeni sentetik all-skip oturumu `8940aef7-2cdf-45ee-a75b-f0bc6c410b0c`: 30 gönderim HTTP200, tamamlandı. Bu içerik/başarı ölçümü değildir.
- Exact body tekrarında aynı yanıt; çift kayıt yok. Assessment/training öğrenci ve oturum UUID'leri aynı; 30 attempt, bir learning_record, bir learning_evidence.
- Girişsiz HTTP401, cross-origin yazma403.
- TypeScript ve bütünleşik build PASS. İlgili bridge/P2 sözleşmeleri 15/15 PASS.
- Uzak gerçek Worker aynı sentetik oturumu HTTP200 okudu. `/api/student-history` ve `/api/core/history` HTTP200, aynı training UUID kayıtları görünür.
- Öğrenci oturumundan eğitmen raporu401; olmayan başka oturuma403.
- Uzak Chromium masaüstü/mobile: aynı completed record, 23/23, pageerror yok, iframe yenilemede tekrar açılır. Ortam proxy CA'sı özel test Chromium NSS deposuna eklenmiş; TLS doğrulaması kapatılmamış.

- Uzak Worker POST ile yeni aktif sentetik değerlendirme `1519f3ad-cbad-4f1b-b69a-7d8132f82e5a` açıldı (HTTP200); Chrome masaüstü/mobile ilk bölüm, 23 bölüm yol haritası ve yenilemede aynı oturum gösterildi. pageerror yok.

## Yayım
Yalnız yeni Worker `cza-p2-integrated-isolated`; mevcut original, ana staging ve production değiştirilmedi. Yeni Worker DATABASE_URL secret'ı mevcut sentetik bağlantıyla bağlandı; mevcut sır değerleri değiştirilmedi, raporda yok.

Platform: https://cza-p2-integrated-isolated.cza-staging-habip.workers.dev/
P2: https://cza-p2-integrated-isolated.cza-staging-habip.workers.dev/assessment/p2

Bu bağlantılar genel oturum girişini atlatmaz. Tarayıcı testinde eski izole test girişinin ürettiği mevcut canonical öğrenci session cookie'si yalnız otomasyon bağlamına aktarıldı; kullanıcı tarayıcısında otomatik giriş vaat edilmez.

## Açık engel / kabul sınırı
Mevcut ana educator auth default trusted proxy HMAC ingress bekliyor; yeni izole Worker'da bu ingress bağlı değil. Mevcut Neon alternatifi yalnız ana staging origin/provider'a sabitlenmiş. Sentetik educator auth_user_id'leri hardcoded local educator ID ile eşleşmiyor. Gerçek bağlı eğitimci girişi `/api/educator-auth` HTTP403. Öğretmen raporu ve düğmeden PDF indirme yeni entegre ortamda ÇALIŞTIRILMADI; eski T5/PDF kanıtı bu yeni entegrasyon için PASS sayılmaz. Gereken en dar sonraki çalışma sentetik kurumun mevcut educator kimliğine güvenilir girişin ayrı test Worker'ına bağlanmasıdır; DB yetkisi genişletmek veya ana staging parolası almak çözüm değildir.

CENTRAL_READY verilmedi; tüm entegrasyon kabulü PENDING. Genel/faz yüzdesi hesaplanmadı. Kapsam sapması YOK.
