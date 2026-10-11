# V04: dar QA yazma tasarımı — UYGULANMADI

Resmi emir: [Issue #90](https://github.com/dekorix/cza-akademi/issues/90). SQL/migration/yetki değişikliği için uygulamadan önce Baş Mimar onayı zorunlu. V03 onayı bu paketi kapsamaz. **V04_ACCEPTED=NO**.

## Kaynak ve hedef

V04 dalı `feat/v04-assigned-work-evidence`, taban PR #89 HEAD `5e39d3f1810f1c0a8228c651c6da5563b3a6a212`, tree `6a52137285cf9c03f700538b67a3256f1944e605`. Bağımlı DRAFT PR hedefi `feat/v03-student-route-assignment`. PR #73/#87/#89 korunur.

Yalnız Neon project `patient-firefly-51111834`, branch `br-withered-queen-b15ltb40`, database `cza_t5_synthetic`. Yalnız Worker `cza-v01-isolated-synthetic-20261010`. Mevcut student `20000000-0000-4000-8000-000000000001`, academy `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, mevcut teacher_assignment/finger_read recipe `361ee0f6-26e2-4484-b9f9-7a88d14fb9f4`. Yeni öğrenci, atama, modül veya paralel profil oluşturulmaz.

## Doğrulanmış canlı engel

Minimum rol `cza_v01_app_runtime_min` için dört mevcut kanonik fonksiyonun EXECUTE yetkisi false: `cza_bind_assigned_work_session_k3c`, `cza_record_assigned_work_attempt`, `cza_complete_assigned_work`, `cza_student_record_learning`. RLS kapatılmadı. Doğrudan genel tablo yazma izni verilmedi.

Salt okunur ön kontrolde public 45 tablo; students=2, users=7, training_sessions=8, question_attempts=0, learning_records=5, learning_evidence=5, recipes=1. Atanmış çalışma oturumu/cevabı=0. V04 fonksiyonu yok. [Ön kontrol](evidence/v04/preflight.json), [45 tablo başlangıç parmak izi](evidence/v04/public-table-baseline.json).

## Onay istenen tam SQL

[Uygulanacak SQL](../db/qa/v04-assigned-work.sql), SHA-256 `3bc0a9c026890eecec3dd4c104a76cd4289c68a7151c07e5c78f1d5215906043`.

Bir yeni fonksiyon: `public.cza_v04_qa_assigned_work(text,text,uuid,uuid,jsonb)`. Fonksiyon sahibi mevcut `cza_t5_test_owner`; SECURITY DEFINER, sabit search_path `pg_catalog,public,pg_temp`; PUBLIC EXECUTE kaldırılır; EXECUTE yalnız mevcut minimum QA rolüne verilir. Guard + CREATE + OWNER + REVOKE PUBLIC + GRANT bir transaction içinde uygulanır. `CREATE OR REPLACE` kullanılmaz: mevcut nesne varsa otomatik üzerine yazılmaz.

Yeni tablo, kolon, index, trigger, policy, rol veya genel SELECT/INSERT/UPDATE/DELETE yetkisi yok. Eski kanonik fonksiyonların tanımı/ACL'i değiştirilmez. Test fixture SQL'i kesinlikle deployment paketine dahil değildir.

Fonksiyon yalnız start/attempt/finish kabul eder. Mevcut onaylı V03 canonical-session doğrulamasını kullanır; kimlik, kurum ve login-session parametreleri istemciden alınmaz. Aktif/demo öğrenci, aktif öğrenci rolü, kurum eşleşmesi, süre/iptal doğrulamaları korunur. Login-session FOR SHARE kilidi revocation ile yazmayı sıralar. Sadece mevcut recipe kabul edilir; aktif modül/atama, başlangıç, son tarih ve iptal denetlenir. Her işlem recipe → training_session sırasıyla kilitlenir.

### Start ve yenileme

Mevcut K3C bind fonksiyonu ve aktif-recipe benzersiz index'i kullanılır. Sunucu UUID/başlangıç zamanı üretir; aynı atama/öğrenci için tekrarlar mevcut oturumu bulur. Yeni oturumun `settings_snapshot` alanına mevcut bir basamaklı 1–9 Parmak Okuma havuzundan seçilen 10 soruluk sabit plan yazılır. Yeni soru bankası kurulmaz; istemci planı mevcut `createQuestion` motoruyla doğrular ve mevcut FingerHand/player ile gösterir. Soru kimliği oturum+index'e bağlıdır.

Başlatılan yeni row üzerinde source, question_count, settings_snapshot güncellenir. Eski V01–V03 oturumlarına plan eklenmez; plansız eski oturum bulunursa fail closed. Tamamlanmış atama yeniden yeni oturum üretmez. İstemci ayarları kalıcı planın otoritesi değildir.

### Attempt, yarış ve belirsiz yanıt

Sadece sıradaki PRIMARY soru kabul edilir. Question ID, index, hedef ve sequence sunucunun kalıcı planına uymalıdır. Sayısal cevap/timing alanları tam sayı ve sınırlı aralıkta doğrulanır. Doğruluk, errorType ve patternValid sunucuda yeniden hesaplanır; istemcinin isCorrect iddiası otorite değildir.

Mevcut kanonik attempt fonksiyonuna doğrulanmış payload gönderilir. UUID+SHA-256 ile aynı payload replay edilir; aynı UUID/farklı payload reddedilir. Farklı UUID/aynı cevaplanmış index reddedilir. Kilit altında next-index kontrolü ikinci sekmenin çift kaydını önler. Tamamlanma sonrası yalnız önceden kaydedilmiş aynen replay kabul edilir.

ResponseLatencyMs, totalResponseTimeMs, stimulusDurationMs ve mevcut olay zamanları cihaz bildirimidir: `timingProvenance=CLIENT_REPORTED`. Guided Parmak Okuma'da görsel cevap boyunca görünür; bildirilmiş stimulus duration bu görünür süreyi taşır. Ölçülmeyen support=`unknown`, strategy=null, skills=[]; preset practice mode kişisel strateji ölçümü sayılmaz. Profilde 14 beceriye uydurma puan yazılmaz.

### Finish ve merkezi profil

10 PRIMARY cevap olmadan tamamlanma reddedilir; erken ara verme oturumu aktif tutar. Mevcut canlı complete fonksiyonu support'u learning mode'dan çıkarıyor; bu genel fonksiyon değiştirilmez. Dar V04 wrapper, mevcut kanonik `cza_student_record_learning` ve `cza_append_verified_evidence` zincirini çağırır.

Kayıt, mevcut ledger sözleşmesi gereği `record_origin=client_reported`, `verification_status=client_reported` kalır. Ayrı activity_result evidence sadece sunucuda sayılan total/correct/wrong/accuracy'yi içerir; authority=`v04_qa_server_answer_evaluator:v1`, verification=`server_verified`, skill=null, support=unknown. Bildirilen süreler/strateji bu verified payload'a girmez. Karışık provenans açıkça tutulur; bütün kaydın server_verified olduğu iddia edilmez.

Session status ancak ledger ve evidence başarılı olduktan sonra completed olur. Aynı transaction hata verirse record/evidence/status birlikte geri alınır. Finish replay aynı kayıt/kanıt UUID'lerini döndürür. V03'ün mevcut read-only profil/provenance projection'ları yeni zinciri okur; yeni profil deposu yok.

## Etki sınırı

Onay sonrası tek mevcut recipe için en fazla 1 yeni training_session, 10 PRIMARY question_attempt, 1 learning_record ve 1 learning_evidence. Bu yeni oturum row'unda source/settings/progress/counters/status/completed_at değişir. Mevcut öğrenci/user/recipe/module/eğitmen bağları güncellenmez. Gerçek giriş/çıkış QA testleri, mevcut onaylı login/logout üzerinden yeni student_sessions ve rate-guard kayıtları oluşturabilir/değiştirebilir; credential/PIN bootstrap gerekmez.

45 tablo önce/sonra sayım ve parmak izi ile karşılaştırılacak; eski 8 training_session, 5 record ve 5 evidence ayrıca eski UUID kümesi üzerinde aynı kalmalı. Yeni learner/recipe sayısı sıfır; assessment/V01/V02 kaynakları ve verileri korunur. Oturum/rate güvenlik tablolarının beklenen auth etkileri ayrı açıklanacak.

Dış QA minimum rolünün dar yazma kabiliyeti artar; güvenlik sınırı fonksiyonun içindeki sabit hedef/session/ownership/atama/plan denetimidir. Genel dört kanonik EXECUTE false kalmalı; role superuser/BYPASSRLS olmamalı; RLS/policy/table ACL değişmemeli. Ana staging/production bu fonksiyon veya deployment için hedef değildir.

## Geri dönüş

[Geri dönüş SQL tasarımı](../db/qa/v04-assigned-work.rollback.sql): yalnız yeni wrapper'ın minimum-role EXECUTE'ını revoke eder; eski/yeni bütün öğrenme verileri korunur. Gerekirse çağırıcılar durduktan ve somut rollback kararı verildikten sonra yalnız bu yeni fonksiyon kaldırılabilir. Otomatik veri silme/reset yok.

QA Worker kaynak geri dönüşü son kabul edilmiş V03 source `62bc61f4e24f3d11f8c1ff514e61f105cb0a62c1`, tree `0e99b02f559aaff5365c26281ad37f49699b265a`; mevcut version `d439fee2-9bd9-495a-9d8a-b8338feae25f`. Main veya ana staging branch'ine müdahale edilmez.

## Uygulamadan önce / sonra test sınırı

Yerel gerçek SQL (PGlite) testinde start/resume, yanlış cevap doğruluğunun yeniden hesabı, index/idempotency reddi, tamamlanma/replay, revoked/expired/role/target/recipe/module denetimleri ve ledger hatasında atomik rollback doğrulandı. Yakalanmış canlı kanonik tanımlar yalnız yerel fixture'da kullanıldı. Bunlar çok bağlantılı Neon yarışını ispatlamaz.

91 ilgili regresyon testinde 0 hata; Chrome154 local mock-transport akışında 9 kontrol geçti. Gerçek QA login/masaüstü/mobil/API/Neon/multitab/yenileme/uncertain-response/finish-race kabulü **BLOCKED_SQL_APPROVAL**. Hazır gerçek çalıştırıcı `scripts/qa/cza-v04-runtime-browser.mjs`; `CZA_V04_QA_APPROVED=YES` gate'ini onay/SQL/deploy sonrası kullanır. Bu environment flag mimari onayın yerine geçmez.

Mevcut ledger'ın 24 saatlik kayıt zaman aralığı sınırı korunur; QA bu aralıkta koşulacaktır. Daha uzun açık kalmış oturum için genel sözleşme değişikliği yapılmaz ve sessiz başarı üretilmez.

Worker MODULE_BYTE_READBACK=UNVERIFIED sınırı V03 kabulünde ayrı production promotion koşulu olarak bırakılmıştır; sır/binding/token çıkartılarak kapatılmayacak. V04'te güvenli byte readback mümkün olmazsa aynı sınır açıkça raporlanır.
