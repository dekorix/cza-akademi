# CZA CANLI DURUM

> Büyük Çelik Zihin Akademisi'nin kanonik **koordinasyon panosu**. Her görev başlangıcında bu belge ve canlı GitHub issue/PR/commit/CI durumu birlikte okunur. Buradaki commit ve PR sayıları anlık görüntüdür; kabul, izin veya canlı deploy kanıtı değildir.

**Yönetim güncellemesi:** 2026-10-13 (TRT), #98 A-DEMO-02 güvenli STOP/rollback sonrasında.
**Kanonik depo:** dekorix/cza-akademi
**Default branch:** main
**Teknik kaynak otoritesi:** canlı GitHub; **aktif kapsam ve iş sırası:** bu belge, #81 ve #94 ile birlikte. Çelişkide kod/dağıtım durur, kanıt uzlaştırılır.

## Son doğrulanan GitHub anlık görüntüsü

- **main HEAD:** 6a2d4e197c8b39d01b8c04e30fee32230e68a3fd
- **main tree:** 35c48d44bb7e02787ed42f2aac93e95dfcc4d663
- **Bu yönetim PR'ı açılmadan önce:** 11 açık PR; 11'i de DRAFT. Bu sayı yeni yönetim PR'ı ve ilerideki çalışmayla değişecektir.
- **V04 PR #91:** DRAFT/OPEN, HEAD 8ef388f9c7fbcb2392805150a32273707d547f7a; base #89 dalı feat/v03-student-route-assignment.
- **A-DEMO-02 PR #101:** DRAFT/OPEN, HEAD 8bb859ff34d7dcb2f2a7ccb3851d1ac737454ee5; tree 2fb5f762a7639b2bb7a1a95b706009b15600e2e3; base korunan #91 dalı feat/v04-assigned-work-evidence.
- **Kanıt zamanı:** 2026-10-13 GitHub read-only taraması, son #98 uygulama sonucu 2026-10-13 09:02:40Z. Hiçbir remote Worker/Neon kontrolü bu belge değişikliğinde yeniden çalıştırılmadı.
- **Branch sayısı:** bu güncelleme sırasında yeniden sayılmadı; tarihsel değer kullanılmaz.

## AKTİF TEK TEKNİK ZİNCİR

