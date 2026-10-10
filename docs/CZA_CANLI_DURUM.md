# CZA CANLI DURUM

> Bu dosya büyük Çelik Zihin Akademisi için **tek canlı yönlendirme panosudur**. Tarihsel kararların yerine geçmez. Her yeni görev başlangıcında GitHub canlı durumu yeniden okunur; bu dosya eskiyse güncellenmeden uygulama başlatılmaz.

**Güncelleme tarihi:** 2026-10-10 (TRT), V01→V02 yönetim geçişi  
**Kanonik depo:** `dekorix/cza-akademi`  
**Default branch:** `main`  
**Main korumalı:** EVET

### Son doğrulanan GitHub snapshot

> Aşağıdaki üç değer **mutable GitHub metadata'sıdır** ve yalnız bu dosyanın son doğrulama anındaki görüntüsüdür. **Canlı GitHub'ın yerine geçmez**; hiçbir kabul, blokaj veya kanonik değer üretmez. Bu dosyayı değiştiren commit'in kendisi `main` HEAD'i yeniden değiştireceği için, burada tutulan HEAD/sayı değerleri tanım gereği bir adım geridedir.

- **Son doğrulanan main HEAD:** `3799cfe5cc046f37762d08c2288d7397d4b5dee5`
- **Son doğrulanan açık PR sayısı:** 7
- **Son doğrulanan toplam branch sayısı:** 80
- **Doğrulama anı:** 2026-10-10, GitHub API okuması

**Kanonik olan bu snapshot değil, aşağıdaki yönetim içeriğidir:** aktif zincir, aktif hedef, kapsam sınırları ve sıradaki tek adım. Güncel repo durumu (main HEAD, PR sayısı, branch sayısı) her zaman canlı GitHub'dan okunur.

## AKTİF TEK ZİNCİR

**Üst kabul zinciri:** #81 — CZA-VERTICAL-01 | Tek öğrencinin değerlendirme → çalışma → eğitmen → rapor staging kabulü (OPEN, 1/7)  
**Tamamlanmış alt görev:** #82 — V01 izole QA sentetik eğitmen girişi ve merkezi kayıt kabulü — **CLOSED / COMPLETED** (2026-10-10T20:57:42Z)  
**Aktif tek uygulama emri:** **#85 — V02 sentetik adayın eğitmen onayıyla mevcut tek Student ID'ye güvenli bağlanması** (PLANLANDI, uygulama başlamadı)  
**Tek çalışma PR:** #73 — fix: kayıt öncesi özel eğitim oturumunu aday ve çevrim kimliğiyle sürdür  
**PR durumu:** OPEN / DRAFT  
**PR branch:** `fix/t5-pre-enroll-resume-integrity`  
**PR HEAD:** `5011469f8f9afa18c020b0ce88506059a711cf99`

### V01 kabul kararı (Baş Mimar, 2026-10-10)
- **`V01_QA_ACCEPTED=PASS_SCOPED`**, **`V01-V07_ACCEPTED=1/7`**.
- Kapsam yalnız SP-ATTN ve SP-DYS sentetik eğitmen/aday **başlangıç + ilk cevap/gözlem + yenileme/isim düzeltmesi + kimlik koruma + negatif erişim** akışının **izole QA** kabulüdür.
- **Kabul EDİLMEDİ:** tüm değerlendirme soruları, diğer profiller, PDF, gerçek öğrenci bağlama, ortak Student Learning Profile'ın tamamı, staging/production, main merge.
- **`V01_ACCEPTED=NO`** — nihai kabul CZA Baş Mimarı'na aittir.

### Aktif hedef (V02)
Sentetik adayın **eğitmen onayıyla mevcut tek Student ID dosyasına güvenli biçimde bağlanması** ve **ikinci bir öğrenci kimliği yaratılmaması**. Bağlama yalnız yetkili eğitmen + doğru kurum altında yapılır; `candidateId/cycleId` geçmişi korunur.

### Korunacak kabul sınırları
- Tek Student ID + tek Student Learning Profile.
- Tanıtım Sites bu teknik zincirin ürünü/DB'si değildir.
- Gerçek öğrenci verisi kullanılmaz.
- Main merge, production deploy, ana staging trafiği değişikliği ve kritik DB müdahalesi kullanıcı açık izni olmadan yapılmaz.
- Kapanmış P0-C/P1/P2/P3 başlıkları yeni somut kanıt olmadan yeniden açılmaz.
- Kod veya CI yeşili tek başına kabul değildir; gerekli UI/API/DB readback/yetki/test kanıtı aranır.

## GÜNCEL DURUM

Issue #82 kaynak kaydına göre:
- İzole sentetik Neon üzerinde `assessment_sessions_pre_enroll_active_identity_uq` PASS; aynı migration tekrar açılmayacak.
- Ayrı QA Worker ile sentetik Neon bağlantısı PASS.
- V01 sayfası ve SP-DYS intake açılıyor.
- **V01 kapandı:** Baş Mimar kararı `V01_QA_ACCEPTED=PASS_SCOPED`; #82 CLOSED/COMPLETED.
- **P1 QA-secret izolasyon açıkları kapandı** (commit `5011469f`): T5 manual yolu secretsiz secure-hold; izolasyon kapısı trigger kapsamı ve test kapsamı genişletildi.
- Aktif tek teknik iş artık **V02 bağlama**: sentetik adayın eğitmen onayıyla mevcut tek `studentId` dosyasına güvenli bağlanması.

