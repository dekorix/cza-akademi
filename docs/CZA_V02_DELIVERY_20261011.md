# V02 delivery — existing candidate to canonical Student ID

V02_ACCEPTED=NO. Independent Chief Architect acceptance remains required.
DRAFT PR #87 targets PR #73 branch, not main.

## Source and deployment

- Protected V01 parent: `5011469f8f9afa18c020b0ce88506059a711cf99`, tree `389a151d0721df1311645d7080e9771847688578`.
- Deployed V02 source: `c4edf691bd107473177a169ff165d531c9c2ecf2`, tree `9cb4df8d987e7dee1bda8784fb30f287709cef75`.
- Branch: `feat/v02-candidate-student-link`; ancestry preserved through ordinary commits.
- QA Worker: `cza-v01-isolated-synthetic-20261010`; active version `341e48bc-9e1d-44b7-a26f-4a5d3fac41ab`, 100%.
- [Worker artifact readback](evidence/v02/worker-readonly.json): 233/233 downloaded JavaScript modules match the local build; 5/5 served static files match source; deployment annotation contains the full source commit/tree.
- Main staging remains version `111d84f5-e284-4f31-85e7-5000071cca21`. No main merge, production deployment, force push or real student data.
- Evidence publication commits after the deployed source add documentation, proof, stronger authorization tests and the read-only provenance script; they do not change product runtime.

## Authorization and atomicity

Issue #81 [approval](https://github.com/dekorix/cza-akademi/issues/81#issuecomment-6105245576) authorizes an additive QA-only `can_link_assessment boolean NOT NULL DEFAULT false`. The session additionally authorized the one missing synthetic relationship and the separate immutable audit migration.

Only the exact active, same-academy, is_demo=true relation was enabled:

