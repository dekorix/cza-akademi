# P1 Neon staging broker proxy

This isolated control-plane service is not linked into the CZA user API. It owns the only Neon organization credential and exposes a narrow project lifecycle proxy. GitHub runners receive an opaque broker capability, never a Neon API key.

Required secret-store values:

- `CZA_BROKER_DATABASE_URL`: durable control-plane PostgreSQL database
- `CZA_BROKER_CAPABILITY_SECRET`: at least 32 bytes, used only to derive opaque lease capabilities
- `CZA_STAGING_NEON_API_KEY`: organization key for a dedicated staging-only Neon organization
- `CZA_STAGING_NEON_ORG_ID`: fixed dedicated staging organization; callers cannot override it
- `CZA_CURRENT_P0C_SHA256`: current accepted attestation digest
- `CZA_PRODUCTION_ENDPOINT_SHA256_DENYLIST`: comma-separated production hostname digests

The runtime does not load production Neon credentials or Cloudflare credentials. Legacy generic admin-key variables are rejected at startup.

Endpoints:

- `GET /healthz`
- `POST /v1/exchange`
- `POST /v1/neon/projects`
- `GET /v1/neon/projects/:leaseProjectId`
- `DELETE /v1/neon/projects/:leaseProjectId`
- `POST /v1/revoke`

All project routes require a fresh exact-claim GitHub OIDC token and the short-lived `x-cza-lease-token`. The route parameter is the broker lease ID, not a caller-selected Neon project ID. Scope, identity, status, and expiry are checked server-side on every request.

`migrations/001_p1_broker_leases.sql` supplies the durable unique `run_key` ledger. Exchange is idempotent per `repository_id:workflow_run_id:run_attempt:wal_run_id`; project creation is serialized and reconciles the deterministic project name before calling Neon. The expiry sweeper marks abandoned nonterminal leases `EXPIRED`.
