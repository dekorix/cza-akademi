# CZA toparlanma kaydı — 7 Ekim 2026

## Karar

Büyük CZA ve tanıtım/materyal web projesi ayrı ürünlerdir. Büyük CZA'nın ilk giriş merkezi kullanıcının özgün Başlangıç Değerlendirmesidir; ardından aynı öğrenci kimliğiyle panel ve çalışmalara geçilir. Eğitmen aynı merkezi kayıtları görür.

## Hata değerlendirmesi

Benzer ürün adları, kaynak deposu, Apps Script Kampüs, Sites yayını ve staging Worker birbirinin yerine gösterildi. Eski giriş adresleri güncel panel talebine cevap olarak verildi. PR #58 kaynak bağlantısını değiştirdi, fakat bu tek başına çalışan yayın veya ürün kimliği kabulü değildi. Dış bağlantının sürüm eşleşmesi doğrulanmadan tamamlanma anlatımı yapıldı.

## Bilinen kaynaklar ve kanıt sınırı

| Nesne | Doğrulanan | Açık kalan |
| --- | --- | --- |
| `dekorix/cza-akademi` | Büyük platform çalışma deposu | Tüm modüllerin güncel runtime kabulü |
| `apps/assessment-appdeploy/` | Özgün uygulamanın kaynak snapshotı ve manifesti | Özgün uygulamanın baştan sona merkezi entegrasyonu |
| Staging Worker | `/educator` HTTP 200; tarayıcıda eğitmen giriş formu görüldü | Çalışan source SHA/tree, öğrenci/eğitmen veri zinciri ve güncellik |
| Sites B | PR #58 sonrası hosting bağlantısı | Ayrı web ürününe ait hedefle çakışmanın giderilmesi |
| Eski Apps Script Kampüs | Kaynakta öğrenci ana sayfası bu adrese yönleniyor | Kullanıcının istediği yeni değerlendirme ilk girişiyle uyumu |

## Kapanış listesi

- [x] Kullanıcının ürün ayrımı ve ilk giriş kararı kayıt altına alındı.
- [x] Gelecek uygulama görevleri için kök AGENTS.md sınırı yazıldı.
- [ ] Staging'deki gerçek kaynak/build ve DB runtime hedefi doğrulandı.
- [ ] Özgün değerlendirme girişinden merkezi öğrenci paneline geçiş doğrulandı.
- [ ] Eğitmen bekleme ekranının kullanıcının tarayıcısındaki nedeni giderildi ve kabul edildi.
- [ ] Aynı kayıt öğrenci geçmişi, eğitmen raporu ve PDF'de doğrulandı.
- [ ] Doğru mevcut hedefte kullanıcının açabileceği izole preview teslim edildi.

Sıradaki tek uygulama görevi: çalışan büyük platformun staging kaynak/build kimliğini mevcut repo ile eşleştirerek değerlendirme ilk giriş akışının gerçek hedefini sabitlemek. Bu kayıt yayın, migration, test PASS veya tamamlanmış ürün iddiası değildir.
