# Issue #82 — checkpoint eşleme ve kabul kanıtı

V01_ACCEPTED=NO. Nihai karar CZA Baş Mimarı'na aittir.

## Kaynak zinciri ve korunan işler

PR #73 tabanı `957fa1b8bdcc8d1a6da40c2b22ad90d0cdd98a01` korunmuştur. Yerel `96790b27feb9d2f2e42e5ec65a2a2ecd11aa093e`, tree `d814e11eccf5def3d18195d37d02426255932cd7`, `integration/qa-candidate-auth-20261010` dalındadır ve PR HEAD'inin devamı değildir. Bu checkpoint'in tüm ağacını PR dalının yerine geçirmek test/migration kaybı ve ilgisiz P2 kapsamı getirecekti.

Bu yüzden PR HEAD üzerinde yalnız QA auth farkı uygulanmıştır. Eski kaynak checkpoint'i ayrı, salt kaynak arşivi `archive/issue-82-qa-source-96790b2` ref'iyle erişilebilir tutulur; ikinci çalışma PR'ı açılmaz. Reset, rebase ve force-push yapılmaz. Auth/assessment ve dört istemci dosyası eski checkpoint ile byte-equal; 53 migration/statik/client-resume dosyası PR tabanıyla byte-equal. T5 route harness'ine yalnız yeni QA bağımlılığı eklenmiştir. [Makineyle doğrulanmış eşleme](evidence/issue-82-regression/source-mapping.json).

## Erişilebilir önceki kanıtlar

[SP-ATTN 14/14 gerçek API–Neon kanıtı](evidence/qa-educator-candidate-20261010/api-neon-acceptance.json), [Chrome yenileme](evidence/qa-educator-candidate-20261010/chrome-restored-task.png), [Chrome akışı](evidence/qa-educator-candidate-20261010/chrome-acceptance.json), [43 kontrol logu](evidence/qa-educator-candidate-20261010/final-auth-tests.log), [7 izolasyon kontrolü](evidence/qa-educator-candidate-20261010/qa-isolation-final-tests.log) ve [eski dağıtım makbuzu](evidence/qa-educator-candidate-20261010/deployment-receipt.json) depoya alınmıştır. 43+7 içinde 5 tekrar vardır; 45 benzersiz auth kontrolü vardır. Bunlar önceki koşunun kanıtlarıdır; yeni koşu diye sunulmaz.

Aktif eski QA Worker `f9dd4266-84f4-423b-978b-7a869c2b3b1f` içeriği Cloudflare API'den indirildi. Yerel checkpoint build'iyle karşılaştırılabilen 234/234 modül SHA256 eşleşti. Bu, deployment etiketi karşılaştırmasından daha güçlüdür; 234 modül dışındaki asset/binding eşitliğini tek başına kanıtlamaz. [İndirilen içerik hash'i ve modül karşılaştırması](evidence/issue-82-sp-dys/worker-readonly.json).

## Yeni SP-DYS canlı akışı

Gerçek sentetik eğitmen, QA-only Neon Auth sağlayıcısıyla giriş yaptı. [13/13 canlı API kontrolü](evidence/issue-82-sp-dys/api-neon.json): yanlış parola401; güvenli/süreli cookie; canonical kurum; SP-DYS create201; ilk cevap200; get ile aynı aday/çevrim/oturum; isim düzeltmesinde aynı kimlik; eşzamanlı tekrar açmalarda aynı aktif oturum; yabancı origin403; sahte eğitmen başlığı403; provider logout ve cookie temizliği; iptal edilmiş cookie401; oturumsuz merkezi endpoint401.

[Doğru izole Neon SQL readback](evidence/issue-82-sp-dys/neon-readback.json): project `patient-firefly-51111834`, branch `br-withered-queen-b15ltb40`, DB `cza_t5_synthetic`; `CZA_SPECIAL_V1_DYS`, `DYS-PH01 → al`, 1 attempt, 1 observation, 1 aktif aday/çevrim, student_id NULL. SQL, bağlı Neon aracıyla salt okunur yapıldı. Runtime rolü veya indeks değiştirilmedi.

Chrome'da gerçek giriş ve ilk SP-DYS create201 görüldü. İlk test harness'i uygulama doğrudan görev ekranına geçtiği halde overview düğmesini bekledi. Bu harness düzeltildi; yeni oturumda Chrome yönetilen proxy CA'sını tanımadığı için `ERR_CERT_AUTHORITY_INVALID` verdi. [Açık browser engeli](evidence/issue-82-sp-dys/browser.json). Chrome'da ilk cevap/yenileme/mobil canlı kabulü henüz PASS değildir. TLS doğrulaması kapatılmadı. Kullanıcı dizinindeki NSS deposuna yalnız açık ortam CA sertifikasının eklenmesi için açık izin soruldu; izin gelmeden bu dizine yazılmaz.

## Yeni regresyonlar

- Auth + QA izolasyonu + T5 kimlik + PR secret izolasyonu: 62/62 PASS.
- Canonical güvenlik ve PostgreSQL davranış grubu: 27/27 PASS.
- Assessment CI hedefli grubunun aynı test listesi: 167/167 PASS.
- TypeScript: PASS. Runtime secrets kaldırılarak full build: PASS.
- Kaynak/public central-special-sync.js byte-equality: PASS.
- Lint'te assessment route'un PR tabanında da bulunan beş uyarı/hata korundu; lint için temiz PASS iddia edilmez. İlgisiz refactor yapılmaz.

[Test logları](evidence/issue-82-regression/). İlk kısıtlı sandbox koşusunun iki güvenlik hatası alt süreç EPERM/boş stdout kaynaklıydı; ağ/alt süreç erişimi verilen tekrar koşusunda aynı testler 27/27 geçti. Yerel Node24 koşuları CI Node22 koşuları diye gösterilmez.

Ana staging, production, gerçek öğrenci verisi ve kapalı benzersiz indeks konusuna müdahale yoktur. Sentetik QA kayıtları denetlenebilir readback için bırakılmıştır. Her kabul türü kaynak, build, canlı API, Chrome ve SQL olarak ayrı kanıtlanır.

GENEL PROJE İLERLEME %=güvenilir bütünleşik ölçüm yok
MEVCUT FAZ İLERLEME %=V01 nihai kabul açık; yüzde üretilmedi
TAMAMLANAN=kayıpsız dar kaynak eşleme, eski log/screenshot/receipt kurtarma, SP-DYS canlı API ve SQL, güvenlik ve regresyon testleri
KALAN=SP-DYS canlı Chrome ilk cevap/yenileme/mobil ve nihai bağımsız kabul
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Chrome CA güven engeli çözülünce gerçek SP-DYS UI ilk cevap ve yenileme kabulünü tamamlamak
