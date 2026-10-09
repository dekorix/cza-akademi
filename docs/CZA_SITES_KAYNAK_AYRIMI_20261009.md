# CZA | Büyük Platform ve ChatGPT Sites Kaynak Sınırı

**Tarih:** 9 Ekim 2026  
**Durum:** Onay adayı; doğrudan `main` ya da production kabulü değildir.

## Kanonik ürün sınırı
- **Büyük CZA:** `dekorix/cza-akademi` ana deposu; öğrenci/eğitmen panelleri, Başlangıç Değerlendirmesi, ortak Student ID ve Student Learning Profile, 0–YKS gelişim/akademik/koçluk/veli/AI ekosistemi.
- **ChatGPT Sites:** tanıtım ve sunum amaçlı **ayrı yayın yüzeyi**. Bir Sites sitesinin proje kimliği büyük CZA'nın üretim/runtime kaynak kimliği değildir. Sites kaynak sürümü aktarılacaksa ayrı, kullanıcıca doğrulanmış Site projesine açık sürüm kaydetme ve ayrıca yayın kararı gerekir.

## Kanıtlanmış tarihçe ve kimlikler
| Kaynak | Sites proje kimliği | Kabul durumu |
|---|---|---|
| GitHub `.openai/hosting.json`, 3 Eylül–6 Ekim öncesi | `appgprj_6a98e9bc27c481919d11f1b06147198b` | Kullanıcının açık hesabındaki `Çelik Zihin Akademisi` Sites listesinde ve edit URL'sinde görüldü; tanıtım sitesi, büyük CZA platformu DEĞİL |
| 6 Ekim commit `37617dd2f4153f0066928094bc99a507a4042f75` | `appgprj_6abf93124e7c819193147ac0c0a3e931` | `project_id` bu değere değiştirildi; site hesabında sahibinin kaydı/Source-Version-Publish yönetimi doğrulanamadı |
| Aktif GitHub `main`, 9 Ekim gözlemi | `appgprj_6abf93124e7c819193147ac0c0a3e931` | **Eski Site bağlantısı riski; uygulama tarafı kabulü YOK** |

**Kaynak kanıtı:** [6 Ekim Sites kimlik değişimi](https://github.com/dekorix/cza-akademi/commit/37617dd2f4153f0066928094bc99a507a4042f75), [Issue #77](https://github.com/dekorix/cza-akademi/issues/77), [Kontrol Kulesi PR #74](https://github.com/dekorix/cza-akademi/pull/74).

## Uygulanan koruyucu kararın kapsamı
Büyük CZA ana deposundan `.openai/hosting.json` **yalnız bu değişiklik adayında kaldırılır**. Ayrıca `vite.config.ts` dosyasındaki bu manifesti doğrudan okuyan import ve Sites Vite eklentisi kaldırılır. Önceki manifestteki `d1=null` ve `r2=null` davranışı `d1_databases: []` ve `r2_buckets: []` ile korunur. Bu bir Sites silme talimatı, üretim dağıtımı veya mevcut Sites içeriği silme eylemi değildir. Herhangi bir Sites versiyonunun kullanıcı hesabında/ürününde kaybolduğunu da kanıtlamaz.

**Neden eski ID'ye körlemesine geri dönülmedi?** Önceki ID hesapta var olsa da **tanıtım** Sites projesine işaret ediyor. Büyük CZA öğrenci veri platformunu bu projeye otomatik kaynak olarak bağlamak mimari sınır ihlalidir.

## Sözleşme ve gelecekteki kaynak aktarımı
1. CZA çekirdek repo herhangi bir Sites proje ID'sini kanonik hosting kaynağı olarak taşımaz.
2. Tanıtım Sites için ayrı proje/kaynak alanı ve açık `SITES_PROJECT_ID` kayıt defteri tutulur. Bu, yalnız o ayrı dağıtım çalışma alanında saklanır; çekirdek CZA Student ID/DB'sini değiştirmez.
3. Sites kaynak sürümü **Save a version**, yayın **Deploy/Publish a version** olarak ayrı kabul edilir. İstemeden otomatik publish yetkisi varsayılmaz.
4. GitHub `main` → Cloudflare / Vercel / Netlify / Sites otomatik dağıtım etkileri tek tek kanıtlanmadan, ilgili merge ve production hakkı verilmiş sayılmaz.
5. Bu PR gelecekte site kimliği dosyasının çekirdek depoya sessizce yeniden eklenmesini veya Vite üzerinden gizli Sites bağının yeniden kurulmasını denetleyen kaynak testi içerir. Sites paket bağımlılığının `package.json` içinde bulunması tek başına entegrasyon anlamına gelmez; bu PR kilit dosyasını değiştirmez.

## Açık konu
- Değişiklik yalnız PR olarak sunulmuştur; GitHub `main` dosyası henüz kaldırılmamıştır.
- `appgprj_6abf...` Sites projesinin başka hesap/çalışma alanındaki gerçek sahipliği henüz belirlenmedi. Bu belirsizlik, çekirdek CZA'nın Sites'e varsayılan bağlı tutulmasının nedeni değildir.
- İlk uygulama denemesinde manifest tek başına kaldırılınca dört mevcut CI'da `vite.config.ts(5,27) TS2307` oluştu; bu hata `vite.config.ts` bağımlılığı kaldırılarak düzeltme adayına dahil edildi. CI yeniden PASS vermeden kabul yapılmaz.
- PR #74'ün son CI, dal koruması, yayın güvenliği ve ayrı ajan devir testi kendi kabul aşamalarını gerektirir. Bu değişiklik onları kendiliğinden PASS yapmaz.

**KAPSAM SAPMASI=YOK | PRODUCTION=YASAK | SIRADAKİ TEK ADIM:** Bu ayrıştırma PR'ının kaynak/diff ve CI sonuçlarını doğrula; ardından main entegrasyon sırasını yayın etkisi, scope ve sahiplik kanıtıyla kararlaştır.
