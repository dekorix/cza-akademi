# CZA | Proje Kontrol Kulesi (ONAYLI YÖNETİM STANDARDI)

> 2026-10-09. Kullanıcının açık onayıyla proje yönetim standardı kabul edildi. Onay, uygulama kodu birleştirme veya production yetkisi değildir. Amaç: Yapay zekâ sohbetlerinde unutulan karar, yanlış anlaşılan istek, kapsam sapması ve kanıtsız teslimi engellemek. Bu protokol merge veya production izni değildir.

## Tek kaynak, üç iz
- **Ürün vizyonu (değişimi kontrollü):** `docs/CZA_URUN_VIZYONU_TASLAK.md` ve mevcut mimari/14 beceri/kimlik kararları.
- **İş kaydı (değişen):** GitHub Issues + PR; tek kanıt bağlantısı, sorumlu, öncelik, bitiş koşulu. Örnek: Başlangıç Değerlendirmesi [#72](https://github.com/dekorix/cza-akademi/issues/72).
- **Durum ve karar defteri (güncellenen):** `docs/CZA_DURUM_PANOSU_TASLAK.md`; karar tarihi, kaynak SHA, test, staging hedefi, PASS/FAIL/BLOCKED, sonraki tek adım.

ChatGPT bellek/sohbet geçmişi **resmî teknik doğrulama değildir**. Yeni sohbette/ajan devrinde bu dosyalar, açık issue/PR ve güncel commitlerden başlanır. Eski konuşma alıntıları canlı kaynağın yerine geçmez.

## Kullanıcının fikrini göreve dönüştürme
Kullanıcı fikirlerini doğal dille söyler; tek tek teknik komut yazması gerekmez. ChatGPT her fikri şu kayda dönüştürür:
`İstek | çözmek istediği sorun | hedef yaş/kullanıcı | ilgili modül | mevcut kanıt | önerilen alternatif | öncelik | kapsam dışı | kabul ölçütleri | etkilenen dosya/API | regresyon testleri | karar/onarım durumu`.
Onaylı vizyon ile çelişirse **KAPSAM SAPMASI=VAR**, uygulama durdurulur ve kullanıcıya gerekçe bildirilir. Taslak fikir ile onaylı teknik görev karıştırılmaz.

## Paralel ama uyumlu iş kulvarları
- **A: Entegrasyon:** Student ID, aday/öğrenci kimliği, API, öğretmen/veli yetkisi, Neon veri bütünlüğü, oturum, kayıt, readback, rapor.
- **B: İçerik + ürün tasarımı:** Yaşa uygunluk, 14 beceri ile kazanım eşleşmesi, soru özgünlüğü/çeşitliliği, pedagojik değerlendirme, öğrenci/öğretmen ekranı, renk, mobil, erişilebilirlik.
- **C: Ticari/veli yaşam döngüsü:** tanıtım sitesi, başvuru, rapor, paket önerisi, kayıt/izinler, paket yetkisi, veli bilgi akışı. **Şimdilik plan ve sözleşme; ana entegrasyon önceliğini kesmez.**
Her kulvar aynı Student Learning Profile ve tek yetki modeline bağlıdır; bağımsız veritabanı/kimlik kurulmaz.

## Faz sırası (korunur)
Öğrenci Paneli → Çalışma Merkezi → Eğitmen Paneli → gerçek öğrenci geçmişi → ödevlendirme → raporlar → ortak Student Learning Profile → Koçluk/LGS/YKS → Veli Paneli → AI öneri motoru. Mevcut yazılı parçaların hazır olması, fazın kabul edildiği anlamına gelmez. Değerlendirme ve ticari akışlar bu çekirdeğin çevresinde entegre edilir; çekirdek fazlar izinsiz yer değiştirmez.

## Bir görevin tamamlanma kapısı
1. **KAPSAM:** Ne korunacak, ne değişecek, neye dokunulmayacak belli mi?
2. **İÇERİK/UX:** Hedef kullanıcı ve yaş, pedagojik amaç, gerçek görev çeşitliliği, kullanılabilirlik ve erişilebilirlik uygun mu?
3. **UYGULAMA:** Sadece ilgili dosyalar, açık değişiklik listesi, veri sözleşmesi ve yetki modeli korundu mu?
4. **TEST:** Unit/integration, gerektiğinde gerçek Chrome desktop + mobile, sentetik uçtan uca akış, hard reload, Neon readback, tenant izolasyonu var mı?
5. **YÖNETİM KONTROLÜ:** ChatGPT kapsam, ürün mimarisi ve beklenen kullanıcı davranışını kontrol etti mi?
6. **BAĞIMSIZ DENETİM:** Gerçek BLOCKER/HIGH güvenlik/kalite riski varsa inceleme yapıldı mı? Kapanmış P0-C/P1/P2/P3 somut yeni kanıtsız açılmadı mı?
7. **NİHAİ KARAR + CHECKPOINT:** Commit/tree + kaynak dalı + staging sürüm kanıtı kayda geçti mi? İzin olmadan merge/production yok.
8. **RAPOR:** Genel %; mevcut faz %; tamamlanan; kalan; KAPSAM SAPMASI=YOK|VAR; SIRADAKİ TEK ADIM. Veri yoksa yüzde uydurulmaz.

**Statüler:** PLANLANDI / KODLANDI / HEDEFLİ TEST PASS / STAGING KABUL PASS / NİHAİ KABUL / BLOCKED. Bir önceki aşamanın PASS sonucu diğerini otomatik geçirmez.

## Unutmama mekanizması
- Her yeni fikir tek ilgili issue/karar günlüğüne kaydedilir; kapsam dışı fikirler kaybolmaz, backlog'da tutulur.
- Müdür'ün her iş emrinde `BASE_SHA`, ilgili issue, değiştirilecek dosyalar, değişmeyecek modüller, testler ve tek teslim bulunur.
- Her anlamlı teslimde belge sürümü + commit/tree + karşılaştırılabilir test kanıtı kayıt edilir; canlıyla karıştırılmaz.
- Yeni sohbet başladıktan sonra ilk işlem: **bu üç belge + açık PR/issue + son main/staging kaynağı** okunur; kullanıcıya her ayrıntı yeniden sorulmaz.
- Yönetim yapay zekâsı yalnız gerçekten yüksek risk veya karar değişikliğinde kullanıcıyı meşgul eder; düşük riskli işler görev panosuna işlenir.
- Kredi verimliliği: gereksiz tüm-repo tarama/refactor yerine dar kapsamlı dosya inceleme ve hedefli test; doğruluk ve güvenlikten tasarruf yapılmaz.

## Yetki sınırı
Gerçek öğrenci verisi üzerinde deney yapılmaz, kimlik/kurum izolasyonu aşılmaz, geri dönüşü zor migration izinsiz uygulanmaz. Production ancak ürün sahibinin açık yetkisiyle. Onaysız yapılabilecek hazırlık: doküman/issue taslağı, salt okunur inceleme, önerilen test ve görev emri.

## Kontrol Kulesi uygulama düzeyleri ve hâlen açık sınır

- PR ve Issue şablonları, karar defteri, `AGENTS.md`, 10 faz + 15 çapraz modül manifesti ve `cza-governance-check.yml` salt-okunur kaynak kontrolü **belge dalında geliştirildi**. Bunların `main` üzerinde bulunduğu iddia edilemez; bunun için PR #74 güvenli entegrasyon kabulü beklenir.
- Kanonik modül manifesti: `docs/CZA_MODUL_KANONIK_MANIFEST.json`; gerçek başlangıç değerlendirme envanteri: `docs/CZA_DEGERLENDIRME_KAYNAK_ENVANTERI_20261009.md`.
- Yeni çalışma oturumu için başlangıç talimatı: depo kökündeki `AGENTS.md`, süreç testi: `docs/CZA_DEVIR_KABUL_SENARYOSU.md`.
- **Belge / kaynak var** ≠ **modül gerçekten çalışıyor** ≠ **CI PASS** ≠ **staging kabulü** ≠ **nihai ürün kabulü**.
- GitHub Actions PASS bir PR'ı otomatik olarak merge'den men etmez. **Dal korumasında zorunlu status check** ayrıca etkin ve kanıtlı olmalıdır. Harici yayın otomasyonu kanıtlanmadan `main` merge durdurulur.
- Bu ilk sistemde modülün tüm gerçek mikro-görevleri için eski/yeni diff ve başka bir ajanın gerçek devir E2E sonucu **açık kabul** olarak kalır. Kanıtsız tamamlanmış gösterme.

## Yeni sohbet / T5 Patronu / Codex devri için başlangıç emri

1. `docs/CZA_KONTROL_PROTOKOLU.md`, `docs/CZA_MASTER_ARCHITECTURE.md`, `docs/CZA_14_Beceri_v1.md`, `CENTRAL_IDENTITY_PLAN.md`, `docs/CZA_URUN_VIZYONU_TASLAK.md` ve `docs/CZA_DURUM_PANOSU_TASLAK.md` belgelerini oku.
2. Ürün vizyonu içinde henüz ürün sahibi onayı bekleyen detayları **taslak** kabul et; onaylanmış yönetim standardıyla karıştırma.
3. `main` HEAD, açık PR/issue ve staging kaynak SHA'sını kanıtla; durum panosundaki tarihsel SHA'yı canlı kabul etme.
4. Şu anda açık olan **tek teknik adımı** çıkar. Tek görev için `BASE_SHA`, dosya sınırı, kullanım akışı, içerik/pedagoji, kabul testleri, geri dönüş ve kanıt teslimini belirle.
5. Ürün kodunu, migration'ı ve production'ı kendiliğinden değiştirme. Uygulama için kod sorumlusuna küçük iş emri yaz ve kanıtlı sonucu denetle.
6. Sonunda zorunlu ilerleme raporu ver: `GENEL PROJE İLERLEME %`, `MEVCUT FAZ İLERLEME %`, `TAMAMLANAN`, `KALAN`, `KAPSAM SAPMASI=YOK|VAR`, `SIRADAKİ TEK ADIM`.
