# P1 Neon credential broker

This is an isolated, single-replica control-plane service. It is not linked into the CZA user API.

Required secret-store values are `CZA_NEON_ADMIN_API_KEY` and `CZA_NEON_ORGANIZATION_ID`. The admin key is used only by the server to mint and revoke one run-bound organization API key; it is never included in an HTTP response. `CZA_BROKER_LEASE_STORE` must point at a persistent, broker-private volume. The service refuses to start without the current independently accepted `CZA_CURRENT_P0C_SHA256` and a non-empty `CZA_PRODUCTION_ENDPOINT_SHA256_DENYLIST`.

Endpoints:

- `GET /healthz`
- `POST /v1/exchange` with a GitHub OIDC bearer token and the exact P1 policy request
- `POST /v1/revoke` with the same run identity and returned `leaseId`

Expired active leases are revoked by the in-process sweeper. Run a single replica because the durable JSON ledger uses an exclusive filesystem lock.
