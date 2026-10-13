# QA-only private educator history broker

Review checkpoint: dccc93d08b357c83453ff3b1b295d6c66fe5397a.

The QA educator route uses the existing fresh authenticatedEducator path and request gate, then calls a private Worker Service Binding. The broker alone receives BROKER_DATABASE_URL. Its Neon HTTP driver invokes a broker-only authorized function in a read-only transaction. No student/general runtime credential fallback exists. Normal staging/production and student paths are unchanged.

The nondeployed example disables workers.dev, version preview URLs and all routes. The ingress example is a fragment, not a deploy configuration. Every scope/binding value is a placeholder. Private service access and independent credential custody MUST be accepted before deployment. Never place credentials in either template.

The SQL template is REVIEW_ONLY_DO_NOT_EXECUTE_LIVE. It does not create login roles or insert scope data. Separate approval is needed for a dedicated least-privilege role, owner-protected scope and function, atomic PUBLIC revoke/broker-only EXECUTE, isolated secret provisioning, service binding, deployment and rollback. The broker checks returned database/project/branch/login-role/student/academy metadata and discards it before responding. All entity authorization is rechecked by the database.

Local proof: tests/broker/private-broker-postgres.integration.mjs executes actual disposable PostgreSQL and actual Miniflare isolates/binding. The Node adapter and provider HTTP exist ONLY in tests. It compiles and runs production broker/client/route code with test transports; the real Neon HTTP implementation is compile-tested separately, never connected. Run only with BROKER_TEST_POSTGRES=local and an explicit BROKER_TEST_PG_PORT pointing at an empty disposable broker_test DB. CI uses an ephemeral PostgreSQL service. Never supply a live DATABASE_URL.

Fresh verification is a trusted-server fact, not a signed DB proof. This design introduces no assertion, nonce or replay ledger. Repeated authorized GETs are normal. A stolen broker credential could select an allowed subject; this HIGH risk requires private custody, binding/route ACL and revocation/rotation acceptance. Provider revocation between verification and the read can permit an in-flight read; the next fresh check denies it. The 5-second conservative age bound is a prototype safety cap, not a production revocation guarantee.

Missing binding/scope/credential/function or driver failure is fail-closed. Existing provider failures currently collapse to 401 in the inherited auth contract; broker/transport outage is 503. No fake empty success. Logs contain generic status/test labels only; database errors, parameter values and credentials are never surfaced.

Rollback planning: disconnect issuance/binding, restore only the separately approved prior isolated ingress, revoke only the new broker entry, retire the dedicated credential. Scope/role/secret cleanup is separate. Preserve accepted source/data/security. No deploy is authorized by this source package.
