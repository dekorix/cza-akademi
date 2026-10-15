# A-DEMO-02_ROOT_CAUSE_AND_FIX_PROPOSAL

Issue98; V05_DEV=NOT_STARTED; A_DEMO_FULL_PASS=NO. Review-only package; no live SQL, permissions, fixture or deployment applied.

## Immutable source and scope

Stacked branch `fix/a-demo-02-history-session-results`, PR base `feat/v04-assigned-work-evidence`.
Protected PR91 `8ef388f9c7fbcb2392805150a32273707d547f7a` / tree `f304d581348b5439e2eb76a66d442c411566a926`; ancestor V03 `5e39d3f1810f1c0a8228c651c6da5563b3a6a212`. PR91 draft/open/unmerged; main `6a2d4e197c8b39d01b8c04e30fee32230e68a3fd` unchanged. V01–V04 PASS_SCOPED remains 4/7. No changes to protected PRs, Studio, existing write functions or assignment lifecycle.

## Root cause 1: false empty timeline

A-DEMO-01 normal-session Chrome: `/api/core/history` 200/events0, `/api/core/learning-profile` 200/recentRecords7, both desktop/mobile. Canonical student `20000000-0000-4000-8000-000000000001`, academy `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`.

`app/api/core/history/route.ts` used `neon(DATABASE_URL)` directly; dashboard/profile use the exact-session QA read adapter. Live catalog confirms `cza_v01_app_runtime_min` has SELECT but is not a member of `authenticated`; training_recipes/training_sessions/question_attempts RLS is ON and SELECT policies apply to authenticated. There is no applicable runtime SELECT policy: default deny returns zero. learning_records/evidence RLS is OFF, but all record/evidence timeline branches JOIN hidden training_sessions. Default URL has no user filters. Owner execution of the exact timeline UNION (no filters) returns 29 events: assignment1, completed7, resumed2, started1, learning_result7, error4, evidence7. No lost data.

Live connector owner cannot `SET LOCAL ROLE cza_v01_app_runtime_min` (permission denied). No membership was added and the failed read-only transaction was not escalated. Local real PostgreSQL test reproduces runtime sessions0/attempts0, raw records7/JOIN records0, with RLS unchanged. This distinction is recorded; local role proof is not claimed as a live runtime-role query.

Fix: preserve the canonical UNION, filters, signed scope-bound cursor, event types, provenance and verificationStatus. Only isolated QA selects an explicit, canonical-session-derived narrow read projection. Missing function/denial becomes 503/403 plus visible retry, never fake empty or profile fallback. Authorized genuinely empty data remains a valid empty timeline. Existing educator/general paths and `/api/student-history` remain unchanged.

## Root cause 2: aggregate vs persistent session view

Dashboard and Work Center model completed **assignment** totals: all PRIMARY attempts under recipe =>20/16/%80 across two valid sessions. Work Center renders those totals and its existing "Sonucu Gör" anchor points to the aggregate section. Studio finished result derives from transient React attempts/result state; there is no persisted-result reader for `view=results`/sessionId. Data exists: both `bdb87fbc-0938-4eb1-82e5-0a2cb362d30f` and `40000004-0000-4000-8000-000000000091` are completed with10 PRIMARY answers/8 correct/2 wrong. Neither must be restarted.

Fix: preserve assignment totals and add individual completed-session cards plus GET-only `/work/result?sessionId=...` and `/api/core/work-results`. Read counts from persisted PRIMARY attempts; exclude feedback retry attempts. Include start/completion timestamps, canonical session/assignment/record/evidence IDs and separate record/evidence verification labels. No questions, target numbers, response payloads, assignment settings, teacher instructions, session cookies or secrets in result projection. No Studio state injection, start/finish/replay calls or mutations. Existing result list/main card is not removed.

API authenticates canonical cookie session first; caller academy/student selectors are rejected403. Invalid/absent/foreign/not-completed session returns404 without distinguishing ownership; unauthenticated401; missing read function503; revoked session401/403. Cache-control no-store. Details use bound session, student and academy, not supplied identity. QA SQL permits only the existing recipe and two existing completed session IDs.

## EXACT SQL approval request (NOT APPLIED)

[Exact SQL](../db/qa/a-demo-02-read.review.sql), [exact rollback](../db/qa/a-demo-02-read.rollback.review.sql). SQL SHA256 recorded in [evidence manifest](evidence/a-demo-02-local/verification.json).

Only one NEW function: `public.cza_a_demo_02_read(text,text,jsonb)`; STABLE SECURITY DEFINER, owner `cza_t5_test_owner`, fixed search_path `pg_catalog,public,pg_temp`, exact project/branch/database guard. Reuses existing `cza_v03_qa_authenticated_student(text)` without editing it, then independently enforces the fixed synthetic student/academy. Explicit operations timeline and completed_results; no dynamic SQL or caller identity. Timeline retains all canonical29 events from that student's existing records, max50+1 rows with server-side filters/keyset cursor. Result projection only current recipe/two existing sessions. Unknown operation/input keys rejected. Both function and API enforce ownership.

