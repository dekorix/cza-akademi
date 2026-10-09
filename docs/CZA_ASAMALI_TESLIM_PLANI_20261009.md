# CZA | ADIM ADIM GERÇEK UYGULAMA VE TESLİM PLANI (v1.0)

**Plan tarihi:** 2026-10-09  
**Ana takip kaydı:** [GitHub Issue #80](https://github.com/dekorix/cza-akademi/issues/80)  
**Ana kod deposu:** `dekorix/cza-akademi`  
**Başlangıç checkpoint:** `main=a3e3a1437adc20d93c3c55f7091a7322feab9773`, tree `1610ae8a46858e1450522ad3cbc04568492be33b`. **Bu tarihsel başlangıçtır; her teslim öncesi güncel main tekrar okunur.**

> **Kapsam:** Ana CZA eğitim platformunu başlatma, denetleme, bağlama ve aşamalı kabul etme planıdır. CZA tanıtım/satış sitesi **tek ekosistemin ayrı teknik alt modülüdür**, eğitim platformunun kendisi değildir. Çalışan hiçbir öğrenci/eğitmen/ödev/değerlendirme içeriğini eksiltme izni yoktur.

## 1. Bitiş hedefimiz

CZA'da tek merkezî Student ID ve Student Learning Profile ile 0–YKS yaşam döngüsü: **Başlangıç Değerlendirmesi → eğitmen onaylı sonuç → Benim Öğrenme Rotam → Akademik Öğrenme Merkezi + Beceri ve Zihin Atölyesi → gerçek çalışma kanıtı → eğitmen ödevi/raporu → veli erişimi → LGS/YKS koçluğu → güvenilir açıklanabilir AI önerisi.**

**İlk çalışır ürün kabul hedefi:** Bir sentetik öğrenci değerlendirmeden yetkili tek kimlik ile girer, çalışmasını tamamlar, sayfa yenilense de kaldığı yerden devam eder, eğitmen aynı kurumda aynı çalışmanın gerçek merkezi deneme/gözlem verisini ve raporunu görür, bağlantısız veli/eğitmen veya farklı kurum erişimi 403 döner. Bu hedefin bazı parça testleri geçmiş olsa da bütün zincirin tek sürümde staging kabulü henüz kanıtlı değildir.

**Kritik eksiltmeme sözleşmesi:** E0–E5, P1–P10 toplam 16 genel profil; 10 özel eğitim profili; P2 özgün 23 bölüm ve eski mikro-görev sayılarının fiilen birebir eşitliği; S01–S14 beceriler ve mevcut Anzan/Soroban/dikkat/hafıza/okuma/zihin haritaları vb. Kaynak kataloğu sayıları nihai pedagojik/UI/data kabulü değildir.

## 2. Değişmez uygulama kuralları

1. **Tek aktif teknik görev:** Her an yalnız bir ürün entegrasyonu F_AKTİF; diğerleri PLAN veya hazır kabul taslağı. Kapatılmayan işi atlayarak yeni yarım modül başlatma.
2. **Repo/deploy sınırı:** `dekorix/cza-akademi` Büyük CZA. Tanıtım Sites'in kaynak, URL, versiyon ve publish hattı ayrı izlenir. `.openai/hosting.json`, Vite Sites eklentisi, Apps Script `/work` bugün bağlıdır; ortak veri/yönlendirme etki analizi olmadan kaldırılmaz.
3. **Sorumlu:** ChatGPT = kapsam/karar ve Müdür görev emri; Codex/Müdür = kaynak ve uygulama; Denetleyici = bağımsız BLOCKER/HIGH güvenlik/kalite incelemesi; kullanıcı = nihai ürün/publish/production kritik yetki. Aynı ajan kendi üretimini bağımsız inceleme olarak beyan etmez.
4. **Uygulama başına minimum kanıt:** BASE_SHA/TREE, değişen dosya listesi, önce/sonra envanteri, davranış API/SQL/arayüz, veri modeli + yetki, sentetik otomatik testler, CI bağlantısı, gereken Chrome masaüstü/mobil, staging URL + gerçek runtime kaynak/sürüm eşlemesi, sentetik DB readback, risk ve rollback/checkpoint.
5. **PASS kademeleri:** SOURCE_PRESENT ≠ CODE_READY ≠ CI_PASS ≠ STAGING_DB_UI_PASS ≠ EDUCATOR_ACCEPTED ≠ FINAL_ACCEPTED. Gerçek öğrenci verisiyle test yok, başkalarının verisine erişim yok; production/migration/merge açık yetki gerektirir.
6. **Plan ve hafta takibi:** Bütün fazlar için yüzde ancak onaylı alt kabul kapıları sayılarak hesaplanır. Önceki bir fazdaki başarılı test yeni kod/sürümün kabul kanıtı olamaz.

## 3. Uygulama kapıları (sıra korunur)

| Sıra | Faz | Beklenen tek ana teslim | Bitirme / çıkış kanıtı | İlk durum |
| --- | --- | --- | --- | --- |
| **F0** | Proje ve kapsam kontrolü | [PR #79](https://github.com/dekorix/cza-akademi/pull/79) ile tek ekosistem/tanıtım sınırı kararı + gerçek Codex devir testi | CI/test, kapsam diff, uygun merge yetkisi ve ayrı oturum handoff raporu; production yok | **CI 5/5 PASS, PR DRAFT; devir E2E AÇIK** |
| **F1** | T5 Başlangıç Değerlendirmesi kabulü | [PR #73](https://github.com/dekorix/cza-akademi/pull/73) aday/çevrim aktif oturumunun güvenli sürdürülmesi, [Issue #72](https://github.com/dekorix/cza-akademi/issues/72) HIGH bulguları | UI aynı adlı farklı aday ayrımı, eşzamanlı çift create yok, farklı kurum 403, hard refresh, DB attempt/observation readback, bağımsız inceleme, kaynak/deploy eşlemesi | **Staging sentetik pozitif kanıtlar var, final kabul AÇIK** |
| **F2** | Öğrenci Paneli | öğrenci giriş/kişisel günlük rota/kaldığı yer | Student ID, öğrencinin yalnız kendi görevleri, reload ve merkezi veri | PLAN; kod kaynakları var, UI kabul doğrulanmadı |
| **F3** | Çalışma Merkezi | gerçek akademik ve zihin egzersizleri ortak oturum/kanıt | Açılıp çözülür görev, attempt/süre/destek/strateji, tekrar/resume, eski modül parity | PLAN; parçalı kod kaynakları var |
| **F4** | Eğitmen Paneli | seçili öğrenci ve kurum kapsamında yönetim ekranı | linked/unlinked + tenant izolasyonu, gerçek denemeyi görme, onay kararları, responsive | PLAN; parçalı kod kaynakları var |
| **F5** | Gerçek öğrenci geçmişi | tek zaman çizelgesi | değerlendir→çalış→deneme/gözlem→rapor DB readback, aynı ID, tarih/iz korunur | PLAN |
| **F6** | Ödevlendirme | eğitmen ödev atar, öğrenci uygular, eğitmen görür | görev sahipliği/yetki, idempotent atama/bitirme, yanlış kurum 403, DB kanıt | PLAN |
| **F7** | Raporlar | eğitmen/onaylı öğrenci/veli raporları | ham kanıt-eğitmen yorumu ayrımı, erişim, yeniden ölçüm, gerektiğinde PDF | PLAN |
| **F8** | Ortak Student Learning Profile | öğrenmenin birleşik veri profili | 14 beceri + akademik kazanım + strateji + yardım/yanılgı ve transfer; yetersiz kanıta INSUFFICIENT | PLAN |
| **F9** | Koçluk / LGS / YKS | hedefler, görev planı ve performans döngüsü | tek SLP, öğretmen onayı, TYT/AYT ve LGS hedeflerinin veri akışı, eski kapsamı eksiltmeme | PLAN |
| **F10** | Veli Paneli | veli kendi çocuğunun gelişimini ve planını görür | onaylı rapor, kişi/kurum izolasyonu, KVKK/minimizasyon ve uygun izin | PLAN |
| **F11** | AI öneri motoru | açıklanabilir eğitmen denetimli öneri | gerekçe + kaynak kanıtı + insan onayı; tanı/etiketleme yok, reddedilebilir öneriler | PLAN |

**Yatay kabul kulvarları (ana faz sırasını değiştirmez):**
- **A. Değerlendirme/parite:** E0–P10, P2 23 bölüm/mikro-görev envanteri, 10 özel eğitim profilinin gerçek görev, kanıt, rapor ve pedagojik uygunluk denetimi F1→F8 boyunca aşamalı olarak yürür. Staging'deki E2 “aktif ama açılmıyor”, P10 görünmeme ve özel eğitim summary/bitiş doğruluğu bulguları #72'de ayrı HIGH/MEDIUM kapılarıdır.
- **B. Görsel/pedagojik UX:** Her yaş için gerçek görev çeşitliliği, erişilebilirlik/klavye/mobil, gelişimsel uygunluk, çocuğu etiketlemeyen sonuç açıklaması. Kaynak mevcut = pedagojik kabul değil.
- **C. Tanıtım/satış/kayıt:** Sites'te tanıtım/iletişim/paket başvurusu; asıl değerlendirme, kayıt, Student ID, öğrenci dosyası ve yetki Büyük CZA'dadır. [Issue #77](https://github.com/dekorix/cza-akademi/issues/77) Sites sahiplik/sürüm erişimi ayrı takip; ana eğitim üretimini bloke etmez. Satış/ödeme güvenilir yetkili çekirdek akış olmadan canlıya alınmaz.

## 4. Her fazın gerçek çalışma prosedürü

**A. Başlat (yalnız bir faz):** güncel main commit/tree + repo/staging sürüm kanıtını oku; mevcut açık PR'ları ve kabul kanıtlarını sınıflandır; eksikleri yeni kodla karıştırma. Önce/sonra envanterini kapat.

**B. Görev emri (Müdür/Codex):** bir issue altında tek somut başarısız davranış, `BASE_SHA`, yalnız etkilenecek dosyalar/API/SQL/UI, etkilemeyeceği alanlar, sentetik test ve geri dönüş kuralını ver. Üç yeni özellik paketiyle kapsamı şişirme.

**C. Gerçek uygulama:** küçük commit/PR, tip/lint/unit/integration; bağımsız kalite incelemesi yalnız somut HIGH/BLOCKER veya teslim kritik aşamasında, geçmiş kapanmış güvenlik başlıklarını nedensiz açma.

**D. Staging:** gerçek Chrome desktop/mobile, güvenilir deploy fingerprint, normal öğrenci/eğitmen/veli oturumu; erişim reddi, eşzamanlılık, yeniden yükleme, veritabanı readback, sentetik temizliği. Böyle kanıt yoksa en fazla CODE+CI PASS.

**E. Nihai kabul:** ChatGPT kapsam/ürün kararı, açık gerekli merge/yayın izinleri, kritik commit/tree/remote checkpoint, kalıcı issue ilerleme kaydı. Başarısızlıkta aynı fazda devam; “bitti” ilan etme.

**F. Kullanıcı gösterimi:** her kabul edilen faz için açılır doğrulanmış **staging** bağlantısı, hangi ekranda neyin çalıştığını ve neyin eksik olduğunu kısa, somut şekilde ver. Kullanıcıya gereksiz 5-10 ekran görüntüsü toplatma; bağlı araçlarla kendin doğrula.

## 5. İlk üç fiilî teslim / gerçek başlangıç

### ADIM 0 | ŞİMDİ | PR #79 mimari sabitleme
- **Kanıt:** HEAD `1fef56acf0c7662f863626bb380f88d2c2ed4772`; Assessment, Reports, Assignment, PostgreSQL security, Governance olmak üzere **5/5 CI PASS**.
- **Sınır:** 7 belge/QA dosyası; `apps-script/Handoff.gs`, `vite.config.ts`, `.openai/hosting.json`, Student ID/API/SQL/production değişmez.
- **Yapılacak:** PR #79 kaynak diff'i ve governance içerik/branch protection'ı tekrar incele; izin varsa belge entegrasyonunu yap; merge checkpoint'i kaydet. Açık izin yoksa review-ready durumda bekle.
- **Ek F0 devir kabulü:** `docs/CZA_DEVIR_KABUL_SENARYOSU.md` gerçek ayrı Codex oturumunda koşulsuz kanıtlanacak. Devir ajanı `AGENTS.md`, #80 ve #72'yi okuyup tek teknik T5 görevi, korunan Site sınırı ve son SHA'yı doğru ifade etmeden F0 tam kabul edilmez.

### ADIM 1 | TEK AKTİF ÜRÜN GÖREVİ | T5 #72 / PR #73 kalan kapı
- **Var olan PASS'ler:** `37903824931` staging eşzamanlılık/tenant/kanıt readback; `37929459667` merkezi DB readback; `37930837286` aynı adlı iki aday gerçek UI ve veri ayrımı; PR head `2e36c378068c5e8f05384b41e7a648f087441986` üzerinde Assessment, browser, PostgreSQL CI PASS.
- **Kalan:** bağımsız reviewer teslimi; kodun main'e göre ayrıntılı farkı ve deploy migration sözleşmesi, staging runtime/build SHA eşlemesi ve real device/mobile Chrome kabulünün eksik olan kısmı; kabul gerektirirse en dar düzeltme. Production benzersiz indeks kurulmadığından kayıt öncesi üretim create fail-closed 503, kanıtsız deploy yapılmaz.
- **Tek teslim:** “T5 PRE-ENROLL RESUME ACCEPTANCE” kaynak commit/tree, test/screenshot linkleri, staging readback, yetki ve idempotency matrisi, kalan risk/nihai karar. Ayrı bağımsız denetim kullan, tek güncel issue #72 içinde tut.

### ADIM 2 | T5 kabulünden sonra | Öğrenci Paneli ilk kanıtlı akış
- **Tek senaryo:** sentetik kayıt öncesi değerlendirme / öğrenci kimliği → yetkili öğrenci giriş → Benim Öğrenme Rotam'da doğru program/görev → ilgili Çalışma Merkezi ekranına yönlenme. Önce baseline Chrome+API+DB; eksik bağa dar PR; sonra eğitmen görünümü. Yeni öğrenci ID üretme veya kaynak içerik silme yok.
- **Teslim:** çalışır staging URL, aynı öğrenci kimliği zinciri, gerçek DB readback, negatif başka öğrenci testi, hard reload.

## 6. Ölçüm ve ilerleme sistemi

- **Milestone / faz kabul oranı:** 12 adımlı F0–F11; bir faz yalnız `NIHAI_KABUL` + checkpoint varsa “tamamlandı” sayılır. Her fazın alt kabul kriterlerinden kaçının geçtiği kanıtla sayılmadan kesin yüzde yazılmaz. Kısmi CI/test sayıları ayrıca raporlanır.
- **Her teslimde zorunlu:** GENEL PROJE İLERLEME %, MEVCUT FAZ İLERLEME %, TAMAMLANAN, KALAN, KAPSAM SAPMASI=YOK|VAR, SIRADAKİ TEK ADIM. Veri yoksa `ÖLÇÜLMEDİ`.
- **Takip tek merkezi yer:** [Issue #80](https://github.com/dekorix/cza-akademi/issues/80); alt ürün HIGH listesi #72; Sites takip #77; PR/commit/workflow kanıtları issue yorumları ile bağlanır. Yeni görev ana issue'yu çoğaltmaz.
- **Güncelleme ritmi:** her **gerçek** checkpoint ve faz kararı sonunda; uzun bir görevde ara durum. Takvimsel otomatik rapor ayrıca kurulmadı.
- **Kapsam sapması:** iş emri tanıtım Sites'i ana platform sanarsa, yeni ikinci öğrenme DB/öğrenci kimliği kurarsa, eski P2/özel eğitim içeriğini silerse **KAPSAM SAPMASI=VAR** ve işe başlanmaz.

**PLAN KARARI:** Bu belge doğrulanmış durum ve yapılacakları ayırır. Planın GitHub'a yazılması F1–F11'in geliştirildiği veya kabul edildiği anlamına gelmez. İlk teknik iş #72 T5 kanıtlı kapanıştır. Production izni verilmedi.
