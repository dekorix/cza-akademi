# P2 T2 — Versioned assessment definition contract

Base: `89714a80ed8a68c2c3d652cb3d68645ef16b0bcb` (T1 staging source).
This candidate has not been applied to staging.

The existing `assessment_sessions` row owns an immutable `definition_contract` JSONB value. No new assessment store is introduced. A new canonical linked P2 session pins `definitionId`, `assessmentVersion`, `blueprintId`, `blueprintVersion`, task mapping, rubric and answer-key version labels, the server evaluator identity, and SHA-256 digests of the existing task bank and routing rules.

The current evaluator identity is `NONE_CLIENT_REPORTED` version `0`. This is a provenance label, not a server scoring claim. T4 will define a real server evaluator. Client answers, correctness and timing do not become server-verified evidence here.

## Read and write behavior

A pinned session whose contract differs from the running source returns `409 assessment_definition_mismatch` for read, attempt, score, observe and finish. This prevents a changed task bank or routing rule from silently reinterpreting a pinned session. Existing sessions with no contract remain accessible under the T1 authorization rules, with `definitionStatus=legacy_unversioned` on reads. Such historical sessions cannot be retroactively proved versioned by this change.

The contract is immutable at the database update boundary. The migration adds one nullable column, a shape constraint, and an update trigger to the existing assessment table. Reapplying the migration preserves data and the contract. The linked-session route uses the existing canonical educator, academy and `can_view` checks.

## Application boundary

After independent audit, apply `20260929_t2_p2_assessment_definition_contract_v1.sql` in its own transaction **before** deploying code that writes `definition_contract`. Verify the migration and the active staging source before traffic changes. No T3–T7 behavior, staging SQL application, or deployment is part of this candidate.
