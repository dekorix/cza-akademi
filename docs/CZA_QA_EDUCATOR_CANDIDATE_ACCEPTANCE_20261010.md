# QA eğitmen girişi ve kayıt öncesi aday başlangıcı — 10 Ekim 2026

## Sonuç ve kabul sınırı
İstenen beş ölçüt izole QA kapsamında karşılandı: gerçek sentetik eğitmen girişi, oturum/kurum yetkisi, aday başlangıcı, candidate/cycle/session sürekliliği, Chrome/API/Neon bağımsız kayıt eşleşmesi.

Test profili **SP-ATTN (Dikkat / yürütücü işlevler), kayıt öncesi eğitmen gözetimli akış**. Chrome ilk görevi `Değerlendirilemedi` olarak kaydetti ve ikinci göreve geçti; bu pedagojik başarı/puan testi değildir. 23 bölümlü özgün P2 tamamlanması veya PDF bu görevde çalıştırılmadı. Önceki T5 kabulü yeniden açılmadı.

QA bağlantısı (giriş gerektirir):
https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev/cza-degerlendirme/?profile=SP-ATTN

## Kaynak
- CZA tabanı: `8d4273085624a26cdf7ff591533c72cd44e484de`; doğrulanmış main atası `a3e3a1437adc20d93c3c55f7091a7322feab9773`.
- Mevcut candidate/cycle ve devam etme kodunun kaynağı PR #73 dalı `957fa1b8bdcc8d1a6da40c2b22ad90d0cdd98a01`. Altı ilgili API/public dosyası taşındı; aynı dört statik dosyanın `cza-degerlendirme` kaynak kopyası eşitlendi. Bu eski dalın governance belge silmeleri taşınmadı.
- Ayrı dal: `integration/qa-candidate-auth-20261010`. Hiçbir main merge/push veya staging/production dağıtımı yapılmadı. Yeni değerlendirme/question bank üretilmedi; özgün P2 ve arşivi korunur.

## Kanıtlanan kök neden ve düzeltme
QA Worker'da önce yalnız DATABASE_URL / CZA_TRUSTED_EDGE bağlıydı; kaynak Neon giriş yolu staging origin/provider'ına sabitti. QA origin ve gerçek sentetik Neon Auth endpoint'i için açık `neon-qa` modu eklendi. Staging'in normal `neon` / signed proxy yolları korunur; QA mevcut gerçek Neon Auth session'ını doğrular, canonical `users` kaydını provider ID ile tekil seçer ve kurumunu DB'den alır. Gövde boyutu, origin, sahte rol başlıkları, expiry, rate-limit ve provider logout kontrolleri korunur. QA parola reseti kapalıdır; mevcut parolalar değiştirilmez.

İlk parola testi provider'da 200, QA'da 401 idi. Gerçek Worker sorgusu şunu kanıtladı: QA, sentetik projenin **farklı Neon dalını** kullanıyordu; yeni test eğitmeni diğer dalda oluşturulmuştu. Eksik canonical eşleme QA'nın gerçek dalına eklendi. Runtime bağlantısı veya rolü değiştirilmedi. Auth provider'ın sentetik dalı ve QA verisinin sentetik dalı ayrı olup aynı provider auth ID canonical kullanıcıya bağlanır.

**İzin verilen proje:** `patient-firefly-51111834`.
**QA veri dalı:** `br-withered-queen-b15ltb40` / `cza_t5_synthetic`.
**QA runtime SQL rolü:** `cza_v01_app_runtime_min`.
**Sentetik Auth provider dalı:** `br-curly-glitter-b1s8z9lw`.

QA guard yalnız tam QA hostname'i + sabit sentetik provider URL'si + doğru project/dal birleşimini kabul eder. Farklı project/dal rate-limit yazması veya provider çağrısından önce reddedilir. QA special API önceden hazırlanmış şemayı kullanır; runtime CREATE/ALTER/INDEX çalıştırmaz.

Benzersiz indeks değiştirilmedi, eksik indeks işi yeniden açılmadı. Migration veya GRANT uygulanmadı. Mevcut sır değerleri değişmedi. Yalnız QA'nın auth mode/provider URL değişkenleri eklendi. Başta eklenen, son tasarımda gerekmeyen yeni HMAC secret'ı kaldırıldı; daha önce var olan iki secret korundu. Provider hesabı, canonical educator ve negatif fixture kayıtları yalnız sentetik veri olarak oluşturuldu; öğrenci oluşturulmadı. Fixture kurulumunda mevcut owner erişimi kullanıldı; Worker owner rolüne yükseltilmedi.

