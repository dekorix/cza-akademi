// CZA-VERTICAL-01 staging-only preview runtime diagnostic.
// No student data, no DB query, no production/active deploy and no secret output.
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const mode=process.argv[2];
const workerName='cza-akademi-staging';
const account='8c23e36e747009ad8c8d0bdbda8d5606';
const activeId='111d84f5-e284-4f31-85e7-5000071cca21';
const workdir=join(process.env.RUNNER_TEMP||'/tmp','cza-v01-diagnostic');
const diagPath='/__cza_v01_endpoint_attestation';
function canonical(value){
  if(typeof value!=='string'||value.length>4096)return null;
  try {
    const u=new URL(value);
    if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname.endsWith('.neon.tech'))return null;
    return u.hostname.toLowerCase()+'|'+u.pathname+'|'+decodeURIComponent(u.username);
  }catch{return null;}
}
function sha(value){return createHash('sha256').update(value).digest('hex');}
async function cfGet(path){
  const token=process.env.CZA_STAGING_PREVIEW_API_TOKEN;
  if(!token)throw new Error('TOKEN_UNAVAILABLE');
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
      '/workers/scripts/'+workerName+path,
      {method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('CLOUDFLARE_HTTP_'+response.status);
  const data=await response.json();
  if(!data.success)throw new Error('CLOUDFLARE_DENIED');
  return data.result;
}
async function checkActive(){
  const resp=await cfGet('/deployments?per_page=3');
  const dep=Array.isArray(resp)?resp:resp?.deployments;
  const versions=dep?.[0]?.versions;
  if(!Array.isArray(versions)||versions.length!==1||
      versions[0].version_id!==activeId||Number(versions[0].percentage)!==100)
    throw new Error('ACTIVE_TRAFFIC_CHANGED');
}
function saveEnv(key,val){appendFileSync(process.env.GITHUB_ENV,key+'='+val+'\n');}
try{
  if(mode==='generate'){
    await checkActive();
    const expected=canonical(process.env.CZA_STAGING_DATABASE_URL);
    if(!expected||!expected.startsWith('ep-falling-resonance-b2qnvtwf'))throw new Error('EXPECTED_TARGET_INVALID');
    mkdirSync(workdir,{recursive:true,mode:0o700});
    const nonce=randomBytes(32).toString('hex');
    const parts=expected.split('|');
    const worker=[
      'const expectedHostHash='+JSON.stringify(sha(parts[0]))+';',
      'const expectedDbHash='+JSON.stringify(sha(parts[1]))+';',
      'const expectedRoleHash='+JSON.stringify(sha(parts[2]))+';',
      'const nonce='+JSON.stringify(nonce)+';',
      'async function digest(value){',
      " const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));",
      " return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');",
      '}',
      'export default {async fetch(request,env){',
      ' const url=new URL(request.url);',
      ' if(request.method!=="POST" || url.pathname!=='+JSON.stringify(diagPath)+
        ' || request.headers.get("x-cza-v01-nonce")!==nonce) return new Response("Not Found",{status:404});',
      ' if(!env.DATABASE_URL||typeof env.DATABASE_URL!=="string")return new Response("{\\"proof\\":\\"MISSING\\"}",{status:503});',
      ' let target;',
      ' try{target=new URL(env.DATABASE_URL);}catch{return new Response("{\\"proof\\":\\"INVALID_URL\\"}",{status:503});}',
      ' if(!["postgres:","postgresql:"].includes(target.protocol)||!target.hostname.endsWith(".neon.tech"))return new Response("{\\"proof\\":\\"INVALID_TARGET\\"}",{status:503});',
      ' const hostMatch=(await digest(target.hostname.toLowerCase()))===expectedHostHash;',
      ' const dbMatch=(await digest(target.pathname))===expectedDbHash;',
      ' const roleMatch=(await digest(decodeURIComponent(target.username)))===expectedRoleHash;',
      ' return new Response(JSON.stringify({hostMatch,dbMatch,roleMatch}),{headers:{"content-type":"application/json","cache-control":"no-store"}});',
      '}};',
      ''
    ].join('\n');
    writeFileSync(join(workdir,'worker.mjs'),worker,{mode:0o600});
    writeFileSync(join(workdir,'wrangler.toml'),
      'name = "'+workerName+'"\nmain = "worker.mjs"\ncompatibility_date = "2026-10-01"\nworkers_dev = true\n',
      {mode:0o600});
    saveEnv('CZA_V01_AUDIT_DIR',workdir);
    writeFileSync(join(workdir,'nonce.txt'),nonce,{mode:0o600});
    console.log('CZA_PROBE_SOURCE_GENERATED=YES');
    console.log('CZA_SECRET_URL_NOT_LOGGED=YES');
  }else if(mode==='verify'){
    const log=readFileSync(join(workdir,'upload.log'),'utf8');
    const match=log.match(/Worker Version ID:\s*([a-f0-9-]{36})/i);
    if(!match)throw new Error('PREVIEW_VERSION_NOT_FOUND');
    const previewId=match[1];
    if(previewId===activeId)throw new Error('PREVIEW_EQUALS_ACTIVE');
    const resource=await cfGet('/versions/'+encodeURIComponent(previewId));
    const bindings=resource?.resources?.bindings;
    if(!Array.isArray(bindings)||!bindings.some(x=>x.name==='DATABASE_URL'&&x.type==='secret_text'))
      throw new Error('PREVIEW_SECRET_MISSING');
    await checkActive();
    const url='https://'+previewId.slice(0,8)+'-'+workerName+'.cza-staging-habip.workers.dev'+diagPath;
    let proof=null;
    for(let i=0;i<7;i++){
      try{
        const response=await fetch(url,{method:'POST',
          headers:{'x-cza-v01-nonce':readFileSync(join(workdir,'nonce.txt'),'utf8'),'content-type':'application/json'},
          body:'{}',signal:AbortSignal.timeout(12000)});
        if(response.status===200){proof=await response.json();break;}
      }catch{}
      await new Promise(res=>setTimeout(res,2500));
    }
    if(proof===null)throw new Error('PREVIEW_PROBE_NOT_READY');
    await checkActive();
    console.log('CZA_AUDIT_PREVIEW_VERSION='+previewId);
    console.log('CZA_ACTIVE_VERSION_UNCHANGED=YES');
    console.log('CZA_ACTIVE_TRAFFIC=100_PERCENT_ORIGINAL');
    console.log('CZA_PREVIEW_SECRET_BINDING=INHERITED');
    console.log('CZA_PREVIEW_ENDPOINT_MATCH='+ (proof.hostMatch===true?'PASS':'MISMATCH'));
    console.log('CZA_PREVIEW_DATABASE_NAME_MATCH='+ (proof.dbMatch===true?'PASS':'MISMATCH'));
    console.log('CZA_PREVIEW_DATABASE_ROLE_MATCH='+ (proof.roleMatch===true?'PASS':'MISMATCH'));
    console.log('CZA_ACTIVE_OLD_VERSION_DB_ENDPOINT_MATCH=NOT_DIRECTLY_ATTESTED');
    if(!proof.hostMatch||!proof.dbMatch||!proof.roleMatch)process.exitCode=2;
  }else throw new Error('UNKNOWN_MODE');
}catch(e){
  console.error('CZA_PREVIEW_DIAGNOSTIC=BLOCKED;REASON='+String(e.message).replace(/[^A-Z0-9_]/g,'_').slice(0,90));
  process.exitCode=2;
}