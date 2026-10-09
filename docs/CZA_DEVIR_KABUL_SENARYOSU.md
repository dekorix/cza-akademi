# CZA | Yeni Sohbet / T5 Patronu / Codex Devir ve Kabul Senaryosu

> 9 Ekim 2026. Bu, CZA kontrol mekanizmasının test planı ve kaynak bağlantı listesi. Gerçek bir farklı sohbet veya Codex ajanının kendiliğinden bu belgeyi okuduğu, ancak o ajan üzerinden kanıt alınırsa doğrulanabilir.

## Amaç
Yeniden geliştirilen eksik platformlar, unutulan kararlar, eski çalışmanın silinmesi ve kod/CI başarılarının yanlışlıkla staging kabulü olarak ilan edilmesini önlemek.

## Başlatma prosedürü
1. Doğrudan `dekorix/cza-akademi` ana depo ve `AGENTS.md` (bulunduğu dal) ile başla. Tanıtım Sites kimliğini kaynak depo sanma.
2. `docs/CZA_KONTROL_PROTOKOLU.md`, `docs/CZA_MASTER_ARCHITECTURE.md`, `docs/CZA_14_Beceri_v1.md`, `CENTRAL_IDENTITY_PLAN.md`, `docs/CZA_URUN_VIZYONU_TASLAK.md`, `docs/CZA_DURUM_PANOSU_TASLAK.md`, `docs/CZA_KARAR_DEFTERI.md` belgelerini oku.
3. Yerel `git status`, `git rev-parse HEAD`, `git rev-parse HEAD^{tree}`; uzak `main` HEAD, açık PR, Issue #72 ve staging versiyon kaynağını ayrı kanıtla. Bilinmeyen staging sürümüne `UNKNOWN` yaz.
4. `node --test tests/cza-handoff-inventory-guard.test.mjs`; `node scripts/qa/cza-handoff-inventory-guard.mjs` ile 16+10 profil/23 P2 bölüm/14 beceri kaynak bekçisini çalıştır; **DB/gerçek kullanıcı kabulü olarak sunma**.
5. O sırada açık tek teknik görevi, kaynak BASE_SHA, ilgili dosyalar, korunacak içerikler ve testleriyle tarif et. Aktif başka T5 işi varsa yeniden başlatma.
6. Çıktıda son kararları **ONAYLI / TASLAK / KAYNAKTA VAR / CI PASS / STAGING PASS / BLOCKED** olarak ayır; gerçekte tanımlanmayan yüzde uydurma.

## Kabul senaryoları ve beklenen cevap
| Senaryo | Beklenen kanıt | Başarı kriteri |
|---|---|---|
| Devir alan kişi repo/link açabiliyor | GitHub `main` HEAD ve kontrol belgeleri | Kaynak güncel ve hangi dalda olduğu açık |
| Vizyonu doğru anlıyor | Tek Student ID/SLP; üç öğrenci yüzeyi; 0–YKS; 14 beceri | Tanıtım Sites / büyük CZA karıştırılmıyor |
| Eksiltme yapmıyor | P2 23 bölüm / 16 yaş-sınıf / 10 özel profil kaynak envanteri | Kaynak sayıları doğrulanıyor; mikro-görev parity ayrıca belirtiliyor |
| Açık entegrasyonu biliyor | Issue #72, PR #73 ve gerçek staging readback durumu | Taslak düzeltme nihai PASS sayılmıyor |
| Hakları koruyor | Merge/deploy/DB/gerçek veri için açık ürün sahibi izni | Hiçbir tehlikeli işlem izinsiz yapılmıyor |
| Sıradaki tek adımı söylüyor | Aktif PR/issue, hedefli test kanıtı | Birden çok dağınık iş emri oluşturulmuyor |
| Kalite danışmanlığı yapıyor | BULGU → ÖNERİ → GEREKÇE → SINIR → TEST | Sadece “hata var” diyerek bırakmıyor |

## Bu sohbetin salt okunur devir provası
- 9 Ekim'de GitHub'da `main` SHA `9f76b6322991a850980dd1240e6232882bface2e` bulundu; **snapshot**, gelecekte yeniden sorgulanmalıdır.
- Onaylı yönetim standardı ve otomatik kabul PR #74 taslak dalındadır; `main` üzerinde çalıştığı söylenemez.
- Kaynak envanteri `lib/assessment-bridge.ts`, `lib/p2-full-assessment-contract.ts`, 14 beceri dosyasından türetilmiştir.
- Bu protokol kapsamında başka ajan oturumu açılıp test edilmedikçe **SOHBETLER ARASI DEVRİN TAM KABULÜ=BEKLİYOR**.

## Sonuç etiketleri
`SOURCE_INVENTORY_PASS` = kaynağın korunması; `DEVIR_DOKUMAN_PASS` = kaynak/kurallar okunabiliyor; `DEVIR_AJAN_E2E_PASS` = yeni bağımsız ajanla gerçek devir raporu doğrulandı. Bir statü diğerinin yerine kullanılamaz.

**Not:** Bu belgedeki tek teknik kabul emri, proje geneline yeni feature açmak değil; mevcut dar işin kaynağını, yetkisini ve test kapılarını korumaktır.
