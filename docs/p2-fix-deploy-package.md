# P2 düzeltmesi — inceleme ve dağıtım paketi

Bu belge dağıtımı hazırlar. Dağıtım, pull request, merge, force-push, uzak veritabanı, SQL, gizli ayar ve gerçek öğrenci verisi bu paketin dışındadır. Aşağıdaki yerel ve sentetik sonuçlar canlı kabul değildir.

| Alan | Değer |
| --- | --- |
| Dal | `cursor/p2-white-screen-question-reachability-4571` |
| Önceki ürün düzeltmesi | `75326e45dbaa8f89e9c0d1f1f3bdce7fe5f76883` |
| Önceki ürün ağacı | `b0778a5d1ce7490be18c5ef73b8cdd75ce8e4427` |
| Önceki paket commit'i | `d0cb8a4cba3ee11fbb3e12eb90b80ebce613a997` |
| AV1 etiket düzeltmesi | Bu belgenin güncellendiği commit. Tam 12 madde `review` olur. |
| Karşılaştırma tabanı | `main` `93fb899a0cd05ab863542c0cbc929275f280fbb1` |
| Ürün farkı | 9 dosya, +660 / −18 |
| Hedef uygulama | `cza-degerlendirme-hl4a5d` |
| Hedef adres | `https://cza-degerlendirme-hl4a5d.v2.appdeploy.ai/` |
| Kaynak klasör | `apps/assessment-appdeploy` |

PR #101 ve PR #107 dosyalarına dokunulmadı.

## 1. Öz inceleme (`main` `93fb899a` ile fark)

### Dosya dosya

| Dosya | Ne değişti | Neden | Risk |
| --- | --- | --- | --- |
| `apps/assessment-appdeploy/src/mathAttitudeFollowUp.ts` | Yeni saf fonksiyon. A7 yanıtı `short`, `middle` veya `explore` ise o madde; boş, `SKIP` veya tanımsız değer ise kısa madde (`4 + 3`, doğru `7`, şıklar `6/7/8`). | A7 atlanınca `SKIP` truthy kalıyor, eski nesne erişimi `undefined.display` fırlatıyor ve React ağacı boş ekrana düşüyordu. | Düşük. Geçerli üç yol aynı. Yalnız bilinmeyen A7 yolu kısa maddeye iner. |
| `apps/assessment-appdeploy/src/MathAttitudeLab.tsx` | A8 maddesi bu fonksiyondan gelir. | Beyaz ekranın kök nedeni. | Düşük–orta. Kayıt içeriği A8 için değişir; aşağıya bakın. |
| `apps/assessment-appdeploy/src/AssessmentErrorBoundary.tsx` | Değerlendirme rotasını saran sınıf sınır. Metin: “Değerlendirme durdurulmadı”, “Bu ekran açılamadı”, düğme “Kaldığın yerden devam et”. Hata metni günlüğe yazılmaz. | Beklenmeyen render hatası tüm sayfayı boş bırakmasın. | Düşük. Yeniden dene, o anki laboratuvarın kaydedilmemiş maddesini başa alır; sunucuya yazılmış denemeler durur. |
| `apps/assessment-appdeploy/src/CzaApp.tsx` | Değerlendirme rotası sınıra alındı. Matematik taramasında 15. maddeden sonra `coreCorrect<=5` ile erken bitiş kalktı. Bitiş `length-1`. İlerleme çubuğu metinleri: matematik “20 tarama görevi”, dil “20 kısa görev”, transfer “12 görev”. Eğitimci rozeti `educatorAttemptBadge` ile çizilir. | Tavan maddeleri X1–X5 her oturumda görünsün; beyaz ekran toparlanabilsin; 12 maddelik AV1 “Destek/inceleme” rozeti almasın. | Orta. Yeni oturumların M1A oranı ve kanıt sayısı değişir. Rozet eşlemesi aynıdır: `review` “Eğitmen incelemesi”. |
| `apps/assessment-appdeploy/src/LanguageScan.tsx` | `idx===14` ve `coreCorrect<=4` erken bitişi kalktı. Bitiş bankanın son maddesi. 10. maddedeki mola duruyor. | 20 maddenin son beşi de gösterilsin. | Orta. L1A kayıt uzunluğu ve oran girdisi değişir. |
| `apps/assessment-appdeploy/src/AdaptiveTransferLab.tsx` | `buildPlan` artık altı alanın 12 maddesini de döndürür. `focus` hâlâ en düşük üç alan olarak yazılır; madde seçmez. Mola, uzunluğun yarısından bir önceki indextedir (12 maddede 5, devam 6). | Altı maddelik kesit tüm bankayı gizlemesin. | Orta. Yeni oturumun beceri oranına altı alan da girer. Etiket kuralı ayrıca düzeltildi. |
| `apps/assessment-appdeploy/backend/adaptiveTransferScore.ts` | AV1 bütünlük sonucu, altı beceri oranı ve eğitimci rozeti. | Tam 6 veya 12 madde `review` kalsın. Eksik, tutarsız, ayrışmayan ve tümü atlanmış kayıt puan üretmesin. | Orta. Eski tutarlı 6 maddelik oran aynıdır. Eksik kayıt artık `insufficient` olur. |
| `apps/assessment-appdeploy/backend/index.ts` | M1A, M2A, M3A, C1A için `next.default` ilgili destek sorusuna bağlandı. M1A ve L1A yönergesi 20 madde der. AV1 yönergesi 12 madde ve altı alan der. Puan ve kanıt `adaptiveTransferSkill` üzerinden gelir. | `review` dalı `default` boşsa oturumu kapatıyordu. AV1 yönergesi ve etiketi 12 maddeyle aynı kurala alındı. | Orta. Yönlendirme değişir. Şema değişmedi. 2000 karakterlik sessiz kesme kalktı. |
| `docs/assessment-14-skill-questions.md` | 14 rapor alanının soru envanteri. | Sahibin “bütün soruları görmek” isteği. Çalışma zamanı yok. | Yok. |
| `tests/p2-assessment-progress.test.mjs` | Graf yürüyüşü, A8 yedek yolu, erken bitişin kalkması, 12 maddelik plan, sınır kaynağı. | Regresyon. | Yok. |
| `tests/p2-av1-score.test.mjs` | 6 ve 12 madde etiketi, rozet, altı beceri oranı ve kaynak bağları. | Eski 6 maddelik kayıt sapmasın; tam 12 madde `incorrect` olmasın. | Yok. |

