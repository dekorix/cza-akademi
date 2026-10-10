# CZA CANLI DURUM

> Bu dosya büyük Çelik Zihin Akademisi için **tek canlı yönlendirme panosudur**. Tarihsel kararların yerine geçmez. Her yeni görev başlangıcında GitHub canlı durumu yeniden okunur; bu dosya eskiyse güncellenmeden uygulama başlatılmaz.

**Güncelleme tarihi:** 2026-10-10 (TRT), self-referential HEAD düzeltmesi  
**Kanonik depo:** `dekorix/cza-akademi`  
**Default branch:** `main`  
**Main korumalı:** EVET

### Son doğrulanan GitHub snapshot

> Aşağıdaki üç değer **mutable GitHub metadata'sıdır** ve yalnız bu dosyanın son doğrulama anındaki görüntüsüdür. **Canlı GitHub'ın yerine geçmez**; hiçbir kabul, blokaj veya kanonik değer üretmez. Bu dosyayı değiştiren commit'in kendisi `main` HEAD'i yeniden değiştireceği için, burada tutulan HEAD/sayı değerleri tanım gereği bir adım geridedir.

- **Son doğrulanan main HEAD:** `4605cbbcb20aedbc322e3abfaa5170611c73e750`
- **Son doğrulanan açık PR sayısı:** 7
- **Son doğrulanan toplam branch sayısı:** 80
- **Doğrulama anı:** 2026-10-10, GitHub API okuması

**Kanonik olan bu snapshot değil, aşağıdaki yönetim içeriğidir:** aktif zincir, aktif hedef, kapsam sınırları ve sıradaki tek adım. Güncel repo durumu (main HEAD, PR sayısı, branch sayısı) her zaman canlı GitHub'dan okunur.

## AKTİF TEK ZİNCİR

**Üst kabul zinciri:** #81 — CZA-VERTICAL-01 | Tek öğrencinin değerlendirme → çalışma → eğitmen → rapor staging kabulü  
**Aktif tek uygulama emri:** #82 — CZA MÜDÜR / CODEX | V01 izole QA sentetik eğitmen girişi ve merkezi kayıt kabulü  
**Tek çalışma PR:** #73 — fix: kayıt öncesi özel eğitim oturumunu aday ve çevrim kimliğiyle sürdür  
**PR durumu:** OPEN / DRAFT  
**PR branch:** `fix/t5-pre-enroll-resume-integrity`  
**PR HEAD:** `957fa1b8bdcc8d1a6da40c2b22ad90d0cdd98a01`

### Aktif hedef
Yalnız izole QA Worker için bağımsız, gerçek doğrulamalı ve güvenli sentetik eğitmen kimlik doğrulama akışı; ardından `/api/assessment-special-linked` üzerinde aynı `candidateId/cycleId/sessionId` ile V01 kayıt / reload / resume kanıtı.

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
- Final kaynak HEAD için kaynak CI/statik kabul var; ancak gerçek QA auth + merkezi DB canlı kabulü tamamlanmadıkça `V01_ACCEPTED=NO`.
- Aktif tek teknik sorun: izole QA Worker'da gerçek sentetik eğitmen auth ve ardından güvenli aday/çevrim/oturum E2E.

## TEK İŞ AKIŞI

`Issue → çalışma branch'i → kod → hedefli test → Draft PR → yönetim kontrolü → gerekiyorsa bağımsız BLOCKER/HIGH denetimi → checkpoint → kullanıcı onayı gerekiyorsa onay → merge/deploy`

Bir ajan yeni işe başlamadan önce:
1. `AGENTS.md`
2. bu dosya
3. aktif issue (#82)
4. üst kabul zinciri (#81)
5. aktif PR (#73) ve güncel HEAD/CI
6. yalnız ilgili mimari/protokol belgeleri

okunur.

## AÇIK PR TRAFİĞİ

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
- Post-merge tutarlılık düzeltmesi (bu güncelleme): yönetim/dokümantasyon branch'i `docs/cza-mission-control-consistency`; ürün kodu, migration, staging veya production değişikliği içermez.
- Bu düzeltme ayrıca **self-referential HEAD** sorununu kapatır: yukarıdaki GitHub snapshot değerleri kanonik değer değildir ve ilerlemeleri tek başına uygulama blokajı oluşturmaz; yalnız aktif zincir/PR/korunan HEAD/kapsam/kabul durumu çelişkisi durdurur.

**GENEL PROJE İLERLEME %:** ÖLÇÜLMEDİ  
**MEVCUT FAZ İLERLEME %:** ÖLÇÜLMEDİ  
**TAMAMLANAN:** GitHub merkezli canlı durum standardı ve aktif tek görev zinciri tanımlandı; Mission Control kurulumu (#83) `main`'e alındı ve canlı durum dosyası gerçek GitHub durumuyla eşitlendi.  
**KALAN:** Bu doküman tutarlılık PR'ının kabulü; ardından yalnız #82 üzerinden #73'ün doğrulanmış teslimi.  
**KAPSAM SAPMASI=YOK**  
**SIRADAKİ TEK ADIM:** `docs/cza-mission-control-consistency` PR'ının governance CI ve içerik denetimini tamamla; merge yetkisi verilirse `main`'e al. Bu tutarlılık kanonik `main`'de kapanmadan #82 uygulamasına başlanmaz.
