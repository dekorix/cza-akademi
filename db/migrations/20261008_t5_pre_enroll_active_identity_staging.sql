-- Approved for the isolated CZA staging DB only.
-- Run outside a transaction. Existing identity collisions must be checked first.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS assessment_sessions_pre_enroll_active_identity_uq
ON public.assessment_sessions (
  (metadata->>'academyId'),
  (metadata->>'createdByEducatorId'),
  (metadata->>'candidateId'),
  (metadata->>'cycleId'),
  template_code
)
WHERE student_id IS NULL AND status = 'active'
  AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
  AND metadata->>'candidateId' IS NOT NULL
  AND metadata->>'cycleId' IS NOT NULL;
