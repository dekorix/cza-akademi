import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync('app/api/assessment-special-linked/route.ts','utf8');
const sid='30000000-0000-4000-8000-000000000001';
function harness(actor='peer',view=true){
 const calls=[];const session={id:sid,student_id:'20000000-0000-4000-8000-000000000001',status:'active',metadata:{createdByEducatorId:'owner',academyId:'academy',profileCode:'SP-DYS'}};
 const sql=async(parts,...params)=>{const q=parts.join('?');calls.push(q);if(q.includes('assessment_attempts'))return[{answer_text:'al'}];if(q.includes('assessment_observations'))return[{educator_note:'unchanged'}];return[];};
 sql.query=async(q)=>{calls.push(q);assert.ok(q.includes('cza_v02_readable_students'));return view?[session]:[];};
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(n){if(n==='@neondatabase/serverless')return{neon:()=>sql};if(n==='@/lib/isolated-qa-auth')return{isolatedQaEnabled:()=>true,isolatedQaDatabaseAllowed:async()=>true};if(n==='@/lib/educator-auth')return{authenticatedEducator:async()=>({id:actor})};if(n==='@/lib/request-guard')return{allowRequest:async()=>({allowed:true})};if(n==='@/lib/special-assessment')return{sanitizeShortText:v=>v||'',isSpecialProfileCode:v=>v==='SP-DYS',sanitizeStringList:()=>[],normalizeSpecialEvidence:()=>({taskCode:'DYS-PH01',answerText:'al',payload:{},supportLevelNumber:0,selfCorrected:false,responseLatencyMs:0,totalResponseTimeMs:0})};throw Error(n);},Response,Request,TextEncoder,URL,process:{env:{DATABASE_URL:'local-test'}}});
 return{calls,post:action=>exports.POST(new Request('https://qa.invalid/api/assessment-special-linked',{method:'POST',body:JSON.stringify({action,sessionId:sid})}))};
}
test('P1 view-only peer reads get/report but attempt/finish never reach mutation',async()=>{
 const h=harness();for(const action of ['get','report'])assert.equal((await h.post(action)).status,200);
 for(const action of ['attempt','finish'])assert.equal((await h.post(action)).status,403);
 assert.ok(!h.calls.some(q=>/UPDATE|INSERT|DELETE/.test(q)));
});
test('P1 missing view denies read; original owner retains independent write gate',async()=>{
 assert.equal((await harness('peer',false).post('get')).status,404);
 const h=harness('owner');
 for(const action of ['attempt','finish'])assert.equal((await h.post(action)).status,200);
 assert.ok(h.calls.some(q=>q.includes('UPDATE public.assessment_attempts')));
 assert.ok(h.calls.some(q=>q.includes('UPDATE public.assessment_sessions')));
});
