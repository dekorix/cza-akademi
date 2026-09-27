# F4 normal educator ingress — candidate configuration and acceptance plan

Candidate parent: `e4a40cc010ffafa3645d6b1ff6fa9ec49a920c6c`.
This document is a reviewable plan, not evidence of live configuration or browser acceptance. No deployment, Auth configuration, database mapping or secret change was performed for this candidate.

## Exact scope and configuration

| Item | Required value / action after approval |
|---|---|
| Neon project | `hidden-glade-66748043` |
| Neon branch | `br-ancient-bread-b2puable` |
| Database | `cza_learning` |
| Existing identity provider | Branch-scoped Neon Auth / Better Auth |
| Auth base URL | `https://ep-falling-resonance-b2qnvtwf.neonauth.c-6.eu-central-1.aws.neon.tech/cza_learning/auth` |
| Worker | `cza-akademi-staging` |
| Exact browser origin | `https://cza-akademi-staging.cza-staging-habip.workers.dev` |
| Worker variable | `CZA_EDUCATOR_AUTH_MODE=neon` (explicit opt-in) |
| Worker variable | `CZA_NEON_AUTH_BASE_URL` = exact Auth base URL above |
| Existing secret bindings | Preserve `CZA_TRUSTED_PROXY_HMAC_SECRET` and `DATABASE_URL`; neither is sent to the browser |
| Other bindings | Preserve Core preview URL, allowlist, bypass secret, trusted edge, diagnostics and all other existing settings |
| Neon Auth trusted origins | Add only the exact Worker origin if absent, preserving every existing entry; no wildcard or bulk replacement |
| Canonical permission | Exactly one active `public.users` educator row with a non-null academy and `auth_user_id` equal to the server-verified provider ID |

Previous read-only inventory established the branch Auth address but did not establish the normal educator provider-account mapping. No pilot mapping is claimed by this candidate. Production and the existing legacy Site are not test targets.

## Browser/server contract

1. Existing `/educator` login form accepts the educator's email/password. Same-origin JSON POST `/api/educator-auth` with `action=login` does not require an educator HMAC signature beforehand. Existing bounded strict input parsing and IP/account rate limits remain.
2. Worker sends credentials only to the fixed provider `/sign-in/email` endpoint, with exact staging Origin. Redirects are rejected. The response body, including any token field, is never forwarded to JavaScript.
3. Worker extracts only `__Secure-neonauth.session_token` from provider Set-Cookie. It does not forward arbitrary provider cookies, Domain, Location, errors or headers. The opaque credential is transported in a host-only Worker cookie `__Host-cza_neon_educator`: Path=/, HttpOnly, Secure, SameSite=Strict, Max-Age=28800. This is a provider-session transport alias, not a new auth/session database.
4. Every authenticated request calls the fixed provider `/get-session?disableCookieCache=true&disableRefresh=true` with the provider cookie name restored server-side. Session userId must equal user.id and expiresAt must be in the future. Neither provider email nor provider role grants canonical access. The local cookie cannot extend the authoritative provider lifetime; expiration/revocation causes DENY. Automatic provider refresh is intentionally disabled.
5. Parameterized canonical query matches `auth_user_id` (text, no UUID cast), `is_active=true`, `role::text='educator'`, LIMIT 2. Zero/multiple matches or missing academy are DENY. A student/inactive/unmapped provider identity has no owner fallback. Failed login mapping triggers provider sign-out and never sets a browser session cookie.
6. Only after session verification and canonical mapping, a private in-process server handoff signs the current method, pathname+search, exact body digest, canonical email context, timestamp and fresh nonce with the existing HMAC mechanism. Existing signature validation and durable nonce consumption run before the canonical identity is returned. Canonical selection remains by verified provider ID, not by the signed email. No reusable public signing endpoint exists.
7. Browser-supplied protected identity/role/signature headers are rejected. No browser headers are copied to the provider. Requests must target the exact staging origin; mutation requests require its exact Origin; cross-site/same-site fetch contexts are rejected. Existing educator route academy/can_view checks remain unchanged.
8. Existing `action=me` verifies the provider again. Hard reload relies on the HttpOnly cookie and live provider verification, not cached browser identity. `action=logout` calls provider `/sign-out`; cookie removal is reported only after successful revocation. Provider errors are sanitized, fail closed and do not create a local session.

The default (non-Neon) legacy signed-proxy/owner/reset path is unchanged. With Neon mode enabled it is deliberately not a fallback. Local password reset is not exposed in Neon mode (`neon_password_recovery_not_enabled`); pilot credentials must already be provisioned through the existing provider. Signup/reset workflows and a new authentication system are outside this candidate.

## Canonical identity mapping step — not executed

After review, confirm the chosen educator exists in this branch's existing Neon Auth, and obtain its immutable provider user ID through an authorized provider/admin path. Verify the approved educator/academy relation and map that ID to the intended existing canonical active educator row's `auth_user_id`. Verify exactly one eligible row, and retain the existing same-academy `teacher_student_links.can_view` relation. Do not infer a role from email similarity, remap a real owner, create permission columns or silently create a second user/profile. If mapping is absent/ambiguous, stop with DENY. Any actual mapping write or pilot triple must receive its own live authorization; none is performed here.

## Evidence and live acceptance boundary

`tests/f4-neon-educator-ingress.test.mjs` executes actual route/parser/ingress/auth code and parameterized queries against isolated PGlite (enum canonical roles, real unique nonce consumption and real linked-student list SQL). Only provider HTTP transport and rate-limit decisions are simulated in this test; these are contract tests, not evidence that Neon accepted credentials in staging. Existing auth/request-security/U3 tests cover HMAC, timestamp, nonce, body tamper and role/academy boundaries.

After separate live approval: preserve bindings, configure the two variables and append the single origin; verify actual provider cookie shape; perform one approved educator login, me, linked list/detail/history, hard reload, logout and reuse of the revoked cookie (DENY). Repeat student/inactive/unmapped/forged-header/expired-session denial with approved synthetic identities. Record exact Worker version and HTTP/UI results. If the provider cookie/response contract differs, stop; do not loosen parsing or claim browser PASS. A trusted Node test signer is not a substitute for this browser acceptance.

Candidate makes no migration, dependency/lockfile change, schema change, local educator-session storage or new public signer. No F2/F3 data, fixture, secret, deployment or production changes are included.

## Provider references

- https://neon.com/blog/handling-auth-in-a-staging-environment
- https://neon.com/docs/auth/authentication-flow
- https://www.better-auth.com/docs/basic-usage
- https://www.better-auth.com/docs/concepts/session-management
