const REQUIRED_CLAIMS = Object.freeze([
  'aud', 'repository', 'repository_id', 'repository_owner_id', 'environment', 'event_name',
  'ref', 'workflow_ref', 'job_workflow_ref', 'job_workflow_sha', 'sub',
]);

export function verifyP1NeonRuntimeClaims(actual, policy) {
  if (policy?.schemaVersion !== 'CZA-P1-NEON-RUNTIME-TRUST-V1') return false;
  if (policy?.authorizationAuthority !== 'RUNTIME_CREDENTIAL_BROKER_POLICY' || policy?.manifestOidcAuthorization !== false) return false;
  if (policy?.issuer !== 'https://token.actions.githubusercontent.com' || policy?.matchingMode !== 'EXACT_ALL_REQUIRED' || policy?.onAnyMismatch !== 'DENY') return false;
  if (!Array.isArray(policy?.forbiddenAuthorizationClaims) || !policy.forbiddenAuthorizationClaims.includes('workflow_sha')) return false;
  if (Object.hasOwn(policy?.claims || {}, 'workflow_sha')) return false;
  if (actual?.iss !== policy.issuer) return false;
  if (!policy.claims || Object.keys(policy.claims).length !== REQUIRED_CLAIMS.length) return false;
  for (const name of REQUIRED_CLAIMS) {
    if (!Object.hasOwn(policy.claims, name) || actual?.[name] !== policy.claims[name]) return false;
  }
  if (!/^[0-9a-f]{40}$/.test(policy.claims.job_workflow_sha)) return false;
  if (policy.claims.job_workflow_ref !== `dekorix/cza-akademi/.github/workflows/faz3-p1-neon-step1-reusable.yml@${policy.claims.job_workflow_sha}`) return false;
  if (policy.claims.workflow_ref !== 'dekorix/cza-akademi/.github/workflows/faz3-p1-provision.yml@refs/heads/feature/faz3-gate1b-v4') return false;
  if (policy.credential?.provider !== 'neon' || policy.credential?.environment !== 'staging') return false;
  if (policy.credential?.cloudflareCredentialsAllowed !== false || policy.credential?.productionEndpointsAllowed !== false) return false;
  return true;
}
