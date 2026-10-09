# CZA | Tek Ekosistem, Ana Platform ve Tanıtım Sitesi Sınırı

**Karar:** 2026-10-09. **Durum:** Ürün sahibi tarafından kesinleştirildi. **Kaynak/mimari kayıt**; teknik taşıma veya yayın kabulü değildir.

## Kanonik ürün hiyerarşisi

**TEK ÜST ÜRÜN / MARKA: Çelik Zihin Akademisi (CZA)**

| Alt bileşen | Ürün rolü | Teknik sınır | Veri ve yetki |
| --- | --- | --- | --- |
| **Büyük CZA Eğitim Platformu** | **Ana ürün ve tek öğrenme omurgası**: 0–YKS öğrenci yaşam döngüsü, Başlangıç Değerlendirmesi, öğrenci/eğitmen/veli panelleri, Akademik Öğrenme, Beceri ve Zihin Atölyesi, ödev, rapor, SLP, koçluk/LGS/YKS ve gelecekte AI | Ana kaynak: `dekorix/cza-akademi`; merkezî kimlik, Neon Learning Core ve yetkili API'ler | **Tek Student ID, tek Student Learning Profile**; değerlendirme, kanıt, öğrenci geçmişi, yetki ve öğretmen onayı buradadır |
| **CZA Tanıtım ve Satış Web Sitesi** | **Ana ürünün ticari/tanıtıcı parçası**: kurum/program tanıtımı, paket bilgileri, soru sorma, başvuru yönlendirme, kayıt talebi ve gerektiğinde randevu/iletişim | **Ayrı web uygulaması ve ayrı yayın yönetimi**; ChatGPT Sites bu yüzey için kullanılabilir; ana uygulamanın yerine geçmez | Öğrencinin ikinci kimliğini veya SLP kopyasını yaratmaz; eğitim raporu/öğrenci kanıtını herkese açık tutmaz; bilgi/başvuru akışını **yetkili** ana platform hizmetine bağlar |

**Temel cümle:** Tanıtım sitesi CZA'nın **ayrı işletmesi veya ayrı eğitim ürünü değildir**. **Tek ekosistemin, ayrı geliştirme ve yayın yaşam döngüsü olan tanıtım/satış modülüdür.** Ana CZA ve tanıtım sitesi birbirinin kod/deploy kaynağı veya çalışma paneli olarak sunulmaz.

## Kullanıcıya gösterilecek bilgi mimarisi

`CZA Tanıtım Sitesi` → `Programlar / paketler / sorular / veli bilgilendirme` → `Başlangıç Değerlendirmesi başvurusu` → `Büyük CZA'nın yetkili değerlendirme giriş akışı` → `Eğitmen onaylı rapor ve kişisel program` → `Tek öğrenci kimliği ile kesin kayıt / yetki aktivasyonu` → `Büyük CZA Öğrenci ve Eğitmen Paneli`.

- **Başvurular:** Asgari veri, amaçla sınırlı onay ve kurum/yetki kontrolü. Tanıtım sitesi eğitim kanıtlarının sistem-of-record'u değildir.
- **Paketler:** Tanıtılabilir; fiyat/ödeme/kabul işlemleri ayrı onaylı iş akışındadır. “Pakete tıklama” öğrenci erişimini açmaz.
- **Rapor:** Eğitmen onaylı içerik, yetkili veli/öğrenci erişiminden görüntülenir; halka açık web sayfasında öğrenci raporu yayımlanmaz.
- **Dijital öğrenme:** Anzan, dersler, dikkat/hafıza, özel eğitim ve koçluk **Büyük CZA platformunda** çalışır. Tanıtım sitesi asıl atölye/egzersiz motoru değildir.
- **İki giriş oluşturulmaz:** Tanıtım ve kayıt sonunda aynı CZA Student ID/SLP korunur.

## Mevcut kodun gerçek durumu (9 Ekim 2026)

**Hedef ayrım onaylandı; teknik ayrıştırma HENÜZ TAMAMLANMADI.**