P2-14 sözleşmesi en az 6, en çok 12 görevdir. Eski 6 maddelik kayıt alt sınırın içinde kalır. Toplam tavan 239’dan 245’e çıkar. Alt sınır 226 durur. Canlı P2 doğru zinciri aynı uçta biter: W1’den MV1’e. MV1’in `next` alanı yoktur; bu meşru kapanıştır. M2, M3, C ve eski L1S sonrası dil blokları bu zincire eklenmedi. DA1S, DA1T ve M1S koşullu destek olarak duruyor.

### Sahibin bilinçli kabul edeceği puan ve rapor farkları

M1A ve L1A’nın 20 maddeye çıkması dağıtımdan önce açık karar ister. AV1 eksik kanıtı ayrı sonuçtır. A8 yedek yolu `FALLBACK` damgası taşır. 2000 karakterlik sessiz kesme yoktur.

1. **M1A ve L1A artık her yeni oturumda 20 madde.** Oran formülü aynıdır: kayıt `MS|` / `LS|` diye açılmazsa veya `n<10` ise `review`; aksi halde `doğru/toplam >= 0.55` ise `correct`, değilse `incorrect`. Rapor, kayıtlı etiketi değil kayıt dizisindeki oranı yeniden okur (`scoreReport` içinde M1A `correct/total`, L1A için S03 okuma, S04 anlama, diğer kodlar genel oran). Eski `n=15` dizileri yerinde kalır ve aynı ayrıştırıcıyla okunur. Yeni diziler tavan maddelerini paydaya ve paydayı tutan doğrulara katar. Alan 2 kanıt sayısı `n(M1A)`; alan 6 kanıt sayısı `n(L1A)`. Yeni tamamlanmış taramada bu sayılar 20’ye çıkar.
2. **M1A `review` artık oturumu kapatmaz.** Atlama, ayrışmayan kayıt veya `n<10` destek sorusu M1S’e gider. Doğru yanıt M1B’de, düşük oran M1S’te kalır. M2A, M3A ve C1A aynı deseni alır; bu üçü canlı P2 zincirinde değildir. `status` zaten `completed` olan oturum yeniden açılmaz. Yanıt ucu `409` “Oturum tamamlandı” döner.
3. **AV1 bütünlük sonucu.** Tutarlı `n=6` veya `n=12` kayıt `review` ve rozet “Eğitmen incelemesi” olur. `n` 6/12 dışında ise, `r=` madde listesi özet pay/payda veya alan başına madde kuralıyla uyuşmuyorsa, payda 2’yi aşıyorsa, dizgi ayrışmıyorsa ya da 12 maddenin tümü `SKIP` ise sonuç `insufficient` olur. Rozet “Eksik kanıt · eğitmen incelemesi”dir. Bu sonuç beceri tabanına ve paydaya girmez. `incorrect` etiketi ve “Destek/inceleme” rozeti bu eksik kayıt için kullanılmaz; diğer görevlerdeki `incorrect` anlamı durur.
4. **AV1 beceri oranı, etiketle aynı kapı değildir.** `scoreReport` ayrışan kayıtta şu pay/paydaları kullanır ve sonucu 0.2 ile 1 arasına sıkıştırır. Payda 0 ise o beceri bu denemeye girmez.

