# V02 authorization precheck

Status: authority approved by issue #81 comment 6105245576; implementation in progress. V02_ACCEPTED=NO.

Source: PR #73 HEAD 5011469f8f9afa18c020b0ce88506059a711cf99,
tree 389a151d0721df1311645d7080e9771847688578.
V01 checkpoint 7b631ab8 is an ancestor. Development branch:
feat/v02-candidate-student-link. No reset, rebase or force push.

Read-only schema inspection on patient-firefly-51111834 /
br-withered-queen-b15ltb40 / cza_t5_synthetic confirms all seven requested
tables and the existing assessment_sessions.student_id column.
teacher_student_links contains can_view and can_coach; no explicit binding
permission and no column comments establishing binding authority.

Evidence in source:
- lib/persistence/coaching-center.ts resolveEducatorCoachingActor: can_view
  gates reads; write=true additionally requires can_coach.
- db/migrations/20260918_u8_coaching_core_v1.sql: can_coach defaults false
  and belongs to the U8 coaching core.
- tests/u8-coaching-core-postgres.test.mjs: tests enforce coaching writes
  separately from viewing. Neither contract grants identity binding.

Smallest proposed authorization change: add can_link_assessment boolean
NOT NULL DEFAULT false to the existing teacher_student_links relation.
Require both can_view and can_link_assessment, active canonical educator,
active same-academy target, and source candidate creator/academy checks.
No implicit grant from can_coach. Enable only specifically authorized
synthetic QA relations after review. No new student identity is created.

Permission migration applied only to isolated QA after checkpoint br-frosty-cell-b1rbruz7.
One explicitly approved new synthetic relation: f2020000-0000-4000-8000-000000000001,
teacher 17114480-0fbd-4468-ab57-06d559579c07, student 20000000-0000-4000-8000-000000000001.
All existing can_view/can_coach permissions retained. Separate audit migration approved
in this session. Runtime users/students UPDATE privileges remain false; fixed SQL
SECURITY DEFINER binding function has an immutable QA project/branch/database guard,
fixed search_path, no dynamic SQL, no PUBLIC execute and explicit runtime EXECUTE.

After authority is established, implement a single atomic transaction:
lock canonical educator, target student, permission relation and existing
assessment session; recheck authority; compare-and-set student_id; insert
one immutable binding audit row in a separate V02 table. Repeat to the same
target returns the original audit; a different target returns 409.
Audit insert failure rolls back the link. Retain candidate/cycle metadata;
update candidate resume lookup so a linked candidate cannot create a new
session. Existing answers, observations, outbox and cycle remain untouched.
The P2_ASSESSMENT_SESSION_CREATED outbox event is not reused.

Completed evidence is recorded in CZA_V02_DELIVERY_20261011.md; V02_ACCEPTED remains NO.