- Link: `f2020000-0000-4000-8000-000000000001`.
- Canonical educator: `17114480-0fbd-4468-ab57-06d559579c07`.
- Existing student: `20000000-0000-4000-8000-000000000001`.
- Academy: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`.

The three pre-existing teacher/student relationships retain their original can_view/can_coach values. No student was inserted. Backup checkpoint `br-frosty-cell-b1rbruz7` was created from the permitted Neon branch before migration at parent LSN `0/2E7A730`; the Neon snapshot API refused snapshots of non-root branches, so the no-compute checkpoint branch was used instead.

`POST /api/assessment-student-link` is QA-only and requires the real educator session, exact mutation origin and candidate ownership. Canonical educator role/activity, source academy/creator/source, target academy/activity/is_demo and can_view + can_link_assessment are rechecked on the server. can_coach is not interpreted as binding authority. The request must explicitly confirm the same target ID. The picker shows recorded name, institution, optional code and full Student ID; changing selection resets confirmation.

The fixed `cza_v02_bind_assessment` SQL function locks the canonical educator, target student, relationship and existing assessment row. One statement updates only student_id and inserts its audit. Same-target repetition returns the existing audit; another authorized target returns conflict (HTTP 409 at the route). Audit INSERT failure rolls back the UPDATE. Inactive/cancelled/wrong source and unauthorized targets are denied. Existing candidate/cycle metadata and assessment status are preserved. Candidate resume includes the already-linked existing session and never uses create as the linking operation.

Existing RLS initially hid target rows from the runtime, which failed the first real picker test. The correction uses fixed, tenant-scoped definer functions for eligible targets and linked history; RLS policies were not modified. All three functions enforce the exact QA project/branch/database, fixed search_path and static SQL, have no PUBLIC execute, and grant only scoped EXECUTE to the existing runtime role. Runtime users/students UPDATE and schema CREATE privileges remain false. Runtime has audit SELECT but no direct INSERT/UPDATE/DELETE/TRUNCATE. The audit trigger also denies update/delete/truncate. The original outbox and its event contract remain unchanged.

Function bodies match the live Neon definitions: [three exact body fingerprints](evidence/v02/neon-function-source-matches.json). [Permission/audit readback](evidence/v02/neon-permissions-audit.json) records the actual final state.

## Test evidence

| Check | Result | Evidence |
|---|---|---|
| V02 API authorization, confirmation, concurrency, repeated audit, evidence preservation, candidate resume/history | 13/13 PASS | [First-binding API](evidence/v02/api.json), [final-source API](evidence/v02/api-final-source.json) |
| Explicit permission revocation, then privileged restoration of the exact relation | 2/2 PASS | [Revocation](evidence/v02/api-revocation.json) |
| Desktop Chrome actual login, picker, confirmation, same session, reload, history, negative requests and revoked logout | PASS | [Desktop](evidence/v02/desktop.json), [confirmation](evidence/v02/desktop-confirmation.png), [restored](evidence/v02/desktop-restored.png) |
| Independent 390px mobile Chrome with the separate existing V01 session | PASS | [Mobile](evidence/v02/mobile.json), [confirmation](evidence/v02/mobile-confirmation.png), [restored](evidence/v02/mobile-restored.png) |
| Targeted V02/V01/QA/static intake tests | 36/36 PASS | [Tests](evidence/v02/targeted-tests.log) |
| Canonical persistence, PostgreSQL security, CI hardening and secret isolation | 32/32 PASS | [Security](evidence/v02/security.log) |
| Existing Assessment CI targeted suite | 167/167 PASS | [Regression](evidence/v02/assessment-regression.log) |
| Independent native PostgreSQL connections: different-target loser blocks then conflicts; same-target repeat; concurrent revocation; audit rollback; restricted runtime functions | 5/5 PASS | [Local PostgreSQL 18.4](evidence/v02/native-postgres-concurrency.json), [GitHub PostgreSQL 18.6](evidence/v02/github-native-postgres.json) |
| TypeScript and build without mounted DB/Cloudflare secrets | PASS | [Type check](evidence/v02/typecheck.log), [Build](evidence/v02/build.log) |
| Deployed source GitHub CI, including security and native PostgreSQL | PASS | [Run 38111538157](https://github.com/dekorix/cza-akademi/actions/runs/38111538157), [receipt](evidence/v02/github-source-ci.json) |

Chrome used 136.0.7103.25, real provider login and TLS validation; no network mocks, cookie injection, certificate-ignore flags or system trust change. The previously approved user NSS trust was reused. Browser negative requests return missing-confirmation 400, cross-tenant 403, forged-header 401 and post-logout 401.

The QA contains one eligible existing student; no second student was created. Different **authorized** target contention was tested on isolated local and GitHub native PostgreSQL servers with two connections, not misreported as a two-target Neon test. Neon API tests cover same-target contention and the existing foreign-academy target denial. HTTP 409 mapping is covered by the route test and its underlying conflict is proven by the native database tests.

The first source's RLS picker failures are retained as [API diagnostic](evidence/v02/initial-api-rls-failure.json) and [Chrome diagnostic](evidence/v02/initial-desktop-rls-failure.json), not counted as PASS. CI run 38111227610 failed because the postgres.js test adapter encoded an already-stringified JSON parameter again; the test fixture now binds through text::jsonb. The corrected run above passed without weakening assertions.

## Read-only Neon preservation comparison

Target throughout: `patient-firefly-51111834` / `br-withered-queen-b15ltb40` / `cza_t5_synthetic`.

[Before](evidence/v02/neon-before.json), [after](evidence/v02/neon-after.json), [comparison](evidence/v02/neon-comparison.json):

- Total students: 2 → 2; total assessment sessions: 63 → 63.
- Existing desktop session `3db6ac62-aa10-44e5-b4fa-4f99fa599e0d`, API session `c0ab8deb-52f4-4b36-b95d-72c392d0c2b0` and mobile session `f825e4d0-c702-4a58-bb7a-7ec991940a89` each changed student_id from NULL to the same pre-existing student.
- Each keeps its exact candidateId/cycleId/sessionId and entire metadata.
- All attempt/observation row fingerprints match before/after; existing first answers and observations remain on the same sessions.
- Exactly one immutable audit per session, including educator, target, academy, candidate/cycle and timestamp; repeated/concurrent API calls create no second audit.
- [V01 source inventory](evidence/v02/v01-source-preservation.json): 250/252 pre-existing static/migration/test files byte-identical; only the two synchronized central-special-sync UI copies changed additively. No files/features removed, no unique-index migration reopened.

## Limits, blockers and rollback

No observed unresolved feature BLOCKER/HIGH remains after the corrected live and native tests. Independent security/architecture acceptance, including the narrow definer-function boundaries, is still outstanding. V03 and V06 remain outside this task.

A supplemental attempt to impersonate the runtime role through the connector's migration-owner SQL channel was denied by PostgreSQL SET ROLE permissions ([receipt](evidence/v02/runtime-permission-boundary.json)); no runtime mutation result is claimed for that attempt. Effective route denial and native restricted-role tests passed; existing runtime table grants and RLS were preserved.

The named governance/inventory scripts from a different local checkout do not exist at the mandated PR #73 base; they are N/A here, not PASS. The source inventory comparison and existing static regression gate passed.

Rollback: revoke only can_link_assessment on the exact newly authorized relation and return the QA Worker to its recorded previous version if required. Leave the additive permission column default false and retain immutable audit/session/evidence rows. Dropping or restoring the database wholesale is unnecessary and is not performed. A revoked permission was actually exercised and restored; SQL audit failure rollback was actually exercised on native PostgreSQL. No linked historical session was unlinked for testing.

Known fixture/password/cookie/DB URI/Cloudflare token scan has zero matches in published evidence and V02 scripts. Artifact fingerprints are in `evidence/v02/artifact-sha256.json`.

GENEL PROJE İLERLEME %=güvenilir toplam ölçüm yok

MEVCUT FAZ İLERLEME %=V01–V07 kabul zinciri 1/7 (%14,3); V02 mimari kabul bekliyor

TAMAMLANAN=QA permission/audit migration, atomik bağlantı, açık onay UI, Chrome masaüstü/mobil, API/Neon korunumu, native eşzamanlılık/rollback, güvenlik/regresyon/CI ve dağıtım kaynak kanıtları

KALAN=Baş Mimar'ın bağımsız V02 kabul kararı

KAPSAM SAPMASI=YOK

SIRADAKİ TEK ADIM=Baş Mimar'ın PR #87 ve değişmez kaynak/kanıt paketini bağımsız doğrulaması