| Beceri | Alan oranı | Sentetik eski 6 madde | Sentetik yeni 12 madde |
| --- | --- | --- | --- |
| S02 | matematik `math/mathMax` | 2/2 → taban 1, kanıt 2 | 2/2 → taban 1, kanıt 2 |
| S04 | dil `lang/langMax` | 1/2 → taban 0.5, kanıt 2 | 1/2 → taban 0.5, kanıt 2 |
| S07 | bellek `memory/memoryMax` | 0/2 → taban 0.2, kanıt 2 | 0/2 → taban 0.2, kanıt 2 |
| S09 | uzam `spatial/spatialMax` | 0/0 → bu denemeye girmez | 1/2 → taban 0.5, kanıt 2 |
| S11 | plan `plan/planMax` | 0/0 → bu denemeye girmez | 2/2 → taban 1, kanıt 2 |
| S12 | esneklik `flex/flexMax` | 0/0 → bu denemeye girmez | 1/2 → taban 0.5, kanıt 2 |

Eski 6 maddelik dizinin etiket ve altı beceri çıktısı, eski `total===6` formülüyle birebir aynıdır. Yeni 12 maddelik dizinin etiketi `incorrect` / “Destek/inceleme” olmaktan çıkıp `review` / “Eğitmen incelemesi” olur. Sayısal tabanlar 0.32 yedek değere düşmez; yukarıdaki oranlardır. Altı alanın yeni kayda girmesi, sahibin 12 madde kararıyla kabul edilen rapor farkıdır. Alan 10’un kanıt sayısı AV1’i saymaz. Öğrenme tepkisi yalnız `correct` etiketine baktığı için AV1 bu indeksi değiştirmez.
5. **AV1 eğitimci yönergesi 12 maddeyi söyler.** “On iki görev altı alanın her birinden ikişer madde olarak açılır.” `focus` madde seçmez.
6. **A8 kısa yedek yolu.** A7 `short`, `middle` veya `explore` ise madde aynıdır ve `a8` alanı seçilen yanıtı tutar. A7 `SKIP` veya tanımsızsa gösterilen işlem `4 + 3` olur ve kayıt `a8=FALLBACK` damgası taşır. Bu damgada A8, `math=` başarı sayacına girmez. `challenge=` A7 yanıtını tutmaya devam eder.
7. **Ham yanıt üst sınırı 16 KB UTF-8 baytıdır.** `POST /api/session/:id/answer` boyutu, yanıt ayrıştırılmadan ve oturum yazılmadan ölçer. 16384 bayt kabul edilir. Bir bayt fazlası HTTP 413 döner ve kayıt aynı kalır. `restart-warmup` ham yanıt yazmaz; görev işaretçisini geri alır. Eski `TRUNCATED|` kaydı hâlâ puana girmez. Kaynak şıklarından ölçülen en uzun dil `r=` dökümü 897 karakterdir.

