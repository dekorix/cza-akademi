# V04 isolated QA runtime — 2026-10-11

V04_ACCEPTED=NO. Architectural acceptance remains with CZA Baş Mimar. Issue #90 / DRAFT PR #91, branch feat/v04-assigned-work-evidence; protected V03 base 5e39d3f1810f1c0a8228c651c6da5563b3a6a212 / tree 6a52137285cf9c03f700538b67a3256f1944e605.

## Authorization and atomic installation

Formal approval: https://github.com/dekorix/cza-akademi/pull/91#issuecomment-6110936791 .
Immutable approved SQL at 2355d19df57d5bcffb214f737796224a0ad1b6ff, SHA256 3bc0a9c026890eecec3dd4c104a76cd4289c68a7151c07e5c78f1d5215906043. SQL unchanged.
Exact Neon target patient-firefly-51111834 / br-withered-queen-b15ltb40 / cza_t5_synthetic; owner cza_t5_test_owner and absence checked immediately before installation.
Neon run_sql_transaction guarantees one transaction. All five approved statements (guard DO, CREATE, OWNER, REVOKE PUBLIC, GRANT minimum role) plus final ACL assertion executed together successfully. CREATE's default PUBLIC grant was never committed/exposed. Post-commit pg_proc: SECURITY DEFINER, owner correct, search_path pg_catalog/public/pg_temp, PUBLIC EXECUTE=false, minimum role EXECUTE=true.
All 51 old cza functions' definition hashes and ACL unchanged. Five generic canonical work/ledger/evidence functions still minimum-role EXECUTE=false. No table/role/policy alteration.

## Deployed source and CI

Worker source f1b6ad4babba0de4f226ff5fd0acbc9d4f3954e9 / tree 8d3267f7cc6f01332f88dd628d0282d04baac9a0.
CI V04 https://github.com/dekorix/cza-akademi/actions/runs/38154059500 SUCCESS; V03 https://github.com/dekorix/cza-akademi/actions/runs/38154059539 SUCCESS.
Windows clean separate worktree full build PASS; generated config had no routes. Wrangler explicit isolated name + --keep-vars deployment succeeded.
Worker cza-v01-isolated-synthetic-20261010 version a2469a65-c2df-43fe-a25f-2669d721849c.
MODULE_BYTE_READBACK=UNVERIFIED; no credential extraction attempted.
Subsequent commit contains evidence/runners/docs only, no deployed app or SQL changes.

## Actual Chrome/API/Neon results

Actual Windows Chrome 154.0.8037.98, desktop 1440x900 / mobile 390x844. Existing private student fixture read locally; normal home username/PIN login, server secure HttpOnly cookie. No cookies fabricated, transport responses not mocked.
One existing Student ID 20000000-0000-4000-8000-000000000001 and existing recipe 361ee0f6-26e2-4484-b9f9-7a88d14fb9f4 only.
Created exactly one logical assigned training session bdb87fbc-0938-4eb1-82e5-0a2cb362d30f. Ten real UI PRIMARY answers; 8 correct, 2 wrong, 0 timeout. Completed through existing ledger chain: learning record a1d057e4-cb08-46be-94c8-e2b6a4fa8c79, evidence 1cd5e31b-d1fc-408d-9847-b0b3b06597a8.
Concurrent start calls returned same session. Hard reload at 3 answers preserved same session/next question; new mobile tab resumed at 4. Logout returned 200, old session me=401; real mobile relogin same student/work/progress.
Question5 real response dropped after backend commit using Chrome CDP. Exact UUID/answer/timings retry replayed with count5, no duplicate.
Foreign student/academy selectors could not switch authenticated identity; foreign recipe=404 and foreign work session=404. No existing foreign-student work session available; actual cross-owned-session fixture coverage remains limited.
Six parallel finish calls all returned same record/evidence, 10/8 counters and replayed=true. Canonical profile includes finger_read, 10 attempts, accuracy80, one completed assignment. Completed recipe start without valid launch rejected403; no second work session.
Final completed panel hard reload and mobile overflow checks passed. Cleanup logout and subsequent finish=401. Zero page errors.

## Honest failures and limits

Initial full runner was not PASS: unhandled pending response timeout, then resumed-run index expectation mismatch. Partial committed answers preserved. Recovery runner has 30 passed checkpoints but final result-screen text assertion timed out because it expected the performance-mode heading for guided practice. Entire recovery run remains passed=false in original evidence. Completion readback/panel/replay runner 10/10 PASS independently. Native final Studio result screen was not captured/asserted successfully; cannot claim full uninterrupted end-to-end PASS. Runner now accepts the existing guided-mode completion heading, but no new assignment/session/reset was created to rerun it.
Fresh question2 multi-tab write race and changed-payload replay statuses were not completely retained as successful runtime evidence. Local SQL/Chrome tests cover these; live complete evidence is still needed under an architect-approved future fixture scope.
No runtime min-role direct SQL credential was carried into this continuation. Browser ran without direct DB URL; Neon connector independently verified target/ACL/data. No secret recovery/probing.
No new SQL/migration/privilege change is currently required. A repeat full first-answer-to-result run cannot occur on this completed one-shot assignment without new fixture/reset authority; no such mutation performed.
Screenshot mobile panel includes asynchronous sections still loading; direct profile API/Neon completion is verified.

## Preservation and provenance

45-table baseline compared with same md5(string_agg(to_jsonb(row)::text, newline ORDER BY row text)) algorithm. Students2, users7, modules and recipe unchanged in row count; students/modules/recipe exact full-row hashes unchanged.
Old eight training sessions, five learning records and five evidence rows match exact baseline hashes after excluding only the new IDs. 37/45 full table fingerprints unchanged.
Expected work deltas: sessions8→9, attempts0→10, records5→6, evidence5→6.
Auth/rate deltas from baseline: student_sessions67→73, rate windows1→7; user rows7 unchanged count with login metadata changes. Failed runners left ordinary login sessions subject to canonical expiry; only current-session logout used.
Educator_sessions count stays1 but fingerprint differs from earlier preflight. V04 runners do not call educator APIs and approved SQL does not touch this table; cause is not established. Report as concurrent/unattributed drift, not preserved-byte PASS.
Timing CLIENT_REPORTED, support unknown, strategy null, skills empty. Learning record retains client_reported provenance; only answer-count/accuracy evidence is server_verified under v04_qa_server_answer_evaluator:v1. No verified timing/support/strategy claims.
V01–V03 accepted QA scope retained. PR73/87/89 unmerged; no main/staging/production writes, new identity/recipe/module, broad grants, force-push/rebase, or data deletion.

GENEL PROJE İLERLEME %=ÖLÇÜLMEDİ
MEVCUT FAZ İLERLEME %=3/7 QA accepted (%42,9); V04_ACCEPTED=NO
TAMAMLANAN=atomic approved SQL, isolated deployment, real login/work/resume/retry/completion/profile and preserved old work rows
KALAN=uninterrupted Studio result-screen evidence, complete fresh multi-tab/negative runtime evidence, architect final acceptance
KAPSAM SAPMASI=YOK
SIRADAKİ TEK ADIM=Baş Mimar mevcut one-shot tamamlanmış atama kanıtını ve kalan dar test kapsamını incelesin.

