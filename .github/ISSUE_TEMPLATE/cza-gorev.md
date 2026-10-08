---
name: "CZA | Geliştirme, hata ve kalite görevi"
about: "Kanonik kapsamı koruyan, test edilebilir tek iş emri"
title: "CZA | "
labels: []
assignees: []
---

### Kaynak istek ve sorun
Kullanıcının asıl ihtiyacı, görülen somut hata, ilgili ekran veya önceki işin kanıtı.

### Etkilenen kulvar ve kullanıcı
A: Entegrasyon / B: Pedagojik içerik ve UX / C: Paket, satış, veli.
Hedef yaş, öğrenci/eğitmen/veli kullanıcısı, ilgili CZA modülü.

### Değişmez kapsam ve önceki içerik
Hangi mevcut ekran, görev, kazanım, veri sözleşmesi, kimlik ve yetki korunacak? **Eskisi / yenisi / kayıp kontrolü**. Her özellik eksiltilemez.

### Önerilen alternatif ve gerekçe
Yalnızca hata teşhisi değil; uygulanabilir yeni UX, öğrenme yolu, API veya veri sözleşmesi. Neden daha iyi?

### Bir tek teslim
Değişebilecek en dar dosya/motorlar, açıkça kapsam dışı dosyalar ve sonraki bağımlılıklar.

### Başlangıç kanıtları
Kaynak BASE_SHA / TREE_SHA, staging kaynak sürümü, issue/PR, mevcut hata veya gözlem.

### Kabul ve test matrisi
PASS/FAIL/BLOCKED/NOT_RUN ayrımı. Gerekirse Chrome desktop+mobile, gerçek veriye dokunmadan sentetik oturum, hard reload, Neon readback, rol/kurum izolasyonu, pedagojik/erişilebilirlik kabulü.

### Yetki ve yayın sınırı
Production, merge, gerçek öğrenci verisi, şema/migration için kullanıcıdan açık yetki olmadan işlem yapma.

### Durum ve sıradaki tek adım
PLANLANDI / KODLANDI / HEDEFLİ TEST PASS / STAGING KABUL PASS / NİHAİ KABUL / BLOCKED. Sonraki tek doğrulanabilir eylem.
