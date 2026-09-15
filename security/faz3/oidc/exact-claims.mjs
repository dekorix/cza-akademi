export const REQUIRED_CLAIMS = Object.freeze([
  'aud', 'repository_id', 'repository_owner_id', 'environment', 'event_name', 'ref',
  'head_ref', 'base_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha', 'sub',
]);

export function verifyExactClaims(actual, policy) {
  if (policy?.issuer !== 'https://token.actions.githubusercontent.com' || policy?.matchingMode !== 'EXACT_ALL' || policy?.onAnyMismatch !== 'DENY') return false;
  if (actual?.iss !== policy.issuer) return false;
  if (!policy.claims || Object.keys(policy.claims).some(name => !REQUIRED_CLAIMS.includes(name))) return false;
  for (const name of REQUIRED_CLAIMS) {
    if (!Object.hasOwn(policy.claims, name) || actual?.[name] !== policy.claims[name]) return false;
  }
  return true;
}
