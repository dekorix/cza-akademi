# CZA Security/Data Integrity deployment gate

This PR is not a deployment authorization. Run every gate below on a disposable
database populated only with synthetic fixtures before requesting QA approval.

## Database identities

- Migrations use a direct, non-pooler `DATABASE_URL_UNPOOLED` connection.
- The client-facing application login is a member of `cza_app_runtime` and is
  not the owner of `learning_records` or `learning_evidence`.
- The server-authoritative verification service uses a different login that is
  a member of `cza_evidence_verifier`.
- Reporting uses a login that is a member of `cza_ledger_reader`.
- The application runtime never receives migration-owner or verifier credentials.

Example grants, executed by the migration owner after creating login roles:

```sql
GRANT cza_app_runtime TO cza_runtime_login;
GRANT cza_evidence_verifier TO cza_verifier_login;
GRANT cza_ledger_reader TO cza_reporting_login;
```

## Trusted edge boundary

Production must run the route inside Cloudflare Workers with
`CZA_TRUSTED_EDGE=cloudflare`. The limiter accepts `CF-Connecting-IP` only when
the runtime-injected `request.cf` object exists. A direct request carrying a
forged header but no Cloudflare runtime context fails closed with 503.

Do not place a separately reachable origin behind the Worker. If the topology
changes, replace `trustedRequestAddress()` with that platform's authenticated
proxy boundary and add an equivalent spoofing test before deployment.

## Contract cutover

The current browser runtime and transport both publish contract `1.1.0`, and the
transport sends the same value in `X-CZA-Contract-Version`. Deploy these public
assets and the API route in the same release. The server continues to accept
header-matched `1.0.0` records and computes the original PR #31 canonical hash,
so legitimate legacy idempotency replays remain valid.

## Required tests

```bash
pnpm test:security
pnpm exec tsc --noEmit
pnpm build
```

## Automated cloud gate

`.github/workflows/canonical-security-postgres.yml` runs the local gates and
then creates an isolated Claimable Neon project for the real PostgreSQL suite.
`scripts/run-canonical-security-postgres-ci.mjs` reads the direct endpoint
created by that same Claimable run, hashes its hostname, and starts the database
orchestrator under a socket-level positive allowlist before importing the
PostgreSQL driver. The allowlist permits exactly that one temporary hostname
and rejects every other hostname fail-closed. It covers the administrator,
test, and synthetic-database cleanup connections without requiring any
production URL or fingerprint. The runner creates a synthetic
`cza_security_test_*` database, redacts connection material, drops the database,
and derives `productionAccessed` from the observed runtime connection hashes.

The workflow uses the repository-locked Neon CLI and full action commit SHAs.
It deletes the temporary Neon project and credential files in `always()`
cleanup steps. Before tests start, Claimable Neon cleanup authority is sealed
with RSA-OAEP-256 and AES-256-GCM using the designated recovery officer's public
key. If project deletion fails, plaintext credentials are still removed while
the encrypted cleanup bundle, project ID, expiry and `orphaned` state remain in
the evidence artifact.

Every successful CI run also performs a live recovery drill against that same
disposable project. It creates a one-run RSA key pair, seals a second bundle,
deletes the original Claimable context and credential, and requires the
recovery command to restore the credential and receive an exact remote
`state: deleted` result from the pinned Neon CLI. The one-run private key and
drill bundle are then destroyed. A sanitized `neon-recovery-drill.json`
evidence record retains the encrypted-bundle hash and confirmed deletion
result. A failure keeps the separately encrypted recovery-officer bundle and
fails the job.

The workflow has no production database credential and performs no merge or
deployment. Pull requests from forks cannot start the disposable Neon job.

The recovery public key is committed at
`security/recovery/cza-neon-cleanup-public.pem` and pinned by its DER SHA-256
fingerprint in the workflow. The recovery officer must keep the matching
private key offline with mode `0600`. The private key must never be added to
Actions, repository files, logs, or artifacts.

If cleanup is reported as `orphaned`, download the encrypted recovery bundle
and run the following from the audited commit before its recorded
`authorityExpiresAt` or project expiry. The command restores credentials only in a temporary
mode-`0700` directory, invokes the repository-locked Neon CLI, requires a
confirmed `state: deleted` response, and removes the restored plaintext in a
`finally` cleanup:

```bash
chmod 600 /secure/offline/cza-neon-recovery-private.pem
node scripts/neon-cleanup-recovery.mjs recover-delete \
  ./neon-cleanup-recovery.encrypted.json \
  /secure/offline/cza-neon-recovery-private.pem \
  ./node_modules/.bin/neon
```

True multi-connection races require a disposable PostgreSQL database whose name
starts with `cza_security_test`. The connection must be direct (its hostname
must not contain `-pooler`). For a manual disposable-only run, pass the lowercase
SHA-256 hash of that temporary hostname as the sole positive allowlist value:

```bash
CZA_TEST_DATABASE_CONFIRM=ephemeral \
CZA_TEST_DATABASE_URL="$DATABASE_URL_UNPOOLED" \
CZA_ALLOWED_POSTGRES_HOST_SHA256="$TEMPORARY_DATABASE_HOST_SHA256" \
pnpm test:security:postgres
```

The integration test creates a populated PR #31 schema, upgrades it twice,
proves least-privilege role behavior, and runs true multi-connection races. It
destroys and recreates the `public` schema. Never point it at production or at a
shared development database, and never copy production data into the fixture.
