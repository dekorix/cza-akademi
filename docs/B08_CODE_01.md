# B08-CODE-01: pure MAT-01 evidence contract

This module implements the accepted B08-AI-REV1 qualitative contract for **local
synthetic review only**. It is not imported by application code. No API, UI,
existing evaluator, SQL, learning profile, recipe or motor is changed.

Authorization: issue #106 comment 6163243221. Design: comment 6163081902.
AI review protocol: issue #108. Sources and their immutable base checkpoint
are recorded in `B08_SOURCES`; curriculum alignment is scoped and source rights
remain `SOURCE_UNVERIFIED`. The contract/rubric labels are new review labels,
not a renaming of the legacy runtime evaluator or a publication approval.

## Functions and interpretation

- `classifyMat01A` recognizes a bounded, explicit-role grammar. Unlabelled `4,7`
  and `4 7` require review. An explicit decimal equality is incorrect; `40+7`
  alone is partial. Unrecognized plausible explanations are not guessed wrong.
- `evaluateMat01Evidence` checks source/rubric versions, response access,
  accommodation, assistance, phase and provenance. It preserves the original
  raw reference and text. S is supported only; correct number recognition is
  distinct from an observed conceptual relationship. B/T require separate
  educator-observation references and qualitative criteria. T additionally
  requires unseen variant/history/version and observed independence conditions.
- `evaluateMat01Collection` deduplicates raw refs. Conflicting replays or a second
  initial response require review; the original first response remains available.
  Different assessment scopes are not combined. MAT-01 remains one task family.
- All outputs have `score=null`, `mastery=INSUFFICIENT`, assignment blocked and
  delayed retention not assessed. Finger-reading produces a dedicated academic
  NO-GO reason without deleting or changing the motor.

References and educator provenance are **declared inputs**, not authenticated
facts. This pure library does not verify signatures, fetch source records,
authenticate reviewers or certify observation accuracy. A later authorized
runtime adapter would need those checks. An unobserved open response remains
unassessed; no automatic free-text B/T concept scoring or numeric rubric exists.
The optional prior evaluation stamp blocks cross-version silent reinterpretation;
it does not overwrite, persist or replace any historical record.

## Synthetic verification

Run `node tests/b08-mat01-evidence-contract.test.mjs` for individually reported
Node test cases covering every REV1 A/S/B/T/F/G scenario, including the integrated
initial-error / supported-success / unknown-transfer trajectory. Test inputs are
synthetic source labels and an artificial timestamp; no child/account/tenant data.
The test harness transpiles only the new pure module through a data URL.

Use `node_modules/.bin/tsc --noEmit`, `npm run lint`, and `npm run build` for the
repository checks. A scoped lint command can check just the two new source/test
files. Repository-wide failures must be compared to unchanged base and reported
honestly, without editing existing files. Local build must not deploy or use DB
or cloud credentials. Test logs and hashes are reported on issue #106.

`REAL_STUDENT_USE=BLOCKED`
`AUTO_ASSIGNMENT=BLOCKED`
`RUNTIME_NOT_WIRED=YES`
