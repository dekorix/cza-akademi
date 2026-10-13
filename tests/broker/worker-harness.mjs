// TEST ONLY transport replacement; production uses the real Neon HTTP driver.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const resolve=name=>require.resolve(name,{paths:[path.dirname(require.resolve('wrangler/package.json'))]});
export const {Miniflare}=await import(resolve('miniflare'));
const {build}=await import(resolve('esbuild'));
export async function bundle(entry,{mock=false}={}) {
 const replacements={
  'isolated-qa-auth.ts':`import {env} from 'cloudflare:workers';export const QA_EDUCATOR_ORIGIN='https://qa.local.invalid';export const QA_NEON_AUTH='https://provider.local.invalid/auth';export const isolatedQaEnabled=()=>true;export const isolatedQaDatabaseAllowed=async()=>true;export function qaAuthStage(){};`,
  'educator-auth.ts':`import{verifiedNeonIdentity}from '${path.resolve('lib/educator-neon-ingress.ts')}';export async function authenticatedEducator(r){const i=await verifiedNeonIdentity(r);return i?{id:i.id}:null;}`,
  'request-guard.ts':`import{env}from'cloudflare:workers';export async function allowRequest(){return(await env.TEST_RATE.fetch('https://rate.local.invalid')).json()}export const allowAccountRequest=allowRequest;export const rateLimited=()=>new Response(JSON.stringify({error:'rate_limited'}),{status:429,headers:{'retry-after':'1'}});`,
 };
 const neonMock=`import{env}from'cloudflare:workers';export function neon(value){if(value!=='LOCAL_TEST_ONLY')throw Error('test_transport_only');return{query:(text,params)=>({text,params}),transaction:async(queries,options)=>{const r=await env.TEST_DATABASE.fetch('https://db.local.invalid',{method:'POST',body:JSON.stringify({queries,options})});const data=await r.json();if(!r.ok){const e=new Error('database_unavailable');e.code=data.code;throw e}return data.results}}}`;
 const plugins=mock?[{name:'local-only-transports',setup(b){b.onResolve({filter:/^@neondatabase\/serverless$/},()=>({path:'neon-mock',namespace:'local-test'}));b.onLoad({filter:/.*/,namespace:'local-test'},()=>({contents:neonMock,loader:'js'}));b.onLoad({filter:/(isolated-qa-auth|educator-auth|request-guard)\.ts$/},args=>({contents:replacements[path.basename(args.path)],loader:'js'}));}}]:[];
 const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'browser',format:'esm',external:['cloudflare:workers','node:crypto'],plugins,logLevel:'silent'});
 let text=result.outputFiles[0].text;
 if(entry.startsWith('app/')) text+='\nexport default {fetch(request){return GET(request)}};';
 return text;
}
export function sourceGuards() {
 const example=fs.readFileSync('workers/qa-educator-broker/wrangler.example.jsonc','utf8');
 return{example,worker:fs.readFileSync('workers/qa-educator-broker/index.ts','utf8')};
}
