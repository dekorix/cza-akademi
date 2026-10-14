# Issue #82 — checkpoint eşleme ve kabul kanıtı

V01_ACCEPTED=NO. Nihai karar CZA Baş Mimarı'na aittir.

## Kaynak zinciri ve korunan işler

PR #73 tabanı `957fa1b8bdcc8d1a6da40c2b22ad90d0cdd98a01` korunmuştur. Yerel `96790b27feb9d2f2e42e5ec65a2a2ecd11aa093e`, tree `d814e11eccf5def3d18195d37d02426255932cd7`, `integration/qa-candidate-auth-20261010` dalındadır ve PR HEAD'inin devamı değildir. Bu checkpoint'in tüm ağacını PR dalının yerine geçirmek test/migration kaybı ve ilgisiz P2 kapsamı getirecekti.

Bu yüzden PR HEAD üzerinde yalnız QA auth farkı uygulanmıştır. Eski kaynak checkpoint'i ayrı, salt kaynak arşivi `archive/issue-82-qa-source-96790b2` ref'iyle erişilebilir tutulur; ikinci çalışma PR'ı açılmaz. Reset, rebase ve force-push yapılmaz. Auth/assessment ve dört istemci dosyası eski checkpoint ile byte-equal; 53 migration/statik/client-resume dosyası PR tabanıyla byte-equal. T5 route harness'ine yalnız yeni QA bağımlılığı eklenmiştir. [Makineyle doğrulanmış eşleme](evidence/issue-82-regression/source-mapping.json).

## Erişilebilir önceki kanıtlar

[SP-ATTN 14/14 gerçek API–Neon kanıtı](evidence/qa-educator-candidate-20261010/api-neon-acceptance.json), [Chrome yenileme](evidence/qa-educator-candidate-20261010/chrome-restored-task.png), [Chrome akışı](evidence/qa-educator-candidate-20261010/chrome-acceptance.json), [43 kontrol logu](evidence/qa-educator-candidate-20261010/final-auth-tests.log), [7 izolasyon kontrolü](evidence/qa-educator-candidate-20261010/qa-isolation-final-tests.log) ve [eski dağıtım makbuzu](evidence/qa-educator-candidate-20261010/deployment-receipt.json) depoya alınmıştır. 43+7 içinde 5 tekrar vardır; 45 benzersiz auth kontrolü vardır. Bunlar önceki koşunun kanıtlarıdır; yeni koşu diye sunulmaz.