## 2. Canlı değerlendirmenin kurulumu (yalnız depo kanıtı)

Depodaki kanıt bir AppDeploy kaynak snapshot’ıdır.

- `apps/assessment-appdeploy/SOURCE_PROVENANCE.md` ve `SOURCE_MANIFEST.json`: uygulama `cza-degerlendirme-hl4a5d`, sürüm `1790749888495`, adres `https://cza-degerlendirme-hl4a5d.v2.appdeploy.ai/`, aktarım `2026-10-06`, 93 dosya, klasör `apps/assessment-appdeploy/`.
- Aynı belgeler ana CZA derlemesinin bu runtime’ı derlemediğini ve AppDeploy’un entegrasyon bitene kadar referans ortam olduğunu yazar.
- `apps/assessment-appdeploy/package.json` betikleri: `dev` = `vite`, `build` = `vite build`, `preview` = `vite preview`.
- `apps/assessment-appdeploy/vite.config.ts`: `base: './'`, çıktı `process.env.APPDEPLOY_VITE_OUT_DIR || 'dist'`, kaynak haritası yalnız `APPDEPLOY_VITE_SOURCEMAP==='hidden'` ise gizli.
- Backend `@appdeploy/sdk`, arayüz `@appdeploy/client` kullanır. Bu iki paket `package.json` bağımlılıklarında yoktur; platformun enjekte ettiği paketlerdir.
- Veri, AppDeploy `db` koleksiyonlarıdır: `assessment_sessions`, `cza_students`, `cza_educator_sessions`, `cza_educator_config`, `cza_report_versions`. Bu klasörde SQL migration dosyası yoktur.
- `INTEGRATION_PLAN.md` snapshot’ı ana derlemeden ayrı tutar ve canlı uygulamanın silinmemesini söyler. Yükleme adımı yazmaz.

Dağıtım komutu, AppDeploy kimlik bilgisi, yükleme adımı ve artefakt hash doğrulaması bu depoda kayıtlı değildir. Kök `package.json` içindeki `wrangler dev` ve `infra/staging` altındaki Wrangler dosyaları ana CZA uygulamasına aittir; bu AppDeploy snapshot’ının dağıtım yolu değildir.

`1790749888495` değeri 2026-10-06 tarihli snapshot pinidir. Bu paket canlı sunucuyu okumadı. Bugün yayında olan sürüm kimliği depodan doğrulanamaz.

## 3. Dağıtım öncesi kontrol listesi

Dağıtım bu turda yapılmaz. Liste, sonraki operatör içindir.

1. Sahip, yeni M1A ve L1A taramalarının 20 madde olmasını kabul eder. Eşikler değişmedi. Tam ve tutarlı AV1 kaydı `review` olur. Eksik AV1 kanıtı `insufficient` olur ve puan yazmaz. A8 yedek yolu `FALLBACK` damgası olmadan başarı sayılmaz.
2. Canlı sürüm kimliği AppDeploy konsolundan, uygulama `cza-degerlendirme-hl4a5d` için yazılır. Depodaki tek pin `1790749888495` (2026-10-06) olup bugünün canlı sürümü sayılmaz.
3. Derleme komutu, `apps/assessment-appdeploy` içinde `npm run build` (`vite build`). Çıktı klasörü `dist` veya `APPDEPLOY_VITE_OUT_DIR`. Beklenen artefakt hash’i depoda tanımlı değildir. İleride alınan çıktı için operatör `dist` üzerinde kendi sha256 kaydını tutar. Bu ortamda değerlendirme uygulamasının `node_modules` klasörü yoktur ve `@appdeploy/client` platform paketidir; bu paket bir `dist` üretmedi ve hash uydurmadı.
4. Hedef uygulama kimliği `cza-degerlendirme-hl4a5d`. Hedef adres `https://cza-degerlendirme-hl4a5d.v2.appdeploy.ai/`.
5. Backend belge şeması bu farkta değişmedi. Yeni migration yok. Koleksiyon adları ve oturum alanları (`status`, `currentTaskId`, `attempts`) aynıdır.
6. Sürmekte olan oturumlar, yerel sentetik kontrolde şöyle davrandı. Bu sonuç canlı kabul değildir.
   - `status: completed` ve `currentTask` boş: “Harika, keşif turu tamamlandı.” kartı. Erken kapanmış M1A oturumu yeni kodla yeniden açılmaz.
   - `status: active`, `currentTask` M1B, daha önce yazılmış M1A `n=15`: ekran “34’ü başka bir yoldan parçala” / “esnek temsil”. Eski kayıt yeniden yazılmaz.
   - `status: active`, `currentTask` M1A, laboratuvar içi indeks sunucuda yoktur: ekran 1. maddeye döner (`47 sayısında`, ilerleme `/ 20`). Sunucuya yazılmış denemeler durur.
   - `status: active`, `currentTask` MA1: ekran “İlk his” / `6 + 3`.

