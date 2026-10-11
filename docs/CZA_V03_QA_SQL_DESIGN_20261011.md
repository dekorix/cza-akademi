# V03 QA runtime: uygulama öncesi SQL tasarımı

PR #89; resmi emir: https://github.com/dekorix/cza-akademi/pull/89#issuecomment-6107427809

**DURUM: tasarım ve yerel güvenlik kanıtı hazır; canlı migration/PIN/modül/atama uygulanmadı. V03_ACCEPTED=NO.** Son kullanıcı mesajı yeni migration uygulamasından önce Baş Mimar onayı istiyor. Bu dosya o onay için somut kapsamdır.

## Kilitli hedef ve mevcut kaynak

Yalnız `patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic` ve Worker `cza-v01-isolated-synthetic-20261010`. Mevcut öğrenci `20000000-0000-4000-8000-000000000001`, kullanıcı `10000000-0000-4000-8000-000000000001`, kurum `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`. Öğrenci sayısı 2; bu öğrencinin training_sessions sayısı 8; training_recipes sayısı 0; PIN özeti NULL. V02'nin eski kayıtları korunur.

Windows Desktop Commander bağlantısı ve mevcut Wrangler OAuth hesabı gerçekten doğrulandı. QA Worker aktif version snapshot `6c7b0d36-5406-4d7e-b9af-7005059a49bd`, kaynak notu `1abf1e257c106809fbf344846dc975c82ca62a90 / b76e3b8c75ab72c429e9fb741a272058f6e4a5df`. Bu, V03 deploy kanıtı değildir. Worker secret isimleri DATABASE_URL ve CZA_TRUSTED_EDGE; değerleri okunmadı. Cloud doğrudan Neon bağlantısı proxy 403 ile engellendi; Neon connector salt-okunur envanteri erişilebilir. Windows'tan minimum runtime role gerçek bağlantı, yalnız stdin/bellekte geçici credential aktarımıyla doğrulandı: doğru project/branch/database; students ve training_recipes doğrudan okumaları 0 satır. Canlı Worker'ın üç öğrenci API'si sahte student/academy/role başlıklarıyla 401 döndü; `live-preflight.json` kanıtı. Kalıcı remote parola dosyası yazımı otomatik güvenlik incelemesince reddedildi ve oluşturulmadı; geçici süreç bellek yöntemi başarılı oldu. Repo/raporda sır yok.

## Salt-okunur erişim

Tam SQL: [db/qa/v03-student-read.sql](../db/qa/v03-student-read.sql). SHA256: `dfe16505dedcdd16b835ba8c5570ae2106f8a6760d77eaf8a18875a17af7b118`.

`public.cza_v03_qa_student_read(text,text,uuid,timestamptz) RETURNS jsonb`:

- `STABLE SECURITY DEFINER`; owner `cza_t5_test_owner`; sabit `search_path=pg_catalog,public,pg_temp`; tüm tablo adları schema-qualified.
- Hem migration hem fonksiyon project/branch/database hedefine kilitlidir. Session token SHA256 özeti dışında kimlik parametresi yoktur. Yetki istemci rol/kurum başlıklarından alınmaz.
- `cza_touch_authenticated_student` sözleşmesindeki token, revoked/expiry, student/user/academy eşleşmesi, aktif öğrenci/kullanıcı ve öğrenci rolü denetlenir. Ek olarak aynı tek QA Student ID ve `is_demo=true` şarttır. Fonksiyonun kendisi last_seen dahil veri yazmaz; mevcut HTTP oturum doğrulayıcı kanonik last_seen güncellemesini sürdürür.
- Mevcut dashboard (5), assignment GET/list/launch okumaları (3), öğrenme profili (8), coaching bridge (1): toplam 17 sabit SELECT dalı. Dinamik SQL/EXECUTE yok. Mevcut projection ve response mapper'ları korunur. Kaynak→SQL generator ve hash kayıt defteri sorgu drift'inde fail closed davranır.
- Recipe UUID yalnız kendi öğrenci/kurum filtresinin yanında kullanılır. Bilinmeyen projection veya yetkisiz oturum SQLSTATE 42501; başka atama boş sonuç.
- PUBLIC EXECUTE kaldırılır; yalnız mevcut `cza_v01_app_runtime_min` EXECUTE alır. Tablo GRANT, rol üyeliği, RLS policy, BYPASSRLS, row_security değişikliği yok. Runtime DDL/superuser verilmez.

## Gerçek giriş

Aynı migration ikinci bir dar fonksiyon ekler: `public.cza_v03_qa_student_login(text,text,text)`. Bu bir okuma fonksiyonu değildir; mevcut `cza_student_login` ile PIN doğrular, başarısız giriş sayacı/kilitleme ve kanonik student_sessions kaydını korur. Yalnız aynı aktif demo öğrenciye ve QA hedefine izin verir; aynı owner/search_path/EXECUTE sınırlaması vardır. Genel `cza_student_login` EXECUTE yetkisi genişletilmez.

Normal `/api/core` login POST, aynı origin/CSRF/rate limit ve mevcut HttpOnly/Secure/SameSite cookie akışını kullanır. Token yanıt gövdesine, repo veya rapora yazılmaz. QA dışındaki giriş upstream akışı ve doğrudan okuma davranışı korunur. Token/cookie enjeksiyonu ile PASS üretilmez.

## Onay istenen QA hazırlığı: kesin satır etkisi

