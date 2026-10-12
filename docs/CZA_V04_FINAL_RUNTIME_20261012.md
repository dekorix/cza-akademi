# V04 final live evidence — 2026-10-12, Europe/Istanbul

**The two requested final checks are complete. Real Chrome38/38 checks PASS; V04_ACCEPTED=NO. Final architectural acceptance belongs to CZA Baş Mimar; PR91 stays DRAFT.**
Authority: https://github.com/dekorix/cza-akademi/pull/91#issuecomment-6124819469 .
Protected V03 base5e39d3f1810f1c0a8228c651c6da5563b3a6a212 / tree6a52137285cf9c03f700538b67a3256f1944e605. V01–V03 scoped QA acceptance retained.

## Real Chrome/API and native Studio results

Windows Chrome154.0.8037.98, desktop1440x900/mobile390x844; normal existing student login using private fixture, no fabricated cookie, mocked response or injected result state.
Student20000000-0000-4000-8000-000000000001 / academy aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa / original recipe361ee0f6-26e2-4484-b9f9-7a88d14fb9f4.
Only new approved fixed fixture40000004-0000-4000-8000-000000000091.

Two actual Studio UI first-question POSTs held at a request barrier then continued UNMODIFIED concurrently: different UUIDs, same correct answer, exactly one200 and one409 work_question_conflict, one PRIMARY row. Winning UUID/exact payload replay200/replayed=true/count1; same UUID/changed answer409 IDEMPOTENCY_KEY_REUSED.
Old accepted completed session addressed through fixture404. Document navigation after race resumed same session/plan at one answer. Desktop q2/q3 intentionally wrong/q4 correct; logout200, actual previously issued token replayed only in memory after revocation401. Mobile normal relogin resumed same Student/session at4 answers/correct2; q5..10 correct through normal Studio.
Native completion10/8; actual guided DOM heading **Harika, 10 soru çalıştın.** and cards **10 Soru / 8 Doğru / 2 Birlikte bakalım** on both viewports. Screenshots show actual completed page; viewport change preserves that real result state, no state injection/UI replacement.
Six parallel finish replays returned identical record/evidence IDs. Foreign session404; foreign Student/academy selectors could not switch authenticated identity. Profile contains both old accepted and fixture records. No real cross-owned student credentials/data used; tenant coverage is these authorized spoof/session scenarios.
Final logout200/post-logout finish401, zero page errors/overflow.
Evidence: final-browser.json, mobile-native-result.png, desktop-native-result.png under docs/evidence/v04-final-runtime/.

## Neon, idempotency and preservation

Exact target patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic, owner cza_t5_test_owner.
Totals:2 students,1 recipe,10 sessions,20 attempts,7 records,7 evidence.
Fixture budget:1 fixed session,10 PRIMARY,10 distinct question indices/attempt UUIDs,1 record/1 evidence; no second fixture/student/module/recipe/reset/delete.
New record f43257d1-6609-4f6f-99a6-bc5025879240; evidence b95c3b27-9e10-4a64-9bf2-6e4174fbedc1.
Original bdb87fbc-0938-4eb1-82e5-0a2cb362d30f remains COMPLETED10/8 with recorda1d057e4-cb08-46be-94c8-e2b6a4fa8c79 / evidence1cd5e31b-d1fc-408d-9847-b0b3b06597a8.
45-table full-row comparison: excluding ONLY new fixture rows,42/45 old-table hashes equal, including9 old sessions/10 answers/6 records/6 evidence, students/recipe/modules/educator_sessions. Only normal auth/rate tables differ: users/student_sessions/api_rate_limit_windows. Normal desktop/mobile/cleanup logins measured separately. No unattributed educator drift in this final before/after run.
All52 old function definitions/ACL, role/table/RLS/policy fingerprints unchanged. New function only.
Timing CLIENT_REPORTED/supportunknown/strategynull/skills empty. Canonical record client_reported; only server-evaluated answer counts/accuracy evidence server_verified under v04_qa_server_answer_evaluator:v1. No verified timing/support/strategy claim.
Evidence: fixture-neon-readback.json, fixture-budget.json, table-comparison.json and before/after table/function/security files.