Kanıt dosyası yereldir: sentetik happy-dom koşusu, React 19.2.6, ağ yok. Ayrıntı `p2-resume-compat` kaydındadır ve canlı kabul değildir.

## 4. Dağıtım sonrası duman testi (yalnız sentetik oturum)

Canlıdaki gerçek oturum açılmaz. Yeni oturumun etiketi sentetik olduğu anlaşılır bir addır. Gerçek öğrenci adı, PIN, çerez, token ve bağlantı dizesi yazılmaz.

Kaydedilecekler: HTTP durum kodu, ekran başlığı, görev kimliği, hata kodu. Yanıt gövdesi, şık seçimi ve öğrenci adı yazılmaz.

Yürüyüş:

1. P2 sentetik oturum aç. Görev kimliği W1 ise zincir ilerler.
2. MA1’de her adımda “Bu soruyu geç”. A7 sonrası A8 başlığı “Seçtiğin yol”, işlem `4 + 3`, şıklar `6`, `7`, `8`. Sayfa beyaz kalmaz.
3. M1A ilerleme `/ 20` olur ve son madde kimliği X5 görünür. Erken “Taramayı Tamamla” 15. maddede çıkmaz.
4. L1A ilerleme `/ 20` olur ve son madde kimliği P5 görünür.
5. AV1 ilerleme `/ 12` olur ve son madde kimliği FL2 görünür. Akış MC1’e geçer. Tutarlı tam kaydın eğitimci rozeti “Eğitmen incelemesi” olur. Eksik kayıtta rozet “Eksik kanıt · eğitmen incelemesi” olur.
6. Bir ekran hata verirse kart “Bu ekran açılamadı” ve düğme “Kaldığın yerden devam et” görünür. Beyaz gövde durma koşuludur.

Durma koşulları: beyaz sayfa, gerçek öğrenci verisi, gizli değer, sentetik olmayan oturuma yazma, canlı sunucuya bu paketten yazma, tutarlı 12 maddelik AV1 rozetinin “Destek/inceleme” görünmesi.

## 5. Geri alma

Geri alma komutu ve kimlik bilgisi depoda yoktur. Wrangler bu uygulamanın geri alma yolu değildir.

Dağıtımdan önce operatör, AppDeploy konsolunda `cza-degerlendirme-hl4a5d` için o anki sürüm kimliğini kaydeder. Geri alma, konsoldan o kaydedilmiş sürümü yeniden yayınlamaktır. Depodaki `1790749888495` yalnız 2026-10-06 snapshot pinidir; konsoldaki güncel kimlikle aynı olduğu ayrıca doğrulanmadan geri alma hedefi sayılmaz.

Git tarafında bu yamanın öncesi `main` `93fb899a` içindeki `apps/assessment-appdeploy` ağacıdır. Canlı sitenin o commit ile aynı olduğu bu depodan doğrulanamaz.

## Durum satırı

`GENEL PROJE İLERLEME %` ölçüm yok. `MEVCUT FAZ İLERLEME %` ölçüm yok. `TAMAMLANAN` AV1 eksik kanıt sonucu, ham kayıt bütünlüğü ve A8 `FALLBACK` damgası. `KALAN` dağıtım yok; M1A ve L1A 20 madde kararı ayrıca durur. `KAPSAM SAPMASI=YOK`. `SIRADAKİ TEK ADIM` bu dalın DRAFT incelemesidir. Dağıtım bu belgede yapılmamıştır. Yerel ve sentetik sonuçlar canlı kabul değildir.
