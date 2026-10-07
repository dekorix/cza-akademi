# P2 T3 — linked session identity and outbox candidate

Base: `c4f22dd3d56265291fbd6014b77caa9ca31cbfd5` (closed T2).
Candidate only. No staging migration, deployment, or production action is authorized by this file.

For an existing canonical student, the authorized educator's linked P2 launch carries a UUID `assessmentCycleKey`. The browser keeps this key in session storage through uncertain responses and reloads, and clears it after receiving the canonical session. A later click gets a new request key but still resolves to the one initial session for that student and definition.

The existing `assessment_sessions` row receives nullable cycle key and type fields. Legacy rows keep NULL. The only admitted new type is `INITIAL`. A partial unique index on student, versioned template and cycle type prevents a second initial P2 session even when two tabs submit different keys. A future reassessment cycle requires a separate explicit product decision; this candidate does not silently create one. The linked route writes the session and one `P2_ASSESSMENT_SESSION_CREATED` outbox event in a single SQL statement and database transaction. Replay returns the same session, including its current lifecycle state, without inserting another event. If the pinned T2 definition changed, replay returns 409 and does not reinterpret the session. Outbox insert failure rolls back the session insert.

Outbox events are durable pending records; this candidate does not introduce a consumer, worker side effects, a baseline, or an evaluator. The unique session/event identity makes a future consumer's replay detectable. Registration-time creation of a student, obligation, session and outbox in one transaction remains an explicit integration boundary: this repository's linked route starts from an already persisted canonical student. It must not be represented as an atomic student-registration path.

Apply `20260929_t3_p2_assessment_session_outbox_v1.sql` in its own transaction before deploying code that reads or writes the cycle key and outbox. Check the exact staging schema and active source before traffic changes. Do not apply T3 as part of local candidate testing.
