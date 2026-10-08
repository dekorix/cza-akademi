# CZA | Proje Kontrol Kulesi (ONAY TASLAĞI)

> 2026-10-08. Amaç: Yapay zekâ sohbetlerinde unutulan karar, yanlış anlaşılan istek, kapsam sapması ve kanıtsız teslimi engellemek. Bu protokol merge veya production izni değildir.

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

## Bir sonraki iyileştirme (öneri)
PR şablonu, issue şablonu ve GitHub Actions kabul kontrolünü, bu protokol onaylandıktan sonra **ayrı küçük PR** ile tanımla; geniş kod değişikliğiyle karıştırma.