## Approved SQL, source and CI

Approved unchanged SQL SHA256d2b21d44c1f4a2f58117bc5ee1c725b61bcd2f7f4ccf9ed4e0ca6d9b979b8109.
DO/CREATE/OWNER/REVOKE PUBLIC/GRANT only minimum role/final ACL assertion executed in ONE Neon run_sql_transaction; PUBLIC=false/minrole=true at installation, no partial public commit. No generic grants, RLS/table/role membership changes or existing function replacement.
Only two application files changed as approved: lib/qa-assigned-work.ts and app/api/core/assignments/route.ts. Exact fixed flag/QA origin/mode/minrole target/normal authenticated fixed Student/academy/recipe, default OFF/mismatches fail closed. Existing origin/rate/auth/cookie preserved; Studio/render/work-center/profile unchanged.
Exact Windows build/deployed source8e2d40b90f9639052b92b437e952240365934e49 / treef8ebce226a080566346db449bdb134981dbac783 PASS; runtime diff in build worktree empty. Later driver/evidence/docs do not change deployed application or approved SQL.
Build-source V03 CI https://github.com/dekorix/cza-akademi/actions/runs/38280610931 SUCCESS; V04 https://github.com/dekorix/cza-akademi/actions/runs/38280610927 SUCCESS:96 tests, TypeScript/lint/local mock Chrome/full build. Code source39cec4e also V03/V04 CI38280073653/38280073845 SUCCESS.

## Worker, cleanup and transport

Worker cza-v01-isolated-synthetic-20261010; explicit --name/--keep-vars, generated config no routes. Test flagON version7c7a3d4b-a503-425e-8bc5-245f174ca502; cleanup/current flagOFF versiond8c2ba48-f686-4f8e-912e-8709f3522cbd. Metadata contains source/tree/CI labels; local build main SHA2569de737f66d46e393a3088cdf7e6d2993798268d0e474d57d15251898e0269599.
**WORKER_MODULE_BYTE_READBACK=UNVERIFIED** remains production-promotion prerequisite; metadata/local hash is not independent remote byte proof. No secret probing.
Actual browser secure response protocolQUIC/issuerYE2, default certificate validation. Neon SDK uses default HTTPS endpoint; proxy-backend pg_stat_ssl=false is not direct PostgreSQL TLS PASS.
Success cleanup: first redeploy same built source flagOFF, then exact-target transaction verifies completed10/8 and REVOKEs only new-function minimum EXECUTE with PUBLIC=false/minrole=false assertion. No UPDATE/DELETE/cancel on completed fixture or old rows. New function owner-only; approved old QA work minimum EXECUTE=true, all existing grants preserved.
New post-cleanup Chrome normal login me200/sameStudent, assignment launch409 assignment_completed, logout200 proves OFF/ordinary completed rule after revocation.
Evidence: worker-deployments.json, post-cleanup-browser.json and after-cleanup-functions.json.
Main/staging/production, PR73/87/89 unchanged; no force-push/rebase/reset/delete or real student data.

## Resolved failures and limits

Windows offline/cloud CONNECT403 blocker resolved for execution when user reconnected existing authorized device. Initial browser driver Runtime.callFunctionOn timeout BEFORE login/new fixture (checks0/fixture0); rerun used focused pages/normal DOM button click, no product/SQL change. Failed attempt is not PASS and login screenshots are not included in public package.
Prior guided/performance heading mismatch is closed by actual guided DOM/counters on both viewports. Fresh race and changed-answer gaps now evidenced.
No remaining BLOCKER/HIGH for these two requested final checks. Architectural acceptance and remote module-byte production gate remain separate.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=3/7 QA kabul (%42,9); V04_ACCEPTED=NO
TAMAMLANAN=38 real Chrome checks, native desktop/mobile10/8, active200/409 race, one record/evidence, preserved old hashes/permissions, cleanupOFF/REVOKE
KALAN=Baş Mimar final acceptance; remote module byte proof remains production condition
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar DRAFT PR91 final live evidence review.
