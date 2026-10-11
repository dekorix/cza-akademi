# V02 P1: okuma / cevap yazma / bağlama ayrımı

Karar kaynağı: [Baş Mimar P1 emri](https://github.com/dekorix/cza-akademi/pull/87#issuecomment-6105596130). Aynı OPEN/DRAFT PR #87, `feat/v02-candidate-student-link`; korunan başlangıç HEAD `911aa08cfd5d4547a0c7ed79acdfed18935729a1`. Yalnız fast-forward devam edildi. **V02_ACCEPTED=NO**.

Dağıtılan ürün kaynağı commit `1abf1e257c106809fbf344846dc975c82ca62a90`, tree `b76e3b8c75ab72c429e9fb741a272058f6e4a5df`. İzole Worker `cza-v01-isolated-synthetic-20261010`, sürüm `6c7b0d36-5406-4d7e-b9af-7005059a49bd`, %100. Sonraki teslim commit'i yalnız test/kanıt/QA aracı ve bu belgeyi tamamlar; ürün dosyaları dağıtılan kaynakla aynıdır. Teslim HEAD/tree PR açıklamasında verilir.

`cza_v02_readable_students` kurum, aktif kanonik eğitmen, aktif sentetik öğrenci ve `can_view` kontrolüyle okumayı sağlar. `cza_v02_student_history` artık bağlama iznine bağlı değildir. History endpointi kaynak oturumun yetkili öğrencinin geçmişinde bulunmasını doğrular; picker/bind kaynak sahipliği kontrolü korunur. `get/report` bu bağımsız okuma yetkisini kullanır. `attempt/finish` ayrıca `createdByEducatorId` ile açık oturum sahibini kontrol eder. View-only başka eğitmen cevap/gözlem/bitiş mutasyonuna ulaşamaz. Yeni genel güvenlik denetimi başlatılmadı; mevcut CI workflow'u korunmuştur.

| Yetki / eylem | Sonuç | Kanıt |
|---|---|---|
| Sahip, can_view=true, can_link=false: get/report/history | PASS | Gerçek QA API, üç eski oturum |
| Sahip, can_view=true, can_link=false: aynı aday resume | PASS | Gerçek API ve desktop/mobile Chrome reload |
| Sahip, can_link=false: bind | DENY 403 | Üç eski oturum üzerinde API; Chrome |
| Aynı kurum view-only iki eğitmen: history | Üç kayıt okunur | Gerçek Neon, önceki 0 sonucu artık 3 |
| View-only başka eğitmen: attempt/finish | DENY 403, SQL mutasyonu yok | Gerçek route kodunu çalıştıran hedefli test; ikinci eğitmen Chrome/API oturumu kullanılmadı |
| Sahip: attempt/finish | PASS | Yerel route testi; korunan QA cevapları yeniden yazılmadı |
| can_view=false: read | DENY | Yerel SQL/route testleri |
| Başka kurum öğrencisi: history | DENY 403 | Gerçek QA API |
| Regrant: read/resume/bind | PASS | Gerçek QA API; idempotent audit |

[Tüm yeni kanıtlar](evidence/v02-p1/):

- Hedefli V02 + V01 resume testleri **27/27 PASS**, TypeScript ve build PASS.
- QA API izin geri alımında **16/16**, geri veriminde **16/16 PASS**.
- Gerçek Chrome desktop ve mobile PASS; sahte istek/cookie enjeksiyonu yok, TLS açık. Ekran görüntüleri ve JSON kanıtları ektedir.
- Yerel gerçek PostgreSQL 18.4, iki bağımsız bağlantı: **6/6 PASS**; yeni scoped read fonksiyonu minimum runtime rolüyle bağlama izni kaldırıldığında okunur, bind reddedilir. Önceden kabul edilen yarış/audit rollback kontrolleri korunur.
- [Dağıtılan kaynak CI](https://github.com/dekorix/cza-akademi/actions/runs/38113634812) SUCCESS. Teslim HEAD CI ayrıca PR açıklamasında verilir; no-secrets workflow'un gerçek PostgreSQL servisinde yeni P1 testi de çalışır.
- 233/233 Worker modülü, 5/5 statik dosya kaynakla eşleşir. Ana staging sürümü `111d84f5-e284-4f31-85e7-5000071cca21` değişmedi.
- Neon yalnız `patient-firefly-51111834` / `br-withered-queen-b15ltb40` / `cza_t5_synthetic`: üç eski oturumun tam metadata, cevap/gözlem satır hashleri ve audit satırları önce/sonra birebir aynı. API revocation/regrant fingerprintleri aynı. Öğrenci **2→2**, oturum **63→63**, audit **3→3**. Onaylanan tek ilişki can_link=true olarak geri yüklendi; diğer ilişkiler false.

Migration additive read fonksiyonu ve yalnız mevcut history fonksiyonunun yetki filtresini düzeltir. Atomik bind SQL'i, audit trigger/tabloları, mevcut can_view/can_coach, RLS, kapalı indeks ve outbox değişmedi. Eski migration/evidence dosyaları yeniden yazılmadı. Production, ana staging, main ve PR #73 değiştirilmedi; gerçek öğrenci kullanılmadı.

Geri dönüş: izole QA Worker önceki kabul edilmiş sürüme alınabilir; P1 read migration'ının history filtresi önceki tanıma geri döndürülebilir. Öğrenci/oturum/cevap/gözlem/audit silme veya değiştirme gerektirmez. Bunun P1 okuma kusurunu geri getireceği açıktır; otomatik rollback yapılmadı.

GENEL PROJE İLERLEME %=güvenilir toplam ölçüm yok  
MEVCUT FAZ İLERLEME %=V01–V07 kabul 1/7 (%14,3); V02 kabul bekliyor  
TAMAMLANAN=tek P1 yetki ayrımı ve hedefli kaynak/CI/Chrome/API/Neon kanıtları  
KALAN=Baş Mimar'ın bağımsız kabul kararı  
KAPSAM SAPMASI=YOK  
SIRADAKİ TEK ADIM=Baş Mimar'ın PR #87 P1 düzeltmesini değerlendirmesi
