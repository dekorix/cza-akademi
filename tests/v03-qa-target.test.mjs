import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
const origin='https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
function load(source,dependencies,env={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>dependencies[id],process:{env},URL,Date});return exports;}
const contract=load(fs.readFileSync('lib/qa-student-read-contract.ts','utf8'),{}).qaStudentReads;
const source=fs.readFileSync('lib/qa-student-read.ts','utf8');
const profileSource=ts.createSourceFile('profile.ts',fs.readFileSync('lib/persistence/student-learning-profile.ts','utf8'),ts.ScriptTarget.Latest,true);
let projection;function visit(n){if(!projection&&ts.isCallExpression(n)&&n.expression.getText(profileSource)==='sql.query')projection=n.arguments[0].text;ts.forEachChild(n,visit);}visit(profileSource);
function harness({enabled=true,target={role:'cza_v01_app_runtime_min',database:'cza_t5_synthetic',project:'patient-firefly-51111834',branch:'br-withered-queen-b15ltb40'}}={}){
 const calls=[];const sql=async(strings,...values)=>{calls.push({text:strings.join('?'),values});return strings.join('').includes('current_user')?[target]:[{rows:[{id:'own'}]}];};
 const api=load(source,{'node:crypto':crypto,'@neondatabase/serverless':{neon:()=>sql},'@/lib/qa-student-read-contract':{qaStudentReads:contract},'@/lib/isolated-qa-auth':{isolatedQaEnabled:()=>enabled,QA_EDUCATOR_ORIGIN:origin},'@/lib/student-session':{readRequestCookie:()=> 'local-unit-token',STUDENT_COOKIE:'cza_student_session'}},{DATABASE_URL:'local-unit-only'});
 return{...api,calls,sql};
}
test('QA reads reject wrong origin, role, database, project and branch before projections',async()=>{
 const wrongOrigin=harness();await assert.rejects(wrongOrigin.studentReadSql(new Request('https://cza-akademi-staging.invalid/')),/target_rejected/);assert.equal(wrongOrigin.calls.length,0);
 for(const [key,value]of [['role','cza_t5_test_owner'],['database','production'],['project','foreign-project'],['branch','foreign-branch']]){
  const target={role:'cza_v01_app_runtime_min',database:'cza_t5_synthetic',project:'patient-firefly-51111834',branch:'br-withered-queen-b15ltb40',[key]:value};const h=harness({target});await assert.rejects(h.studentReadSql(new Request(origin)),/target_rejected/);assert.equal(h.calls.length,1);
 }
});
test('allowlisted QA projections send token hash, never caller student or academy selectors',async()=>{
 const h=harness();const sql=await h.studentReadSql(new Request(origin));const result=await sql.query(projection,['FOREIGN_ACADEMY','FOREIGN_STUDENT']);assert.equal(result[0].id,'own');const values=h.calls[1].values;
 assert.equal(values[0],crypto.createHash('sha256').update('local-unit-token').digest('hex'));assert.equal(values[1],'profile_1');assert.ok(!values.includes('FOREIGN_ACADEMY')&&!values.includes('FOREIGN_STUDENT'));
 await assert.rejects(sql.query('SELECT * FROM public.users'),/projection_rejected/);assert.equal(h.calls.length,2);
});
test('QA-disabled runtime keeps the existing Neon query and upstream login paths',async()=>{
 const h=harness({enabled:false});assert.equal(await h.studentReadSql(new Request('https://normal.invalid')),h.sql);assert.equal(await h.isolatedQaStudentLogin(new Request('https://normal.invalid'),'username','pin'),null);assert.equal(h.calls.length,0);
});