İncelenebilir çalıştırıcı: [prepare-v03-fixture.mjs](../scripts/qa/prepare-v03-fixture.mjs). Açık `CZA_V03_QA_PREP_APPROVED=1`, ayrı QA owner URL ve repo dışında özel fixture yolu olmadan çalışmaz. Önkoşul uyuşmazlığında transaction geri alınır; mevcut PIN/modül/atama üzerine yazılmaz.

1. **1 mevcut users satırı**: yukarıdaki öğrenci kullanıcısının yalnız NULL `pin_hash` alanına bcrypt özeti ve `updated_at` yazılır. PIN yalnız özel fixture içinde tutulur; sohbete/GitHub/rapora konmaz. Hiç öğrenci/user INSERT yok.
2. **1 modules INSERT**: `code=finger_read`, `name=Parmak Okuma`, `category=mental_arithmetic`, `is_active=true`, `created_at=DEFAULT`. Kod zaten varsa işlem durur; eski modül güncellenmez.
3. **1 training_recipes INSERT**: yeni recipe UUID; mevcut student/academy; mevcut aktif, aynı kurumda can_view bağlantısı olan sentetik educator `10000000-0000-4000-8000-000000000002`; `source=teacher_assignment`, `module_code=finger_read`, `name=V03 QA · Parmak Okuma`, tek sentetik yönerge, mevcut `defaultRecipeSettings('finger_read')` çıktısı, `is_active=true`, `starts_at=now()`, `expires_at=NULL`, client request UUID `90000000-0000-4000-8000-000000000088`, mevcut create akışıyla aynı request hash. Diğer alanlar kanonik DEFAULT/NULL; FK ve mevcut unique/check kuralları korunur.

Tercih edilen mevcut educator assignment API kullanıcı/teacher_student_links ve training_recipes tablolarına doğrudan erişiyor; runtime RLS uyuşmazlığı bu yolu da etkiliyor. Tasarım yeni educator yazma yetkisi açmaz. Yukarıdaki kayıt **onaylı QA bootstrap** olarak raporlanacaktır; öğretmenin UI'da gerçekten create yaptığı iddia edilmeyecektir. Baş Mimar bootstrap yerine gerçek educator API kullanımını şart koşarsa bu ayrı somut yetki engelidir.

Migration schema etkisi: yalnız 2 yeni public fonksiyon + bu iki fonksiyonun sınırlı EXECUTE ACL'si. Tablo/index/policy/eski fonksiyon değişikliği yok. Login ve HTTP rate limiter kendi beklenen oturum/sayaç kayıtlarını yazacaktır; V04 çalışma/attempt/session üretimi bu görevde yapılmaz. Eski 8 training session ve tüm eski assessment/attempt/observation/audit/learning kayıtları korunur. 45 public tablo için yalnız sayım+özet fingerprint başlangıç kanıtı `docs/evidence/v03-qa-design/neon-before.json` içindedir; sır veya ham öğrenci kaydı içermez.

## Kanıt ve uygulama kapısı

- Yerel 41/41 test: önceki 39 test + 2 yeni güvenlik testi. PGlite içinde 17 gerçek SQL dalı, RLS altındaki runtime doğrudan okuma reddi, başka recipe/kurum/öğrenci, revoked/expired/inactive/role/demo ve yanlış branch reddi; bilinmeyen sorgu reddi; runtime write yetkisiz. Yerel fixture DB adı postgres olarak uyarlanmıştır; canlı Neon minimum rol PASS değildir.
- Giriş/upstream/rate limit/cookie sınırları için ek 20/20 yerel regresyon geçti. TypeScript ve tam build geçti. Chrome 154 masaüstü 1440×900 / mobil 390×844 mevcut mock arayüz regresyonu geçti; gerçek login veya V03 kabulü sayılmaz.
- Canlı migration, PIN başlangıcı, modül, atama ve V03 Worker deploy yapılmadı. Gerçek login→3 API→Chrome→reload/relogin→Neon readback→yetki reddi ve tam HEAD CI/Worker eşleşmesi kalan iştir.
- AGENTS.md'de koşullu istenen governance/inventory test dosyaları ve inventory script'i bu korunan #87 tabanlı dalda bulunmuyor; çalıştırma denemeleri MODULE_NOT_FOUND, PASS sayılmadı. Kapsam dışı main dosyaları taşınmadı. Mevcut V03 UI, public içerik, eski migration'lar ve profil/coaching projection kaynakları byte olarak değiştirilmedi.

Onaydan sonra migration owner transaction içinde yalnız kilitli QA'ya uygulanır; runtime role ile canlı SQL/HTTP güvenlik kontrolleri, aynı öğrenciyle normal login ve atama readback çalışır. Eski tablo fingerprint'leri beklenen dar kullanıcı/oturum/rate-limit değişimleri dışında karşılaştırılır. Başarısızlıkta QA Worker eski version'a döner; yeni fonksiyon EXECUTE geri alınabilir. Eski kayıt silinmez; staging/production/main/PR73/PR87 değişmez.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=V01–V07 2/7 QA kabul (%28,6); V03 kabul yok
TAMAMLANAN=erişim ve NULL PIN kanıtı; somut SQL/fixture tasarımı; yerel güvenlik/regresyon/build/Chrome
KALAN=Baş Mimar uygulama onayı ve gerçek QA E2E/CI/Worker eşleşmesi
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=bu SQL ve tam satır etkili QA hazırlığının Baş Mimar onayı
