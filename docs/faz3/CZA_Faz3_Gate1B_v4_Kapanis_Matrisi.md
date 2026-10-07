# Faz 3 Gate 1B v4 kapanış matrisi

| Bulgu | Gerçek uygulama | Dosya/kod | Test | Sonuç |
|---|---|---|---|---|
| B1 — provider-schema güvenilir değil | AF_UNIX adapter yok; read-only lock ile kurulan değişmemiş binary’ler, gerçek AF_UNIX ve tam schema yüzeyi zorunlu | native workflow + collector + proof verifier + offline gate | adapter/override/reattach/eksik yüzey negatifleri; doğal Linux’ta dinamik PASS zorunlu | KAPALI (uygulama); re-audit yürütme kapısı |
| B2 — zorunlu kontroller IaC grafiğinde yok | WAF, transform, Access/MFA, Worker/route, Tunnel config, DNS ve Neon gerçek resource; external kontroller gerçek kod/SQL | `infra/staging/modules/**`, `control-classification.json` | otomatik HCL graph + control coverage | KAPALI (statik) |
| B3 — P0 guard fail-open | Provider’sız ayrı root ve apply/destroy/import hard-fail guard | `p0-static/**`, `assert-p0-nonmutating.mjs` | exit 23 negatif test; P0 plan 0 resource | KAPALI |
| B4 — origin verifier yok | HMAC/body/JWT/authority/route/tenant/nonce fail-closed verifier ve gerçek route | `lib/faz3-origin-*.ts`, `app/api/faz3-origin/route.ts` | bundled behavior, tamper ve replay testleri | KAPALI (offline) |
| H1 — OIDC template | Gerçek repo numeric ID’leri, final commit ve pinned reusable SHA için çalışan exact-claim verifier/policy | OIDC generator/schema/verifier + P1 workflows | pozitif fixture + her claim için negatif fixture + manifest identity doğrulaması | KAPALI |
| H2 — canonical/header zinciri eksik | Literal/decoded C0/DEL reddi; multi-value WAF + late-transform marker; Worker sabit boolean kullanmıyor | edge/origin parser + Cloudflare module + Worker | 33 control × iki runtime, property grammar, HCL graph ve adversarial header testleri | KAPALI (statik) |
| H3 — recovery/WAL gerçek değil | Üç mutation için harici PREPARED/REQUESTED WAL, strict wrapper, tam label discovery, delete ve sıfır-kaynak requery | reusable workflow + WAL/wrapper/reconciler | premature mutation/credential negatifleri + lost-response/remaining-resource lifecycle | KAPALI (offline) |
| H4 — teslim yeniden üretilemiyor | Tüm workflow hashleri, final source commit/tree, pinned reusable SHA, imzalı vendored toolchain ve ağsız tek-ZIP temiz-dizin kapısı | manifest builder/verifier + git object index + toolchain inventory + offline gate | dosya/iş akışı/imza/toolchain drift negatifleri; native kanıt kapı içinde zorunlu | KAPALI (paketleme) |

## Karar sınırı

P0 kaynak paketi provider mutation yapmamıştır. Doğal Linux provider kanıtı statik yeniden denetimde offline gate tarafından üretilip doğrulanmadan kapı PASS vermez. P1 kapalı kalır.
