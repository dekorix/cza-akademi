# CZA | Kanıta Dayalı Durum Panosu (ONAY TASLAĞI)

> Tarih: 2026-10-08. Bu anlık **bağlam özeti** canlı telemetri değildir. Her kullanımda GitHub/CI/staging yeniden doğrulanmalıdır. Taslak PR ana daldaki mevcut teslimleri değiştirmez.

## Değişmez yön
**0–YKS vizyonu; tek Student ID + tek Student Learning Profile; öğrenciye 'Benim Öğrenme Rotam / Akademik Öğrenme / Beceri ve Zihin Atölyesi'; eğitmen onaylı adaptif rota; özel eğitim ve erken gelişim dahil, yaşa uygun farklı yüzeyler.** Paket, rapor, veli ve tanıtım akışı ileride aynı öğrenci yaşam döngüsüne bağlanır.

## Bağımsız kulvarlar ve güncel kanıt sınırı
| Kulvar | Son görülen durum | Kapanış için zorunlu kapı |
| --- | --- | --- |
| A. Merkezi kimlik/entegrasyon | Neon merkezî mimari mevcut; bazı alt test PASS; tüm hedefler için nihai staging acceptance yok | Gerçek oturum + sentetik kayıt + yetki/izolasyon + hard reload + rapor readback |
| B. Değerlendirme/içerik/UX | 26 profil merkezî katalogda; staging ilk sayfada P10 yok; E2 kartı aktif gösterilip açılamıyor; #72 açık | Her profil içerik/başlatma/kanıt/rapor/uyarlama; yaş/mobil/erişilebilirlik kabulü |
| C. Satış/paket/veli | Entegre müşteri yolculuğu ürün vizyonunda; ayrı tanıtım sitesi var | Ürün/paket kararı, başvuru, eğitmen raporu, veli izinleri, kayıt ve yetki aktivasyonu |

## Kanıt ve linkler
- Ana repo: https://github.com/dekorix/cza-akademi
- Son doğrulanan main commit (2026-10-08): `9f76b6322991a850980dd1240e6232882bface2e` (#71), **bu belge sonraki tarihte güncel sayılmamalı**.
- Değerlendirme sert denetim: https://github.com/dekorix/cza-akademi/issues/72
- Ana canlıya çıkış panosu [#1](https://github.com/dekorix/cza-akademi/issues/1): 2026-09-07 tarihli ilk kayıt, **güncel PASS statüsü için tek başına güvenilmez**.
- PR #60: https://github.com/dekorix/cza-akademi/pull/60 (2026-10-08'de DRAFT/OPEN).
- PR #69: https://github.com/dekorix/cza-akademi/pull/69 (2026-10-08'de DRAFT/OPEN; hedefli CI başarı kaydı; staging nihai kabul değil).
- Değerlendirme staging aday bağlantısı: https://08dc47f9-cza-akademi-staging.cza-staging-habip.workers.dev/cza-degerlendirme/ (bu URL **onaylı ana ürün kabulü değildir**).

## Aktif tek teknik adım
**Özel eğitim kayıt öncesi aday oturumunun güvenli, çift kayıt üretmeyen yeniden başlatma davranışı**, #72 kabul kriterleri ve sentetik staging readback kanıtıyla doğrulanacak. Bu adım kapatılmadan genel değerlendirme kabulü ilan edilmez.

## Açık ürün kararları
1. İlk satışa açılacak **minimum program/yaş kapsamı** ve paket fiyat/isimleri henüz nihai onaylı değil.
2. 0–5 yaşta yetişkin aracılı içerik ve 5+ öğrenci ekranı için ayrı kabul standartları netleştirilecek.
3. Mevcut P2 23 bölümün mikro-görev envanteri ile merkezi port kapsamı karşılaştırılacak; hiçbir içerik doğrulanmadan eksiltilmeyecek.

## Zorunlu rapor (son doğrulanmış, ölçülebildiğinde)
- **GENEL PROJE İLERLEME %:** Ölçüm altyapısı/son veriler yok; uydurulmaz.
- **MEVCUT FAZ İLERLEME %:** Ölçüm altyapısı/son veriler yok; uydurulmaz.
- **TAMAMLANAN:** Ürün vizyonu kararı için taslak, 14 beceri standardı ve ana mimari mevcut; çeşitli teknik alt testler.
- **KALAN:** Merkezi uçtan uca kabul, içerik ve UX sert kabul, paket/veli yaşam döngüsü.
- **KAPSAM SAPMASI=YOK** (taslak kontrol paketinde hiçbir ürün kodu değiştirilmedi).
- **SIRADAKİ TEK ADIM:** #72 kayıt öncesi oturum tekrar başlatma kusurunun testli düzeltilmesi.

## 9 Ekim 2026 | Kontrol Kulesi yeni checkpoint (tarihsel, salt okunur)

- PR #75, PR #74'ün yalnız **belge dalına** birleştirildi: `e6f9a7a1be4f8876bbd3d5beced887db8bc72e9b`.
- PR #76, `AGENTS.md`, gerçek kaynak envanteri, devir senaryosu ve regresyon bekçisini aynı belge dalına birleştirdi: `72bdbf8240766057803583ddafe43c3f00e5baba`.
- CZA değerlendirme kaynak envanteri: 16 yaş/sınıf + 10 özel eğitim kodu; P2 23 bölüm / 226–239 sözleşmesel görev; 14 beceri. **Gerçek mikro-görev karşılaştırması ve staging kabulü hâlâ açık.**
- `docs/CZA_MODUL_KANONIK_MANIFEST.json` 10 ana faz ve 15 çapraz program ailesini taşır; her biri SOURCE_REFERENCE_PRESENT_ACCEPTANCE_UNVERIFIED olarak tutulur. Kaynak dosyanın varlığı nihai ürün kabulü değildir.
- `tests/cza-handoff-inventory-guard.test.mjs` ve `tests/cza-module-manifest.test.mjs` için GitHub CI kaydı PR #74 HEAD ile ayrıca doğrulanır; önceki CI PASS otomatik olarak yeni HEAD'e taşınmaz.
- **MAIN MERGE BLOCKED:** harici Cloudflare/Vercel/Sites yayın etkisi ve GitHub required check/branch protection admin düzeyinde net değil; PR #74 taslak kalacak.
- **SIRADAKİ TEK ADIM:** PR #74 için yayın etkisi ve dal koruma kabulünü yetkili salt okunur kanıtla kapat; ancak sonra main merge konusunda karar ver.
