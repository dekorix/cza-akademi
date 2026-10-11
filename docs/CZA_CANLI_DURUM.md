# CZA CANLI DURUM — V04 çalışma checkpoint'i

2026-10-11 TRT. **Güncel aktif zincir: Issue #81 → resmi Issue #90 → feat/v04-assigned-work-evidence → [DRAFT PR #91](https://github.com/dekorix/cza-akademi/pull/91).** V01–V03 PASS_SCOPED, 3/7 (%42,9). V03 mimari kabul https://github.com/dekorix/cza-akademi/pull/89#issuecomment-6109292240 . V04_ACCEPTED=NO; nihai kabul Baş Mimar'a ait.

Korunan PR73/87/89 OPEN/DRAFT. V04 tabanı PR89 HEAD5e39d3f1810f1c0a8228c651c6da5563b3a6a212/tree6a52137285cf9c03f700538b67a3256f1944e605. Main başlangıç snapshot6a2d4e197c8b39d01b8c04e30fee32230e68a3fd; PR91 açılmasıyla 10 açık PR. Mevcut V03 UI/tek öğrenci/profil ve bütün eski veriler korunur.

Yalnız mevcut QA project patient-firefly-51111834/branch br-withered-queen-b15ltb40/db cza_t5_synthetic/Worker cza-v01-isolated-synthetic-20261010. Tek mevcut student20000000-0000-4000-8000-000000000001 ve finger_read recipe361ee0f6-26e2-4484-b9f9-7a88d14fb9f4; yeni öğrenci/atama/profil yok. Somut canlı engel: minimum role için bind_k3c/record_attempt/complete_work/student_record_learning EXECUTE=false. V03 SQL onayı V04'e taşınmaz; V04 SQL/privilege öncesi tam tasarım+etki+rollback ve ayrı Baş Mimar onayı zorunlu. Henüz V04 yazımı/deploy yok.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=3/7 QA scoped (%42,9); V04 açık
TAMAMLANAN=Issue90/HEAD/tree, V04 dalı ve kodu, tam SQL/etki/rollback, 91 yerel test, Chrome154 mock 9 kontrol, TypeScript/build, 45 tablo başlangıç envanteri
KALAN=dar SQL onayı, gerçek Chrome/API/Neon kabulü, exact-HEAD CI
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=incelemeye hazır DRAFT PR üzerinden dar QA SQL paketine Baş Mimar onayı

---

# Tarihsel V03 checkpoint'i — aşağıdaki eski aktif/kabul alanları güncel değildir

2026-10-11 TRT. Bu branch'in koordinasyon kaydıdır; main merge veya ürün kabulü değildir.

## AKTİF TEK ZİNCİR

- Üst kabul: Issue #81.
- Aktif tek uygulama emri: Issue #88, V03 Öğrenci Paneli.
- Çalışma branch'i: `feat/v03-student-route-assignment`; mevcut PR #89 OPEN/DRAFT.
- Güncel dar runtime emri: https://github.com/dekorix/cza-akademi/pull/89#issuecomment-6107427809
- Korunan PR #73: OPEN/DRAFT, HEAD `5011469f8f9afa18c020b0ce88506059a711cf99`.
- Korunan PR #87: OPEN/DRAFT, HEAD `bb2ef9657e88a1de5343d38984502fdc3e5d8f13`, tree `26b03af0069ac1d20ddb84dfbcb39a021bae90cd`.
- #87, #73 HEAD'inin altı commit ilerisinde; merge-base #73 HEAD'idir. V03 PR tabanı `feat/v02-candidate-student-link` olacaktır.
- GitHub main HEAD snapshot: `6a2d4e197c8b39d01b8c04e30fee32230e68a3fd`; 8 açık PR. Mutable snapshot kabul kanıtı değildir.

## Kabul ve kapsam

Issue #88 ve kullanıcı emri uyarınca V01/V02 `PASS_SCOPED`, V01–V07 2/7 QA scoped. V01/V02 yeniden geliştirilmez. V03_ACCEPTED=NO. Tek mevcut Student ID, kanonik oturum/kurum izolasyonu ve mevcut içerik korunur. Yeni öğrenci kimliği, gerçek öğrenci verisi, main merge, PR #73/#87 değişikliği, ana staging/production, rebase veya force-push yok. Yalnız `patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic` hedefinde önceden raporlanmış, güvenlik koşulları kanıtlanmış additive QA fonksiyon migration'ı resmi emir kapsamında; genel yetki/RLS değişikliği yasak.

