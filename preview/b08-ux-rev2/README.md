# B08-UX-REV2 · MAT-01 sentetik görsel önizleme

**Başlamak için:** [CZA_B08_MAT01_REV2.html](./CZA_B08_MAT01_REV2.html) dosyasını GitHub'da açın, “Download raw file” ile indirin, kendi tarayıcınızda açın. İnternet, sunucu, kurulum veya öğrenci hesabı gerekmez. GitHub dosya sayfası HTML'yi uygulama olarak çalıştırmaz. Dosya kendi CSS/JS'sini içerir; yayın/staging değildir.

1. Hazırlıkta A1 tanıma veya A2 bağımsız üretim/nesne/iletişim seçin. A1 için görsel gruplar veya büyük yazılı şıklar seçilebilir. Erişim ve sunum tercihi düzey/tanı üretmez.
2. Öğrenci görünümünde A yanıtını kaydedin. S/B/T önce kilitlidir. Kaydedilen yanıtın düzenleme/silme düğmesi yoktur.
3. S'de onluk materyalini inceleyin; verilen desteği seçin. B'de kendi açıklamanızı verin. T'de yeni 52 örneği için iki temsil üretin. S/B/T'de seçenek tanıma ayrı bir alternatif kanaldır, üretimle eşitlenmez.
4. Eğitmen görünümünde doğrudan öğrenci yanıtını ve ayrı sentetik gözlemi karşılaştırın. B1–B5 / T1–T5 durumlarını ayrı kaydedin. T'de geçmiş kaynağı, UNSEEN ve yardım NONE yoksa NOT_ASSESSED kalır. Bu alanlar gerçek doğrulanmış kimlik/uyaran geçmişi değildir.
5. Yeni deneme oluşturun; eski deneme aynı sentetik öğrenci referansı altında salt okunur kalır. İlk yanıtı destekle değiştirmeyin. Gerçek öğrenci adı/verisi girmeyin.
6. Şıklı öğrenci sayfasındaki A4 düğmesi veya Ctrl/Cmd+P ile yazdırın. Örnek [A4 şıklı PDF](./evidence/A4-choices.pdf) de vardır. Cevap anahtarı baskıya eklenmez.
7. Sentetik JSON'u eğitmen görünümünden indirebilirsiniz. Kayıtlar **yalnız sekme belleğindedir**; sayfa yenileme/kapatma tüm oturumu kaybettirir. Kapatma uyarısı tarayıcıya bağlıdır. Dosya sistemi, DB veya SLP'ye otomatik kalıcılık yoktur.

## Kaynak ve sözleşme

