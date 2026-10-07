# P2 T2 staging acceptance checkpoint

Decision: T2 staging acceptance PASS, closed by the Decision Organ on 2026-09-29.
Source commit: `c4f22dd3d56265291fbd6014b77caa9ca31cbfd5`
Source tree: `a3968ba0613ce5871f0ea200e781fbc961e6a106`
Staging Worker: `cza-akademi-staging`, version `71d2abb1-d647-4725-84c7-f64af5577a9a` at 100%.
Staging database: `hidden-glade-66748043` / `br-ancient-bread-b2puable` / `cza_learning`.

The exact `20260929_t2_p2_assessment_definition_contract_v1.sql` was committed atomically before the Worker traffic changed. A new session returned `current`; a legacy session returned `legacy_unversioned`. A mismatched session returned 409 on assessment read, and the educator report emitted no routing or recommendation for it. The temporary synthetic acceptance sessions were removed after verification; the eight preexisting sessions remained legacy. Production was not accessed or approved.

Separate open record: `F4_PILOT_HISTORY_PARITY=PENDING`. T2 closure does not change its status.