## Korunan kimlikler
| Kimlik | Chrome → Worker API → Neon |
| --- | --- |
| candidateId | `795c3171-876d-475d-a85b-7183f3ed593a` |
| cycleId | `13b484fd-56a0-461b-821c-f305b775da4b` |
| sessionId | `190f03b9-7e94-4167-8958-fb0ac25673af` |
| academyId | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` |
| canonical educator ID | `17114480-0fbd-4468-ab57-06d559579c07` |
| provider auth ID | `99963cb7-f9e6-4c1c-9737-b9893785ba8b` |

Aday kayıt öncesidir: `student_id=NULL`; metadata `source=EDUCATOR_PRE_ENROLLMENT`. Candidate, cycle, session ve kurum/eğitmen eşleşmesi server/DB kaydıyla doğrulandı. Aynı aday/çevrim için tekrar başlatma 200/resumed ve aynı session döndürdü; tek değerlendirme ve tek ilk-görev kaydı vardı.

## Çalıştırılmış kabul kanıtı
- Gerçek Neon credential sign-in: 200; hatalı parola 401. Mock provider veya sahte authenticated cookie kullanılmadı.
- HeadlessChrome/153.0.8010.0: UI giriş formu → doğrulanmış eğitmen → aday formu → create201 → ilk görev attempt200 → yenilemede ikinci görev ve üç aynı kimlik. Pageerror yok. Mobil 390px görünüm fotoğrafı alındı; bağımsız mobil cihaz girişi testi değildir. TLS doğrulaması kapatılmadı; ortam CA'ları ayrı Chromium NSS trust store'a eklendi. Chromium paketinin varsayılan disable-web-security bayrağı kaldırıldı; gerçek Origin kontrolü çalıştı.
- **14/14 API–Neon kontrolü PASS:** kimlik/kurum; Chrome–Worker tuple eşliği; tekrar başlatmada aynı session; Neon kaydı ve tek cevap; browser cookie'sinin gerçek, süresi geçmemiş Neon Auth session satırı; girişsiz401; foreign origin403; forged-role401; aynı kurum başka eğitmen kaydı404; başka kurum kaydı404; provider logout200; eski cookie401; çıkıştan sonra kayıt erişimi401; kaydın korunması.
- API testinin ilk koşusunda forged-role için 403 bekleyen assertion 401 ile durdu. Ürün doğru biçimde erişimi reddediyordu: canonical auth null döndürür ve endpoint 401 verir. Assertion bu sözleşmeye düzeltildi; erişim gevşetilmedi. Önceden geçen API kontrolleri tekrar çalıştırılmadan kalan kısım devam ettirildi; bu ayrım JSON kanıtında korunur.
- Auth/request regression grubu **43/43 PASS**; son QA izolasyon dosyası **7/7 PASS** (ilk beşi grupta da yer alır; toplam 45 benzersiz kontrol). Son iki kontrol farklı dalın reddi ve başarısız provider revocation'ın 503 olarak korunmasıdır. TypeScript ve bütünleşik build PASS.
- DB salt okunur yetki kanıtı: runtime superuser/CREATE ROLE/CREATE DB/BYPASS RLS değil; public schema CREATE ve users INSERT yetkisi yok; users SELECT ve değerlendirme INSERT yetkisi var. Hiçbir yetki artırılmadı.

Kanıt dosyaları: `docs/evidence/qa-educator-candidate-20261010/`. Bunlarda parola, token, cookie, bağlantı dizesi veya secret değeri bulunmaz. Test kimlik bilgileri Git deposuna eklenmedi.

## Dağıtım ve kalan kapsam
Yalnız `cza-v01-isolated-synthetic-20261010` güncellendi. Ana staging last-modified başlangıç ve sonuçta aynı: `2026-10-10T11:10:24.386745Z`; P2 isolated eski Worker da aynı `2026-10-10T08:44:05.8787Z`. Önceki QA sürümü `7b34a8de-eda4-48d0-92d6-6b926402b4ba`, geri dönüş referansıdır; otomatik rollback yapılmadı. Son commit/tree, Worker version ve build SHA256 ayrı deployment receipt ile checkpoint edilir.

GENEL PROJE İLERLEME %: bütünleşik ölçüm olmadığından hesaplanmadı.
MEVCUT FAZ İLERLEME %: bu görevdeki beş QA kabul ölçütü 5/5 (%100).
TAMAMLANAN: bu dar QA eğitmen/aday başlangıcı kabulü.
KALAN: bu beş ölçüt içinde yok; 23 bölümlü P2 uçtan uca ürün kabulü, rapor/PDF ve ana staging entegrasyonu ayrı kapsamdır.
KAPSAM SAPMASI=YOK.
SIRADAKİ TEK ADIM: ürün sahibinin bu izole kabul checkpoint'ini incelemesi; ana staging'e geçiş yetkisi çıkarılmaz.
