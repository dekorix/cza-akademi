# CZA | Depo İçin Ajan Başlangıç Kuralları

Bu depo **ÇELİK ANZAN 2 / büyük Çelik Zihin Akademisi** platformudur; ayrı tanıtım Sites uygulamasıyla karıştırılmamalıdır. Yeni sohbet, Codex veya T5 Patronu görevi geldiğinde önce bu kuralları ve kanonik belge kaynaklarını oku. Bu dosyanın varlığı bir ajanın otomatik bağlandığını veya GitHub eylemlerini kendi kendine başlattığını kanıtlamaz.

## Çalışmaya başlamadan oku
1. `docs/CZA_CANLI_DURUM.md` (**canlı yönlendirme panosu**; aktif tek issue/PR/görev burada belirlenir, ancak GitHub canlı durumu her başlangıçta yeniden doğrulanır)
2. `docs/CZA_KONTROL_PROTOKOLU.md` (onaylı yönetim standardı)
3. `docs/CZA_MASTER_ARCHITECTURE.md` ve `CENTRAL_IDENTITY_PLAN.md`
4. `docs/CZA_14_Beceri_v1.md` (14 kanonik beceri)
5. `docs/CZA_URUN_VIZYONU_TASLAK.md` (taslak kalan ticari ve uygulama ayrıntıları)
6. `docs/CZA_KARAR_DEFTERI.md` (tarih ve gerekçeli karar)
7. `docs/CZA_DURUM_PANOSU_TASLAK.md` (tarihsel snapshot, canlı durum değildir)
8. `docs/CZA_DEGERLENDIRME_KAYNAK_ENVANTERI_20261009.md` (26 profil, P2 23 bölümün kaynak kanıtı, runtime kabulü değildir)
9. `docs/CZA_MODUL_KANONIK_MANIFEST.json` (10 ana faz + 15 program ailesi, kaynak referansları; gerçek kabul değildir)
10. Github `main` HEAD, açık PR/issue, CI ve hedef staging build SHA. Başta **güncel** doğrula.

**Tek aktif görev kuralı:** `CZA_CANLI_DURUM.md` içindeki aktif zincirin önüne başka ürün işi alınmaz. Canlı GitHub verisi dosyayla çelişirse uygulamayı durdur, panoyu güncelle ve yalnız doğrulanmış yeni aktif zincirle devam et.

## Nihai ürün vizyonu ve değişmez kural
Tek Student ID ve Student Learning Profile, yaşa uyarlanmış 0–YKS gelişim/akademik öğrenme/beceri atölyesi. Öğrencinin üç yüzeyi: **Benim Öğrenme Rotam / Akademik Öğrenme Merkezi / Beceri ve Zihin Atölyesi**; verileri ayrılmaz. 14 beceri ölçme kanıtının boyutlarıdır; klinik tanı veya öğrenciyi sabit etiketleme aracı değildir. 0–2 yaşta yetişkin aracılı gözlem/esas çalışma. LGS/YKS çekirdek kapsam; KPSS/AGS gelecekteki opsiyon. Paket, veli ve satış akışları ortak omurgaya bağlanır; ayrı bir öğrenci kimliği kurulmaz.

## Sıra ve uygulama disiplini
Ana faz: Öğrenci Paneli → Çalışma Merkezi → Eğitmen Paneli → gerçek öğrenci geçmişi → ödevlendirme → raporlar → ortak Student Learning Profile → koçluk/LGS/YKS → Veli Paneli → AI öneri motoru. **Eksiltme yasak:** önce/sonra envanteri olmadan eski özellik, P2 23 bölüm, özel eğitim beceri ve görevlerini kaldırma. Bir PR = dar kabul edilebilir iş; gereksiz tüm-repo refactor veya test tekrarı yapma.

A) merkezi kimlik/oturum/kanıt/yetki, B) pedagojik içerik/görsel/UI/UX, C) tanıtım/paket/kayıt/veli kulvarlarını ayır. Üçü ortak Student Learning Profile'a dayanır. Kod yazılması PASS değildir: gereken sentetik akış + Chrome mobile/desktop + yetki + DB readback + eğitimci onayıyla kabulü ayrı kanıtla. GitHub issue #72 Başlangıç Değerlendirmesi, PR #73 kayıt öncesi oturum konuları için kanıttır; canlı durum her yeni koşuda güncel okunur.

## Güvenlik ve karar
Ürün sahibi açıkça izin vermeden **production deploy, publish, merge veya gerçek öğrenci verisiyle test YAPMA**. DB migration, force-reset/rebase, secrets, farklı kurum erişimi ve mevcut T5 kabulünü bozacak müdahale için ayrıca somut onay gerekir. Kapanmış P0-C/P1/P2/P3 konularını yeni kanıt olmadan yeniden açma. Dış yayın bağlantılarının durumu belirsizse birleştirmeyi durdur.

Yalnız ilgili dosyaları incele; gerekçeli öneri, kod sınırı, pedagojik/UX alternatif, testler ve geri dönüş planı sun. Eksik kanıta `BLOCKED` veya `DOĞRULANAMADI` yaz; PASS uydurma.

## Yeni görevi başlatırken
`node --test tests/cza-governance-contract.test.mjs tests/cza-handoff-inventory-guard.test.mjs` ve `node scripts/qa/cza-handoff-inventory-guard.mjs` yalnız kapsam uygunsa ve dosyalar mevcutsa çalıştır. Bu, **kaynak envanterini** korur; staging son kullanıcı kabulünün yerine geçmez.

Her ana teslim sonunda: `GENEL PROJE İLERLEME %`, `MEVCUT FAZ İLERLEME %`, `TAMAMLANAN`, `KALAN`, `KAPSAM SAPMASI=YOK|VAR`, `SIRADAKİ TEK ADIM`. Ölçüm yoksa yüzde üretme.
