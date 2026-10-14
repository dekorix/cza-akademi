# B08-V32-CHECKPOINT-01 — sentetik HIGH kapısı

**SOURCE_NOT_AVAILABLE.** #111'de belirtilen özgün V3.2 HTML (`11602012…a1f1d`) bu çalışma ortamında yoktur. Bu dosya onun byte kopyası değildir. [#111](https://github.com/dekorix/cza-akademi/issues/111) madde2'nin izin verdiği alternatifle, immutable PR110 HEAD `6d6d5c36f832d5b8ec725aecc6c9497945713474` üzerinde dar fallback checkpoint oluşturuldu. Yeni V4 tasarımı yok.

## Denemek için

1. [HTML](./CZA_MAT01_V32_CHECKPOINT.html) sayfasından Download raw file ile indir, tarayıcıda aç. İnternet/hesap/sunucu gerekmez; GitHub dosya sayfası HTML'yi çalıştırmaz.
2. Hazırlıkta A2 seç. A kaydından önce S/B/T kilitlidir. Yanıtın değiştirilemez; S desteği ayrı kalır. Yeni denemede önceki kayıt arşivde, tekrar47 maruziyeti görünürdür.
3. T'de kendi iki gösterimini ayrı satır/noktalı virgülle yaz; soruda örnek çözüm yok. Gerekçeni ayrıca eğitmene anlat/göster.
4. Eğitmen görünümünde T gözlemini ekle. Olumsuz ham hüküm her koşulda NOT_ASSESSED kalır. T1–T5 gözlemi, RELATION_OBSERVED, UNSEEN, yardım NONE ve incelenmiş sentetik günlük referansı birlikte gereklidir. Öğretmen penceresi örnek günlük kodunu gösterir; keyfî kaynak kodu kabul edilmez. Bu fixture gerçek SLP geçmişini doğrulamaz.
5. Eksiksiz örnek yalnız PROVISIONAL_EVIDENCE üretir; mastery INSUFFICIENT, assignment BLOCKED, realTransfer NOT_VERIFIED. Aynı sekmede önce52 kullanılmışsa yeni denemede artık yeni transfer sayılmaz.

T1=iki gösterim; T2=onluk/birlik ilişkisi; T3=T_gerekce; T4=T_bagimsiz; T5=yeni uyaran koşulu. PR110'un T1–T5 kapıları korunur. Matematik parser'ı yalnız açık etiketli tam sayı onluk/birlik veya iki terimli toplamı tanır; iki gösterim52, farklı yapıda ve en az biri onluk/birlik olmalıdır. Bilinmeyen biçim yanlış puan değil NOT_ASSESSED olur. Tanıma ve menüyle kurma bağımsız üretim sayılmaz; fiziksel nesne ve öğrenci iletişimi ayrı kayıt kanalıdır.

## Tekrar üretim

```sh
node preview/b08-v32/build.mjs
node tests/b08-v32-gate.test.mjs
node tests/b08-v32.browser.mjs
```

Build PR110'un değişmez model/UI/style/accepted source'unu okur, yalnız yeni standalone HTML'yi yazar. Eski dosyalar değiştirilmez. Browser Playwright + Chromium ortam aracı gerektirir; B08_PLAYWRIGHT_MODULE ve B08_CHROMIUM_PATH desteklenir. Paket/lock değişmedi. [Exact browser sonucu + HTML SHA](./evidence/browser.json), [unit çıktısı](./evidence/unit.txt). Önceki Baş Mimar'ın17/23 testleri yeni koşulmuş gibi raporlanmaz.

Browser aynı HTML'yi setContent ile render eder; ortam file:// politikası nedeniyle indirilen dosyanın doğrudan açılışı NOT_RUN. 1440×900/390×844, klavye/A4 ve ağ/JS kontrolleri yereldir. [Negatif öğretmen](./evidence/desktop-negative.png), [geçici olumlu](./evidence/desktop-provisional.png), [mobil öğrenci](./evidence/mobile-student.png), [mobil T kanıtı](./evidence/mobile-teacher.png), [A4](./evidence/A4.pdf).

Sekme belleği yenilemede kaybolur; JSON indirilebilir. UI rol değiştirici auth değildir, öğretmen beyanı gerçek uzman onayı değildir; immutable koruma DevTools'a karşı güvenlik garantisi değildir. Ekran okuyucu/çocuk/gerçek mobil ve gerçek SLP/API/DB doğrulaması NOT_RUN. PR91/101/107/109/110, main ve Codex A #98 korunur. Gerçek öğrenci/SQL/secret/Worker/deploy/production yok.

`USER_VISUAL_ACCEPTANCE=PENDING`; `REAL_STUDENT_USE=BLOCKED`; `AUTO_ASSIGNMENT=BLOCKED`; `REAL_SLP_DB=NO`; `AUTH/ROLE_REAL_INTEGRATION=NO`; `STAGING_DEPLOY=NO`; `PRODUCTION=NO`; `MAIN_MERGE=NO`.
