# CZA Faz 3 / Kapı 1B — B1 Son Kapanış Matrisi

| Kontrol | Bağlanan kanıt / uygulama | Sonuç |
|---|---|---|
| İmzalı Manifest v4 | Ed25519 + RFC8785-JCS; run `35014797059`; artifact `10414893292`; digest `3067bafbfd36a661f48d0498f4cefc210ec1befb1a7d38acb4dd0c9fd92c05d4` | PASS |
| Uygulama kimliği | Commit `83878d0bbaa99cef7656d9a74f98c881a9bb8900`; tree `13bc90c34618373c6899bf24183bcfe289969649` | PASS |
| P1 proof kaynağı | Run ID, artifact ID/adı/digest ve uygulama kimliği yalnız doğrulanmış manifest çıktılarından okunur; manuel proof girdisi yoktur | PASS |
| Run ve artifact doğrulaması | Başarılı exact-run/workflow/repository/commit ile exact artifact ID/ad/digest zorunludur | PASS |
| Evidence bağı | Proof belgesi, provider schema, inventory ve lockfile SHA-256 değerleri manifestte imzalıdır | PASS |
| Replay guard | Sabit workflow concurrency + run/digest tabanlı GitHub artifact claim; aynı isimde mevcut claim ikinci kullanımı fail-closed reddeder | PASS |
| Provisioning önkoşulu | Provision job yalnız proof gate ve claim upload başarılıysa başlayabilir; manifestteki uygulama commit'i checkout edilir | PASS |
| Bu turdaki mutation | Provider mutation, P1 provisioning, deploy, merge ve production erişimi çalıştırılmadı | PASS |

Hedefli testler; doğru zinciri kabul eder, bozuk imza, run/digest uyuşmazlığı, manuel sahte locator, replay ve farklı commit/tree durumlarını reddeder.
