# CZA | Kronolojik Karar Defteri

Bu defter yalnız **nihai ürün/yönetim kararlarını**, tarih, kanıt ve değişiklik gerekçesiyle izler. Taslak fikirleri kabul edilmiş karar gibi kaydetmez. Geçmiş tüm konuşmaların eksiksiz dökümü **değildir**. Tarihsel kararlar kaynağı doğrulandıkça kontrollü biçimde eklenir.

| Karar ID | Tarih | Karar ve sınır | Durum | Kaynak / kanıt | Üstüne yazılacaksa gerekçe |
|---|---|---|---|---|---|
| CZA-K-001 | 2026-10-09 | Büyük CZA, tek öğrenci kimliği ve tek Student Learning Profile ile akademik öğrenme ve beceri atölyelerini bütünleştirir. Öğrenci ana deneyimi Benim Öğrenme Rotam / Akademik Öğrenme / Beceri ve Zihin Atölyesi şeklindedir. | ÜRÜN VİZYONU ONAYLI; uygulama kabulü ayrı | PR #74 ürün vizyonu, docs/CZA_MASTER_ARCHITECTURE.md | Kullanıcı kararı gerektirir |
| CZA-K-002 | 2026-10-09 | Kontrol Kulesi ChatGPT, T5 Patronu, Codex/Müdür için ortak yönetim standardıdır; kabul için kapsam, içerik/UX, kod, yetki, test, staging kanıtı ve checkpoint aranır. | YÖNETİM STANDARDI ONAYLI; otomasyon kısmi | PR #74 ve docs/CZA_KONTROL_PROTOKOLU.md | Kullanıcı kararı gerektirir |
| CZA-K-003 | 2026-10-09 | Production yalnız açık ürün sahibi izniyle. Yeni öğrenci kimliği/DB yaratma, gerçek çocuk verisiyle test, kanıtsız merge/yayın yok. | GEÇERLİ SINIR | docs/CZA_KONTROL_PROTOKOLU.md | Kullanıcı kararı gerektirir |
| CZA-K-004 | 2026-10-09 | 0–YKS uzun vadeli ürün kapsamı; 0–2 yaşta veli/eğitmen aracılı gelişimsel uygulama, gelecekte KPSS/AGS opsiyonu. İlk ticari sürüm kapsamı/fiyatları ayrı karar gerektirir. | VİZYON; FAZ DETAYI AÇIK | docs/CZA_URUN_VIZYONU_TASLAK.md | Hedef fazlar ayrı incelenecek |
| CZA-K-005 | 2026-10-09 | Başlangıç Değerlendirmesi ayrı staging önizlemesi tamamlandı sayılmaz. P2 eski kapsamı ve özel eğitim görevleri eksiltilmez; merkezî kimlik/oturum ve pedagojik kalite ayrı kabul edilir. | KAPSAM KORUMASI | GitHub issue #72, PR #73 | Gerçek kabul gerektirir |
| CZA-K-006 | 2026-10-10 | **Tek aktif görev / Mission Control:** CZA'da aynı anda tek aktif geliştirme görevi yürür. **GitHub**, mutable repo state (main HEAD, açık PR sayısı/trafiği, branch sayısı, CI, kabul kanıtı) için gerçek kaynaktır. **`docs/CZA_CANLI_DURUM.md`**, aktif yönetim zinciri ve kapsam için kanonik koordinasyon kaynağıdır; içindeki HEAD/PR/branch değerleri yalnız son doğrulanan snapshot'tır ve canlı GitHub'ın yerine geçmez. `docs/CZA_DURUM_PANOSU_TASLAK.md` yalnız tarihsel snapshot'tır. Aktif zincir: üst kabul issue'su (#81) → tek uygulama emri (#82) → tek çalışma PR'ı (#73). Diğer açık PR'lar aktif görevin önüne geçemez. Durdurma yalnız aktif zincir / aktif PR / korunan HEAD / kapsam / kabul durumu çelişkisinde uygulanır; yalnız HEAD ilerlemesi, PR sayısı veya branch sayısı değişmesi tek başına blokaj değildir, snapshot yenilenir. | YÖNETİM KARARI ONAYLI; uygulama kabulü ayrı | PR #83 merge `4605cbbcb20aedbc322e3abfaa5170611c73e750`, `docs/CZA_CANLI_DURUM.md`, `docs/CZA_KONTROL_PROTOKOLU.md`, `AGENTS.md`, issue #81, issue #82, PR #73 | Kullanıcı kararı gerektirir |

## Yeni karar kaydı şablonu
- ID / tarih:
- Değişikliği başlatan sorun veya yeni kullanıcı kararı:
- Eski kural ve kaynağı:
- Yeni kural ve kapsamı:
- Gerekçe, öngörülen yan etkiler:
- Etkilenen modüller ve açık PR/issue:
- Kim tarafından, hangi kanıtla onaylandı:
- Kod/CI/staging kabulünden farkı:
- Geri alma/yeniden değerlendirme koşulu:

**Kural:** Bu kayıt commit geçmişini ikame etmez. Uygulama durumu GitHub PR/CI/kanıtla ayrı tutulur.

## CZA-K-006 ayrıntılı kaydı — Tek aktif görev / Mission Control

- **ID / tarih:** CZA-K-006 / 2026-10-10
- **Değişikliği başlatan sorun veya yeni kullanıcı kararı:** Mission Control kurulumu (#83) `main`'e alındıktan sonra `docs/CZA_CANLI_DURUM.md` gerçek GitHub durumundan koptu: main HEAD eski commit'i (`a3e3a14`), açık PR sayısı 8 yerine gerçekte 7, PR #83 hâlâ DRAFT görünüyordu. Aynı anda birden çok işe başlama riski doğdu.
- **Eski kural ve kaynağı:** Durum ve karar takibi `docs/CZA_DURUM_PANOSU_TASLAK.md` üzerinden yapılıyordu; bu dosya 2026-10-08/09 tarihli anlık görüntüdür ve canlı PR/CI durumunu taşımıyordu.
- **Yeni kural ve kapsamı (self-referential HEAD düzeltmesi dahil):** İki kaynak ayrılır. **GitHub = mutable repo state için gerçek kaynak** (main HEAD, açık PR sayısı/trafiği, branch sayısı, CI, kabul kanıtı). **`docs/CZA_CANLI_DURUM.md` = aktif yönetim zinciri ve kapsam için kanonik koordinasyon kaynağı**; içindeki HEAD/PR/branch değerleri açıkça "Son doğrulanan GitHub snapshot" olarak etiketlenir ve canlı GitHub'ın yerine geçmez. `docs/CZA_DURUM_PANOSU_TASLAK.md` yalnız tarihsel snapshot olarak kalır. Aynı anda tek aktif geliştirme görevi yürütülür; zincir üst kabul issue'su → tek uygulama emri → tek çalışma PR'ı şeklindedir. Bir belge kendi merge sonrası `main` HEAD'ini kesin kanonik değer olarak taşıyamaz; onu değiştiren commit HEAD'i yeniden değiştirir. Bu nedenle durdurma yalnız **aktif zincir / aktif PR / korunan HEAD / kapsam / kabul durumu** çelişkisinde uygulanır; yalnız `main` HEAD ilerlemesi, açık PR sayısı veya branch sayısı değişmesi tek başına uygulama blokajı oluşturmaz, snapshot yenilenir ve iş devam eder.
- **Gerekçe, öngörülen yan etkiler:** Yanlış faz tespiti ve paralel/çakışan iş üretimini engeller. Yan etki: her görev başında GitHub okuma maliyeti artar; bu, kanıtsız ilerleme riskinden daha ucuzdur.
- **Etkilenen modüller ve açık PR/issue:** `docs/CZA_CANLI_DURUM.md`, `docs/CZA_KONTROL_PROTOKOLU.md`, `docs/CZA_KARAR_DEFTERI.md`, `AGENTS.md`. Açık zincir: issue #81, issue #82, PR #73.
- **Kim tarafından, hangi kanıtla onaylandı:** Ürün sahibi talimatı (2026-10-10 Mission Control post-merge tutarlılık görevi); kanıt olarak GitHub API okumaları — main HEAD `4605cbbcb20aedbc322e3abfaa5170611c73e750`, PR #83 `MERGED` (2026-10-10T19:14:42Z), açık PR sayısı 7, PR #73 `OPEN`/draft HEAD `957fa1b8bdcc8d1a6da40c2b22ad90d0cdd98a01`.
- **Kod/CI/staging kabulünden farkı:** Bu bir yönetim/dokümantasyon kararıdır. Ürün kodu, SQL, migration, staging, Worker veya production kabulü değildir ve bunların yerine geçmez.
- **Geri alma/yeniden değerlendirme koşulu:** Ürün sahibi tek aktif görev kısıtını kaldırırsa, canlı durum kaynağı değiştirilirse veya GitHub merkezli olmayan bir yönetim aracına geçilirse bu karar yeniden değerlendirilir.
