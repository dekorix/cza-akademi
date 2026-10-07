# CZA Learning Core Staging

This directory is the review artifact for a dedicated, non-production Central
Learning Core adapter. It is not a second learning/session system: every action
delegates to an existing RPC on the isolated Neon test branch.

Deployment is intentionally out of scope for this checkpoint. Before a later
staging deployment, configure these values through the provider's encrypted
environment store:

```text
DATABASE_URL=<credential for the exact test branch/database below>
CZA_NEON_PROJECT_ID=hidden-glade-66748043
CZA_NEON_BRANCH_ID=br-ancient-bread-b2puable
CZA_NEON_DATABASE=cza_learning
```

The adapter refuses to initialize if the three identity attestations differ or
if `DATABASE_URL` is not a Neon PostgreSQL URL for `cza_learning`. Do not add a
production fallback.

After management review and a verified non-production deployment, the existing
staging application may be configured separately with:

```text
CZA_CORE_API_URL=https://<staging-core-host>/api/student
CZA_CORE_API_ALLOWED_HOSTS=<staging-core-host>
```

Do not configure the Cloudflare Worker until the core staging deployment and
its database binding have been independently verified.