Aktif eski QA Worker `f9dd4266-84f4-423b-978b-7a869c2b3b1f` içeriği Cloudflare API'den indirildi. Yerel checkpoint build'iyle karşılaştırılabilen 234/234 modül SHA256 eşleşti. Bu, deployment etiketi karşılaştırmasından daha güçlüdür; 234 modül dışındaki asset/binding eşitliğini tek başına kanıtlamaz. [İndirilen içerik hash'i ve modül karşılaştırması](evidence/qa-educator-candidate-20261010/worker-content-comparison.json).

## Yeni SP-DYS canlı akışı

Gerçek sentetik eğitmen, QA-only Neon Auth sağlayıcısıyla giriş yaptı. [14/14 canlı API kontrolü](evidence/issue-82-sp-dys/api-neon.json): yanlış parola401; güvenli/süreli cookie; canonical kurum; SP-DYS create201; ilk cevap200; get ile aynı aday/çevrim/oturum; isim düzeltmesinde aynı kimlik; eşzamanlı tekrar açmalarda aynı aktif oturum; iki eşzamanlı ilk create için 201/200 ve tek session; yabancı origin403; sahte eğitmen başlığı403; provider logout ve cookie temizliği; iptal edilmiş cookie401; oturumsuz merkezi endpoint401.

[Doğru izole Neon SQL readback](evidence/issue-82-sp-dys/neon-readback.json): project `patient-firefly-51111834`, branch `br-withered-queen-b15ltb40`, DB `cza_t5_synthetic`; `CZA_SPECIAL_V1_DYS`, `DYS-PH01 → al`, 1 attempt, 1 observation, 1 aktif aday/çevrim, student_id NULL. SQL, bağlı Neon aracıyla salt okunur yapıldı. Runtime rolü veya indeks değiştirilmedi.

[Masaüstü gerçek Chrome](evidence/issue-82-sp-dys/browser.json) ve [bağımsız 390px mobil Chrome](evidence/issue-82-sp-dys/browser-mobile.json) PASS: formdan gerçek giriş → SP-DYS aday create201 → `DYS-PH01 / al` attempt200 → reload'da Görev2/8 → aynı oturumdan gerçek get200 → görünen isim düzeltmesinde create200/resumed ve üç kimlik korunumu → logout200/revoked → me401. Mock network veya cookie enjeksiyonu kullanılmadı. Mobil koşu ayrı tarayıcı girişi yaptı; yalnız viewport değişiminden ibaret değildir. [Masaüstü ekranı](evidence/issue-82-sp-dys/desktop-restored.png), [mobil ekranı](evidence/issue-82-sp-dys/mobile-independent-restored.png).

Mobil test ilk cevap öncesinde duraklatılıp gerçek Neon SQL ile 0 attempt / 0 observation okundu; test devam ettikten sonra aynı session'da 1 attempt / 1 observation okundu. [Önce SQL](evidence/issue-82-sp-dys/mobile-before-sql.json), [sonra SQL](evidence/issue-82-sp-dys/neon-readback.json). Son readback ayrıca masaüstü ve API kimliklerini, eşzamanlı ilk create için tek aktif session'ı kapsar.

İlk Chrome test harness'i eski düğme adını ve reload sırasında otomatik get bekliyordu. Gerçek ürün `Eksik ilk alanı aç` düğmesini kullanır; reload sonrasında test aynı gerçek browser session'ından get çağırır. Ürün kodu bu beklentilere uydurulmadı. Bu düzeltmeler sonrası tam koşular PASS. Sadece yerel cache'in temizlenmesiyle yeniden restore senaryosu bu koşunun iddiası değildir.

CA engeli kullanıcı izniyle çözüldü. Açık `environment-proxy-ca.crt` sertifikası mevcut yönetilen trust bundle ve önceden hazırlanmış NSS girişinin SHA256 değeriyle karşılaştırıldı; curl yalnız bu CA ile TLS_VERIFY=0 verdi. Yalnız Chromium kullanıcı NSS deposuna bu açık sertifika eklendi; sistem genelinde trust veya sır değişmedi. Chrome prosesine mevcut NSS deposunda yazma erişimi verilmesi gerekti. TLS doğrulaması ve browser web security açık kaldı; HOME değişkeni değiştirilmedi. [CA kaynağı ve izin sınırı](evidence/issue-82-sp-dys/ca-provenance.json).

Yeniden çalıştırılabilir [browser script](../scripts/qa/cza-issue82-synthetic-browser.mjs) ve [API script](../scripts/qa/cza-issue82-synthetic-api.mjs): `CZA_QA_FIXTURE_FILE` yalnız yerel, depoya alınmayan sentetik fixture JSON yoludur. Browser için `CZA_CHROMIUM_EXECUTABLE` ile standart Chrome verilebilir; `CZA_QA_MOBILE=1` bağımsız mobil koşuyu seçer. API tarafında yönetilen ortam proxy'si için Node24 `NODE_USE_ENV_PROXY=1` kullanıldı. Script'ler parola/cookie/connection URI değerlerini kanıtlara yazmaz.

## Dağıtımın birebir eşlemesi

Yalnız izole QA Worker `--keep-vars` ile source `2e7996d199144419712c9b4082429cf77a5ec523`, tree `e01c9a011221ed1c6f471ec7a53bdd6fec99d23c` üzerinden dağıtıldı. Aktif version `e5fd0a22-6e24-43df-a812-12ca6ac13777`, %100. Cloudflare'dan yeniden indirilen 232/232 modül SHA256 değeri bu build ile aynı; [receipt ve modüller](evidence/issue-82-sp-dys/worker-readonly.json). Servis edilen beş static JS dosyası da public kaynakla byte-equal: [static provenance](evidence/issue-82-sp-dys/served-static-provenance.json). [Dağıtım logu](evidence/issue-82-sp-dys/qa-deploy.log). Sonraki teslim commit'i QA script/kanıt/belge ekler; runtime kaynağı bu source commit'idir.

Ana staging aktif version başlangıç ve bitişte `111d84f5-e284-4f31-85e7-5000071cca21` %100; staging/production auth, sır veya trafik değişmedi. İndeks/migration ve runtime rolü değiştirilmedi.

## Yeni regresyonlar

- Auth + QA izolasyonu + T5 kimlik + PR secret izolasyonu: 62/62 PASS.
- Canonical güvenlik ve PostgreSQL davranış grubu: 27/27 PASS.
- Assessment CI hedefli grubunun aynı test listesi: 167/167 PASS.
- TypeScript: PASS. Runtime secrets kaldırılarak full build: PASS.
- Kaynak/public central-special-sync.js byte-equality: PASS.
- Special Education Browser Acceptance: 9/9 PASS. İlk yerel koşuda 8/9 geçti; dokuz profili dönen test 30 saniyelik toplam limitte durdu. Aynı test 120 saniyelik ortam süresiyle, assertion değişmeden 53.1 saniyede geçti. Gerçek GitHub CI standart koşusu da PASS.
- Kaynak commit'in gerçek GitHub CI sonucu: 8 success, DB readback workflow skipped; skipped PASS sayılmadı. [CI kayıtları](evidence/issue-82-regression/github-source-ci.json).
- Lint'te assessment route'un PR tabanında da bulunan beş uyarı/hata korundu; lint için temiz PASS iddia edilmez. İlgisiz refactor yapılmaz.

[Test logları](evidence/issue-82-regression/). İlk kısıtlı sandbox koşusunun iki güvenlik hatası alt süreç EPERM/boş stdout kaynaklıydı; ağ/alt süreç erişimi verilen tekrar koşusunda aynı testler 27/27 geçti. Yerel Node24 koşuları CI Node22 koşuları diye gösterilmez.

Ana staging, production, gerçek öğrenci verisi ve kapalı benzersiz indeks konusuna müdahale yoktur. Sentetik QA kayıtları denetlenebilir readback için bırakılmıştır. Her kabul türü kaynak, build, canlı API, Chrome ve SQL olarak ayrı kanıtlanır.

GENEL PROJE İLERLEME %=güvenilir bütünleşik ölçüm yok
MEVCUT FAZ İLERLEME %=V01 nihai kabul açık; yüzde üretilmedi
TAMAMLANAN=kayıpsız dar kaynak eşleme, eski log/screenshot/receipt kurtarma, SP-DYS canlı API ve SQL, güvenlik ve regresyon testleri
KALAN=Baş Mimarı tarafından bağımsız kanıt incelemesi ve nihai V01 kabul kararı
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimarı'nın erişilebilir PR #73 kaynak/kanıt/dağıtım zincirini inceleyip nihai kabul kararı vermesi