Target ONLY `patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic`. Minimum role ONLY `cza_v01_app_runtime_min`, EXECUTE ONLY new function; REVOKE PUBLIC. No role membership, SELECT/table grants, policy/RLS/BYPASSRLS changes. No old function definitions/ACL change, no record mutation. There is one new narrowly guarded privilege surface, not a general read grant.

**Atomic application after separate written approval only:** submit guard, CREATE, OWNER, REVOKE PUBLIC, GRANT minimum, ACL assertion as ordered statements using Neon `run_sql_transaction` (documented single transaction). The reviewed BEGIN/COMMIT file describes that same atomic transaction; exclude only outer BEGIN/COMMIT when using the transactional tool. Do not execute statements as individual autocommit calls. If a single-transaction guarantee is unavailable, STOP. CREATE defaults cannot be observed by other sessions before the transaction commits with PUBLIC revoked. Existing-name collision fails; CREATE OR REPLACE is forbidden.

Before and after: exact old52 function definitions/owners/ACL compared to accepted evidence; also preserve current final-fixture owner-only ACL. Compare all six table complete-row fingerprints and counts2/1/10/20/7/7, role attributes/membership and RLS/table ACL matrix. Proposed function may be added; everything else must match. If any mismatch, STOP and preserve data.

Rollback: first restore exact prior Worker version, then one guarded transaction REVOKE only new function's minimum-role EXECUTE. Function may remain owner-only; no DROP/reset/DELETE. SQL failing mid-package rolls back creation/grants. No data rollback is needed because function is read-only.

## Isolated Worker approval request (NOT DEPLOYED)

Domain ONLY `https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev`; Worker ONLY `cza-v01-isolated-synthetic-20261010`. Current version `d8c2ba48-f686-4f8e-912e-8709f3522cbd`, source `8e2d40b90f9639052b92b437e952240365934e49` / tree `f8ebce226a080566346db449bdb134981dbac783`; accepted metadata and A-DEMO-01 flagOFF preserved. Current fixture wrapper remains non-executable by minimum/PUBLIC. No enabling final fixture flag.

After SQL approval and exact-source successful CI: build reviewed commit/tree, confirm working copy equals reviewed SHA, deploy only exact named Worker with same existing bindings, DATABASE_URL and all existing vars unchanged; `CZA_V04_QA_FINAL_FIXTURE=OFF`. No secret listing/logging. Proposed command: `npx.cmd wrangler deploy --config dist/server/wrangler.json --name cza-v01-isolated-synthetic-20261010 --keep-vars --message '<reviewed SHA/tree/CI> A-DEMO-02 readonly'`, **only if generated config/CLI preserve every current binding/var and contain no main/staging/prod route**; otherwise STOP. No unreviewed flags. Review record will cite concrete source/tree/CI before permission request. Deployment rollback exact `wrangler rollback d8c2ba48-f686-4f8e-912e-8709f3522cbd --name cza-v01-isolated-synthetic-20261010` with validated config and unchanged bindings. Automatic rollback requires the same approved isolated target; no production promotion.

After approval: existing private fixture, normal Chrome154 desktop1440×900/mobile390×844; panel→history (7 learning result events across pagination, canonical sources retained)→Work Center aggregate20/16→each10/8/2 "Sonucu Gör"→hard reload→normal logout/login→same result/profile. Existing one Student ID; do not start, answer, finish, replay or create fixture. GET invalid/foreign/other-session denies401/403/404; no cookie fabrication. Own students/other academy negative identities only existing sentinels; no new login/student created. Work hash6/oldACL checks before/after; normal auth/rate effects recorded separately. Never infer private answer keys or measured strategy.

Local mock-transport desktop/mobile screenshots and PostgreSQL/API proofs do NOT constitute live Worker acceptance. Live checks remain BLOCKED_PENDING_ARCHITECT_SQL_AND_DEPLOY_APPROVAL. WORKER_MODULE_BYTE_READBACK=UNVERIFIED remains production promotion gate; metadata/build hashes are not independent remote byte verification.

## Local verification

110/110 tests PASS, TypeScript and narrow lint PASS, full platform build PASS. Local mock-transport Chrome HeadlessChrome/153.0.8010.0 desktop/mobile **42 checks PASS**: canonical seven-record history, 2×10/8/2 vs aggregate20/16, hard reload/mock reentry, 401/404, retry, genuine empty and read error, no mutation requests/page errors/overflow. [Manifest](evidence/a-demo-02-local/verification.json), [local browser evidence](evidence/a-demo-02-local/browser.json). Source snapshots and local fixture labels are explicit; no claim of live deployed repair.

## Status

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=4/7 (%57,1) izole QA scoped
TAMAMLANAN=Kök neden kanıtı; dar kod ve review-only SQL/test paketi
KALAN=Ayrı SQL/deploy onayı ve mevcut veriyle canlı doğrulama
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar exact SQL ve exact-source izole Worker paketini incelesin
