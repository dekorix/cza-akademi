// CZA-VERTICAL-01: READ-ONLY Cloudflare deployment provenance.
// Uses GitHub's existing staging preview token. No writes, no deploys,
// no reading student records and no output of secret binding values.
const account = '8c23e36e747009ad8c8d0bdbda8d5606';
const worker = 'cza-akademi-staging';
const expectedPrefix = '111d84f5';
const token = process.env.CZA_STAGING_PREVIEW_API_TOKEN;

if (!token) {
  console.error('CZA_ACTIVE_WORKER_METADATA=BLOCKED;REASON=STAGING_TOKEN_UNAVAILABLE');
  process.exit(2);
}
async function getJson(path) {
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error('CZA_CLOUDFLARE_API=BLOCKED;HTTP_STATUS=' + response.status);
    process.exit(2);
  }
  const data = await response.json();
  if (!data?.success) {
    console.error('CZA_CLOUDFLARE_API=BLOCKED;REASON=REMOTE_API_REJECTED');
    process.exit(2);
  }
  return data.result;
}
const base = '/accounts/' + account + '/workers/scripts/' + worker;
const result = await getJson(base + '/deployments?per_page=3');
const list = Array.isArray(result) ? result : result?.deployments;
if (!Array.isArray(list) || list.length === 0) {
  console.error('CZA_ACTIVE_WORKER_METADATA=BLOCKED;REASON=NO_DEPLOYMENT');
  process.exit(2);
}
const latest = list[0]; // Cloudflare documents first as latest active deployment.
const activeVersions = latest?.versions || [];
if (activeVersions.length !== 1 || Number(activeVersions[0]?.percentage) !== 100) {
  console.error('CZA_ACTIVE_WORKER_METADATA=BLOCKED;REASON=MULTI_VERSION_TRAFFIC');
  process.exit(2);
}
const id = activeVersions[0].version_id;
if (!/^[0-9a-f-]{36}$/i.test(String(id))) {
  console.error('CZA_ACTIVE_WORKER_METADATA=BLOCKED;REASON=INVALID_VERSION_ID');
  process.exit(2);
}
const version = await getJson(base + '/versions/' + encodeURIComponent(id));
const bindings = version?.resources?.bindings;
const names = Array.isArray(bindings) ? bindings : null;
const dbBinding = names?.find(item => item.name === 'DATABASE_URL');
const authBinding = names?.find(item => item.name === 'CZA_NEON_AUTH_BASE_URL');
// Only whitelisted non-secret metadata can enter GitHub logs.
const etag = version?.resources?.script?.etag;
const safeEtag = typeof etag === 'string' && /^[a-f0-9]{16,128}$/i.test(etag)
  ? etag : 'UNAVAILABLE';
console.log('CZA_WORKER_NAME=' + worker);
console.log('CZA_ACTIVE_VERSION_ID=' + id);
console.log('CZA_ACTIVE_TRAFFIC_PERCENT=' + Number(activeVersions[0].percentage));
console.log('CZA_ACTIVE_SCRIPT_ETAG=' + safeEtag);
console.log('CZA_ACTIVE_DB_BINDING=' +
  (dbBinding ? (dbBinding.type === 'secret_text' ? 'SECRET_PRESENT' : 'UNEXPECTED_TYPE') : names ? 'MISSING' : 'METADATA_UNAVAILABLE'));
console.log('CZA_ACTIVE_AUTH_BINDING=' +
  (authBinding ? 'PRESENT' : names ? 'MISSING' : 'METADATA_UNAVAILABLE'));
console.log('CZA_DATABASE_URL_SECRET_VALUE=NOT_READ');
console.log('CZA_ACTIVE_DATABASE_ENDPOINT_MATCH=UNVERIFIED_RUNTIME_PROBE_REQUIRED');
if (!id.startsWith(expectedPrefix)) {
  console.error('CZA_ACTIVE_WORKER_METADATA=BLOCKED;REASON=VERSION_CHANGED_RECHECK');
  process.exit(2);
}
console.log('CZA_ACTIVE_WORKER_METADATA=PASS_READONLY');
