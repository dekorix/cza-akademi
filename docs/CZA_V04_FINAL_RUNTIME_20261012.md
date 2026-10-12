# V04 final fixture execution checkpoint — 2026-10-12
V04_ACCEPTED=NO; DRAFT PR91 remains. [Architect approval6124819469](https://github.com/dekorix/cza-akademi/pull/91#issuecomment-6124819469).
Approved source190479381ef50b7811f69dc3da35ba941932f88b / tree2e9ffbda87118e8ccdd6f74d8a3d9b575ca69747.
Exact unchanged SQL SHA256d2b21d44c1f4a2f58117bc5ee1c725b61bcd2f7f4ccf9ed4e0ca6d9b979b8109.
Target/owner/absence checked;45 table fingerprints and old function/role/RLS/grant hashes captured before installation.
Approved five SQL statements + final ACL assertion executed by Neon run_sql_transaction in ONE transaction. PUBLIC=false/minimum=true/owner cza_t5_test_owner/SECURITY DEFINER/search_path correct after commit. Installation created zero fixture data.
Connector pg_stat_ssl reported false on the proxy's backend connection. App Neon fetch uses default HTTPS /sql endpoint (SDK inspected; no overrides), browser Worker origin HTTPS. No claim of direct PostgreSQL-wire TLS readback.
Only lib/qa-assigned-work.ts and app/api/core/assignments/route.ts product files changed: exact fixed flag, exact QA origin/mode/minrole DB target, normal authenticated fixed Student/academy/recipe; default OFF, bad flag/identity denied. Launch calls approved read-only launch operation and retains existing origin/rate/auth/cookie logic; ordinary completed409 unchanged when OFF. Studio/render/work-center/profile untouched.
Local changed-gate regressions18/18 and TypeScript/lint PASS. Final live Chrome/API/Neon still pending; one fixed fixture ID40000004-0000-4000-8000-000000000091 only, no reset/new fixture if failure.
Module byte readback remains UNVERIFIED. Main/staging/production, PR73/87/89 unchanged.

