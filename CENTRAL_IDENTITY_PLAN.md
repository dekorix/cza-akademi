# CZA tek kimlik ve kayıt kararı

Ana ürün, panel ve pedagojik ilkeler için [CZA Ana Mimari](docs/CZA_MASTER_ARCHITECTURE.md) belgesini esas alın. Bu belge yalnız merkezî kimlik ve kayıt bağlantısının uygulama kararlarını açıklar.

## Karar

**Neon Learning Core**, Çelik Zihin Akademisi için öğrencinin, eğitimcinin, oturumların, çalışma sonuçlarının ve eğitimci raporlarının tek kayıt otoritesidir.

Google Apps Script tabanlı eski Kampüs; ilk değerlendirme, eski çalışma kayıtları ve geçiş verisi için korunur. Yeni öğrenci oturumu veya yeni CZA çalışma kaydı iki sisteme ayrı ayrı yazılmaz. Geçiş tamamlanana kadar Google Kampüs yalnızca denetlenmiş, tek yönlü bir kaynak olarak kullanılır.

## Neden bu karar

- CZA uygulaması hâlihazırda öğrenciyi ve çalışma seanslarını Neon Learning Core üzerinden başlatıyor.
- Canlı öğrenci ucu oturumsuz isteği `401 unauthorized` ile reddediyor.
- Eğitimci rapor ucu oturumsuz isteği `401 educator_session_required` ile reddediyor.
- Bu davranış, iki uçta da merkezi oturum doğrulamasının bulunduğunu gösterir.

## Kimlik modeli

Her öğrenci için tek bir `student_id` bulunur. Aşağıdaki değerler bu öğrenciye bağlı tanımlayıcılardır; öğrenci kimliği değildir:

| Alan | Amaç |
| --- | --- |
| `student_id` | Neon içinde değişmeyen ana kimlik |
| `campus_student_code` | Öğrenci/Veli Kampüsü kodu, ör. `582946` |
| `login_username` | CZA öğrenci giriş adı, ör. `zeynep7` |
| `legacy_reference` | Eski sistemden gelen geçiş anahtarı, ör. `ZC-007` |

Eğitimciler için aynı ilke geçerlidir: tek `educator_id`, kurum kodu ve rol bilgisi Neon’de tutulur.

## Sunucu sözleşmesi

CZA tarayıcısı yalnız kendi `/api` yollarına konuşur. Bu yollar Neon Learning Core’a sunucu tarafından istek iletir. Neon aşağıdaki işlevleri sağlamalıdır:

1. `student.login` — kullanıcı adı ve PIN ile öğrenci oturumu açar.
2. `student.me` — öğrenci oturumunu doğrular.
3. `exercise.start`, `exercise.attempt`, `exercise.interaction`, `exercise.finish` — mevcut çalışma kayıt akışı.
4. `educator.login` — eğitimci kodu ve PIN ile eğitimci oturumu açar.
5. `educator.me` — eğitimci oturumunu doğrular.
6. `educator.studentReport` — yalnız yetkili eğitimcinin, yetkili olduğu öğrenci için rapor almasını sağlar.

Eğitimci oturum anahtarı tarayıcıda metin alanına yapıştırılmaz. CZA sunucusu, öğrenci oturumundaki gibi HttpOnly ve Secure çerez kullanır.

## Geçiş sırası

1. Neon’de öğrenci ve eğitimci kimlik tabloları ile tanımlayıcı eşleştirme tablosu doğrulanır.
2. Eski Kampüs kayıtları tek seferlik, denetlenebilir içe aktarma ile `student_id` değerlerine bağlanır.
3. Örnek kontrol: `582946`, `zeynep7` ve `ZC-007` aynı `student_id` değerine çözülür.
4. Neon eğitimci giriş ve rapor uçları uygulanır.
5. CZA eğitimci ekranı gerçek giriş ile açılır; elle anahtar girişi kaldırılır.
6. Öğrenci → seans → soru kaydı → eğitimci raporu zinciri gerçek test hesabıyla doğrulanır.
7. Başarılı doğrulamadan sonra kaynak koddaki geçici `582946 → ZC-007` dönüşümü kaldırılır.

## Yayın için gerekli dış bilgi

Bu planın uygulanması için Neon projesine yetkili erişim veya aşağıdaki mevcut servis sözleşmesi gerekir:

- eğitimci giriş isteği ve yanıtı,
- eğitimci rapor isteği ve yanıtı,
- öğrenci tanımlayıcı eşleştirme tablosu ya da RPC adı,
- geliştirme/test üretim ayrımı için Neon proje ve dal bilgisi.

Bu bilgiler olmadan CZA tarafında yeni bir kimlik sistemi uydurulmaz.
