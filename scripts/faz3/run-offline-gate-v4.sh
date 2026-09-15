#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

for forbidden in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY NEON_API_KEY DATABASE_URL CZA_FAZ3_STAGING_DATABASE_URL TF_REATTACH_PROVIDERS TF_CLI_CONFIG_FILE TF_PLUGIN_CACHE_DIR; do
  if [[ -n "${!forbidden:-}" ]]; then
    echo "PROVIDER_OR_DATABASE_CREDENTIAL_FORBIDDEN:$forbidden" >&2
    exit 80
  fi
done

gate_tmp="$(mktemp -d)"
trap 'rm -r "$gate_tmp"' EXIT

node scripts/faz3/verify-delivery-v4.mjs --static-only
node scripts/faz3/verify-vendored-toolchain.mjs delivery/toolchain/inventory.json
tofu_bin="$repo_root/delivery/toolchain/tofu"
provider_mirror="$repo_root/delivery/toolchain/providers"
test -x "$tofu_bin"
test "$("$tofu_bin" version -json | node -pe 'JSON.parse(require("fs").readFileSync(0)).terraform_version')" = "1.12.0"

"$tofu_bin" fmt -check -recursive infra/staging
node scripts/faz3/assert-p0-nonmutating.mjs infra/staging/p0-static --command scan
if node scripts/faz3/assert-p0-nonmutating.mjs infra/staging/p0-static --command apply; then
  echo "P0_APPLY_NEGATIVE_TEST_FAILED" >&2
  exit 81
fi
"$tofu_bin" -chdir=infra/staging/p0-static init -backend=false -input=false
"$tofu_bin" -chdir=infra/staging/p0-static validate
"$tofu_bin" -chdir=infra/staging/p0-static plan -refresh=false -lock=false -input=false -out="$gate_tmp/p0.plan"
test "$("$tofu_bin" -chdir=infra/staging/p0-static show -json "$gate_tmp/p0.plan" | node -pe 'JSON.parse(require("fs").readFileSync(0)).resource_changes?.length || 0')" = "0"

cp infra/staging/p1-provision/.terraform.lock.hcl "$gate_tmp/lock.before"
"$tofu_bin" -chdir=infra/staging/p1-provision init -backend=false -input=false -lockfile=readonly -plugin-dir="$provider_mirror"
"$tofu_bin" -chdir=infra/staging/p1-provision validate
"$tofu_bin" -chdir=infra/staging/p1-provision providers schema -json > "$gate_tmp/provider-schema.json"
cmp infra/staging/p1-provision/.terraform.lock.hcl "$gate_tmp/lock.before"
node scripts/faz3/inventory-provider-schema.mjs "$gate_tmp/provider-schema.json" "$gate_tmp/provider-schema-inventory.json"
source_commit="$(node -pe 'JSON.parse(require("fs").readFileSync("delivery/CZA_Faz3_Delivery_Manifest_v4.json")).application.commit')"
CZA_TOFU_BIN="$tofu_bin" node scripts/faz3/collect-native-provider-proof.mjs \
  --root=. \
  --source-commit="$source_commit" \
  --schema="$gate_tmp/provider-schema.json" \
  --inventory="$gate_tmp/provider-schema-inventory.json" \
  --out="$gate_tmp/native-provider-proof.json"

node scripts/faz3/generate-offline-resource-graph.mjs . "$gate_tmp/offline-resource-graph.json"
cmp infra/staging/generated/offline-resource-graph.json "$gate_tmp/offline-resource-graph.json"
node --test tests/faz3-canonical-cross-runtime.test.mjs tests/faz3-origin-verifier.behavior.test.mjs tests/faz3-oidc-policy.test.mjs tests/faz3-recovery-wal.test.mjs tests/faz3-replay-concurrency.test.mjs tests/faz3-worker-bundle.test.mjs
./node_modules/.bin/tsc --noEmit

node scripts/faz3/verify-delivery-v4.mjs --native-provider-proof="$gate_tmp/native-provider-proof.json"
echo '{"result":"PASS","providerMutationAttempted":false,"productionAccessed":false}'