- Yetki: ürün sahibinin B08-UX-REV2 görev metni, [kopyası](./SOURCE_TASK.md).
- [#106 kaynak kabulü](https://github.com/dekorix/cza-akademi/issues/106#issuecomment-6164263176), [B08-AI-REV1](https://github.com/dekorix/cza-akademi/issues/106#issuecomment-6163081902), [AI protokolü #108](https://github.com/dekorix/cza-akademi/issues/108).
- PR109 HEAD `253c160b7fd03004b57c95e17dc2e614ae288d93` içindeki saf modülün **byte-identical**, yeni yolda [kaynak kopyası](./vendor/accepted-contract.ts). PR109 değiştirilmedi. HTML build bu kaynağı transpile eder. Önizleme yalnız `classifyMat01A` metin sınıflayıcısını çağırır; tam accepted evaluator/collection entegrasyonu iddiası yoktur.
- `model.mjs` ayrı **UX adapter v2**: şık tanıma, append-only deneme/yanıt/gözlem ve T ön koşulları. `3 onluk 17 birlik` / `0 onluk 47 birlik` gibi **negatif olmayan tam sayılı** toplamı 47 olan açık etiketli alternatifler EQUIVALENT_NONCANONICAL olur. PR109'un eski sonucunu yeniden yazmaz; tam kanonik basamak çözümlemesi saymaz. Tanınmayan sözlü açıklamalar inceleme bekler. Dil parser'ı tüm matematiksel ifade biçimlerini kapsamaz.
- MEB [MAT.2.1.2](https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/116) hedef adayı, [MAT.1.1.2](https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/45) ön koşul; eşleme önceki B08 kaynak kabulüne dayanır, bu görevde program yeniden onaylanmadı.
- CSS onluk çubukları/küpleri bu prototip için özgün oluşturulmuştur. 10 hücreli çubuk görseli ve küp oranı saymayı destekler; fiziksel materyal kalibrasyonu veya uzman onaylı görsel banka değildir. Finger motoru değiştirilmez/kaldırılmaz, başarı aktarımı yoktur.

## Kanıt ve test tekrar üretimi

Node >=22.13, repo bağımlılıklarıyla:

```sh
node preview/b08-ux-rev2/build.mjs
node tests/b08-ux-rev2.test.mjs
node_modules/.bin/tsc --noEmit
node_modules/.bin/oxlint preview/b08-ux-rev2 tests/b08-ux-rev2.test.mjs tests/b08-ux-rev2.browser.mjs
```

Tarayıcı scripti sistem Chromium + ortamda Playwright kullanır. Repo package/lock dosyasına yeni bağımlılık eklenmedi. Playwright yoksa izole `/tmp/b08-browser` dizinine kurulup `B08_PLAYWRIGHT_MODULE=/tmp/b08-browser/node_modules/playwright` verilebilir. Chromium yolu `B08_CHROMIUM_PATH` ile değişebilir.

```sh
node tests/b08-ux-rev2.browser.mjs
```

Bu ortamın Chromium politikası `file://` gezinmesini reddetti. Dosya içeriği değiştirilmeden `page.setContent` ile Chromium'a verildi; gerçek render, DOM/etkileşim, touch, klavye, print ve screenshot kontrolleri yapıldı. **Doğrudan indirilen dosyayı çift tıklayarak açma bu ortamda NOT_RUN**; kullanıcı görsel kabulünde kontrol edilmelidir. Bu yöntem güvenlik politikasını değiştirmez, ağ kullanmaz. [Son browser sonucu](./evidence/browser-results.json).

Ekranlar: [masaüstü öğrenci](./evidence/desktop-student-a.png), [destek](./evidence/desktop-student-support.png), [transfer](./evidence/desktop-student-transfer.png), [eğitmen](./evidence/desktop-teacher.png), [mobil şıklar](./evidence/mobile-student-choices.png), [mobil eğitmen](./evidence/mobile-teacher-viewport.png), [tam mobil kanıt](./evidence/mobile-teacher.png), [nesne gruplama](./evidence/mobile-grouping.png).

## Kabul sınırları

- Ekran değiştirici **rol/oturum yetkilendirmesi değildir**. Öğretmen beyanı doğrulanmış uzman/kimlik/geçmiş kanıtı değildir. İki görünüm aynı sekmede örnek kanıt aktarımını gösterir.
- Freeze/append-only koruması normal prototip kullanımı içindir; tarayıcı geliştirici araçlarına karşı değişmez kayıt/kriptografik denetim değildir.
- Yaş öğrenme düzeyi değildir. Sunum boyutu uyarlanır; bireysel erişim, ekran okuyucu, gerçek özel eğitim kullanımı ve çocukla kullanılabilirlik doğrulanmadı. Nesne aracı drag/drop zorunlu kılmaz; select/klavye/touch ile çalışır. Ses tanıma/çizim tanıma yok; iletişim yanıtı aynen yazıya geçirilir, öğretmen yorumu ayrı gözlemdir.
- Tek SLP mimarisi için yalnız `SYNTHETIC_SINGLE_SLP` referansı; gerçek kimlik, 26 profil/P2 23 bölüm/14 beceri veri akışına bağlanmaz. CZA-S01 aday kanıt etiketi toplam beceri puanı üretmez. Retention NOT_ASSESSED; score=null; mastery INSUFFICIENT; otomatik ödev yok.
- Main, PR91/101/107/109, assessment API/UI/evaluator, SQL/Worker, gerçek kayıt ve production değiştirilmez. Gelecek entegrasyon ayrıca kimlik/yetki, kalıcı append-only kayıt, kaynak geçmişi, gerçek erişilebilirlik ve kullanıcı kabulü gerektirir.

`B08_UX_REV2=IN_PROGRESS`; `USER_VISUAL_ACCEPTANCE=PENDING`; `REAL_STUDENT_USE=BLOCKED`; `AUTO_ASSIGNMENT=BLOCKED`; `RUNTIME_NOT_WIRED=YES`; `PRODUCTION_APPROVED=NO`.
