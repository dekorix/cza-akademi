# CZA | Kronolojik Karar Defteri

Bu defter yalnız **nihai ürün/yönetim kararlarını**, tarih, kanıt ve değişiklik gerekçesiyle izler. Taslak fikirleri kabul edilmiş karar gibi kaydetmez. Geçmiş tüm konuşmaların eksiksiz dökümü **değildir**. Tarihsel kararlar kaynağı doğrulandıkça kontrollü biçimde eklenir.

| Karar ID | Tarih | Karar ve sınır | Durum | Kaynak / kanıt | Üstüne yazılacaksa gerekçe |
|---|---|---|---|---|---|
| CZA-K-001 | 2026-10-09 | Büyük CZA, tek öğrenci kimliği ve tek Student Learning Profile ile akademik öğrenme ve beceri atölyelerini bütünleştirir. Öğrenci ana deneyimi Benim Öğrenme Rotam / Akademik Öğrenme / Beceri ve Zihin Atölyesi şeklindedir. | ÜRÜN VİZYONU ONAYLI; uygulama kabulü ayrı | PR #74 ürün vizyonu, docs/CZA_MASTER_ARCHITECTURE.md | Kullanıcı kararı gerektirir |
| CZA-K-002 | 2026-10-09 | Kontrol Kulesi ChatGPT, T5 Patronu, Codex/Müdür için ortak yönetim standardıdır; kabul için kapsam, içerik/UX, kod, yetki, test, staging kanıtı ve checkpoint aranır. | YÖNETİM STANDARDI ONAYLI; otomasyon kısmi | PR #74 ve docs/CZA_KONTROL_PROTOKOLU.md | Kullanıcı kararı gerektirir |
| CZA-K-003 | 2026-10-09 | Production yalnız açık ürün sahibi izniyle. Yeni öğrenci kimliği/DB yaratma, gerçek çocuk verisiyle test, kanıtsız merge/yayın yok. | GEÇERLİ SINIR | docs/CZA_KONTROL_PROTOKOLU.md | Kullanıcı kararı gerektirir |
| CZA-K-004 | 2026-10-09 | 0–YKS uzun vadeli ürün kapsamı; 0–2 yaşta veli/eğitmen aracılı gelişimsel uygulama, gelecekte KPSS/AGS opsiyonu. İlk ticari sürüm kapsamı/fiyatları ayrı karar gerektirir. | VİZYON; FAZ DETAYI AÇIK | docs/CZA_URUN_VIZYONU_TASLAK.md | Hedef fazlar ayrı incelenecek |
| CZA-K-005 | 2026-10-09 | Başlangıç Değerlendirmesi ayrı staging önizlemesi tamamlandı sayılmaz. P2 eski kapsamı ve özel eğitim görevleri eksiltilmez; merkezî kimlik/oturum ve pedagojik kalite ayrı kabul edilir. | KAPSAM KORUMASI | GitHub issue #72, PR #73 | Gerçek kabul gerektirir |

| CZA-K-006 | 2026-10-09 | **Tek CZA ekosistemi.** Büyük CZA ana eğitim platformudur; tanıtım/satış Sites uygulaması bu ekosistemin **yalnız ayrı yayınlanan web parçasıdır**, ayrı öğrenci/öğrenme ürünü değildir. Student ID, Student Learning Profile, değerlendirme, akademik/beceri motoru, eğitmen yetkisi merkezî kalır. Mevcut Sites `/work`/manifest/Vite bağları test edilmeden kaldırılmaz. | **ÜRÜN MİMARİSİ KESİNLEŞTİRİLDİ; TEKNİK AYRIŞTIRMA BEKLİYOR** | Ürün sahibinin 9 Ekim açık talimatı; `docs/CZA_TEK_EKOSISTEM_TANITIM_SINIRI_20261009.md`; PR #59 ve reddedilen #78 | Yeni ürün sahibi kararı ve geçiş testleri gerekir |

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
