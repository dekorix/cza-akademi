# P0 static root

This root intentionally declares no provider, module, data source, resource, import, backend, provisioner, or removed block. It exists only so `tofu init -backend=false`, `validate`, `plan`, and a deliberately attempted `apply` cannot reach a provider mutation surface. `scripts/faz3/assert-p0-nonmutating.mjs` parses this directory and rejects any newly introduced provisioning block before invoking OpenTofu.
