// CZA-VERTICAL-01: do not reveal any Cloudflare or Neon secrets.
// GET metadata only. An encrypted binding's presence is NOT proof of target.
const TOKEN=process.env.CZA_STAGING_PREVIEW_API_TOKEN;
const expectedUrl=process.env.CZA_STAGING_DATABASE_URL;
if(!TOKEN || !expectedUrl) {
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=INPUT_UNAVAILABLE');
  process.exit(2);
}
const BASE='https://api.cloudflare.com/client/v4/accounts/8c23e36e747009ad8c8d0bdbda8d5606/workers/scripts/cza-akademi-staging';
const header={Authorization:'Bearer '+TOKEN};
async function get(path){
  const response=await fetch(BASE+path,{method:'GET',headers:header,signal:AbortSignal.timeout(12000)});
  if(!response.ok) return {status:response.status,ok:false};
  const payload=await response.json();
  return {status:response.status,ok:payload.success===true,value:payload.result};
}
function target(value) {
  if(typeof value!=='string' || value.length>4096) return null;
  let u;
  try{u=new URL(value);}catch{return null;}
  if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname.endsWith('.neon.tech'))return null;
  return {host:u.hostname.toLowerCase(),database:u.pathname,role:decodeURIComponent(u.username)};
}
const expected=target(expectedUrl);
if(!expected || !expected.host.startsWith('ep-falling-resonance-b2qnvtwf')) {
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=INVALID_EXPECTED_TARGET');
  process.exit(2);
}
const deployments=await get('/deployments?per_page=2');
const ds=Array.isArray(deployments.value)?deployments.value:deployments.value?.deployments;
if(!deployments.ok || !Array.isArray(ds)||!ds.length){
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=DEPLOYMENT_METADATA_MISSING');
  process.exit(2);
}
const latest=ds[0], versions=latest?.versions;
if(!Array.isArray(versions)||versions.length!==1||Number(versions[0].percentage)!==100){
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=MULTI_VERSION_OR_UNSAFE_TRAFFIC');
  process.exit(2);
}
const active=versions[0].version_id;
if(active!=='111d84f5-e284-4f31-85e7-5000071cca21'){
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=ACTIVE_VERSION_CHANGED');
  process.exit(2);
}
const v=await get('/versions/'+encodeURIComponent(active));
if(!v.ok) {
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=VERSION_METADATA_UNAVAILABLE');
  process.exit(2);
}
const b=v.value?.resources?.bindings;
const bs=Array.isArray(b)?b:[];
const db=bs.find(x=>x.name==='DATABASE_URL');
if(!db || db.type!=='secret_text'){
  console.error('CZA_RUNTIME_DB_ATTESTATION=BLOCKED;REASON=VERSION_SECRET_ABSENT');
  process.exit(2);
}
console.log('CZA_ACTIVE_VERSION_CONFIRMED=YES');
console.log('CZA_ACTIVE_DB_BINDING_TYPE=SECRET_TEXT');
let candidate=target(db.text ?? db.value);
if(candidate) {
  const same=candidate.host===expected.host&&candidate.database===expected.database&&candidate.role===expected.role;
  console.log('CZA_VERSION_SCOPED_DATABASE_MATCH='+ (same?'PASS':'MISMATCH'));
  console.log('CZA_RUNTIME_DB_ATTESTATION='+(same?'PASS_VERSION_SCOPED':'BLOCKED_MISMATCH'));
  if(!same)process.exitCode=2;
}else{
  console.log('CZA_VERSION_SCOPED_DATABASE_MATCH=UNVERIFIED_ENCRYPTED');
  // A script-level secret GET may be newer than the active version.
  // It can support diagnostics, but MUST NOT be promoted to version-level PASS.
  const secret=await get('/secrets/DATABASE_URL');
  console.log('CZA_SCRIPT_LEVEL_SECRET_API_HTTP='+secret.status);
  if(secret.ok){
    const current=target(secret.value?.text??secret.value?.value);
    console.log('CZA_SCRIPT_LEVEL_SECRET_READBACK='+ (current?'TARGET_READABLE_BUT_VERSION_NOT_ATTESTED':'REDACTED'));
    if(current)console.log('CZA_SCRIPT_LEVEL_TARGET_MATCH='+
       (current.host===expected.host&&current.database===expected.database&&current.role===expected.role?'SUPPORTING_ONLY':'MISMATCH_NOT_VERSION_SCOPED'));
  }
  console.log('CZA_RUNTIME_DB_ATTESTATION=BLOCKED_VERSION_SECRET_OPAQUE');
}
// Deliberately never print URLs, hostname, DB credentials, source JSON,
// environment variables, version bindings, or HTTP body.
