# CZA Faz 3 Gate 1B v4

`infra/staging` has one source-of-truth: OpenTofu 1.12.0 with Cloudflare 5.25.0 and Neon 0.1.15 pinned exactly. No provider mutation was run while producing this package.

## Roots

- `p0-static/` has zero provider, module, data, resource, backend, import, or provisioner blocks. `assert-p0-nonmutating.mjs` exits nonzero for `apply`, `destroy`, or `import` and rejects any provisioning block added to this root.
- `modules/` contains the real staging modules. It is not a root and cannot run by itself.
- `p1-provision/` is the only provisioning root. It requires P0-C attestation, an approved GitHub Environment, exact-claim OIDC exchange, durable WAL, and explicit `authorize_p1=true`. P1 remains closed in this delivery.

## Control ownership

`control-classification.json` labels every required control as `NATIVE_PROVIDER_RESOURCE` or `EXTERNAL_ENFORCEMENT_REQUIRED`. The generated graph is derived from HCL and that classification by `scripts/faz3/generate-offline-resource-graph.mjs`; it is never hand-authored.

Cloudflare Rules observe the multi-value header map and `http.request.headers.truncated` before the Worker receives a merged `Headers` view. The firewall rejects truncation, duplicate Content-Type, and client-provided `x-cza-*` trust headers. A late transform emits the complete-header marker and raw target. The Worker independently rejects missing markers and malformed target bytes; the origin reconstructs the target from the signed raw target and requires byte-identical canonical output.

## Native provider proof

`.github/workflows/faz3-p0-native-provider-schema.yml` is the approved natural-Linux proof route. It installs checksum-pinned OpenTofu, uses published provider binaries without a shim, runs `fmt`, `init -backend=false`, provider lock, `validate`, and `providers schema -json`, then verifies the complete Cloudflare schema is not reduced. That workflow was deliberately not triggered during P0 source production. Until its immutable artifact is attached and sealed into Manifest v4, B1 remains open and the package must not claim static re-audit readiness.
