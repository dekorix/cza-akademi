const STAGING_CORE_ROUTE =
  'https://cza-akademi-staging.cza-staging-habip.workers.dev/api/core';

export type GuardStage =
  | 'invalid_parameters'
  | 'trusted_edge_unconfigured'
  | 'cloudflare_context_missing'
  | 'client_address_unavailable'
  | 'database_unconfigured'
  | 'sql_call_failed'
  | 'sql_result_invalid'
  | 'quota_exceeded';

export function stagingDiagnosticsEnabled(requestUrl: URL): boolean {
  return (
    process.env.CZA_STAGING_RUNTIME_DIAGNOSTICS === '1' &&
    process.env.NODE_ENV === 'production' &&
    requestUrl.href === STAGING_CORE_ROUTE
  );
}

export function reportGuardStage(stage: GuardStage): void {
  console.info('k3e_guard_diagnostic', { stage });
}

const SAFE_PATH_SEGMENTS = new Set([
  'api',
  'student',
  'login',
  'auth',
  'sso',
  'verify',
  '_vercel',
  'deployment-protection',
]);

export function reportUpstreamRedirect(
  status: number,
  location: string | null,
  coreUrl: string,
): void {
  let host = 'unrecognized';
  let path = '/[masked]';
  try {
    const destination = new URL(location || '', coreUrl);
    const upstream = new URL(coreUrl);
    if (destination.protocol === 'https:') {
      if (
        destination.host === upstream.host ||
        destination.host === 'vercel.com'
      ) {
        host = destination.host;
      }
      const parts = destination.pathname.split('/').filter(Boolean);
      if (parts.length > 0 && parts.length <= 6) {
        path = `/${parts.map((part) => (SAFE_PATH_SEGMENTS.has(part) ? part : '[masked]')).join('/')}`;
      }
    }
  } catch {
    // Malformed Location is represented only by fixed labels.
  }
  console.info('k3e_upstream_redirect', { status, host, path });
}
