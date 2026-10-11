# Issue #88 — V03 Öğrenci Paneli teslimi

**V03_ACCEPTED=NO; V03_RUNTIME_ACCEPTANCE=BLOCKED.** Nihai kabul CZA Baş Mimarı'na aittir. V01/V02 PASS_SCOPED korunur; V04–V07 kabulü değildir.

## Kaynak ve sınır

- Branch: `feat/v03-student-route-assignment`, yalnız V03, DRAFT PR tabanı `feat/v02-candidate-student-link`.
- Korunan #87 HEAD: `bb2ef9657e88a1de5343d38984502fdc3e5d8f13`, tree `26b03af0069ac1d20ddb84dfbcb39a021bae90cd`.
- #73 HEAD: `5011469f8f9afa18c020b0ce88506059a711cf99`. GitHub compare ve yerel Git ata zinciri: #73 → 4dd8307 → 9acfd2c → c4edf69 → 911aa08 → 1abf1e2 → bb2ef96. Altı commit ahead, behind=0, merge-base #73 HEAD.
- Başlangıç main snapshot `6a2d4e197c8b39d01b8c04e30fee32230e68a3fd`; 8 açık PR. #73/#87 OPEN/DRAFT, unmerged. #87 güncel CI no-secrets-postgres SUCCESS.
- Main'in canlı durum panosu V02'de kalmıştı; #88 ve kullanıcı emrine göre bu dar branch'te koordinasyon kaydı güncellendi. #87 tabanında yeni yönetim belgeleri bulunmadığından main talimatları ayrıca okundu.
- Mevcut sentetik Student ID `20000000-0000-4000-8000-000000000001`, akademi `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`. İkinci öğrenci kimliği oluşturulmadı.
- DB/rol/politika değişikliği, migration, gerçek öğrenci verisi, deployment, ana staging/production, main merge, #73/#87 değişikliği, rebase ve force-push yok.

## Önce/sonra ve en küçük kod değişikliği

**Önce:** Mevcut Öğrenci Paneli atamaları merkezî öğrenci oturumundan ve training_recipes'ten okuyor; ortak Learning Profile aynı öğrenci/kurumla hesaplanıyor. Ayrı “Benim Öğrenme Rotam” görünümü yok. Atama sayısı terminal kayıtlar dahil “etkin” diye gösteriliyor; her atamanın eylemi “Çalışmayı aç”.

**Sonra:** Yalnız `components/student-dashboard.tsx` ürün değişikliği. Rota devam eden mevcut atamayı önceliklendirir, yoksa başlayabilecek mevcut atamayı seçer; başlık, modül, ilerleme ve eğitmen yönergesini aynı dashboard kaydından gösterir. Kaynak recipe ID ile mevcut atama sayfasına gider; ortak Öğrenme Profili'ne bağlanır. Gelecek/tamamlanmış/iptal/süresi dolmuş/kapalı kayıt rota olarak sunulmaz. Atama listesi korunur, mevcut durum etiketleri kullanılır ve terminal kayıtlar “Atama ayrıntıları” olarak açılır. Boş/hata halinde hazır çalışma iddiası yok.

API, Student ID modeli, oturum, can_view, V02 değerlendirme bağları, P2/özel eğitim, 14 beceri, Anzan/Soroban, koçluk ve eski ekranlar değiştirilmedi. Yeni profil/veri modeli veya demo ürün verisi yok. Test mock ataması yalnız yerel test dosyasındadır.

## Testler ve kanıtın sınırı

| Kontrol | Sonuç | Kanıt / sınır |
|---|---|---|
| Yeni V03 UI + dashboard API harness | 7/7 PASS | [unit.log](evidence/v03/unit.log); in-progress önceliği, tüm terminal durumlar, boş/hata/loading, aynı recipe, escaping, oturumsuz/kimlik/DB hata deny |
| Mevcut U1 panel / U2 work kontratları | 15/15 + 6/6 PASS | [U1](evidence/v03/u1-panel.log), [U2](evidence/v03/u2-work.log) |
| Mevcut U1/U2 PGlite + U7 profil | 2/2 + 2/2 + 7/7 PASS | [postgres-profile.log](evidence/v03/postgres-profile.log); yalnız geçici yerel DB ve mevcut test fixture kimlikleri; canlı runtime RLS kabulü değildir |
| Son kaynak TypeScript, hedefli lint, full build | PASS | [typecheck](evidence/v03/typecheck.log), [lint](evidence/v03/lint.log), [build](evidence/v03/build.log) |
| Chromium 154, 1440×900 ve 390×844 | LOCAL_MOCK_UI PASS | [browser.json](evidence/v03/browser.json), [desktop](evidence/v03/1440.png), [mobile](evidence/v03/390.png); gerçek React sayfası, rota/profil, aynı recipe/reload, mock 401'de panel yok, mock yeniden giriş, taşma yok, pageerror=0 |
| Governance + envanter | 8/8 + 9/9 PASS; envanter PASS | [main snapshot log](evidence/v03/governance-main-snapshot.log), [inventory](evidence/v03/inventory-main-snapshot.json); main/work başlangıç yönetim dosyaları üzerinde, #87 tabanının CI sonucu değildir |
| Gerçek Neon salt-okunur sentetik envanter | PASS_SCOPED | [neon-readonly](evidence/v03/neon-readonly.json), [rol](evidence/v03/neon-runtime-permissions.json): mevcut aktif demo öğrenci/aktif student kullanıcısı, üç V02 bağlantısı, demo öğrenci sayısı 2 |
| Gerçek yetkili öğrenci login/API ve negatif kullanıcı/kurum | DOĞRULANAMADI | Bu ortamda QA öğrenci credential/provider bağları yok; API unit harness ve mock 401 gerçek login değildir |
| Gerçek atanmış çalışma ve hard reload/yeniden login | BLOCKED | Canlı sentetik öğrencinin teacher_assignment sayısı **0**; mock recipe canlı atama değildir |
| Worker commit/tree/DB endpoint eşlemesi | DOĞRULANAMADI | V03 deploy yapılmadı; önceki #87 Worker kanıtı V03 kaynak kabulüne taşınmadı |