**Üst ürün kabulü:** [#81 CZA-VERTICAL-01](https://github.com/dekorix/cza-akademi/issues/81) — OPEN. [#80](https://github.com/dekorix/cza-akademi/issues/80) uzun vadeli ana faz planıdır.

**Korunan izole sentetik QA kabulü:** V01–V04 = **4/7 (%57,1), PASS_SCOPED**. V04 kapanışı [#90](https://github.com/dekorix/cza-akademi/issues/90) CLOSED ve [PR #91 mimari kararında](https://github.com/dekorix/cza-akademi/pull/91#issuecomment-6130801440) kayıtlıdır. V01–V03'ün önceki scoped kabulleri korunur. Bu sayı **tüm CZA projesinin yüzdesi değildir**.

**TEK AKTİF A/KOD İŞİ:** [#98 A-DEMO-02](https://github.com/dekorix/cza-akademi/issues/98) — Öğrenci Geçmişim ekranındaki yanlış/eksik geçmiş ve oturum bazlı kalıcı salt-okunur sonuç görünümünün dar onarımı. **Tek uygulama PR'ı #101 DRAFT**; #91 HEAD ve önceki QA kabulü korunur. **A_DEMO_FULL_PASS=NO; V05_DEV=NOT_STARTED**.

**A-DEMO-01:** #81 altında PARTIAL. Öğrenci giriş/panel/rota, Çalışma Merkezi toplamı ve profil gerçek sentetik QA'da görülmüştür; Geçmişim yanlış boş ve tekil sonuç ayrımı eksikti. Kod ve kayıt kabulüyle birleşik demo kabulü karıştırılmayacak.

**İkinci teknik geliştirme başlatma:** YASAK. #98 kabulü veya gerçek BLOCKER/HIGH yönetim kararı olmadan V05'e ya da ayrı ürün kod işine geçilmez.

### Korunan stacked PR zinciri

- [#73](https://github.com/dekorix/cza-akademi/pull/73): V01/T5 tabanı → main, DRAFT.
- [#87](https://github.com/dekorix/cza-akademi/pull/87): V02 → #73 tabanı, DRAFT.
- [#89](https://github.com/dekorix/cza-akademi/pull/89): V03 → #87 tabanı, DRAFT.
- [#91](https://github.com/dekorix/cza-akademi/pull/91): V04 → #89 tabanı, DRAFT; scoped QA PASS, main/production kabulü değil.
- [#101](https://github.com/dekorix/cza-akademi/pull/101): A-DEMO-02 → #91 tabanı, DRAFT; canlı kullanıcı akışı kabulü FAIL.
- Diğer açık taslaklar #32, #59, #60, #62, #69, #79: mevcut aktif teknik işin önüne geçmez; kapatma/merge için ayrı kanıt gerekir.

## #98 EN SON KANIT VE ENGEL: 2026-10-13

**Son uygulama raporu:** [A-DEMO-02 SAFE REDEPLOY AND LIVE ACCEPTANCE](https://github.com/dekorix/cza-akademi/issues/98#issuecomment-6142089706). Bu, Codex/uygulama teslim raporudur; burada bağımsız Worker/Neon tekrar testi yapıldığı iddia edilmez.

- **Önceki dar izinli çalışmada:** QA secret hazırlığı, guarded restore-only SQL işlemi, kaynak/CI kontrolü ve yalnız izole Worker'a **tek** deneme dağıtımı raporlandı. Secret değeri veya DB URL hiçbir zaman bu dosyaya konmaz.
- **Canlı tarayıcı:** Gerçek normal Chrome masaüstü oturumu ve Geçmişim'in ilk **20** olayı PASS. “Daha fazla yükle” sonrası **29** olaya erişim 45 saniye içinde doğrulanamadı: **FAIL**. Mobil, bütün tekil sonuçlar ve negatiflerin tamamı bu STOP sonrası **NOT_RUN**; bunlara PASS yazılamaz.
- **Somut HIGH kök neden:** lib/persistence/learning-timeline.ts içindeki timestamp normalizasyonu PostgreSQL'in mikro saniyeli occurred_at değerini JS ISO mili saniyesine indiriyor. İmzalı keyset cursor sınırında SELECT karşılaştırması bunu aynı hassasiyette kullanmıyor. Salt-okunur SQL tekrarında ilk 20'den sonra ms-cursor **7**, mikro saniye koruyan cursor **9** olay getiriyor (**27/29** ile **29/29** farkı); LEARNING_RESULT ve SKILL_EVIDENCE olayları atlanıyor. Tarayıcıda son DOM sayısı kaydedilmediği için orada 27 görüldüğü iddia edilmez.
- **Veri kaybı kanıtı YOK:** onaylı sentetik QA verisinde 29 kanonik geçmiş olayı, 7 learning record; iki ayrı completed Parmak Okuma session'ının her biri 10 soru/8 doğru/2 yanlış; Work Center toplamı 20 cevap/16 doğru/%80. Bu sonuçların gerçek yeni UI'da tam/kalıcı gösterimi **henüz kabul edilmedi**.
- **Zorunlu STOP ve güvenli rollback:** başarısızlık üzerine tek deneme sonlandırıldı. Rapora göre izole Worker tekrar eski **d8c2ba48-f686-4f8e-912e-8709f3522cbd** sürümüne %100 alındı, QA final fixture bayrağı OFF; yeni salt-okunur QA fonksiyonunun minimum rol EXECUTE yetkisi yeniden kapatıldı (PUBLIC=false). Eski 53 fonksiyon ve altı QA veri tablosu fingerprint'i korunmuş bildirildi. Deneme Worker'ı e0b62a4b-69ee-456f-a637-25a556f6af32 artık aktif kabul edilmez.
- **Açık temizlik notu:** aktif sürümde yeni dedicated cursor-secret binding'i yok ve geçici yerel plaintext silinmiş raporlandı; *inaktif sürümde* olası dedicated secret materyal temizliği ayrıca izin/kanıt gerektirir. Genel secrets temizliği veya secret readback yapılmaz.
- **İzin durumu:** 2026-10-13 tarihli secret/restore-only SQL/tek Worker deneme izinleri kullanılan tek denemeye özeldi; **otomatik ikinci deploy izni değildir**. PR #101 HEAD/code değişmemiştir. Main, genel staging ve production bu denemeyle değişmedi.
- **Production koşulu:** WORKER_MODULE_BYTE_READBACK=UNVERIFIED kalır. QA kaynak/hash/CI eşlemesi production terfisi değildir.

**TEK AKTİF TEKNİK SONRAKİ ADIM:** Codex A, **#98 / PR #101** üzerinde yalnız kanıtlanmış mikro saniye hassasiyeti/kursor sınırı HIGH hatası için **dar kaynak-kod düzeltme önerisi ve regresyon planı** hazırlasın. Aynı timestamp'e sahip kanonik event'ler, tam 29/29 olay, 7 learning record, 2×(10/8/2) sonuç, 401/403/404 ve mevcut kimlik/tenant sınırları planın ölçütüdür. Önce değişmez kaynak/etki ve test sonucu mimari kontrole sunulur. **SQL/ACL/secret/Worker deploy veya gerçek veri yazması, yeni açık ve dar karar olmadan uygulanmaz.**

## B PEDAGOJİ/KAYNAK İŞ KOLU (TEKNİK İŞ DEĞİL)

- [#94 A/B Kontrol Merkezi](https://github.com/dekorix/cza-akademi/issues/94) A tek teknik iş + B yalnız pedagojik inceleme/üretim taslağı ayrımını düzenler; bağımsız pedagojik insan kabulü olmadan içerik yayımlanmaz.
- [#103 B06](https://github.com/dekorix/cza-akademi/issues/103): başlangıç değerlendirmesi, kanıt/ön koşul/adaptif öğrenme **salt-okunur kaynak/boşluk keşfi**; açık görev. Kod/SQL/deploy/gerçek öğrenci bilgisi içermez. #93 B01 ve #102 B05 **ON_HOLD**, kayıtlardaki B02–B04 taslakları geçmişteki hâliyle korunur.
- 2026-10-13 [eleştirel Ar-Ge kararı](https://github.com/dekorix/cza-akademi/issues/94#issuecomment-6141764086): önemli ürün/pedagoji önerilerinde kanıt, karşı-tez, alternatif, ölçülebilir pilot ve rol/yaş uygunluğu gerekir.
- [Akıllı komut dönüştürme protokolü](https://github.com/dekorix/cza-akademi/issues/94#issuecomment-6142240545): yeni belirsiz fikirler önce profesyonel komut; bu **önceden açıkça onaylı dar #98 teknik işini durdurmaz**. Kullanıcı doğrudan uygulama isteyebilir, production/yüksek risk izinleri ayrı kalır.
- Pedagojik B kulvarı ikinci A/kod görevi değildir; onaysız içerik gerçek öğrenci akışına bağlanmaz.

## KAPSAM, YETKİ VE KABUL KAPILARI

- **Tek Student ID + tek Student Learning Profile**, öğrenci paneli → Çalışma Merkezi → eğitmen paneli → gerçek geçmiş/ödev/rapor → ortak profil → koçluk/LGS/YKS → veli → açıklanabilir AI; 14 kanonik beceri, yaş ve öğrenme düzeyi ayrımı, özel eğitim, Anzan/Soroban, P2 özgün 23 bölüm korunur. Genç yaşlarda yetişkin aracılı uygulama vizyonu ayrı sürüm kararıdır.
- **Tanıtım Sites** tek CZA ticari ekosisteminin alt yüzeyidir, ana platform repository/QA öğrenci verisinin yerine geçmez.
- **YALNIZ** ilgili izolasyonda sentetik öğrenci ve mevcut izinli kaynak; gerçek öğrenci verisi/şifresi/secret değeri GitHub'a veya rapora yazılmaz.
- Main merge, ana staging trafiği, production/publish, genel DB migration, permission genişletme, force-push/rebase/reset **kullanıcının açık gerekli izni olmadan YOK**.
- Daha önce kapanmış P0-C/P1/P2/P3 meseleleri yeni somut kanıt olmadan açılmaz. Kod/CI veya lokal mock başarıları gerçek Chrome+API+DB/rol/tenant+source/deploy kanıtının yerine geçmez.
- Üst #81 tam staging kabulü (V01–V07) henüz tamamlanmadı. Önceki ana staging değerlendirme yolu/aktif Worker-DB endpoint ve bağımsız remote-byte eşlemesi gibi ana staging/production şartları ayrıca çözülmeden **READY FOR PRODUCTION** ilan edilmez.

## HER AJANIN BAŞLAMA AKIŞI

1. AGENTS.md → docs/CZA_CANLI_DURUM.md → docs/CZA_KONTROL_PROTOKOLU.md → docs/CZA_KARAR_DEFTERI.md → docs/CZA_MASTER_ARCHITECTURE.md.
2. Canlı GitHub **main HEAD + #81 + #94 + #98 + PR #101, korunan PR #91/#89/#87/#73** ve ilgili CI/yorum/teslim SHA'larını doğrula; bu belgeyi canlı SHA sanma.
3. A teknik işte önce değişmez scope, tek dar branch/PR, hedefli test, yönetim kontrolü, yalnız gerekli BLOCKER/HIGH bağımsız denetimi, checkpoint. B kaynak işinde insan pedagoji onay kapısını koru.
4. GitHub ile **aktif zincir / aktif PR / korunan HEAD / kapsam / kabul** çelişirse STOP ve belgeyi uzlaştır. Sadece main SHA veya açık PR sayısının ilerlemesi **tek başına blocker değildir**.

## YÖNETİM CHECKPOINT TARİHÇESİ

- Mission Control [PR #83](https://github.com/dekorix/cza-akademi/pull/83) 2026-10-10 MERGED; snapshot tutarlılığı [PR #84](https://github.com/dekorix/cza-akademi/pull/84) MERGED; V01→V02 [PR #86](https://github.com/dekorix/cza-akademi/pull/86) MERGED. Bunlar mevcut #98 kabulünün yerine geçmez.
- V01–V04 kabul zinciri #82/#85/#88/#90 ve PR #73/#87/#89/#91 kaynaklarına dayanır. **4/7 yalnız izole sentetik QA scoped**; stacking DRAFT ve general staging/prod kabulü yok.
- Önceki QA sertifika zinciri/trust kaygısı tarihsel kontroldür; 2026-10-12 V04 ve 2026-10-13 A-DEMO gerçek Chrome normal HTTPS denemeleriyle **tüm QA'yı bugün bloklayan güncel sebep olduğu iddia edilmez**. Yeni CA/trust değişikliği yapılmaz.
- Bu 2026-10-13 güncellemesi yalnız **dokümantasyon**, ayrı branch ve DRAFT PR'dır; ürün kodu, DB, QA Worker, main veya production değiştirmez.

**GENEL PROJE İLERLEME %:** ÖLÇÜLMEDİ (tam platform için kanıtlı ağırlıklı payda yok).
**MEVCUT FAZ İLERLEME %:** V01–V07 4/7 = %57,1 **izole sentetik QA scoped**; A-DEMO-02 FULL_PASS=NO.
**TAMAMLANAN:** V01–V04 scoped QA; #90 kapanışı; #98 kök neden ve güvenli rollback kanıtı; mevcut GitHub yönetim durumu uzlaştırması.
**KALAN:** #98 mikro saniye/kursor HIGH düzeltmesi + gerçek izole QA desktop/mobile ve yetki/regresyon kabulü, V05–V07, genel staging/production kabul kapıları.
**KAPSAM SAPMASI=YOK**
**SIRADAKİ TEK ADIM:** Codex A #98/PR #101 için **yalnız mikro saniye koruyan cursor onarımı ve test/etki önerisini** mimari incelemeye sunar; bu kayıt yeni SQL/Worker/production izni değildir.