Yalnız mevcut öğrenci panelinin rota ve atama görünümü incelenir/düzeltilir. V04–V07 kapsam dışıdır. Runtime Chrome/API/Neon readback ve Worker kaynak eşlemesi eksikse DOĞRULANAMADI yazılır. Nihai kabul CZA Baş Mimarı'na aittir.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=2/7 QA scoped; V03 açık
TAMAMLANAN=GitHub başlangıç envanteri ve #87 ata zinciri
KALAN=V03 gerçek sentetik login/Chrome/API/Neon/Worker kanıtı
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar'ın onayladığı dar QA paketinin gerçek runtime testleri

## 2026-10-11 TRT uygulama onayı

Baş Mimar, `a638215595c56aa28b2b8c835b34445f6a3e598d` tasarım/etki paketine “Dar QA paketini onaylıyorum” yanıtını verdi. İki sınırlı fonksiyon yalnız kilitli Neon QA transaction'ında kuruldu. Aynı mevcut kullanıcıda NULL PIN özeti başlatıldı; 1 `finger_read` modülü ve 1 mevcut bağlı sentetik educator adına teacher_assignment bootstrap kaydı eklendi. Yeni öğrenci yok; öğrenci sayısı 2, eski training_sessions 8. RLS politika fingerprint'i değişmedi. Bunlar gerçek educator UI create PASS iddiası veya V03 kabulü değildir. Normal gerçek login/Chrome/API/DB/Worker eşleşmesi sıradaki doğrulamadır.

## Gerçek oturum kontrolü checkpoint'i (tarihsel, ek onay öncesi)

Gerçek Chrome login HTTP 200, fakat dashboard HTTP 403: minimum runtime role eski canonical touch/revoke fonksiyonlarında EXECUTE sahibi değil. Yeni read/login fonksiyonlarının EXECUTE hakkı var. V03 gerçek test FAIL; masaüstü/mobil tam akış henüz tamamlanmadı. Ek dar iki fonksiyon tasarımı `docs/CZA_V03_QA_SESSION_FOLLOWUP_20261011.md` ve `db/qa/v03-session-lifecycle.sql` içinde; **uygulanmadı, ayrı Baş Mimar onayı bekliyor**. Genel eski fonksiyon/table/RLS yetkisi açılmayacak. QA Worker teşhis kaynağı 8abc6bb2ee36e067ef6beb5914188ef549609db0, CI38132014672 SUCCESS; version bd9f325d-a6c1-405d-b22e-d70c5c942e13. Sıradaki tek adım ek dar oturum paketinin onayı; V03_ACCEPTED=NO.

## Güncel ek onay sonrası

Baş Mimar b42b1a9 ek paketi için “Dar ek oturum paketini onaylıyorum” dedi. İki ek fonksiyon kilitli QA transaction'ında kuruldu; genel eski fonksiyon/RLS/rol yetkileri aynı. Gerçek Chrome masaüstü/mobil tam40/40 test geçti; minimum Neon rolü12/12 ve statik5 byte eşitliği geçti. Eski56 oturum ve40/45 tablo fingerprint'i aynı; beklenen5 değişiklik onaylı hazırlık/login/rate-limit kayıtlarıdır. Ana staging değişmedi. QA source62bc61f4e24f3d11f8c1ff514e61f105cb0a62c1/tree0e99b02f559aaff5365c26281ad37f49699b265a; CI38132583947 SUCCESS; Worker versiond439fee2-9bd9-495a-9d8a-b8338feae25f. Ayrıntı `docs/CZA_V03_QA_RUNTIME_20261011.md`. Worker module bağımsız byte readback Windows indirme hatası ve eksik güvenli runner bağlantısı nedeniyle DOĞRULANAMADI. V03_ACCEPTED=NO; Baş Mimar nihai kabulü açık.
