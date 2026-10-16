# QA login fail-closed repair — 2026-10-17

Scope: issue #98 student login; base 849ef9d27a3ffbb45a928ceb601f433acc083a11 (previously reviewed diagnostic source), parent PR #101 checkpoint 1896a522. Separate Windows worktree and branch; existing candidate build and working trees unchanged.

## Reproduced defect

With isolated QA enabled and an external core configured, an empty QA SQL result returned undefined. The login route treated it as QA-disabled and forwarded the credential request to the external core. The regression reproduced an upstream 401 rather than an infrastructure 503. This is a source-level reproduced defect, NOT a finding that the historical live failure had this cause.

## Repair

Only QA-disabled mode may return null. Enabled QA requires a non-array object with boolean ok; a rejection must carry a non-empty string error. Invalid/missing results throw a fixed exception and the existing route returns 503 qa_login_unavailable. No new login, credential store, SQL, migration, environment variable, grant or deployment. Existing canonical successful login and explicit invalid_credentials rejection remain unchanged.

## Verification

New integration test loads the actual QA helper and actual POST route with synthetic SQL, a permitted synthetic target and a configured external core. No live database or Worker requests occur.

Before repair: 4 tests, 3 pass, 1 fail (401 instead of 503).
After repair: 23 targeted tests pass, 0 fail across qa-login-fail-closed, login-error-codes, v03-qa-target, k3e-staging-diagnostics and v03-student-panel.

Coverage includes missing/NULL/primitive/array/object/malformed-ok/errorless rejection results, zero external credential requests for enabled QA failures, target mismatch, SQL failure without exception leakage, credential rejection, successful secure HttpOnly cookies without response-body token, and unchanged QA-disabled upstream behavior.

TypeScript noEmit and targeted oxlint passed (0 warnings/errors). npm run build completed with exit 0 (66.68 seconds). This was a new isolated local build; the previously approved candidate build was not modified.

## Acceptance boundary

LOCAL_REPAIR=TESTED. HISTORICAL_LIVE_LOGIN_ROOT_CAUSE=UNPROVEN. A_DEMO_FULL_PASS=NO. LIVE_QA=NO_GO. HIGH1/HIGH2 remain open. No claim of real browser/provider/DB acceptance. Existing normal rate-limit behavior is not changed. Three student surfaces, Student ID, Student Learning Profile, assessment content and LGS/YKS scope unchanged.

Deployment is not performed by this change. Existing QA Worker was independently read as 100% d8c2ba48 before work. Rollback of this source repair is its isolated commit revert; no DB rollback required.