İlk tarayıcı denemesi sandbox localhost EPERM nedeniyle çalışmadı; aynı test izinli yürütmede geçti. İlk dar lint bulguları semantik output ve node:test kayıt açıklamasıyla düzeltildi. Git fetch ilk sandbox koşusunda proxy bağlantısı kuramadı; izinli salt-okunur fetch geçti. Son testler doğrulanmış #87 worktree'sinde yürütüldü; daha önceki test kopyası tüm runtime dosyalarıyla byte-equal doğrulandı.

## Yetki matrisi ve gerçek engeller

- **Kendi oturumu:** dashboard authenticatedStudent → student/academy/student_user bağları; learning-profile aynı student/academy. Yerel API harness PASS; gerçek QA login henüz yok.
- **Oturumsuz/iptal oturum:** dashboard 401, veri sorgusu yok (harness); mock tarayıcı paneli gizler. Gerçek endpoint/login revocation testi yapılmadı.
- **Sahte URL öğrenci/kurum seçicisi:** API seçim için URL/body okumaz; tüm SQL parametreleri oturumun öğrenci/kurumundan gelir (harness). Gerçek başka kullanıcı/kurum cookie testi açık.
- **RLS yeni V03 HIGH bulgusu:** [politikalar](evidence/v03/neon-rls-policies.json) öğrenciler/atamalar için yalnız authenticated rolünün can_view/kurum politikalarını gösteriyor. [Üyelik](evidence/v03/neon-runtime-membership.json): cza_v01_app_runtime_min authenticated üyesi değil, tablo sahibi cza_t5_test_owner; rol superuser/bypassRLS değil. Dashboard ve Learning Profile doğrudan SELECT kullanıyor. Bu rol altında öğrenci okuması için uygulanabilir mevcut politika gösterilemedi; uygulama readback başarısı varsayılamaz. Gerçek rol-switch readback [permission denied to set role](evidence/v03/neon-runtime-role-test.json) ile reddedildi. Bu yeni öğrenci okuma yüzeyi bulgusudur; V02 eğitmen scoped fonksiyonlarını yeniden açmaz. RLS gevşetilmedi; çözüm ayrıca mimari karar/izinli DB işi gerektirir.
- **Eksik gerçek atama:** mevcut Student ID üzerinde source=teacher_assignment kaydı yok. Eğitmen yetkili gerçek atama yolu ve mevcut öğrenci giriş bağları tamamlanmadan V03 PASS verilemez. SQL ile atama/öğrenci oluşturulmadı.
- Gerçek QA öğrenci credential/provider bağları ve V03 Worker eşlemesi eksik. Sır/parola/cookie/token/DB URI rapora alınmadı.

## Geri dönüş ve kabul

Ürün geri dönüşü tek UI commit'ini revert etmekle yapılır; API/DB rollback veya migration yok. DRAFT PR kanıt incelemesine hazırdır; runtime BLOCKED olduğu için kabul/merge önerilmez. Yeni öğrenci yaratmadan mevcut öğrenci için izinli giriş, scoped RLS okuma ve gerçek eğitmen ataması sağlandıktan sonra Chrome desktop/mobile gerçek login → API → DB → reload/yeniden login → negatif izolasyon ve Worker kaynak eşlemesi tamamlanmalıdır.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=2/7 QA scoped; V03 kabul edilmedi
TAMAMLANAN=dar UI, ayrı branch/DRAFT PR, yerel UI/API/DB/derleme testleri ve gerçek Neon salt-okunur envanter
KALAN=gerçek V03 öğrenci oturumu/ataması, runtime RLS, Worker eşlemesi ve Baş Mimar kabulü
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar'ın mevcut tek Student ID için gerçek atama/giriş ve scoped RLS okuma engellerini çözüm sırasına alması
