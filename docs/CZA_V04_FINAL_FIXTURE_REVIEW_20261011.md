# V04 final acceptance fixture — REVIEW ONLY / NOT APPLIED

Date: 2026-10-11 Europe/Istanbul. Issue90 / DRAFT PR91.
Decision: https://github.com/dekorix/cza-akademi/pull/91#issuecomment-6112270644 .
Existing accepted core data is not repeated or reset. This document requests NEW, separate approval only for the remaining live active-question race and native guided Studio result screen.

## Completed permitted checks

Actual Windows Chrome154.0.8037.98 desktop1440x900/mobile390x844: normal existing student login; GET /work and GET /studio?program=assigned&recipe=<original>&sessionId=<completed>&view=results.
Both Studio pages stayed ready with the start button; no result heading. No start or finish calls made. Current Studio has no result-session GET restore effect: result counters are React state set by completion while the page remains alive. Work Center links do not restore the Studio result state. No DOM/state injection, fabricated cookie or mocked transport used.
Guided expected title is "Harika, 10 soru çalıştın.", counters Soru10 / Doğru8; performance title is not the guided acceptance target.
Eleven safe checks passed. Changed answer9 on existing question1 target7 using committed UUID a2a80757-2500-46e6-b1bd-6f2ca9d37a43 returned409 IDEMPOTENCY_KEY_REUSED. Two actual tabs/new UUIDs on the completed same question both409 work_session_closed; this is NOT a fresh active-question winner/loser race. Existing unrelated training session0f255515-8035-49c5-a2e1-e240c4dbbc9d rejected404 work_not_found. Foreign student/academy query selectors cannot switch identity. Logout then attempt401.
Full-row fingerprints of students2, recipes1, sessions9, attempts10, records6, evidence6 unchanged from prior immutable delivery and final-read pair. Old completed session remains10/8. No duplicate/session/result created.

## Remaining blockers and precise approval boundary

BLOCKER-UI: completed-session read-only navigation cannot recreate native Studio's live result state. Adding a general results feature is out of scope.
BLOCKER-RACE: a completed question cannot demonstrate one fresh success plus one conflict; changing its status/reset is forbidden.
No broad permission/security HIGH found. MODULE_BYTE_READBACK=UNVERIFIED remains the separate production promotion condition. Educator-session earlier drift remains unattributed; not reopened.
Owner SET ROLE minimum runtime is still unsupported, but no role membership/grant is needed for proposed normal Worker/Chrome tests.

## One logical new fixture; exact write budget

ONLY Neon patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic; Worker cza-v01-isolated-synthetic-20261010.
Same existing student20000000-0000-4000-8000-000000000001 / academy aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa / recipe361ee0f6-26e2-4484-b9f9-7a88d14fb9f4 / finger_read.
NEW fixture training_session fixed ID40000004-0000-4000-8000-000000000091, settings_snapshot.v04QaFixture=final-acceptance-pr91.
At most ONE new logical test session: 1 training_sessions row, 10 PRIMARY question_attempts, 1 learning_records, 1 learning_evidence. Normal auth sessions/login/rate rows additionally accounted separately. Expected work totals after success: sessions10, attempts20, records7, evidence7; students2/recipes1/modules unchanged.
Original completed IDbdb87fbc-0938-4eb1-82e5-0a2cb362d30f and all its answer/record/evidence hashes unchanged. No new student/user/module/recipe, no original-row mutation, no reset or DELETE.
The new test session deliberately uses the original recipe, but distinct fixed session/attempt/client-record identities. It is labelled QA fixture and must not be interpreted as accidental duplication of the accepted first completion.

## Full review SQL and local validation

SQL: db/qa/v04-final-fixture.review.sql
SHA256 d2b21d44c1f4a2f58117bc5ee1c725b61bcd2f7f4ccf9ed4e0ca6d9b979b8109 .
106-line complete package: target/owner DO guard, CREATE one new public.cza_v04_qa_final_fixture(text,text,uuid,uuid,jsonb), OWNER, REVOKE PUBLIC, GRANT EXECUTE only cza_v01_app_runtime_min. Must all run in one transaction with final PUBLIC=false/minrole=true assertion. SQL installation itself creates ZERO data rows.
Original public.cza_v04_qa_assigned_work and every existing function unchanged. No generic table/role/RLS grants or canonical function replacement.
New function preserves exact project/branch/database/auth/session-expiry/revocation/Student/academy/recipe/module/cancel/expiry and one-digit10-round recipe checks.
launch operation validates the scope and old completed10/8 anchor; returns settings/fixtureID only, no data mutation. It authorizes ONLY a fixture launch, not reopening the original session.
start operation locks recipe and inserts fixed fixture session at most once with canonical plan/version and audit label. Calls unchanged canonical K3C binder with the fixed session ID and its stable first clientSessionId. On further starts resumes only that row; after its completion refuses launch/start.
attempt/finish require p_session=the fixed fixture ID then delegate to original approved QA wrapper. Original canonical attempt, ledger and verified evidence behavior reused unchanged.
Local PGlite review-only test PASS: launch creates no row; two starts one fixed row; stable plan; old session cannot be addressed through new wrapper; committed UUID replay and changed-answer rejection; next-question conflict; 10/8 completion; one record/evidence replay; original anchor full-row hash unchanged; PUBLIC absent. This is NOT live acceptance.
New test included in V04 read-only CI; no live install/deploy jobs.

