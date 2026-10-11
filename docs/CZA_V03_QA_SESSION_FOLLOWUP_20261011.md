# V03 QA oturum yaşam döngüsü: ek uygulama onayı paketi

V03_ACCEPTED=NO. Bu belge b42b1a9'daki uygulama öncesi tasarım kaydıdır. **Güncel durum: Baş Mimar “Dar ek oturum paketini onaylıyorum” dedi; aynen belirtilen SQL yalnız kilitli QA transaction'ında uygulandı.** Gerçek sonuçlar `CZA_V03_QA_RUNTIME_20261011.md` içindedir. Aşağıdaki uygulama öncesi notlar tarihsel tasarım gerekçesidir.

İlk onaylı paket izole QA'ya uygulandı: iki sınırlı login/read fonksiyonu, mevcut NULL PIN başlangıcı, bir finger_read ve mevcut educator adına tek kanonik bootstrap atama. Öğrenci sayısı 2, eski training_sessions 8; yeni öğrenci yok. Gerçek Chrome arayüzüyle login 200, Secure/HttpOnly/SameSite cookie başarılı; dashboard 403. Bu test FAIL'dir, gerçek V03 PASS değildir.

Kök neden canlı pg_proc/has_function_privilege ile doğrulandı: runtime `cza_v01_app_runtime_min`, mevcut `cza_touch_authenticated_student` ve `cza_revoke_student_session` için EXECUTE sahibi değildir. Yeni read fonksiyonuna ulaşılmadan kanonik session touch çağrısı reddediliyor. Önceki tasarım mevcut HTTP session doğrulamasının çalışacağını varsaymıştı; bu varsayım gerçek testte doğrulanmadı. Genel fonksiyon yetkisi açılmayacak.

Tam SQL: [db/qa/v03-session-lifecycle.sql](../db/qa/v03-session-lifecycle.sql). Yalnız `patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic`, migration sahibi cza_t5_test_owner. İki yeni fonksiyon; eski fonksiyonlar ve onaylı read/login SQL değişmez.

SQL SHA256: `017f8527093669c8cbaf29d17f0fd07ba1482c6bf3a0a3261dd57d54e3d7c3d8`. Yerel PGlite ek SQL yürütme/kanonik kimlik/yanlış hash/yanlış branch/genel revoke reddi/dar revoke/idempotent logout geçti; ilgili 12/12 test ve TypeScript geçti. Bunlar canlı migration veya gerçek V03 PASS değildir.

- `cza_v03_qa_authenticated_student(text)`: STABLE SECURITY DEFINER, salt okunur. Onaylı read fonksiyonunun exact target + tek demo öğrenci + aktif kullanıcı/öğrenci + öğrenci rolü + eşleşen kurum + geçerli/revoked olmayan session kontrolünü yeniden kullanır. Sadece doğrulanmış session_id/student_id/academy_id/student_user_id döner. Token veya hash döndürmez. Yetkisiz oturum boş sonuç; HTTP 401. QA'da last_seen yazmaz. Normal ortam mevcut touch fonksiyonunu kullanmaya devam eder.
- `cza_v03_qa_revoke_student_session(text)`: SECURITY DEFINER, salt okunur değildir; yalnız aynı demo öğrenci/kurum ve token hash eşleşmesinde mevcut kanonik revoke fonksiyonunu çağırır. Yok/revoked/expired session için idempotent; başka öğrenci/kurum oturumunu güncellemez. Hedef kilidi ve hash biçimi zorunlu. Tek yazma etkisi kendi session revocation'ıdır.

İkisinde sabit search_path pg_catalog,public,pg_temp; owner cza_t5_test_owner; PUBLIC EXECUTE kaldırılır; yalnız minimum runtime role EXECUTE. Tablo GRANT, rol üyeliği, RLS/policy/BYPASSRLS, genel touch/revoke EXECUTE, credential/PIN/modül/atama değişikliği yok. Sır okunmaz/raporlanmaz; oturum materyali owner sorgusuyla alınmaz.

Kod yalnız mevcut QA mode'da bu iki dar fonksiyonu kullanır; QA dışında session doğrulama, last_seen ve logout eski davranışını korur. Yeni migration onaysız uygulanmayacak. Onay sonrası minimum role + gerçek Chrome desktop/mobile, API/profile/assignment, refresh/relogin/logout ve farklı kurum/öğrenci reddi tekrar çalıştırılır; eski kayıt ve RLS fingerprint karşılaştırılır. Bootstrap educator UI create PASS değildir.

Kaynak teşhis HEAD 8abc6bb2ee36e067ef6beb5914188ef549609db0, tree 16db515305f48e1cfab5dbb7a66385e089321a98; CI 38132014672 SUCCESS; QA Worker version bd9f325d-a6c1-405d-b22e-d70c5c942e13. 403 kanıtı üç gerçek login koşusunda korunacak. Main staging/production ve PR73/87 değiştirilmedi.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=V01–V07 2/7 scoped kabul; V03 açık
TAMAMLANAN=ilk onaylı QA hazırlığı, gerçek login, 403 kök neden doğrulaması, ek dar SQL tasarımı
KALAN=ek migration onayı ve gerçek V03 uçtan uca testleri
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=bu iki dar oturum fonksiyonunun uygulama onayı
