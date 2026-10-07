# CZA Faz 3 Gate 1B v4 security artefacts

Bu dizin `CZA-F3-GATE-1B-V4` için HMAC, OIDC, RBAC, replay, recovery, supply-chain ve Ed25519 offline attestation sözleşmelerini içerir. Dosyalar provider secret'ı, production kimliği veya gerçek öğrenci verisi içermez.

Ana offline komutlar:

```sh
npm run gate:faz3
```

Gate doğal AF_UNIX destekli Linux üzerinde değiştirilmemiş provider plugin’leriyle çalıştırılmalıdır. Provider mutation ve provider credential yasaktır. P1 ve P2 kanıtlarının yerine geçmez.