## Necessary temporary Worker routing — proposed, NOT IMPLEMENTED

No existing application files are changed in this delivery. If approved, only a bounded QA adapter is necessary:
1. Environment switch CZA_V04_QA_FINAL_FIXTURE must equal the fixed fixture UUID; require exact QA hostname, existing isolatedQaEnabled/assertQaStudentTarget and authenticated exact existing student/academy/minimum-role DB target.
2. In lib/qa-assigned-work.ts choose the new fixture function only under this switch, otherwise call the unchanged old function. Parameterized SQL; no caller-selected function/session target.
3. In app/api/core/assignments/route.ts only the fixture switch + exact existing recipe path may call the new function's read-only launch. Return the existing assignment launch cookie/settings/Studio path after normal auth/origin/rate checks. The ordinary completed-assignment409 branch remains unchanged when flag OFF. The QA branch explicitly targets the new fixture; it must never reopen/update the old completed session.
4. No Studio UI/renderer/profile/work-center product change, no panel listing rewrite. Direct Studio assigned URL uses existing server settings and existing rendering. Fixture mode is a QA-only test entry and removed/disabled at cleanup.
Approval request therefore includes this narrowly temporary QA routing and isolated Worker deployment, in addition to the new SQL function; SQL alone cannot yield a native Studio run because existing completed-assignment launch correctly rejects it.

## Single authorized future run

Only after separate architect approval: fresh before hashes/ACL/source; one atomic SQL installation; implement reviewed temporary routing, CI/build and isolate deploy; normal existing student login.
Two real Chrome tabs at active question1 submit same numeric correct answer with DIFFERENT UUIDs concurrently. Exactly one200, one409 work_question_conflict; one PRIMARY row. Retain full original nonsecret winning payload privately for exact retry200 replay and different-answer same-UUID409. Retry/reload at next question cannot add duplicate.
Two intentional wrong answers on q2/q3, q4..10 correct →10/8 known expectation. Remaining native answers run through existing Studio; no synthetic React state. Observe actual normal completion HTTP response and correct guided heading; assert10/8 from DOM, capture desktop/mobile result screenshots while preserving that actual page.
Foreign identifiers/tenant selectors, old accepted session and random nonexistent session rejected; revoked cookie401; no new real or other-student fixture. Existing real cross-owned-session dataset is not presumed available.
Neon readback shows exactly fixed fixture1 +PRIMARY10 +record1/evidence1; repeated finish same IDs. Existing accepted full-row hashes equal. Report fixture record IDs/provenance, elapsed client timing as CLIENT_REPORTED/supportunknown/strategynull.
No second fixture/session or reset/retry from scratch if failed; resume only this fixed fixture. If unexpected SQL/permission/route change needed, stop for concrete review.

## Rollback / cleanup: no deletion of records

Full script db/qa/v04-final-fixture.rollback.review.sql SHA2568248756f2f4cc3ce4c40ea0b742556342a41d5aed8deda4601cff47ca5ed9766 .
Turn fixture switch OFF / restore isolated Worker to accepted f1b6ad4 source (versiona2469a65-c2df-43fe-a25f-2669d721849c or reproducible build) first; then same-target transaction REVOKE only new function EXECUTE. PUBLIC remains revoked throughout. Existing approved V04 function/role/RLS/table grants stay intact.
Installation failure atomically rolls back before any fixture row. Before first start no data exists to undo.
After a test/partial failure retain all newly labelled rows for audit, never delete/reopen old or new ledger rows. REVOKE blocks further calls. Retaining a partial active fixture is explicit quarantine, not a claim of successful reversible data cleanup; report it for architect disposition.
The extra record remains part of this isolated synthetic student's QA history/profile; no production migration or generic fixture support.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=3/7 QA (%42,9), V04_ACCEPTED=NO
TAMAMLANAN=existing completed record readonly Chrome research, eleven safe negative checks and unchanged work fingerprints
KALAN=native guided Studio result + active-question concurrent winner/loser evidence; separate fixture authorization required
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar complete SQL/write budget/temporary QA routing/retain-without-delete rollback package approval.

