# V04 / Issue #90 — uygulama ve onay checkpoint'i

Çalışma PR'ı [#91 OPEN/DRAFT](https://github.com/dekorix/cza-akademi/pull/91), branch `feat/v04-assigned-work-evidence`. PR #89'un dalına bağımlıdır; main hedefi veya merge değildir.

Uygulama commit `2355d19df57d5bcffb214f737796224a0ad1b6ff`, tree `9089bd74c0a75c45366f0541c4771352c66814e2`. Doğrudan parent/merge-base: korunan PR89 HEAD `5e39d3f1810f1c0a8228c651c6da5563b3a6a212`, tree `6a52137285cf9c03f700538b67a3256f1944e605`. Belge checkpoint'i sonraki dar commit olarak taşınabilir; uygulama/SQL inceleme kaynağı bu immutable commit'tir.

## Uygulanan kaynak değişikliği

Mevcut Öğrenci Paneli, assignment launch, Studio, FingerHand/exercise/player, kanonik attempt ve ledger/profile zinciri kullanılır. Tek recipe/öğrenci QA fonksiyonu tasarlandı; henüz uygulanmadı. Kalıcı soru planı, kanonik next-index, exact-payload idempotency, yenileme/newtab ayar yükleme, belirsiz cevap için sessionStorage draft, server counts ile sonuç ve hata sonrası tamamlanma tekrar denemesi eklendi. Genel free-practice/non-QA upstream korunur; diğer modüllerin kaynakları kaldırılmadı.

## Test ve kanıt ayrımı

[91 ayrı yerel kontrol sonucu](evidence/v04/local-tests.json): 90-test regresyon paketi + yeni me/projection sözleşme testi; ilgili handler tekrar kontrolü 17/17. PGlite önerilen gerçek SQL'i çalıştırır; testlerin canlı QA migration olmadığı açıkça belirtilmiştir. Atama/soru/UUID/replay/işlemsel rollback, eski panel/profil/kanonik güvenlik geçer.

[Chrome154 yerel akış](evidence/v04/local-browser.json): masaüstü 1440×900, mobil 390×844, 9/9 kontrol; gerçek Studio, mock API. Belirsiz acknowledgement, aynı UUID, reload ile sonraki soru, 10 cevap, kayıt hatasında başarısızlık/retry ve yatay taşma kontrolü. Canlı normal giriş/Neon yazımı PASS olarak sunulmaz.

TypeScript, tam platform build ve yeni yardımcı/test lint geçer. Mevcut Studio tam lint: korunan kaynak20 hata, V04 kaynak18 hata; aynı eski hook/compiler/a11y/link/deprecation kategorileri kalır. Eski lint borcu kapatıldı iddiası yok.

İlk uygulama commit'inin CI koşuları [V04 38153684275](https://github.com/dekorix/cza-akademi/actions/runs/38153684275), [V03 38153684201](https://github.com/dekorix/cza-akademi/actions/runs/38153684201); checkpoint yazım anında IN_PROGRESS. Son teslim HEAD'inin gerçek CI sonucu GitHub'dan ayrıca doğrulanır; belge içindeki snapshot CI sonucunun yerine geçmez.

## Canlı ortam ve korunma

[Salt okunur ön kontrol](evidence/v04/preflight.json), [45 tablo envanteri](evidence/v04/public-table-baseline.json): students2/users7/training_sessions8/question_attempts0/learning_records5/evidence5/recipes1; atanmış session/attempt0. SQL fonksiyonu mevcut değil; genel write EXECUTE=false. Henüz V04 veritabanı yazımı veya Worker dağıtımı yok.

İzole Worker mevcut V03 version `d439fee2-9bd9-495a-9d8a-b8338feae25f`, deployed source `62bc61f4e24f3d11f8c1ff514e61f105cb0a62c1`, tree `0e99b02f559aaff5365c26281ad37f49699b265a`. Wrangler deployments list ile canlı doğrulandı. MODULE_BYTE_READBACK=UNVERIFIED; güvenli yöntem yoksa ayrı production-promotion şartı kalır.

PR73 HEAD `5011469f8f9afa18c020b0ce88506059a711cf99`, PR87 HEAD `bb2ef9657e88a1de5343d38984502fdc3e5d8f13`, PR89 HEAD `5e39d3f1810f1c0a8228c651c6da5563b3a6a212`: yeniden doğrulandı, OPEN/DRAFT ve unmerged. Main, ana staging, production, credential/PIN ve eski kayıtlar değiştirilmedi.

## Somut engel / sonraki iş

**BLOCKED_SQL_APPROVAL**: [tam SQL + etki + rollback](CZA_V04_QA_SQL_DESIGN_20261011.md) için ayrı Baş Mimar onayı beklenir. Bu izin gelmeden bir yeni wrapper/EXECUTE uygulanmaz. Hazır gerçek QA çalıştırıcısı ancak onaylı SQL ve exact-source izole deployment sonrası kullanılır. Sonra gerçek UI giriş, masaüstü/mobil, aynı oturum/relogin, çok sekme/start/attempt/finish yarışları, gerçek dropped-response retry, API yetki reddi ve Neon önce/sonra kayıt kanıtı tamamlanır.

Mevcut ledger 24h aralık sınırı korunur. QA'da başka öğrenciye ait mevcut training_session yok; rastgele/foreign session ve foreign student/academy selector reddi gerçek test paketinde ayrı raporlanır. Yeni yabancı öğrenci veya atama açılmaz.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=V01–V03 3/7 QA scoped (%42,9); V04 kabul edilmedi
TAMAMLANAN=V04 kodu, ayrı dal/DRAFT PR, yerel test/build/Chrome ve SQL inceleme paketi
KALAN=SQL onayı, gerçek QA uygulama/dağıtım/test/Neon readback ve Baş Mimar kabulü
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=dar QA SQL paketinin Baş Mimar tarafından onaylanması

**V04_ACCEPTED=NO.** Nihai kabul CZA Baş Mimarı'na aittir.
