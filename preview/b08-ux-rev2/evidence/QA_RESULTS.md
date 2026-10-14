# B08-UX-REV2 · yerel sentetik doğrulama · 2026-10-14 UTC

- Node v24.19.0; Chromium 151; Playwright ortam aracı. OS: Linux.
- `node preview/b08-ux-rev2/build.mjs`: PASS, self-contained HTML üretildi.
- `node tests/b08-ux-rev2.test.mjs`: **28/28**, fail0/skip0. [Bireysel sonuçlar](./unit-results.txt).
- `node tests/b08-ux-rev2.browser.mjs`: **36 assertion PASS**, JS error0, network request0. [Sonuç](./browser-results.json). DOM/gerçek UI etkileşimi; gerçek öğrenci yok. İki boyut 1440×900 / 390×844; mobil emülasyon, fiziksel cihaz değildir.
- `node_modules/.bin/tsc --noEmit`: exit0.
- Scoped `oxlint preview/b08-ux-rev2 tests/b08-ux-rev2.test.mjs tests/b08-ux-rev2.browser.mjs`: exit0.
- `npm run lint`: exit1; main ile aynı **1414 hata / 3 uyarı**, diagnostic multiset fark0. GENERAL_LINT=FAIL_BASELINE_UNCHANGED. Eski dosyalar düzeltilmedi.
- Yerel `npm run build`: exit0. Komut ortamından DATABASE_URL/CZA_T5_DATABASE_URL/CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID kaldırıldı. Deploy/DB çağrısı yapılmadı. Standalone HTML build'den bağımsızdır.
- Governance test8/8, kaynak envanteri test9/9, envanter guard PASS (16+10 profil, P2 23 bölüm, 14 beceri).
- `git diff --check`: PASS. Yeni metin dosyalarında postgres URL/private key/UUID/Worker-host/Neon-host örüntü taraması0 bulgu. Bu sınırlı örüntü taraması tam güvenlik sertifikası değildir.
- Accepted contract kaynak kopyası SHA256 `391d479a9d654c14b9f82ceba1c2046a7fb78cbb2e18ab0ad50f491c2cdf1bd4`, PR109 modülüyle birebir aynı. Tam evaluator bağlanmadı; classifier + ayrı UX adapter kullanıldı.

## Sınanan senaryolar

| Senaryo | Beklenen ve gözlenen |
|---|---|
| A öncesi S/B/T | UI disabled + model FIRST_RESPONSE_REQUIRED |
| A tekrar / eski denemeyi değiştirme | IMMUTABLE_RESPONSE / ARCHIVED_ATTEMPT_LOCKED; nested kayıt frozen |
| Yeni deneme | Ayrı ID, ilk kaydın ham yanıtı korunur; UI'da arşiv görünür |
| 4 onluk 7 birlik / 7 onluk 4 birlik | RELATION_OBSERVED / INCORRECT_RELATION, score yok |
| 40+7 / 4,7 | PARTIAL_EVIDENCE / AMBIGUOUS_REVIEW |
| 3 onluk 17 birlik / 0 onluk 47 birlik | EQUIVALENT_NONCANONICAL; matematiksel eşdeğer, kanonik çözümleme değil |
| Kanal kullanılamadı | NOT_ASSESSED, sıfır puan yok |
| A yanlış, S doğru (MODEL) | İki ham yanıt ve faz ayrı; ilk yanıt değişmedi |
| Seçenek tanıma | RECOGNITION_CORRECT/INCORRECT; üretim/ustalık/transfer başarısı değil |
| T geçmiş/yardım bilinmiyor veya eksik | NOT_ASSESSED |
| T genel yargı var, rubrik yok / T5 yok | NOT_ASSESSED |
| T doğrulanmış sentetik beyan + tüm ölçütler | RELATION_OBSERVED; beyan gerçek uzman onayı değildir |
| T eksik ölçütler | PARTIAL_EVIDENCE |
| Şık konumu | Tek denemede dört görevde her konum bir kez; her görevde dört denemelik blokta her konum bir kez; oturuma özgü crypto shuffle, ilk A cevabı ilk konumda değil |
| Sızıntı | A öncesi sonraki ekranlar kapalı, placeholder/örnek cevap düğmesi yok; T başlığında/yanıt alanında çözüm yok |
| Klavye/touch | Native radio Space/ArrowRight + Enter ile kilitleme; mobil tap ile seçenek/kaydet PASS |
| Mobil | Yatay taşma yok; 390×844 öğrenci/eğitmen/nesne ekranı |
| A4 | Büyük şıklı çıktı PDF, 1 A4 sayfa; anahtar eklenmez |

**NOT_RUN:** Ortam politikası file:// gezinmesini reddetti; aynı HTML byte'ları Chromium `page.setContent` ile render/test edildi. Çift tıklama/indirilen dosya açılışı, gerçek ekran okuyucu, fiziksel mobil, insan özel eğitim/çocuk kullanılabilirlik, doğrulanmış öğretmen oturumu, gerçek API/DB/SLP E2E, staging ve production kabulü NOT_RUN. Sunucu kimliği, kalıcı kayıt veya gerçek transfer geçmişi doğrulaması yoktur. Sekme yenilemesi belleği kaybettirir; normal UI'da deneme/yanıt silme yoktur. Kullanıcı görsel kabulü PENDING.
