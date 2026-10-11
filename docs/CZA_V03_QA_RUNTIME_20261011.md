# V03 izole QA gerçek oturum teslimi

V03_ACCEPTED=NO. Nihai kabul CZA Baş Mimarı'na aittir. Mevcut PR #89 OPEN/DRAFT; Issue #88 dışında ürün geliştirme yok.

## Uygulanan onaylar ve sınır

Baş Mimar önce a638215 tasarımına “Dar QA paketini onaylıyorum”, ardından b42b1a9 ek oturum tasarımına “Dar ek oturum paketini onaylıyorum” yanıtını verdi. Her iki SQL paketi kendi kilitli QA transaction'ında uygulandı. Toplam dört dar SECURITY DEFINER fonksiyonu; owner cza_t5_test_owner, sabit search_path, PUBLIC EXECUTE yok, yalnız cza_v01_app_runtime_min EXECUTE. Read ve session identity STABLE/salt okunur. Login mevcut kanonik PIN/session akışını, revoke yalnız aynı sentetik öğrencinin mevcut kanonik çıkışını kullanır. Genel touch/revoke/login EXECUTE hâlâ kapalı. Tablo/rol/RLS/policy/BYPASSRLS yetkisi genişletilmedi.

Hedef yalnız patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic ve cza-v01-isolated-synthetic-20261010 Worker'ıdır. Aynı Student ID 20000000-0000-4000-8000-000000000001. Yeni öğrenci yok; kullanıcı7/öğrenci2. Mevcut NULL PIN özeti yalnız onaylanan kullanıcıda başlatıldı; gizli fixture repo dışında tek kullanıcı ACL'siyle korundu. PIN/token/hash/password raporlanmadı.

Bir finger_read modülü ve mevcut can_view bağlı sentetik educator adına tek teacher_assignment bootstrap kaydı vardır: recipe361ee0f6-26e2-4484-b9f9-7a88d14fb9f4. Kanonik API query ve öğrenme profili aynı kaydı gösterir. **Bu onaylı bootstrap'tır; educator UI/API create PASS değildir.** Öğrencinin atanmış çalışmasını görme ve launch sözleşmesi test kapsamındadır; çalışma motorunda soru/attempt üretimi V04'tür.

## Gerçek ve yerel kanıt

İlk üç gerçek Chrome koşusunda normal login200 fakat dashboard403 görüldü. Eski session touch/revoke ACL açığı doğrulandı; başarısız JSON'lar korunur. Ek onaylı session sarmalayıcıları bu engeli giderdi.

Gerçek Chrome154.0.8037.98, desktop1440×900/mobile390×844: normal form girişi; Secure/HttpOnly/SameSite cookie; dashboard/profile/assignment list/detail; aynı Student ID, tek atama, eski8 session/5record/5evidence; gerçek rota başlığı; refresh/relogin; durable logout ve sonrası401; foreign recipe404; sahte student/academy/role selector kendi kimliği dışına çıkamaz; öğrenci educator olamaz; sıfır pageerror/yatay taşma. Mock/interception/cookie injection yok. İlk tam koşu40/40 geçti. API launch200/kendi recipe ve foreign launch404 eklendi; son gerçek koşu44/44 geçti. JSON ve ilk tam koşunun orijinal boyutlu ekran görüntüleri docs/evidence/v03-runtime altındadır. Launch sözleşmesi eğitim session/attempt oluşturmaz.

Canlı minimum rol kanıtı12/12: doğrudan students/recipes RLS0 satır; yanlış token özeti session identity boş; genel touch/revoke EXECUTE42501; tabloda UPDATE WHERE false42501; bilinmeyen session logout idempotent; eski değerlendirme beş statik JS dosyası HTTP byte eşitliği. Oturum materyali owner sorgusuyla okunmadı.

Yerel44/44, TypeScript ve secret-free CI/build/mock desktop/mobile başarılı. Ek canonical security/account15 geçti. Eski f4-login-workers-runtime testi esbuild bağımlılığı bulunmadığından MODULE_NOT_FOUND; PASS sayılmadı. Koşullu governance/inventory dosyaları korunan87 tabanında yok; kapsam dışı kaynak taşınmadı.

## Veri ve kaynak korunumu

45 public tablo:40 fingerprint değişmedi. Yalnız users (onaylı PIN/login alanları), modules (+1), training_recipes (+1), student_sessions (gerçek login/revoke) ve api_rate_limit_windows beklenen değişti. Eski56 student_sessions özeti8b28a12481e6ecf995d9e9e1f5e2b678 aynıdır. Eski8 training_sessions, assessment/attempt/observation/audit/learning kayıtları aynı. RLS policy özeti684c16779e665bf33340fd2eee073b63 aynıdır. Role super/BYPASSRLS/createDB/createRole/authenticated üyeliği yok.

V03 UI3a8514d'den beri byte aynı; public/eski migration/profil/coaching projection kaynakları87 ile aynı. PR73 HEAD5011469f8f9afa18c020b0ce88506059a711cf99; PR87 HEADbb2ef9657e88a1de5343d38984502fdc3e5d8f13/tree26b03af0069ac1d20ddb84dfbcb39a021bae90cd; ata zinciri73+6 korunur. Main merge/production/ana staging/rebase/force-push yok. Ana staging deployments JSON önce/sonra eşittir.

## Dağıtım ve gerçek sınırlama

Gerçek test edilen QA Worker version d439fee2-9bd9-495a-9d8a-b8338feae25f. Dağıtım source62bc61f4e24f3d11f8c1ff514e61f105cb0a62c1/tree0e99b02f559aaff5365c26281ad37f49699b265a; exact source CI38132583947 SUCCESS. Windows clone FF, build ve Wrangler --keep-vars deploy başarılı. Mevcut secret binding değerleri okunmadı; QA dışı dağıtım yok.

**Worker byte source readback DOĞRULANAMADI.** Mevcut authenticated Wrangler/C3 indirme girişimleri Windows Node UV_HANDLE_CLOSING/3221226505 ile başarısız; C3 scratch yalnız standart template üretti, bunu Worker kaynak kanıtı saymıyoruz. Eski salt-okunur runner için CLOUDFLARE_API_TOKEN/ACCOUNT_ID ortam bağlantısı yok. Credential retrieval otomatik onay incelemesince gereksiz credential probing gerekçesiyle reddedildi; sır alınmadı. Güvenli CLI alternatifleri denenip başarısız oldu. Dağıtım metadata/CI/FF kaynak ve statik asset byte eşitliği kanıtlıdır; çalışan Worker modüllerinin bağımsız byte eşitliği iddia edilmiyor. Ek yetki onaysız açılmayacak.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=V01–V07 2/7 scoped kabul; V03 teknik QA kanıtı hazır, kabul açık
TAMAMLANAN=Onaylı dar QA, gerçek login/desktop/mobile/API/refresh/logout/denial, Neon/CI/korunum
KALAN=bağımsız Worker module byte readback ve Baş Mimar nihai kabulü
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar'ın kanıt ve kalan kaynak okuma sınırını değerlendirmesi