- `dekorix/cza-akademi` deposunda `.openai/hosting.json` → `appgprj_6abf93124e7c819193147ac0c0a3e931` var. Bu hedefe ait Sites yönetim/sürüm sahipliği doğrulanamadı. Dosya **bu karar kapsamında değiştirilmez veya silinmez**.
- `vite.config.ts`, Sites eklentisi ve bu hosting manifesti üzerinden build bağı taşıyor.
- `apps-script/Handoff.gs` ve `app/layout.tsx`, `https://celik-zihin-akademisi.habipcann65.chatgpt.site` adresini kullanıyor. `tests/sites-canonical-binding.test.mjs` bu mevcut B bağını bekliyor. **Yönlendirmeler tek taraflı kaldırılmaz**.
- PR #78'de manifesti silen aday, Vite TS2307 ve kanonik Sites sözleşmesi testinin FAIL vermesi nedeniyle reddedildi/kapatıldı. Kasıtlı kaynak/yayın bağı kanıtlanmadan “ayrıldı” denmez.
- Taslak [PR #59](https://github.com/dekorix/cza-akademi/pull/59) önceki “ayrı ürün” ifadesi için tarihsel bağlamdır. **Bu karar daha kesindir:** tek CZA ürünü/ekosistemi, ayrı teknik tanıtım bileşeni. Çelişen metinler güncellenmeden PR #59 eski dille merge edilmez.
- [Issue #77](https://github.com/dekorix/cza-akademi/issues/77) Sites B kimlik/sürüm/yayın yönetimi erişimi için açık kalır.

## Sorumluluk ve kabul sınırları

1. **Öğrenci, eğitmen, veri, akademik öğrenme, SLP ve değerlendirme sorunları → Büyük CZA.**
2. **Tanıtım metni, sayfa tasarımı, program vitrini, pazarlama SEO'su → Tanıtım Sitesi.**
3. **Tanıtımdan başvuruya ve kayda geçiş → iki bileşenin yetki kontrollü API/redirect sözleşmesi.** Kapsam ana platform kimliğini ve eğitim geçmişini korur.
4. **Sites versiyon/publish yetkisi**, **Büyük CZA Worker/deploy yetkisi** anlamına gelmez. Tam tersi de geçerli değildir.
5. PR/issue, Codex/T5 Patronu ve ChatGPT yeni çalışmaya başlarken **“ANA CZA mı, TANITIM WEB SİTESİ mi, ENTEGRASYON SINIRI mı?”** ayrımını açıkça belirtir.
6. Çalışma tamamlandı sayılması için her bileşenin farklı URL, kaynak commit/tree, gerçek erişim ve test kanıtı gerekir. Dosya değişikliği “production’a yayınlandı” kabul edilmez.

## Doğru teknik uygulama sırası

A. Önce mevcut `/work`, Sites manifesti, Vite eklentisi, Apps Script linkleri ve onaylı GitHub referanslarının **eski→yeni kullanım ve veri akışı envanteri** çıkarılır. Bu sırada T5/değerlendirme kabul işleri bozulmaz.

B. Tanıtım Sitesinin **ayrı kaynak alanı ve ayrı versiyon/publish hattı** belirlenir. İkinci öğrenci/DB oluşturulmaz. Site yalnız yetkili bağlantı üzerinden değerlendirmeye ve kayıt akışına gider.

C. Entegrasyon için sentetik öğrenci ve veli izinleri, başvuru→değerlendirme→eğitmen raporu→kayıt/erişim, yanlış kuruma erişim ve idempotent ödeme/kayıt senaryoları test edilir. İçerik eksiltme olmadan Chrome masaüstü/mobil ve staging readback istenir.

D. Ancak bütün kaynak/yayın/erişim kanıtları tamamlandığında yeni bağlantılar kademeli devreye alınır; production yalnız **kullanıcının açık izniyle**.

**KAPSAM SAPMASI=YOK (karar ve belgeler).** Mevcut kaynak karması açık **TEKNİK AYRIŞTIRMA BORCU**dur. **SIRADAKİ TEK ADIM:** Büyük CZA değerlendirme ve öğrenci akışlarına dokunmadan ayrı tanıtım Sitesinin kaynak/URL/yayın sınırını doğrulayan teknik envanteri hazırlamak.