## V02 ÖN KOŞUL NOTU (salt okunur bulgu)
- QA Worker host'u `cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev` sertifika zinciri: `cza-staging-habip.workers.dev` ← `YE2` ← `Root YE` ← `ISRG Root X2` ← `ISRG Root X1` (self-signed).
- Windows `LocalMachine\Root` deposunda **ISRG Root X1 var**; **ISRG Root X2 YOK**; `LocalMachine\CA` ara deposunda ISRG/LE ara sertifikası YOK.
- Bu nedenle gerçek Chrome kabulünde `ERR_CERT_AUTHORITY_INVALID` görülme riski vardır. Bu, V02 uygulamasının önündeki ayrı bir teknik engeldir ve **henüz çözülmemiştir**; çözüm kullanıcı izni gerektirir.
- CA/trust değişikliği **yapılmadı**; TLS doğrulaması kapatılmadı; `--ignore-certificate-errors` kullanılmadı.

## TEK İŞ AKIŞI

`Issue → çalışma branch'i → kod → hedefli test → Draft PR → yönetim kontrolü → gerekiyorsa bağımsız BLOCKER/HIGH denetimi → checkpoint → kullanıcı onayı gerekiyorsa onay → merge/deploy`

Bir ajan yeni işe başlamadan önce:
1. `AGENTS.md`
2. bu dosya
3. aktif issue (#85 — V02)
4. üst kabul zinciri (#81) ve tamamlanmış alt görev kaydı (#82)
5. aktif PR (#73) ve güncel HEAD/CI
6. yalnız ilgili mimari/protokol belgeleri

okunur.

## AÇIK PR TRAFİĞİ

> Sayı ve durum **son doğrulanan snapshot**tır; güncel liste her zaman canlı GitHub'dan okunur.

- **#79 BEKLEME** — docs/qa(cza): tanıtım sitesi tek CZA ekosisteminin alt modülüdür — `docs/cza-one-ecosystem-marketing-boundary-20261009` → `main` — DRAFT
- **#73 AKTİF** — fix: kayıt öncesi özel eğitim oturumunu aday ve çevrim kimliğiyle sürdür — `fix/t5-pre-enroll-resume-integrity` → `main` — DRAFT
- **#69 BEKLEME** — fix(intake): show truthful special education readiness badges — `fix/intake-special-status-truth-20261008` → `main` — DRAFT
- **#62 BEKLEME** — Eğitmen panelini günlük işlere odakla ve ayrıntıları açılır bölümlere taşı — `ux/educator-progressive-disclosure` → `main` — DRAFT
- **#60 BEKLEME** — Bind original assessment context to the same authorized CZA student identity — `feature/original-assessment-cza-identity` → `main` — DRAFT
- **#59 BEKLEME** — docs: Başlangıç Değerlendirmesi girişini ve ayrı web projesi sınırını koru — `docs/cza-main-product-boundary-20261007` → `main` — DRAFT
- **#32 BEKLEME** — Security/Data Integrity hardening v2 — `security/educator-auth-ci-hardening-v2` → `main` — DRAFT

Diğer açık PR'lar aktif tek görevin önüne geçemez. Kapatma/merge kararı ayrıca kanıtla verilir; bu panonun varlığı otomatik kapatma yetkisi değildir.

## YÖNETİM CHECKPOINT

- Mission Control kurulum branch'i: `docs/cza-mission-control-20261010`
- Mission Control PR: **#83 / MERGED** — 2026-10-10T19:14:42Z, merge commit `4605cbbcb20aedbc322e3abfaa5170611c73e750`
- Mission Control kurulumu `main`'e alındı; bu dosya artık kanonik canlı durum kaynağıdır ve her görev başında buradan okunur.
- Post-merge tutarlılık düzeltmesi: yönetim/dokümantasyon branch'i `docs/cza-mission-control-consistency`; PR **#84 / MERGED** (merge commit `3799cfe5cc046f37762d08c2288d7397d4b5dee5`).
- V01→V02 yönetim geçişi (bu güncelleme): yönetim/dokümantasyon branch'i `docs/cza-v02-transition`; ürün kodu, migration, staging veya production değişikliği içermez.
- Bu düzeltme ayrıca **self-referential HEAD** sorununu kapatır: yukarıdaki GitHub snapshot değerleri kanonik değer değildir ve ilerlemeleri tek başına uygulama blokajı oluşturmaz; yalnız aktif zincir/PR/korunan HEAD/kapsam/kabul durumu çelişkisi durdurur.

**GENEL PROJE İLERLEME %:** ÖLÇÜLMEDİ  
**MEVCUT FAZ İLERLEME %:** ÖLÇÜLMEDİ  
**TAMAMLANAN:** Mission Control kurulumu (#83) ve self-referential HEAD tutarlılığı (#84) `main`'e alındı; #82 V01 izole QA kabulü kapandı (`PASS_SCOPED`, 1/7); 3 P1 QA-secret izolasyon açığı kapatıldı.  
**KALAN:** V02–V07 (6/7); V02 için eğitmen onaylı tek Student ID bağlama; QA TLS/CA trust engelinin çözümü (kullanıcı izni gerekir).  
**KAPSAM SAPMASI=YOK**  
**SIRADAKİ TEK ADIM:** V02 uygulama issue'su açılıp yalnız o kapsamda çalışılması; V02 başlamadan QA TLS/CA trust engelinin kullanıcı izniyle kapatılması.
